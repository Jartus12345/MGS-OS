const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const path = require('path');
const { pool, q, init } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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
