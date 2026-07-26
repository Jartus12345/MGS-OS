const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const { pool, q, init } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
let _anthropic = null;
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'mgs-os-secret-change-in-prod-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// ── Auth middleware ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  res.redirect('/login');
}

// ── Pages ─────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await q.userByEmail((email || '').toLowerCase().trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.redirect('/login?error=1');
    }
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    res.redirect('/');
  } catch (e) {
    console.error('Login error:', e.message);
    res.redirect('/login?error=1');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ── API: Clients ────────────────────────────────────────────
app.get('/api/clients', requireAuth, async (req, res) => {
  try { res.json(await q.allClients()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clients/:key', requireAuth, async (req, res) => {
  try {
    const c = await q.clientByKey(req.params.key);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/clients/:key', requireAuth, async (req, res) => {
  try {
    const c = await q.clientByKey(req.params.key);
    if (!c) return res.status(404).json({ error: 'Not found' });
    await q.updateClient({ ...c, ...req.body, key: req.params.key });
    res.json(await q.clientByKey(req.params.key));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── API: Tab data ───────────────────────────────────────────────
app.get('/api/clients/:key/tabs/:tab', requireAuth, async (req, res) => {
  try {
    const row = await q.tabData(req.params.key, req.params.tab);
    res.json(row ? JSON.parse(row.data) : {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clients/:key/tabs/:tab', requireAuth, async (req, res) => {
  try {
    await q.upsertTab(req.params.key, req.params.tab, JSON.stringify(req.body));
    res.json({ ok: true });
    // Run archive sweep in background after delivery tab changes
    if (req.params.tab === 'delivery') {
      archiveOldTasks(req.params.key).catch(() => {});
      archiveCompletedCalendar(req.params.key).catch(() => {});
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Document cycle helpers ──────────────────────────────────────────────────────
const CYCLE_DOC_TYPES = ['strategy', 'planable_report', 'scorecard', 'content_calendar'];

// Map AI classification types to cycle document types
const CLASSIFICATION_TO_CYCLE = {
  strategy: 'strategy',
  planable: 'planable_report',
  scorecard: 'scorecard',
  content_calendar: 'content_calendar'
};

const CYCLE_LABELS = {
  strategy: 'Quarterly strategy',
  planable_report: 'Planable report',
  scorecard: 'Digital Credibility Scorecard',
  content_calendar: 'Content calendar'
};

function addCalendarMonths(dateStr, months) {
  const d = new Date(dateStr);
  const targetMonth = d.getMonth() + months;
  const year = d.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  // Clamp to last valid day of target month
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(d.getDate(), lastDay);
  return new Date(year, month, day);
}

function calcCycleStatus(cycle, nowDate) {
  const today = nowDate || new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (!cycle.last_uploaded_at || !cycle.next_due_at) {
    return { status: 'not_started', lastUploadedAt: null, nextDueAt: null, daysUntilDue: null, daysOverdue: 0, frequencyMonths: cycle.frequency_months };
  }

  const nextDue = new Date(cycle.next_due_at);
  const nextDueStr = nextDue.toISOString().slice(0, 10);
  const diffMs = nextDue - new Date(todayStr);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let status;
  if (diffDays > 7) status = 'current';
  else if (diffDays > 0) status = 'due_soon';
  else if (diffDays === 0) status = 'due_today';
  else status = 'overdue';

  return {
    status,
    lastUploadedAt: cycle.last_uploaded_at,
    nextDueAt: nextDueStr,
    daysUntilDue: diffDays > 0 ? diffDays : 0,
    daysOverdue: diffDays < 0 ? Math.abs(diffDays) : 0,
    frequencyMonths: cycle.frequency_months,
    lastSourceFilename: cycle.last_source_filename || null
  };
}

// ── API: Document cycles ────────────────────────────────────────────────────────
app.get('/api/clients/:key/document-cycles', requireAuth, async (req, res) => {
  try {
    const rows = await q.docCycles(req.params.key);
    const cycles = {};
    for (const docType of CYCLE_DOC_TYPES) {
      const row = rows.find(r => r.document_type === docType) || { document_type: docType, frequency_months: { strategy: 3, planable_report: 1, scorecard: 6, content_calendar: 1 }[docType] };
      const statusData = calcCycleStatus(row);
      cycles[docType] = { documentType: docType, label: CYCLE_LABELS[docType], ...statusData };
    }
    const overdueCount = Object.values(cycles).filter(c => c.status === 'overdue').length;
    const dueSoonCount = Object.values(cycles).filter(c => c.status === 'due_soon' || c.status === 'due_today').length;
    res.json({ clientKey: req.params.key, cycles, summary: { overdueCount, dueSoonCount, hasWarning: overdueCount > 0 || dueSoonCount > 0 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── API: PDF upload & AI extraction ────────────────────────────────────────────
const EXTRACTION_PROMPT = `You are a data extraction assistant for MGS OS, a marketing agency client dashboard.

Analyse this PDF report and extract all relevant data. First identify what type of document it is, then extract the appropriate data.

DOCUMENT TYPES — identify the type FIRST before extracting:
- "content_calendar": A content calendar, posting schedule, or social media plan. Contains a list of posts/content pieces with due dates, titles, descriptions, and requirements. Organised by week, date, or post number. THIS IS NOT a strategy document. Key signals: post numbers (Post 1, Post 2…), due dates per post, content briefs, approval requirements, social media captions.
- "task_list": A document describing one or more tasks, deliverables, or work items for the client. Could be a website brief, page design spec, copywriting brief, brand asset request, logo brief, photography brief, print/design job, etc. Key signals: a list of things to do or deliver, descriptions of work, deadlines, requirements. Use this when the document is clearly a task or brief rather than a performance report or strategy. Also set a "section" field: "website" if the tasks relate to a website, web pages, SEO, or digital; "brand" if they relate to brand identity, design assets, print, photography, copywriting, or visual work. If genuinely mixed or unclear, pick the closest fit.
- "planable": A Planable social media analytics/performance report. Contains metrics like impressions, engagements, followers, reach, page views, posts published, audience data, top performing content, engagement rates, follower growth. Key signal: numerical performance data, charts, statistics.
- "scorecard": A Digital Credibility Scorecard. Contains scores out of 5 for individual metrics grouped into Brand, Marketing & Communications, and Website & Digital. Total score out of 75.
- "strategy": A strategy document or sprint brief. Contains commercial objectives, desired perceptions, long-term strategy, workstreams, sprint goals. Does NOT include content calendars or posting schedules.
- "unknown": Cannot determine type.

IMPORTANT: A content calendar with posts and due dates is ALWAYS "content_calendar", never "strategy".
IMPORTANT: A website brief, page spec, or list of website/brand deliverables is ALWAYS "task_list", never "strategy".

Return ONLY a single valid JSON object. No explanation, no markdown, just the JSON.

If type is "planable", return:
{
  "type": "planable",
  "period": "reporting period e.g. June 2025",
  "tabs_updated": ["overview", "progress"],
  "overview": {
    "stats": [
      {"label": "Impressions", "value": "32,952", "sub": "↑ 222% vs prior period", "color": "#27500A"},
      {"label": "Engagements", "value": "8,112", "sub": "↑ 788% vs prior period", "color": "#185FA5"},
      {"label": "Followers", "value": "727", "sub": "↑ 137 new", "color": ""},
      {"label": "Delivery score", "value": "92%", "sub": "No overdue tasks", "color": "#27500A"}
    ],
    "top_content": [
      {"name": "Post or content name", "value": "3,820", "tag": "impr.", "tag_bg": "#EAF3DE", "tag_col": "#27500A"}
    ]
  },
  "progress": {
    "metrics": [
      {"label": "Impressions", "value": "32,952", "tag": "↑222%", "tag_bg": "#EAF3DE", "tag_col": "#27500A"},
      {"label": "Engagements", "value": "8,112", "tag": "↑788%", "tag_bg": "#EAF3DE", "tag_col": "#27500A"},
      {"label": "Followers", "value": "727", "tag": "+137", "tag_bg": "#EAF3DE", "tag_col": "#27500A"},
      {"label": "Page views", "value": "494", "tag": "↑141%", "tag_bg": "#EAF3DE", "tag_col": "#27500A"},
      {"label": "Posts published", "value": "17", "tag": null, "tag_bg": null, "tag_col": null},
      {"label": "Senior audience", "value": "57.2%", "tag": null, "tag_bg": null, "tag_col": null}
    ],
    "geography": [
      {"label": "Isle of Man", "pct": 100, "val": "71.8%", "color": "#185FA5"}
    ]
  }
}

For tag colour coding: if a metric increased use tag_bg "#EAF3DE" tag_col "#27500A". If decreased use tag_bg "#FCEBEB" tag_col "#791F1F". If neutral/no change use null for both.
For stat colour: increases "#27500A", decreases "#E24B4A", neutral "".
Include ALL metrics you can find in the PDF. Extract geography/audience data if present. Extract top performing posts if present.

If type is "scorecard", return:
{
  "type": "scorecard",
  "tabs_updated": ["brand"],
  "brand": {
    "scorecard_client": "client name if visible",
    "scorecard_date": "date if visible",
    "overall": 43,
    "overall_max": 75,
    "overall_label": "Developing · 26–50 range",
    "overall_col": "#EF9F27",
    "sections": [
      {"label": "Brand", "score": 13, "max": 25, "bg": "#F1EFE8", "col": "#EF9F27"},
      {"label": "Marketing & comms", "score": 13, "max": 25, "bg": "#F1EFE8", "col": "#EF9F27"},
      {"label": "Website & digital", "score": 17, "max": 25, "bg": "#EAF3DE", "col": "#27500A"}
    ],
    "metrics": [
      {"section": "Brand — 13/25", "items": [
        {"name": "Visual identity", "score": 3, "col": "#639922"},
        {"name": "Consistency across channels", "score": 2, "col": "#E24B4A"},
        {"name": "Tone of voice", "score": 3, "col": "#639922"},
        {"name": "Thought leadership", "score": 2, "col": "#E24B4A"},
        {"name": "Company culture demonstrated", "score": 3, "col": "#639922"}
      ]},
      {"section": "Marketing & comms — 13/25", "items": [
        {"name": "Social media presence", "score": 2, "col": "#E24B4A"},
        {"name": "Content quality & relevance", "score": 2, "col": "#E24B4A"},
        {"name": "Stakeholder messaging", "score": 3, "col": "#639922"},
        {"name": "Reputation signals", "score": 3, "col": "#639922"},
        {"name": "Engagement levels", "score": 3, "col": "#639922"}
      ]},
      {"section": "Website & digital — 17/25", "items": [
        {"name": "Website design", "score": 4, "col": "#639922"},
        {"name": "Website compliance", "score": 3, "col": "#639922"},
        {"name": "Customer experience / UX", "score": 3, "col": "#639922"},
        {"name": "Site speed", "score": 5, "col": "#639922"},
        {"name": "Site visibility / SEO", "score": 2, "col": "#E24B4A"}
      ]}
    ],
    "recommendations": [
      {"title": "Recommendation title", "body": "Detail of recommendation"}
    ],
    "rescore_reminder": "Next scorecard due in 6 months"
  }
}

For scorecard section colour coding: score/max >= 0.7 use bg "#EAF3DE" col "#27500A", otherwise bg "#F1EFE8" col "#EF9F27".
For metric item colour: score >= 4 use "#639922", score >= 3 use "#EF9F27", score < 3 use "#E24B4A".
For overall colour: score >= 51 use "#639922", score >= 26 use "#EF9F27", else "#E24B4A".
Overall label: 0-25 "Needs development · 0–25 range", 26-50 "Developing · 26–50 range", 51-65 "Established · 51–65 range", 66-75 "Leading · 66–75 range".

If type is "content_calendar", return:
{
  "type": "content_calendar",
  "period": "July 2026",
  "tabs_updated": ["delivery"],
  "delivery": {
    "weeks": [
      {
        "label": "Week 1 — 1–7 Jul",
        "tasks": [
          {"status": "", "text": "Post title or caption summary", "desc": "Full post description, brief, or caption from the PDF", "date": "01 Jul", "points": 1},
          {"status": "", "text": "Another post title", "desc": "Description of what this post should contain", "date": "03 Jul", "points": 1}
        ]
      },
      {
        "label": "Week 2 — 8–14 Jul",
        "tasks": [
          {"status": "", "text": "Post title", "desc": "Post description or brief", "date": "10 Jul", "points": 1}
        ]
      }
    ]
  }
}

Group posts by calendar week. Set status to "" (empty string, not done). Set points to 1 for every post. Use the post title as text. Put the full post description, brief, caption, or content notes in desc. Format date as "DD Mon" (e.g. "14 Jul"). Include ALL posts found in the document. Omit desc only if truly no description exists.

If type is "task_list", return:
{
  "type": "task_list",
  "section": "website",
  "period": "July 2026",
  "tabs_updated": ["delivery"],
  "tasks": [
    {"status": "", "text": "Short task title", "desc": "Full description of the task, requirements, and any notes from the document", "date": "31 Jul", "points": 3},
    {"status": "", "text": "Another task", "desc": "Description", "date": "", "points": 2}
  ]
}

Set section to "website" or "brand" as described above. Extract every task or deliverable mentioned. Use a short title as text and put all detail in desc. Estimate points importance 1–5 based on how large or significant the task appears (1=minor, 5=major deliverable). If a due date is mentioned use "DD Mon" format, otherwise leave date as "". Set status to "" for all tasks.

If type is "strategy", return:
{
  "type": "strategy",
  "tabs_updated": ["strategy", "sprints"],
  "strategy": {
    "hierarchy": [
      {"num": 1, "bg": "#F1EFE8", "col": "#444441", "name": "Commercial objective", "desc": "extracted objective"},
      {"num": 2, "bg": "#E6F1FB", "col": "#0C447C", "name": "Desired perception", "desc": "extracted perception"},
      {"num": 3, "bg": "#E1F5EE", "col": "#085041", "name": "Long-term strategy", "desc": "extracted strategy"},
      {"num": 4, "bg": "#EAF3DE", "col": "#27500A", "name": "Current sprint", "desc": "current sprint summary"},
      {"num": 5, "bg": "#FAEEDA", "col": "#633806", "name": "Next sprint", "desc": "next sprint summary", "border": true}
    ],
    "workstreams": [
      {"label": "workstream name", "pct": 50, "color": "#EF9F27", "val": "In progress", "val_col": "#EF9F27"}
    ],
    "perceptions": [
      {"label": "perception target", "pct": 0, "color": "#EF9F27", "val": "0%", "val_col": "#EF9F27"}
    ]
  },
  "sprints": {
    "sprints": [
      {
        "title": "Sprint 1 — name",
        "period": "Month range",
        "status": "Planning",
        "status_bg": "#E6F1FB",
        "status_col": "#185FA5",
        "border_col": "#185FA5",
        "bar_pct": 0,
        "bar_col": "#185FA5",
        "body": "Sprint description",
        "tasks": [{"done": false, "text": "task description"}]
      }
    ]
  }
}

Extract as much detail as possible from the document. If a field is not present in the document, omit it rather than guessing.`;

async function extractPDF(buffer) {
  const base64 = buffer.toString('base64');
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: EXTRACTION_PROMPT }
      ]
    }]
  });
  const text = response.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in AI response');
  return JSON.parse(match[0]);
}

async function applyExtraction(clientKey, extracted) {
  const updated = [];

  if (extracted.type === 'planable') {
    const existingOv = await q.tabData(clientKey, 'overview');
    const ov = existingOv ? JSON.parse(existingOv.data) : {};
    if (extracted.overview?.stats) ov.stats = extracted.overview.stats;
    if (extracted.overview?.top_content) ov.top_content = extracted.overview.top_content;
    await q.upsertTab(clientKey, 'overview', JSON.stringify(ov));
    updated.push('overview');

    const existingPr = await q.tabData(clientKey, 'progress');
    const pr = existingPr ? JSON.parse(existingPr.data) : {};
    if (extracted.progress?.metrics) pr.metrics = extracted.progress.metrics;
    if (extracted.progress?.geography) pr.geography = extracted.progress.geography;
    await q.upsertTab(clientKey, 'progress', JSON.stringify(pr));
    updated.push('progress');
  }

  if (extracted.type === 'scorecard' && extracted.brand) {
    await snapshotTabToArchive(clientKey, 'brand', 'scorecard_snapshot').catch(() => {});
    await q.upsertTab(clientKey, 'brand', JSON.stringify(extracted.brand));
    updated.push('brand');
  }

  if (extracted.type === 'task_list' && extracted.tasks?.length) {
    const existing = await q.tabData(clientKey, 'delivery');
    const del = existing ? JSON.parse(existing.data) : {};
    const section = extracted.section === 'brand' ? 'brand' : 'website';
    // Append to existing tasks (dedupe by text)
    const existing_tasks = del[section] || [];
    const newTexts = new Set(extracted.tasks.map(t => t.text));
    const merged = existing_tasks.filter(t => !newTexts.has(t.text)).concat(extracted.tasks);
    del[section] = merged;
    await q.upsertTab(clientKey, 'delivery', JSON.stringify(del));
    updated.push('delivery');
  }

  if (extracted.type === 'content_calendar' && extracted.delivery?.weeks?.length) {
    const existing = await q.tabData(clientKey, 'delivery');
    const del = existing ? JSON.parse(existing.data) : {};
    del.weeks = extracted.delivery.weeks;
    await q.upsertTab(clientKey, 'delivery', JSON.stringify(del));
    updated.push('delivery');
  }

  if (extracted.type === 'strategy') {
    if (extracted.strategy) {
      await snapshotTabToArchive(clientKey, 'strategy', 'strategy_snapshot').catch(() => {});
      await q.upsertTab(clientKey, 'strategy', JSON.stringify(extracted.strategy));
      updated.push('strategy');
    }
    if (extracted.sprints) {
      await q.upsertTab(clientKey, 'sprints', JSON.stringify(extracted.sprints));
      updated.push('sprints');
    }
  }

  return updated;
}

app.post('/api/clients/:key/upload', requireAuth, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const extracted = await extractPDF(req.file.buffer);
    const updated = await applyExtraction(req.params.key, extracted);

    // Update document cycle if this is a tracked recurring document type
    let cycleUpdate = null;
    const cycleDocType = CLASSIFICATION_TO_CYCLE[extracted.type];
    if (cycleDocType) {
      try {
        const now = new Date();
        const nextDue = addCalendarMonths(now.toISOString().slice(0, 10), { strategy: 3, planable_report: 1, scorecard: 6, content_calendar: 1 }[cycleDocType]);
        const nextDueStr = nextDue.toISOString().slice(0, 10);
        const filename = req.file.originalname || null;
        await q.upsertDocCycle(req.params.key, cycleDocType, now.toISOString(), nextDueStr, filename, extracted.type);
        await q.logUpload(req.params.key, cycleDocType, filename, extracted.type).catch(() => {});
        const row = { last_uploaded_at: now.toISOString(), next_due_at: nextDueStr, frequency_months: { strategy: 3, planable_report: 1, scorecard: 6, content_calendar: 1 }[cycleDocType], last_source_filename: filename };
        cycleUpdate = { documentType: cycleDocType, label: CYCLE_LABELS[cycleDocType], ...calcCycleStatus(row) };
      } catch (cycleErr) {
        console.error('Cycle update failed (non-fatal):', cycleErr.message);
      }
    }

    const typeLabels = { planable: 'Planable report', scorecard: 'Digital Credibility Scorecard', strategy: 'Strategy document', content_calendar: 'Content calendar', task_list: `Task list (${extracted.section||'delivery'})` };
    res.json({
      ok: true,
      type: extracted.type,
      type_label: typeLabels[extracted.type] || 'Document',
      period: extracted.period || null,
      tabs_updated: updated,
      cycle_update: cycleUpdate
    });
  } catch (e) {
    console.error('PDF extraction error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Chat context builders ──────────────────────────────────────────────────────
function buildDeliveryCtx(d) {
  if (!d || !Object.keys(d).length) return 'No delivery data.';
  const lines = [`Overdue tasks: ${d.overdue_count || 0}`];
  (d.weeks || []).forEach(w => {
    if (w.tasks?.length) {
      lines.push(`${w.label}:`);
      w.tasks.forEach(t => lines.push(`  [${t.status || 'pending'}] ${t.text}${t.date ? ' · ' + t.date : ''}`));
    }
  });
  if (d.website?.length) {
    lines.push('Website tasks:');
    d.website.forEach(t => lines.push(`  [${t.status || 'pending'}] ${t.text}${t.points ? ' · ' + t.points + 'pt' : ''}${t.date ? ' · ' + t.date : ''}`));
  }
  if (d.brand?.length) {
    lines.push('Brand tasks:');
    d.brand.forEach(t => lines.push(`  [${t.status || 'pending'}] ${t.text}${t.points ? ' · ' + t.points + 'pt' : ''}${t.date ? ' · ' + t.date : ''}`));
  }
  return lines.join('\n');
}
function buildStrategyCtx(d) {
  if (!d || !Object.keys(d).length) return 'No strategy data.';
  const lines = [];
  (d.hierarchy || []).forEach(h => lines.push(`${h.name}: ${h.desc}`));
  if (d.workstreams?.length) { lines.push('Workstreams:'); d.workstreams.forEach(w => lines.push(`  ${w.label}: ${w.val || w.pct + '%'}`)); }
  if (d.perceptions?.length) { lines.push('Perception targets:'); d.perceptions.forEach(p => lines.push(`  ${p.label}: ${p.val || p.pct + '%'}`)); }
  return lines.join('\n');
}
function buildSprintsCtx(d) {
  if (!d?.sprints?.length) return 'No sprint data.';
  return d.sprints.map(s => {
    const tasks = (s.tasks || []).map(t => `    [${t.done ? 'done' : 'pending'}] ${t.text}`).join('\n');
    return `${s.title} (${s.status}) — ${s.period}\n${s.body || ''}${tasks ? '\n' + tasks : ''}`;
  }).join('\n\n');
}
function buildProgressCtx(d) {
  if (!d?.metrics?.length) return 'No Planable metrics.';
  return d.metrics.map(m => `${m.label}: ${m.value}${m.tag ? ' ' + m.tag : ''}`).join('\n');
}
function buildBrandCtx(d) {
  if (!d || !Object.keys(d).length) return 'No scorecard data.';
  const lines = [`Overall: ${d.overall || 0}/${d.overall_max || 75} — ${d.overall_label || ''}`];
  (d.sections || []).forEach(s => lines.push(`  ${s.label}: ${s.score}/${s.max}`));
  (d.recommendations || []).forEach((r, i) => lines.push(`Recommendation ${i + 1}: ${r.title} — ${r.body}`));
  return lines.join('\n');
}
function buildContractCtx(d) {
  const c = d?.contract;
  if (!c) return 'No contract data set.';
  if (c.type === 'monthly') return 'Rolling monthly contract.';
  const typeLabel = c.type === '6mo' ? '6-month' : '12-month';
  if (!c.start_date) return `${typeLabel} contract — start date not set.`;
  const start = new Date(c.start_date);
  const months = c.type === '6mo' ? 6 : 12;
  const renewal = new Date(start); renewal.setMonth(renewal.getMonth() + months);
  const days = Math.round((renewal - new Date()) / (1000 * 60 * 60 * 24));
  return `${typeLabel} contract · Started ${start.toLocaleDateString('en-GB')} · Renews ${renewal.toLocaleDateString('en-GB')} (${days > 0 ? 'in ' + days + ' days' : Math.abs(days) + ' days overdue'})`;
}

// ── API: Chat (streaming SSE) ───────────────────────────────────────────────────
app.post('/api/clients/:key/chat', requireAuth, async (req, res) => {
  const { message, history } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'No message' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  try {
    const client = await q.clientByKey(req.params.key);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const tabNames = ['overview', 'strategy', 'sprints', 'delivery', 'progress', 'brand'];
    const tabs = {};
    for (const tab of tabNames) {
      try { const row = await q.tabData(req.params.key, tab); tabs[tab] = row ? JSON.parse(row.data) : {}; }
      catch(e) { tabs[tab] = {}; }
    }

    let cyclesText = 'No cycle data.';
    try {
      const cycles = await q.docCycles(req.params.key);
      cyclesText = cycles.map(c => {
        const s = calcCycleStatus(c);
        return `${c.document_type}: ${s.status}${s.daysOverdue > 0 ? ' (' + s.daysOverdue + 'd overdue)' : ''}${s.daysUntilDue > 0 ? ' (due in ' + s.daysUntilDue + 'd)' : ''}`;
      }).join('\n');
    } catch(e) {}

    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const systemPrompt = `You are MGS AI — the intelligent assistant built into MGS OS, the client delivery operating system for Manx Growth Solutions, a marketing agency based on the Isle of Man.

Today is ${today}.
Client: ${client.name} (${client.sub || ''})
Phase: ${client.phase || '—'} · Delivery score: ${client.score || '—'}

## YOUR JOB

You are a senior account strategist. You do not just report data — you interpret it. Your job is to:

1. **Lead with a clear verdict.** Open every response with one or two sentences that tell the user exactly where this client stands right now — ahead, on track, behind, or at risk. Don't hedge. Be direct.

2. **Explain the WHY behind scores.** If delivery is low, say what's causing it — which tasks are overdue, which weeks are behind, what's been missed. If it's high, explain what's going well and what's driving it. Never just state a number without explaining what's behind it.

3. **Connect delivery to strategy.** Look at the client's commercial objective and current sprint goal. Then assess whether current delivery is actually moving the needle on those goals, or whether work is happening but not aligned to what matters. Call this out explicitly.

4. **Be specific.** Reference actual task names, overdue items, dates, score breakdowns. Vague praise or generic summaries are useless. If a content calendar is behind, say which weeks are incomplete. If website tasks are stalling, name them.

5. **End with actions.** Always close with a short, prioritised list of what the team needs to do right now — not general advice, but specific next steps based on the actual data.

## RESPONSE FORMAT

Use this structure for briefings and status updates (adapt for simple questions):

**[One-sentence verdict — e.g. "This month is behind — delivery is at 42% and two website tasks are now overdue."]**

**Where we stand**
Narrative paragraph explaining current delivery vs expectations, referencing actual numbers and tasks.

**What's dragging it down / What's working**
Bullet points of specific issues or wins, with task names and dates where relevant.

**How this tracks against the strategy**
One paragraph connecting current delivery to the client's commercial objective and active sprint goal.

**What needs to happen now**
Numbered list of prioritised actions — specific, actionable, not generic.

For short factual questions (e.g. "when is the contract up?"), answer concisely without the full structure. Match the format to the question.

If data is missing or a field is empty, say so briefly — don't pad with filler.

═══ QUARTERLY STRATEGY ═══
${buildStrategyCtx(tabs.strategy)}

═══ SPRINTS ═══
${buildSprintsCtx(tabs.sprints)}

═══ DELIVERY ═══
${buildDeliveryCtx(tabs.delivery)}

═══ PLANABLE METRICS (last report) ═══
${buildProgressCtx(tabs.progress)}

═══ DIGITAL CREDIBILITY SCORECARD ═══
${buildBrandCtx(tabs.brand)}

═══ CONTRACT ═══
${buildContractCtx(tabs.overview)}

═══ DOCUMENT FRESHNESS ═══
${cyclesText}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const msgHistory = [
      ...((history || []).slice(-12).map(m => ({ role: m.role, content: m.content }))),
      { role: 'user', content: message.trim() }
    ];

    const stream = await getAnthropic().messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system: systemPrompt,
      messages: msgHistory,
      stream: true
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch(e) {
    console.error('Chat error:', e.message);
    try { res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`); res.end(); } catch(_) {}
  }
});

// ── Archive ─────────────────────────────────────────────────────────────────────
const ARCHIVE_GRACE_DAYS = 7;

function completionMonth(task) {
  // Use completed_at if set, otherwise fall back to current month
  if (task.completed_at) return task.completed_at.substring(0, 7);
  return new Date().toISOString().substring(0, 7);
}

async function archiveOldTasks(clientKey) {
  try {
    const row = await q.tabData(clientKey, 'delivery');
    if (!row) return;
    const d = JSON.parse(row.data);
    const cutoff = new Date(Date.now() - ARCHIVE_GRACE_DAYS * 24 * 60 * 60 * 1000);
    let changed = false;

    const buckets = {}; // { 'YYYY-MM': { website: [], brand: [] } }
    function bucket(month, type) {
      if (!buckets[month]) buckets[month] = { website: [], brand: [] };
      return buckets[month][type];
    }

    const newWebsite = (d.website || []).filter(t => {
      if (!t.text || !(t.done || t.status === 'done')) return true;
      const completedAt = t.completed_at ? new Date(t.completed_at) : null;
      if (completedAt && completedAt < cutoff) {
        bucket(completionMonth(t), 'website').push({ ...t, _archived_from: 'delivery' });
        changed = true;
        return false;
      }
      return true;
    });

    const newBrand = (d.brand || []).filter(t => {
      if (!t.text || !(t.done || t.status === 'done')) return true;
      const completedAt = t.completed_at ? new Date(t.completed_at) : null;
      if (completedAt && completedAt < cutoff) {
        bucket(completionMonth(t), 'brand').push({ ...t, _archived_from: 'delivery' });
        changed = true;
        return false;
      }
      return true;
    });

    if (!changed) return;

    for (const [month, types] of Object.entries(buckets)) {
      if (types.website.length) await q.appendArchive(clientKey, month, 'website_tasks', types.website);
      if (types.brand.length) await q.appendArchive(clientKey, month, 'brand_tasks', types.brand);
    }

    d.website = newWebsite;
    d.brand = newBrand;
    await q.upsertTab(clientKey, 'delivery', JSON.stringify(d));
    console.log(`Archived old tasks for ${clientKey}`);
  } catch (e) {
    console.error('archiveOldTasks error:', e.message);
  }
}

async function archiveCompletedCalendar(clientKey) {
  try {
    const row = await q.tabData(clientKey, 'delivery');
    if (!row) return;
    const d = JSON.parse(row.data);
    const weeks = d.weeks || [];
    const allPosts = weeks.flatMap(w => (w.tasks || []).filter(t => t.text));
    if (allPosts.length === 0) return;
    if (!allPosts.every(t => t.done || t.status === 'done')) return;

    // Use the latest completed_at across all posts to determine archive month
    const completedAts = allPosts.map(t => t.completed_at).filter(Boolean).sort();
    const latestCompleted = completedAts.length > 0 ? completedAts[completedAts.length - 1] : new Date().toISOString();
    const month = latestCompleted.substring(0, 7);

    await q.appendArchive(clientKey, month, 'content_calendar', [{
      weeks,
      post_count: allPosts.length,
      archived_at: new Date().toISOString()
    }]);

    // Reset weeks to empty
    d.weeks = [
      { label: 'Week 1', tasks: [] },
      { label: 'Week 2', tasks: [] },
      { label: 'Week 3', tasks: [] },
      { label: 'Week 4', tasks: [] }
    ];
    await q.upsertTab(clientKey, 'delivery', JSON.stringify(d));
    console.log(`Archived completed content calendar for ${clientKey} → ${month}`);
  } catch (e) {
    console.error('archiveCompletedCalendar error:', e.message);
  }
}

// Snapshot strategy/scorecard to archive when overwritten by a new PDF upload
async function snapshotTabToArchive(clientKey, tabName, category) {
  try {
    const row = await q.tabData(clientKey, tabName);
    if (!row) return;
    const d = JSON.parse(row.data);
    const month = new Date().toISOString().substring(0, 7);
    await q.appendArchive(clientKey, month, category, [{
      ...d,
      _snapped_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.error('snapshotTabToArchive error:', e.message);
  }
}

// ── Delivery calendar events ─────────────────────────────────────────────────────
function parseEventDate(dateStr) {
  if (!dateStr) return null;
  const MO = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
    january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
  const s = String(dateStr).trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  let m = s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (m) { const mo=MO[m[2].substring(0,3)]; if(mo) return `${m[3]}-${String(mo).padStart(2,'0')}-${String(parseInt(m[1])).padStart(2,'0')}`; }
  m = s.match(/^(\d{1,2})\s+([a-z]{3,})$/);
  if (m) { const mo=MO[m[2].substring(0,3)]; if(mo) return `${new Date().getFullYear()}-${String(mo).padStart(2,'0')}-${String(parseInt(m[1])).padStart(2,'0')}`; }
  m = s.match(/^([a-z]{3,})\s+(\d{4})$/);
  if (m) { const mo=MO[m[1].substring(0,3)]; if(mo) return `${m[2]}-${String(mo).padStart(2,'0')}-01`; }
  return null;
}

app.get('/api/clients/:key/history-events', requireAuth, async (req, res) => {
  try {
    const events = [];

    // Active delivery tab
    const deliveryRow = await q.tabData(req.params.key, 'delivery');
    if (deliveryRow) {
      const d = JSON.parse(deliveryRow.data);
      const todayKey = new Date().toISOString().substring(0,10);
      for (const week of (d.weeks || [])) {
        for (const t of (week.tasks || [])) {
          if (!t.text) continue;
          const plannedDate = parseEventDate(t.date);
          const date = plannedDate || (t.completed_at ? t.completed_at.substring(0,10) : null);
          if (!date) continue;
          const isDone = t.done || t.status === 'done';
          const status = isDone ? 'done' : (plannedDate && plannedDate < todayKey) ? 'overdue' : 'pending';
          events.push({ date, type: 'post', label: t.text, status, planned_date: plannedDate||date,
            detail: { text: t.text, desc: t.desc||'', date: t.date||date, week_label: week.label||'', points: t.points||0, status, completed_at: t.completed_at||null } });
        }
      }
      for (const t of (d.website || [])) {
        if (!t.text) continue;
        const pd = parseEventDate(t.date);
        const date = pd || (t.completed_at ? t.completed_at.substring(0,10) : null);
        if (!date) continue;
        const isDone = t.done || t.status === 'done';
        const status = isDone ? 'done' : (pd && pd < todayKey) ? 'overdue' : 'pending';
        events.push({ date, type: 'website', label: t.text, status, planned_date: pd||date,
          detail: { text: t.text, desc: t.desc||'', date: t.date||date, status, completed_at: t.completed_at||null } });
      }
      for (const t of (d.brand || [])) {
        if (!t.text) continue;
        const pd = parseEventDate(t.date);
        const date = pd || (t.completed_at ? t.completed_at.substring(0,10) : null);
        if (!date) continue;
        const isDone = t.done || t.status === 'done';
        const status = isDone ? 'done' : (pd && pd < todayKey) ? 'overdue' : 'pending';
        events.push({ date, type: 'brand', label: t.text, status, planned_date: pd||date,
          detail: { text: t.text, desc: t.desc||'', date: t.date||date, status, completed_at: t.completed_at||null } });
      }
    }

    // Strategy tab — meeting
    const stratRow = await q.tabData(req.params.key, 'strategy');
    if (stratRow) {
      const s = JSON.parse(stratRow.data);
      if (s.next_meeting_booked) {
        const today2 = new Date().toISOString().substring(0,10);
        const mStatus = s.next_meeting_booked < today2 ? 'overdue' : 'pending';
        events.push({ date: s.next_meeting_booked, type: 'meeting', label: 'Client meeting', status: mStatus, planned_date: s.next_meeting_booked,
          detail: { text: 'Client meeting', desc: s.next_meeting_notes||'', date: s.next_meeting_booked, status: mStatus, completed_at: null } });
      }
    }

    // Brand tab — scorecard date
    const brandRow = await q.tabData(req.params.key, 'brand');
    if (brandRow) {
      const b = JSON.parse(brandRow.data);
      if (b.scorecard_date) {
        const date = parseEventDate(b.scorecard_date);
        if (date) {
          const today = new Date().toISOString().substring(0,10);
          const status = date > today ? 'pending' : 'done';
          events.push({ date, type: 'scorecard', label: 'Digital Credibility Scorecard', status, planned_date: date,
            detail: { text: 'Digital Credibility Scorecard', desc: '', date: b.scorecard_date, status, completed_at: null } });
        }
      }
    }

    // Archive — past content calendars, website/brand tasks, snapshots
    const months = await q.listArchiveMonths(req.params.key);
    for (const month of months) {
      const rows = await q.getArchive(req.params.key, month);
      for (const row of rows) {
        if (row.category === 'content_calendar') {
          for (const cal of (row.data || [])) {
            for (const week of (cal.weeks || [])) {
              for (const t of (week.tasks || [])) {
                if (!t.text) continue;
                const plannedDate2 = parseEventDate(t.date);
                const date = plannedDate2 || (t.completed_at ? t.completed_at.substring(0,10) : null);
                if (!date) continue;
                events.push({ date, type: 'post', label: t.text, status: 'done', planned_date: date,
                  detail: { text: t.text, desc: t.desc||'', date: t.date||date, week_label: week.label||'', points: t.points||0, status: 'done', completed_at: t.completed_at||null } });
              }
            }
          }
        }
        if (row.category === 'website_tasks') {
          for (const t of (row.data || [])) {
            const pd = parseEventDate(t.date);
            const date = pd || (t.completed_at ? t.completed_at.substring(0,10) : null);
            if (date && t.text) events.push({ date, type: 'website', label: t.text, status: 'done', planned_date: pd||date,
              detail: { text: t.text, desc: t.desc||'', date: t.date||date, status: 'done', completed_at: t.completed_at||null } });
          }
        }
        if (row.category === 'brand_tasks') {
          for (const t of (row.data || [])) {
            const pd = parseEventDate(t.date);
            const date = pd || (t.completed_at ? t.completed_at.substring(0,10) : null);
            if (date && t.text) events.push({ date, type: 'brand', label: t.text, status: 'done', planned_date: pd||date,
              detail: { text: t.text, desc: t.desc||'', date: t.date||date, status: 'done', completed_at: t.completed_at||null } });
          }
        }
        if (row.category === 'strategy_snapshot') {
          const date = String(row.archived_at).substring(0,10);
          if (date) events.push({ date, type: 'strategy', label: 'Strategy document', status: 'done' });
        }
        if (row.category === 'scorecard_snapshot') {
          const date = String(row.archived_at).substring(0,10);
          if (date) events.push({ date, type: 'scorecard', label: 'Scorecard (archived)', status: 'done' });
        }
      }
    }

    // Document cycle due dates
    const cycles = await q.docCycles(req.params.key);
    for (const c of cycles) {
      if (!c.next_due_at) continue;
      const date = String(c.next_due_at).substring(0,10);
      const typeMap = { content_calendar: 'post', strategy: 'strategy', scorecard: 'scorecard', planable_report: 'report' };
      const labelMap = { content_calendar: 'Content calendar due', strategy: 'Strategy review due', scorecard: 'Scorecard due', planable_report: 'Planable report due' };
      events.push({ date, type: typeMap[c.document_type]||'report', label: labelMap[c.document_type]||'Due', status: 'due' });
    }

    res.json({ events });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Archive API endpoints ────────────────────────────────────────────────────────
app.get('/api/clients/:key/archive', requireAuth, async (req, res) => {
  try {
    const months = await q.listArchiveMonths(req.params.key);
    res.json({ months });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/clients/:key/archive/:month', requireAuth, async (req, res) => {
  try {
    const rows = await q.getArchive(req.params.key, req.params.month);
    const result = {};
    for (const row of rows) {
      result[row.category] = { data: row.data, archived_at: row.archived_at };
    }
    res.json({ month: req.params.month, categories: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Google Calendar (stub — ready to activate with credentials) ─────────────────
// To activate: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars,
// install googleapis: npm install googleapis
// Then implement OAuth2 flow using google.auth.OAuth2 and calendar.events.insert
app.get('/api/google/status', requireAuth, (req, res) => {
  res.json({ connected: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), configured: false });
});

// ── API: Session info ───────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ email: req.session.userEmail });
});

process.on('uncaughtException', e => console.error('Uncaught:', e.stack || e.message));
process.on('unhandledRejection', e => console.error('Unhandled rejection:', e?.stack || e));

// ── Start ─────────────────────────────────────────────────────────────────
async function start() {
  app.listen(PORT, () => console.log(`MGS OS running on http://localhost:${PORT}`));
  try {
    await init();
    console.log('Database ready');
  } catch (e) {
    console.error('Database init failed:', e.stack || e.message);
  }
}

start();
