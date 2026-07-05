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
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  res.redirect('/login');
}

// ── Pages ─────────────────────────────────────────────────────────────────────
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

// ── API: Clients ──────────────────────────────────────────────────────────────
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

// ── API: Tab data ─────────────────────────────────────────────────────────────
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── API: PDF upload & AI extraction ──────────────────────────────────────────
const EXTRACTION_PROMPT = `You are a data extraction assistant for MGS OS, a marketing agency client dashboard.

Analyse this PDF report and extract all relevant data. First identify what type of document it is, then extract the appropriate data.

DOCUMENT TYPES:
- "planable": A Planable social media analytics/performance report. Contains metrics like impressions, engagements, followers, reach, page views, posts published, audience data, top performing content, engagement rates, follower growth.
- "scorecard": A Digital Credibility Scorecard. Contains scores out of 5 for individual metrics grouped into Brand (visual identity, tone of voice, thought leadership, consistency, culture), Marketing & Communications (social media, content quality, stakeholder messaging, reputation, engagement), and Website & Digital (design, compliance, UX, site speed, SEO). Total score out of 75.
- "strategy": A strategy document or sprint brief. Contains objectives, desired perceptions, workstreams, tasks, timelines, sprint goals.
- "unknown": Cannot determine type.

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
  const response = await anthropic.messages.create({
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
    // Merge into existing overview tab
    const existingOv = await q.tabData(clientKey, 'overview');
    const ov = existingOv ? JSON.parse(existingOv.data) : {};
    if (extracted.overview?.stats) ov.stats = extracted.overview.stats;
    if (extracted.overview?.top_content) ov.top_content = extracted.overview.top_content;
    await q.upsertTab(clientKey, 'overview', JSON.stringify(ov));
    updated.push('overview');

    // Merge into progress tab
    const existingPr = await q.tabData(clientKey, 'progress');
    const pr = existingPr ? JSON.parse(existingPr.data) : {};
    if (extracted.progress?.metrics) pr.metrics = extracted.progress.metrics;
    if (extracted.progress?.geography) pr.geography = extracted.progress.geography;
    await q.upsertTab(clientKey, 'progress', JSON.stringify(pr));
    updated.push('progress');
  }

  if (extracted.type === 'scorecard' && extracted.brand) {
    await q.upsertTab(clientKey, 'brand', JSON.stringify(extracted.brand));
    updated.push('brand');
  }

  if (extracted.type === 'strategy') {
    if (extracted.strategy) {
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

    const typeLabels = { planable: 'Planable report', scorecard: 'Digital Credibility Scorecard', strategy: 'Strategy document' };
    res.json({
      ok: true,
      type: extracted.type,
      type_label: typeLabels[extracted.type] || 'Document',
      period: extracted.period || null,
      tabs_updated: updated
    });
  } catch (e) {
    console.error('PDF extraction error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── API: Session info ─────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ email: req.session.userEmail });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await init();
    app.listen(PORT, () => console.log(`MGS OS running on http://localhost:${PORT}`));
  } catch (e) {
    console.error('Failed to start:', e.message);
    process.exit(1);
  }
}

start();
