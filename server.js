import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ORG_EMAIL = process.env.ORG_EMAIL || 'kypzerorg@gmail.com';
const GMAIL_USER = process.env.GMAIL_USER || ORG_EMAIL;
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const DATA_DIR = path.join(__dirname, 'data');

/* ------------------------------------------------------------------ */
/* Storage: MongoDB when MONGODB_URI is set, otherwise JSON files.    */
/* Every write goes through one queue, so read-modify-write is safe.  */
/* ------------------------------------------------------------------ */
const FILES = { events: 'events.json', registrations: 'registrations.json', messages: 'messages.json' };
const MONGODB_URI = process.env.MONGODB_URI || '';
const ON_RENDER = !!process.env.RENDER;
// Render's free disk is wiped on restart, so never accept registrations there without a database.
const STORAGE_READY = !!MONGODB_URI || !ON_RENDER;
let queue = Promise.resolve();
let db = null;

async function readFile(name) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, FILES[name]), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function read(name) {
  if (!db) return readFile(name);
  return db.collection(name).find({}, { projection: { _id: 0 } }).toArray();
}

async function write(name, before, after) {
  if (!db) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, FILES[name]), JSON.stringify(after, null, 2));
    return;
  }
  // Only touch documents that changed, so one bad write can't wipe a collection.
  const col = db.collection(name);
  const old = new Map(before.map((d) => [d.id, JSON.stringify(d)]));
  const ops = after
    .filter((d) => old.get(d.id) !== JSON.stringify(d))
    .map((d) => ({ replaceOne: { filter: { id: d.id }, replacement: d, upsert: true } }));
  const keep = new Set(after.map((d) => d.id));
  const gone = before.filter((d) => !keep.has(d.id)).map((d) => d.id);
  if (gone.length) ops.push({ deleteMany: { filter: { id: { $in: gone } } } });
  if (ops.length) await col.bulkWrite(ops);
}

function mutate(name, fn) {
  const run = queue.then(async () => {
    const data = await read(name);
    const before = structuredClone(data);
    const result = await fn(data);
    await write(name, before, data);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

async function connectDb() {
  if (!MONGODB_URI) return;
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || 'kypzero');
  for (const name of Object.keys(FILES)) await db.collection(name).createIndex({ id: 1 }, { unique: true });
  // First start: copy the starter events from data/events.json, once.
  const meta = db.collection('meta');
  if (!(await meta.findOne({ _id: 'seeded' }))) {
    const events = await readFile('events');
    if (events.length && !(await db.collection('events').countDocuments())) await db.collection('events').insertMany(events.map((e) => ({ ...e })));
    await meta.insertOne({ _id: 'seeded', at: new Date() });
  }
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ------------------------------------------------------------------ */
/* Mail                                                                */
/* ------------------------------------------------------------------ */
// Brevo sends over HTTPS, which works on hosts that block SMTP (like Render's free plan).
// Otherwise Gmail SMTP with an App Password; otherwise emails are only logged.
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_NAME = 'KYPZERO // Sector Zero';
const transporter = !BREVO_API_KEY && GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })
  : null;
const MAIL_MODE = BREVO_API_KEY ? 'brevo' : transporter ? 'gmail' : 'dry-run';

async function sendMail(opts) {
  try {
    if (MAIL_MODE === 'brevo') {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: FROM_NAME, email: GMAIL_USER },
          to: [{ email: opts.to }],
          ...(opts.replyTo ? { replyTo: { email: opts.replyTo } } : {}),
          subject: opts.subject,
          htmlContent: opts.html,
          textContent: opts.text,
        }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return true;
    }
    if (MAIL_MODE === 'gmail') {
      await transporter.sendMail({ from: `"${FROM_NAME}" <${GMAIL_USER}>`, ...opts });
      return true;
    }
    console.log(`[mail:dry-run] to=${opts.to} subject="${opts.subject}"`);
    return false;
  } catch (e) {
    console.error('[mail] failed:', e.message);
    return false;
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return 'To be announced';
  return d.toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function shell(body) {
  return `<!doctype html><html><body style="margin:0;background:#050203;padding:32px 12px;font-family:'Courier New',Courier,monospace;color:#e8dcc8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0c0507;border:1px solid #5a0d14">
<tr><td style="padding:30px 32px 22px;border-bottom:1px solid #3a0a0f;text-align:center">
<div style="font-size:11px;letter-spacing:6px;color:#d0142c">TRANSMISSION FROM SECTOR ZERO</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:12px;color:#e8dcc8;margin-top:12px">KYPZERO</div>
<div style="font-size:11px;letter-spacing:4px;color:#8a7a72;margin-top:6px">HACK THE DARK</div></td></tr>
<tr><td style="padding:28px 32px;font-size:14px;line-height:1.75;color:#e8dcc8">${body}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #3a0a0f;font-size:11px;line-height:1.6;color:#7a6a64;text-align:center">
Sent from <a href="${esc(SITE_URL)}" style="color:#d0142c">${esc(SITE_URL)}</a><br>Questions? Just reply, or write to ${esc(ORG_EMAIL)}</td></tr>
</table></td></tr></table></body></html>`;
}

function row(label, value) {
  return `<tr><td style="padding:6px 0;color:#8a7a72;font-size:11px;letter-spacing:2px;width:120px;vertical-align:top">${label}</td><td style="padding:6px 0;color:#e8dcc8">${esc(value)}</td></tr>`;
}

function registrationMail(reg, ev) {
  const html = shell(`
<p style="margin:0 0 14px">${esc(reg.name)},</p>
<p style="margin:0 0 18px">The pact is sealed. Your name has been written into the servers of Sector Zero.
You are registered for <b style="color:#ff3b1f">${esc(ev.title)}</b>.</p>
<div style="border:1px dashed #b3001b;padding:16px 18px;margin:0 0 20px;text-align:center">
<div style="font-size:11px;letter-spacing:4px;color:#8a7a72">YOUR TICKET</div>
<div style="font-size:28px;letter-spacing:6px;color:#ff3b1f;margin-top:6px">${esc(reg.ticket)}</div></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row('EVENT', ev.title)}${row('WHEN', fmtDate(ev.date))}${row('WHERE', ev.venue || 'To be announced')}
${ev.teamSize ? row('TEAM SIZE', ev.teamSize) : ''}${row('NAME', reg.name)}${row('COLLEGE', reg.college)}${row('PHONE', reg.phone)}
</table>
<p style="margin:22px 0 0">Keep this ticket. We will contact you with further instructions before the ritual begins.</p>
<p style="margin:14px 0 0;color:#8a7a72;font-style:italic">Don't look back.</p>`);
  const text = `${reg.name}, the pact is sealed.\n\nYou are registered for ${ev.title}.\nTicket: ${reg.ticket}\nWhen: ${fmtDate(ev.date)}\nWhere: ${ev.venue || 'TBA'}\n\n- KYPZERO`;
  return { html, text };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,17}$/;
const str = (v, max) => String(v ?? '').trim().slice(0, max);

function cleanEvent(b = {}, base = {}) {
  const ev = { ...base };
  const set = (k, max) => { if (b[k] !== undefined) ev[k] = str(b[k], max); };
  set('title', 80); set('tagline', 160); set('description', 4000); set('venue', 160);
  set('prize', 80); set('teamSize', 40); set('mode', 20); set('date', 30); set('deadline', 30);
  if (b.seats !== undefined) ev.seats = Math.max(0, Math.floor(Number(b.seats) || 0));
  if (b.status !== undefined) ev.status = b.status === 'closed' ? 'closed' : 'open';
  if (b.tags !== undefined) {
    const tags = Array.isArray(b.tags) ? b.tags : String(b.tags).split(',');
    ev.tags = tags.map((t) => str(t, 24)).filter(Boolean).slice(0, 8);
  }
  if (!ev.title) throw new HttpError(400, 'Title is required.');
  if (!ev.date || isNaN(new Date(ev.date))) throw new HttpError(400, 'A valid date is required.');
  if (ev.deadline && isNaN(new Date(ev.deadline))) throw new HttpError(400, 'Deadline is not a valid date.');
  ev.mode ||= 'offline';
  ev.status ||= 'open';
  ev.tags ||= [];
  ev.seats ??= 0;
  return ev;
}

function deadlinePassed(ev) {
  if (!ev.deadline) return false;
  const end = ev.deadline.length <= 10 ? new Date(`${ev.deadline}T23:59:59`) : new Date(ev.deadline);
  return Date.now() > end.getTime();
}

function publicEvent(ev, regs) {
  const registered = regs.filter((r) => r.eventId === ev.id).length;
  const full = ev.seats > 0 && registered >= ev.seats;
  const open = ev.status === 'open' && !full && !deadlinePassed(ev);
  return { ...ev, registered, seatsLeft: ev.seats > 0 ? Math.max(0, ev.seats - registered) : null, full, open };
}

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */
const hits = new Map();
function limiter(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return res.status(429).json({ error: 'Too many signals. The void needs a moment. Try again later.' });
    list.push(now);
    hits.set(key, list);
    next();
  };
}

function admin(req, res, next) {
  const given = Buffer.from(String(req.get('x-admin-key') || ''));
  const want = Buffer.from(ADMIN_KEY);
  if (!ADMIN_KEY || given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
    return res.status(401).json({ error: 'Access denied.' });
  }
  next();
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three'), { maxAge: '7d' }));
app.use('/vendor/gsap', express.static(path.join(__dirname, 'node_modules/gsap/dist'), { maxAge: '7d' }));
app.get('/healthz', (req, res) => res.send('ok'));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.use(express.static(path.join(__dirname, 'public')));

// ---- public ----
app.get('/api/events', wrap(async (req, res) => {
  const [events, regs] = await Promise.all([read('events'), read('registrations')]);
  const list = events.map((e) => publicEvent(e, regs)).sort((a, b) => new Date(a.date) - new Date(b.date));
  res.json(list);
}));

app.get('/api/events/:id', wrap(async (req, res) => {
  const [events, regs] = await Promise.all([read('events'), read('registrations')]);
  const ev = events.find((e) => e.id === req.params.id);
  if (!ev) throw new HttpError(404, 'This event has vanished.');
  res.json(publicEvent(ev, regs));
}));

app.get('/api/stats', wrap(async (req, res) => {
  const [events, regs] = await Promise.all([read('events'), read('registrations')]);
  res.json({ events: events.length, souls: regs.length, colleges: new Set(regs.map((r) => r.college.toLowerCase())).size });
}));

const paused = (req, res, next) => (STORAGE_READY ? next() : res.status(503).json({ error: 'Registrations open very soon. The servers are still waking up - try again later.' }));

app.post('/api/register', paused, limiter(8, 10 * 60 * 1000), wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true, ticket: 'KZ-000000', emailSent: false }); // honeypot
  const name = str(b.name, 80);
  const email = str(b.email, 120).toLowerCase();
  const phone = str(b.phone, 20);
  const college = str(b.college, 120);
  const fields = {};
  if (name.length < 2) fields.name = 'Tell us your name.';
  if (!EMAIL_RE.test(email)) fields.email = 'That email looks cursed. Check it.';
  if (!PHONE_RE.test(phone)) fields.phone = 'Enter a valid phone number.';
  if (college.length < 2) fields.college = 'Which college do you haunt?';
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Some fields need attention.', fields });

  const { reg, ev } = await mutate('registrations', async (regs) => {
    const events = await read('events');
    const ev = events.find((e) => e.id === b.eventId);
    if (!ev) throw new HttpError(404, 'This event has vanished.');
    const pub = publicEvent(ev, regs);
    if (ev.status !== 'open' || deadlinePassed(ev)) throw new HttpError(409, 'Registrations for this ritual are sealed.');
    if (pub.full) throw new HttpError(409, 'Every seat is taken. The circle is full.');
    if (regs.some((r) => r.eventId === ev.id && r.email === email)) throw new HttpError(409, 'This email has already signed the pact for this event.');
    const reg = {
      id: crypto.randomUUID(),
      ticket: `KZ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      eventId: ev.id, eventTitle: ev.title,
      name, email, phone, college,
      createdAt: new Date().toISOString(),
    };
    regs.push(reg);
    return { reg, ev };
  });

  const mail = registrationMail(reg, ev);
  const [emailSent] = await Promise.all([
    sendMail({ to: reg.email, subject: `Pact sealed: ${ev.title} [${reg.ticket}]`, ...mail }),
    sendMail({
      to: ORG_EMAIL,
      replyTo: reg.email,
      subject: `New registration: ${ev.title} (${reg.name})`,
      text: `New registration for ${ev.title}\n\nTicket: ${reg.ticket}\nName: ${reg.name}\nEmail: ${reg.email}\nPhone: ${reg.phone}\nCollege: ${reg.college}\nTime: ${reg.createdAt}`,
      html: shell(`<p style="margin:0 0 14px">A new soul signed the pact for <b style="color:#ff3b1f">${esc(ev.title)}</b>.</p>
<table role="presentation" width="100%">${row('TICKET', reg.ticket)}${row('NAME', reg.name)}${row('EMAIL', reg.email)}${row('PHONE', reg.phone)}${row('COLLEGE', reg.college)}${row('TIME', fmtDate(reg.createdAt))}</table>`),
    }),
  ]);
  res.json({ ok: true, ticket: reg.ticket, emailSent });
}));

app.post('/api/contact', paused, limiter(5, 10 * 60 * 1000), wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true });
  const name = str(b.name, 80);
  const email = str(b.email, 120).toLowerCase();
  const message = str(b.message, 3000);
  const fields = {};
  if (name.length < 2) fields.name = 'Tell us your name.';
  if (!EMAIL_RE.test(email)) fields.email = 'That email looks cursed. Check it.';
  if (message.length < 5) fields.message = 'Say a little more.';
  if (Object.keys(fields).length) return res.status(400).json({ error: 'Some fields need attention.', fields });

  await mutate('messages', (msgs) => { msgs.push({ id: crypto.randomUUID(), name, email, message, createdAt: new Date().toISOString() }); });
  const [delivered] = await Promise.all([
    sendMail({
      to: ORG_EMAIL, replyTo: email, subject: `Signal received from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: shell(`<table role="presentation" width="100%">${row('FROM', name)}${row('EMAIL', email)}</table>
<p style="margin:18px 0 0;white-space:pre-wrap">${esc(message)}</p>`),
    }),
    sendMail({
      to: email, subject: 'Your signal reached Sector Zero',
      text: `${name}, we received your message. Someone will answer from the dark soon.\n\n- KYPZERO`,
      html: shell(`<p style="margin:0 0 14px">${esc(name)},</p><p style="margin:0">Your signal reached us. Someone will answer from the dark soon.</p>
<p style="margin:14px 0 0;color:#8a7a72;font-style:italic">Stay near the light.</p>`),
    }),
  ]);
  res.json({ ok: true, emailSent: delivered });
}));

// ---- admin ----
app.get('/api/admin/check', admin, (req, res) => res.json({ ok: true, mail: MAIL_MODE === 'dry-run' ? 'dry-run' : 'live', provider: MAIL_MODE, from: GMAIL_USER, storage: db ? 'mongodb' : 'files', storageReady: STORAGE_READY }));

app.post('/api/admin/test-mail', admin, wrap(async (req, res) => {
  const sent = await sendMail({
    to: ORG_EMAIL, subject: 'Test transmission from Sector Zero',
    text: 'If you can read this, email delivery works.',
    html: shell('<p style="margin:0">If you can read this, email delivery works. The pact emails will arrive like this one.</p>'),
  });
  res.json({ ok: sent, mail: MAIL_MODE === 'dry-run' ? 'dry-run' : 'live' });
}));

app.post('/api/admin/events', admin, wrap(async (req, res) => {
  const ev = await mutate('events', (events) => {
    const ev = cleanEvent(req.body, { id: crypto.randomBytes(5).toString('hex'), createdAt: new Date().toISOString() });
    events.push(ev);
    return ev;
  });
  res.status(201).json(ev);
}));

app.put('/api/admin/events/:id', admin, wrap(async (req, res) => {
  const ev = await mutate('events', (events) => {
    const i = events.findIndex((e) => e.id === req.params.id);
    if (i < 0) throw new HttpError(404, 'Event not found.');
    events[i] = cleanEvent(req.body, events[i]);
    return events[i];
  });
  res.json(ev);
}));

app.delete('/api/admin/events/:id', admin, wrap(async (req, res) => {
  await mutate('events', (events) => {
    const i = events.findIndex((e) => e.id === req.params.id);
    if (i < 0) throw new HttpError(404, 'Event not found.');
    events.splice(i, 1);
  });
  res.json({ ok: true });
}));

app.get('/api/admin/registrations', admin, wrap(async (req, res) => {
  let regs = await read('registrations');
  if (req.query.eventId) regs = regs.filter((r) => r.eventId === req.query.eventId);
  res.json(regs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}));

app.get('/api/admin/registrations.csv', admin, wrap(async (req, res) => {
  let regs = await read('registrations');
  if (req.query.eventId) regs = regs.filter((r) => r.eventId === req.query.eventId);
  const cols = ['ticket', 'eventTitle', 'name', 'email', 'phone', 'college', 'createdAt'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...regs.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
  res.send('﻿' + csv);
}));

app.delete('/api/admin/registrations/:id', admin, wrap(async (req, res) => {
  await mutate('registrations', (regs) => {
    const i = regs.findIndex((r) => r.id === req.params.id);
    if (i < 0) throw new HttpError(404, 'Registration not found.');
    regs.splice(i, 1);
  });
  res.json({ ok: true });
}));

app.get('/api/admin/messages', admin, wrap(async (req, res) => {
  res.json((await read('messages')).reverse());
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Nothing lives here.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed request.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong in the dark. Try again.' });
});

connectDb()
  .catch((e) => {
    console.error(`  ! MongoDB connection failed: ${e.message}`);
    process.exit(1);
  })
  .then(() => app.listen(PORT, () => {
    console.log(`\n  KYPZERO is awake on ${SITE_URL}`);
    console.log(`  Admin control room: ${SITE_URL}/admin`);
    console.log(`  Storage: ${db ? 'MongoDB' : 'JSON files in data/'}${STORAGE_READY ? '' : ' - REGISTRATIONS PAUSED (set MONGODB_URI)'}`);
    if (!ADMIN_KEY) console.log('  ! ADMIN_KEY is not set - admin is locked.');
    if (MAIL_MODE === 'brevo') console.log(`  Mail: Brevo API, sending as ${GMAIL_USER}`);
    else if (MAIL_MODE === 'dry-run') console.log('  ! No BREVO_API_KEY or GMAIL_APP_PASSWORD - emails are logged, not sent (dry-run).');
    else {
      transporter.verify()
        .then(() => console.log(`  Mail: Gmail SMTP as ${GMAIL_USER}`))
        .catch((e) => console.log(`  ! Mail login failed: ${e.message}`));
    }
    console.log('');
  }));
