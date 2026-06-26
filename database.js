const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'mgs.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sub TEXT,
    phase TEXT,
    avatar TEXT,
    avatar_bg TEXT,
    avatar_col TEXT,
    score TEXT,
    score_bg TEXT,
    score_col TEXT,
    badge TEXT,
    badge_bg TEXT,
    badge_col TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS client_tabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_key TEXT NOT NULL,
    tab TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(client_key, tab)
  );
`);

// ── Seed admin user ──────────────────────────────────────────────────────────
function seedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('jenson@manxgrowthsolutions.com');
  if (!existing) {
    const hash = bcrypt.hashSync('Mgs12345', 12);
    db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('jenson@manxgrowthsolutions.com', hash);
    console.log('Admin user created.');
  }
}

// ── Seed default clients ─────────────────────────────────────────────────────
function seedClients() {
  const count = db.prepare('SELECT COUNT(*) as n FROM clients').get().n;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO clients
      (key, name, sub, phase, avatar, avatar_bg, avatar_col, score, score_bg, score_col, badge, badge_bg, badge_col, sort_order)
    VALUES
      (@key,@name,@sub,@phase,@avatar,@avatar_bg,@avatar_col,@score,@score_bg,@score_col,@badge,@badge_bg,@badge_col,@sort_order)
  `);

  const insertTab = db.prepare(`
    INSERT OR IGNORE INTO client_tabs (client_key, tab, data) VALUES (?, ?, ?)
  `);

  const clients = [
    {
      key: 'whittles', name: 'Whittles', sub: 'Law firm · Isle of Man · Regulatory & corporate advisory',
      phase: 'Sprint 2 · Planning', avatar: 'WH', avatar_bg: '#F1EFE8', avatar_col: '#444441',
      score: '92%', score_bg: '#EAF3DE', score_col: '#27500A',
      badge: 'Sprint 1 complete', badge_bg: '#EAF3DE', badge_col: '#27500A', sort_order: 1
    },
    {
      key: 'g11', name: 'Group Eleven', sub: 'Corporate services · Isle of Man',
      phase: 'Sprint 1 · Wk 3', avatar: 'G11', avatar_bg: '#E6F1FB', avatar_col: '#0C447C',
      score: '61%', score_bg: '#FAEEDA', score_col: '#633806',
      badge: 'Sprint 1 · Week 3', badge_bg: '#E6F1FB', badge_col: '#185FA5', sort_order: 2
    },
    {
      key: 'ex3', name: 'Example client 3', sub: 'Add client details here',
      phase: 'Not started', avatar: 'E3', avatar_bg: '#EEEDFE', avatar_col: '#3C3489',
      score: '—', score_bg: '#F1EFE8', score_col: '#5F5E5A',
      badge: 'Not started', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', sort_order: 3
    },
    {
      key: 'ex4', name: 'Example client 4', sub: 'Add client details here',
      phase: 'Not started', avatar: 'E4', avatar_bg: '#E1F5EE', avatar_col: '#085041',
      score: '—', score_bg: '#F1EFE8', score_col: '#5F5E5A',
      badge: 'Not started', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', sort_order: 4
    },
    {
      key: 'ex5', name: 'Example client 5', sub: 'Add client details here',
      phase: 'Not started', avatar: 'E5', avatar_bg: '#FAEEDA', avatar_col: '#633806',
      score: '—', score_bg: '#F1EFE8', score_col: '#5F5E5A',
      badge: 'Not started', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', sort_order: 5
    },
    {
      key: 'ex6', name: 'Example client 6', sub: 'Add client details here',
      phase: 'Not started', avatar: 'E6', avatar_bg: '#FCEBEB', avatar_col: '#791F1F',
      score: '—', score_bg: '#F1EFE8', score_col: '#5F5E5A',
      badge: 'Not started', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', sort_order: 6
    },
    {
      key: 'ex7', name: 'Example client 7', sub: 'Add client details here',
      phase: 'Not started', avatar: 'E7', avatar_bg: '#EAF3DE', avatar_col: '#27500A',
      score: '—', score_bg: '#F1EFE8', score_col: '#5F5E5A',
      badge: 'Not started', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', sort_order: 7
    },
    {
      key: 'ex8', name: 'Example client 8', sub: 'Add client details here',
      phase: 'Not started', avatar: 'E8', avatar_bg: '#FBEAF0', avatar_col: '#72243E',
      score: '—', score_bg: '#F1EFE8', score_col: '#5F5E5A',
      badge: 'Not started', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', sort_order: 8
    }
  ];

  const whittlesOverview = {
    stats: [
      { label: 'Impressions (90 days)', value: '32,952', sub: '↑ 222% vs prior period', color: '#27500A' },
      { label: 'Engagements', value: '8,112', sub: '↑ 788% vs prior period', color: '#185FA5' },
      { label: 'Followers', value: '727', sub: '↑ 137 new', color: '' },
      { label: 'Delivery score', value: '92%', sub: 'No overdue tasks', color: '#27500A' }
    ],
    summary: {
      title: 'Sprint 1 — brand foundation summary',
      body: 'Brand foundation complete. 17 posts published, all five workstreams delivered. Platform established for commercial growth months 4–12.',
      tasks: [
        { done: true, text: 'Brand system aligned across all touchpoints' },
        { done: true, text: 'Our Talent series launched — Claire Foden, Gillian Christian' },
        { done: true, text: 'Employee LinkedIn profiles audited and banners created' },
        { done: true, text: 'Regulatory authority content — 2 posts per month' },
        { done: true, text: 'Advocates for Sport Fund — launched as brand property' }
      ]
    },
    actions: [
      { type: 'green', icon: 'ti-arrow-right', title: 'Sprint 2 — brief now', body: 'Brand foundation complete. Sprint 2 must be planned immediately to maintain momentum.' },
      { type: 'blue', icon: 'ti-bulb', title: 'Opportunity', body: 'Our Talent and Sports Fund drove highest engagement. Make these cornerstones of sprint 2.' }
    ],
    top_content: [
      { name: 'Gillian Christian — IoD nominee', value: '3,820', tag: 'impr.', tag_bg: '#EAF3DE', tag_col: '#27500A' },
      { name: 'Claire Foden — Our Talent', value: '2,320', tag: 'eng.', tag_bg: '#E6F1FB', tag_col: '#185FA5' },
      { name: 'Sports Fund launch', value: '1,310', tag: 'eng.', tag_bg: '#E6F1FB', tag_col: '#185FA5' }
    ]
  };

  const whittlesDelivery = {
    overdue_count: 0,
    weeks: [
      {
        label: 'Week 1 — 2–6 Jun',
        tasks: [
          { status: 'done', text: 'Regulatory insight post — employment law update', date: '2 Jun' },
          { status: 'done', text: 'Our Talent — Claire Foden profile', date: '5 Jun' }
        ]
      },
      {
        label: 'Week 2 — 9–13 Jun',
        tasks: [
          { status: 'done', text: 'Sports Fund — Sienna Dunn athlete spotlight', date: '9 Jun' },
          { status: 'done', text: 'Firm news — Lewis Bridson trainee achievement', date: '12 Jun' }
        ]
      },
      {
        label: 'Week 3 — 16–20 Jun',
        tasks: [
          { status: 'done', text: 'Gillian Christian — IoD nominee announcement', date: '16 Jun' },
          { status: 'prog', text: 'Regulatory insight post — corporate advisory', date: '19 Jun' }
        ]
      },
      {
        label: 'Week 4 — 23–27 Jun',
        tasks: [
          { status: '', text: 'Brand positioning post — premium advisory', date: '23 Jun' },
          { status: '', text: 'Our Talent — next team member brief to client', date: '26 Jun' }
        ]
      }
    ],
    website: [
      { status: 'done', text: 'LinkedIn company page description updated', date: 'Mar 2025' },
      { status: 'prog', text: 'Website hero messaging — align to new positioning', date: '30 Jun' },
      { status: '', text: 'Regulatory advisory services page — copy refresh', date: 'Jul 2025' },
      { status: '', text: 'Sports Fund dedicated page — build and publish', date: 'Jul 2025' }
    ],
    brand: [
      { status: 'done', text: 'LinkedIn banner assets — full senior team', date: 'Apr 2025' },
      { status: 'done', text: 'Sports Fund visual identity — logo and templates', date: 'Apr 2025' },
      { status: 'done', text: 'Carousel template — standardised layout', date: 'Mar 2025' },
      { status: '', text: 'Brand guidelines document — formal write-up', date: 'Jul 2025' },
      { status: '', text: 'Employee resharing guide — light engagement brief', date: 'Jul 2025' }
    ]
  };

  const whittlesProgress = {
    objectives: [
      { label: 'Commercial objective', pct: 72, color: '#639922', sub: 'Increase awareness to support growth and recruitment' },
      { label: 'Perception progress', pct: 61, color: '#185FA5', sub: 'Moving towards: premium boutique advisory firm' }
    ],
    perceptions: [
      { label: 'Premium boutique positioning', pct: 78, color: '#639922' },
      { label: 'Visible advisory collective', pct: 45, color: '#185FA5' },
      { label: 'Regulatory authority', pct: 35, color: '#EF9F27' },
      { label: 'Recruitment signalling', pct: 40, color: '#EF9F27' }
    ],
    metrics: [
      { label: 'Impressions', value: '32,952', tag: '↑222%', tag_bg: '#EAF3DE', tag_col: '#27500A' },
      { label: 'Engagements', value: '8,112', tag: '↑788%', tag_bg: '#EAF3DE', tag_col: '#27500A' },
      { label: 'Followers', value: '727', tag: '+137', tag_bg: '#EAF3DE', tag_col: '#27500A' },
      { label: 'Page views', value: '494', tag: '↑141%', tag_bg: '#EAF3DE', tag_col: '#27500A' },
      { label: 'Posts published', value: '17', tag: null },
      { label: 'Senior audience', value: '57.2%', tag: null }
    ],
    geography: [
      { label: 'Isle of Man', pct: 100, val: '71.8%', color: '#185FA5' },
      { label: 'United Kingdom', pct: 26, val: '18.7%', color: '#185FA5' },
      { label: 'Jersey', pct: 2, val: '1.5%', color: '#B5D4F4' }
    ]
  };

  const whittlesStrategy = {
    hierarchy: [
      { num: 1, bg: '#F1EFE8', col: '#444441', name: 'Commercial objective', desc: 'Support regulatory growth and senior recruitment over 12 months' },
      { num: 2, bg: '#E6F1FB', col: '#0C447C', name: 'Desired perception', desc: 'Premium boutique law firm — senior-led advisory collective with visible regulatory expertise' },
      { num: 3, bg: '#E1F5EE', col: '#085041', name: 'Long-term strategy', desc: 'Shift from single-leader credibility to firm-wide advisory strength across IOM' },
      { num: 4, bg: '#EAF3DE', col: '#27500A', name: 'Sprint 1 complete', desc: 'Brand foundation — 90-day structural alignment across five workstreams' },
      { num: 5, bg: '#FAEEDA', col: '#633806', name: 'Next — Sprint 2', desc: 'Authority content, regulatory visibility, Sports Fund cadence, audience growth', border: true }
    ],
    workstreams: [
      { label: 'Brand system alignment', pct: 100, color: '#639922', val: '100%', val_col: '#27500A' },
      { label: 'Employee presence', pct: 100, color: '#639922', val: '100%', val_col: '#27500A' },
      { label: 'Our Talent series', pct: 40, color: '#EF9F27', val: 'Ongoing', val_col: '#EF9F27' },
      { label: 'Regulatory authority', pct: 50, color: '#EF9F27', val: 'Ongoing', val_col: '#EF9F27' },
      { label: 'Advocates for Sport Fund', pct: 30, color: '#EF9F27', val: 'Ongoing', val_col: '#EF9F27' }
    ],
    perceptions: [
      { label: 'Premium boutique positioning', pct: 78, color: '#639922', val: '78%', val_col: '#27500A' },
      { label: 'Visible advisory collective', pct: 45, color: '#185FA5', val: '45%', val_col: '#185FA5' },
      { label: 'Regulatory authority', pct: 35, color: '#EF9F27', val: '35%', val_col: '#EF9F27' },
      { label: 'Recruitment signalling', pct: 40, color: '#EF9F27', val: '40%', val_col: '#EF9F27' }
    ]
  };

  const whittlesSprints = {
    sprints: [
      {
        title: 'Sprint 1 — brand foundation', period: 'Mar – May 2025 · 90 days',
        status: 'Complete', status_bg: '#EAF3DE', status_col: '#27500A',
        border_col: '#639922', bar_pct: 100, bar_col: '#639922',
        body: 'Correct structural misalignment between Whittles\' digital presence and actual capability.',
        tasks: [
          { done: true, text: 'LinkedIn company page description and messaging updated' },
          { done: true, text: 'Typography, layout and carousel hierarchy standardised' },
          { done: true, text: 'Tagline developed' },
          { done: true, text: 'Senior team LinkedIn profiles audited and recommendations provided' },
          { done: true, text: 'Employee brand assets — LinkedIn banners created' },
          { done: true, text: 'Our Talent series launched — Claire Foden, Gillian Christian' },
          { done: true, text: 'Regulatory insight content — 2 posts per month established' },
          { done: true, text: 'Advocates for Sport Fund — launched and visual identity defined' },
          { done: true, text: '17 LinkedIn posts published · Three-month progress report produced' }
        ]
      },
      {
        title: 'Sprint 2 — authority & visibility', period: 'Jun – Aug 2025 · Planning now',
        status: 'Planning', status_bg: '#E6F1FB', status_col: '#185FA5',
        border_col: '#185FA5', bar_pct: 0, bar_col: '#185FA5',
        body: 'Scale what is working. Build regulatory authority, continue Our Talent cadence, grow Sports Fund presence.',
        tasks: [
          { done: false, badge: 'To plan', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', text: 'Our Talent series — 1 profile per month' },
          { done: false, badge: 'To plan', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', text: 'Regulatory insight posts — 2 per month minimum' },
          { done: false, badge: 'To plan', badge_bg: '#F1EFE8', badge_col: '#5F5E5A', text: 'Sports Fund — athlete spotlight bi-monthly' },
          { done: false, badge: 'Action now', badge_bg: '#FAEEDA', badge_col: '#633806', text: 'Sprint 2 strategic brief — to be written' }
        ]
      },
      {
        title: 'Sprint 3 — market recognition', period: 'Sep – Nov 2025 · Planned',
        status: 'Planned', status_bg: '#F1EFE8', status_col: '#5F5E5A',
        border_col: 'rgba(0,0,0,0.1)', bar_pct: 0, bar_col: '',
        body: 'Translate visibility into market recognition among CSPs, HNW clients and senior recruits.',
        tasks: [], faded: true
      }
    ]
  };

  const whittlesBrand = {
    scorecard_client: 'Group Eleven',
    scorecard_date: '15 June 2026',
    overall: 43, overall_max: 75, overall_label: 'Developing · 26–50 range', overall_col: '#EF9F27',
    sections: [
      { label: 'Brand', score: 13, max: 25, bg: '#F1EFE8', col: '#EF9F27' },
      { label: 'Marketing & comms', score: 13, max: 25, bg: '#F1EFE8', col: '#EF9F27' },
      { label: 'Website & digital', score: 17, max: 25, bg: '#EAF3DE', col: '#27500A' }
    ],
    metrics: [
      { section: 'Brand — 13/25', items: [
        { name: 'Visual identity', score: 3, col: '#639922' },
        { name: 'Consistency across channels', score: 2, col: '#E24B4A' },
        { name: 'Tone of voice', score: 3, col: '#639922' },
        { name: 'Thought leadership', score: 2, col: '#E24B4A' },
        { name: 'Company culture demonstrated', score: 3, col: '#639922' }
      ]},
      { section: 'Marketing & comms — 13/25', items: [
        { name: 'LinkedIn / Facebook / Instagram', score: 2, col: '#E24B4A' },
        { name: 'Content quality & relevance', score: 2, col: '#E24B4A' },
        { name: 'Stakeholder messaging', score: 3, col: '#639922' },
        { name: 'Reputation signals', score: 3, col: '#639922' },
        { name: 'Engagement levels', score: 3, col: '#639922' }
      ]},
      { section: 'Website & digital — 17/25', items: [
        { name: 'Website design', score: 4, col: '#639922' },
        { name: 'Website compliance', score: 3, col: '#639922' },
        { name: 'Customer experience / UX', score: 3, col: '#639922' },
        { name: 'Site speed', score: 5, col: '#639922' },
        { name: 'Site visibility / SEO', score: 2, col: '#E24B4A' }
      ]}
    ],
    recommendations: [
      { title: 'Brand guidelines', body: 'Develop comprehensive guidelines covering visual identity, tone of voice, and messaging across all channels.' },
      { title: 'Brand recognition social media', body: 'Introduce a structured LinkedIn strategy focused on industry insight, leadership perspectives and employee visibility.' },
      { title: 'People & culture communications', body: 'Implement team profiles, employee stories, and culture-led content to humanise the brand and strengthen recruitment.' }
    ],
    rescore_reminder: 'Next Digital Credibility Scorecard due for Group Eleven in <strong>December 2026</strong>. Schedule 6-month reassessment to measure progress against these scores.'
  };

  const txn = db.transaction(() => {
    clients.forEach(c => insert.run(c));
    insertTab.run('whittles', 'overview', JSON.stringify(whittlesOverview));
    insertTab.run('whittles', 'delivery', JSON.stringify(whittlesDelivery));
    insertTab.run('whittles', 'progress', JSON.stringify(whittlesProgress));
    insertTab.run('whittles', 'strategy', JSON.stringify(whittlesStrategy));
    insertTab.run('whittles', 'sprints', JSON.stringify(whittlesSprints));
    insertTab.run('whittles', 'brand', JSON.stringify(whittlesBrand));
  });
  txn();
  console.log('Default clients seeded.');
}

seedAdmin();
seedClients();

// ── Queries ──────────────────────────────────────────────────────────────────
const q = {
  allClients: db.prepare('SELECT * FROM clients ORDER BY sort_order ASC, id ASC'),
  clientByKey: db.prepare('SELECT * FROM clients WHERE key = ?'),
  tabData: db.prepare('SELECT data FROM client_tabs WHERE client_key = ? AND tab = ?'),
  upsertTab: db.prepare(`
    INSERT INTO client_tabs (client_key, tab, data, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(client_key, tab) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `),
  updateClient: db.prepare(`
    UPDATE clients SET name=@name, sub=@sub, phase=@phase, avatar=@avatar,
    avatar_bg=@avatar_bg, avatar_col=@avatar_col, score=@score, score_bg=@score_bg,
    score_col=@score_col, badge=@badge, badge_bg=@badge_bg, badge_col=@badge_col
    WHERE key=@key
  `),
  userByEmail: db.prepare('SELECT * FROM users WHERE email = ?')
};

module.exports = { db, q };
