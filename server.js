const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { q } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data dir for session store
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ dir: dataDir, db: 'sessions.db' }),
  secret: process.env.SESSION_SECRET || 'mgs-os-secret-change-in-prod-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
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

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = q.userByEmail.get((email || '').toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.redirect('/login?error=1');
  }
  req.session.userId = user.id;
  req.session.userEmail = user.email;
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ── API: Clients ──────────────────────────────────────────────────────────────
app.get('/api/clients', requireAuth, (req, res) => {
  res.json(q.allClients.all());
});

app.get('/api/clients/:key', requireAuth, (req, res) => {
  const c = q.clientByKey.get(req.params.key);
  if (!c) return res.status(404).json({ error: 'Not found' });
  res.json(c);
});

app.patch('/api/clients/:key', requireAuth, (req, res) => {
  const c = q.clientByKey.get(req.params.key);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const updated = { ...c, ...req.body, key: req.params.key };
  q.updateClient.run(updated);
  res.json(q.clientByKey.get(req.params.key));
});

// ── API: Tab data ─────────────────────────────────────────────────────────────
app.get('/api/clients/:key/tabs/:tab', requireAuth, (req, res) => {
  const row = q.tabData.get(req.params.key, req.params.tab);
  res.json(row ? JSON.parse(row.data) : {});
});

app.put('/api/clients/:key/tabs/:tab', requireAuth, (req, res) => {
  q.upsertTab.run(req.params.key, req.params.tab, JSON.stringify(req.body));
  res.json({ ok: true });
});

// ── API: Session info ─────────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ email: req.session.userEmail });
});

app.listen(PORT, () => console.log(`MGS OS running on http://localhost:${PORT}`));
