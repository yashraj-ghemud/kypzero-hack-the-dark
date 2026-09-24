// KYPZERO API on Cloudflare Pages Functions + D1. Every /api/* request lands here.
import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

const app = new Hono().basePath('/api');

class HttpError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,17}$/;
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Event dates are wall-clock strings ("2026-10-31T18:00") in the organiser's timezone.
function localToDate(s, offset) {
  if (!s) return null;
  if (/(Z|[+-]\d\d:\d\d)$/.test(s)) return new Date(s);
  const full = s.length === 10 ? `${s}T00:00:00` : s.length === 16 ? `${s}:00` : s;
  return new Date(`${full}${offset}`);
}

function fmtEventDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s || '');
  if (!m) return 'To be announced';
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
  return d.toLocaleString('en-IN', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', ...(m[4] ? { hour: '2-digit', minute: '2-digit' } : {}) });
}

const fmtStamp = (iso, env) => new Date(iso).toLocaleString('en-IN', { timeZone: env.TIMEZONE || 'Asia/Kolkata' });

function deadlinePassed(ev, env) {
  if (!ev.deadline) return false;
  const end = localToDate(ev.deadline.length <= 10 ? `${ev.deadline}T23:59:59` : ev.deadline, env.TZ_OFFSET || '+05:30');
  return Date.now() > end.getTime();
}

function publicEvent(ev, registered, env) {
  const full = ev.seats > 0 && registered >= ev.seats;
  const open = ev.status === 'open' && !full && !deadlinePassed(ev, env);
  return { ...ev, registered, seatsLeft: ev.seats > 0 ? Math.max(0, ev.seats - registered) : null, full, open };
}

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
  if (!ev.date || !/^\d{4}-\d{2}-\d{2}/.test(ev.date)) throw new HttpError(400, 'A valid date is required.');
  if (ev.deadline && !/^\d{4}-\d{2}-\d{2}/.test(ev.deadline)) throw new HttpError(400, 'Deadline is not a valid date.');
  ev.mode ||= 'offline';
  ev.status ||= 'open';
  ev.tags ||= [];
  ev.seats ??= 0;
  return ev;
}

async function body(c) {
  try { return await c.req.json(); } catch { throw new HttpError(400, 'Malformed request.'); }
}

/* ------------------------------------------------------------------ */
/* Data access                                                         */
/* ------------------------------------------------------------------ */
const rowToEvent = (r) => ({ ...JSON.parse(r.data), id: r.id, createdAt: r.created_at });
const rowToReg = (r) => ({
  id: r.id, ticket: r.ticket, eventId: r.event_id, eventTitle: r.event_title,
  name: r.name, email: r.email, phone: r.phone, college: r.college, createdAt: r.created_at,
});

async function getEvent(db, id) {
  const r = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  return r ? rowToEvent(r) : null;
}

async function counts(db) {
  const { results } = await db.prepare('SELECT event_id, COUNT(*) AS n FROM registrations GROUP BY event_id').all();
  return new Map(results.map((r) => [r.event_id, r.n]));
}

async function saveEvent(db, ev) {
  const { id, createdAt, ...data } = ev;
  await db.prepare('INSERT INTO events (id, data, created_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET data = ?2')
    .bind(id, JSON.stringify(data), createdAt).run();
}

/* ------------------------------------------------------------------ */
/* Mail (Brevo HTTPS API)                                              */
/* ------------------------------------------------------------------ */
async function sendMail(env, opts) {
  if (!env.BREVO_API_KEY) {
    console.log(`[mail:dry-run] to=${opts.to} subject="${opts.subject}"`);
    return false;
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'KYPZERO // Sector Zero', email: env.MAIL_FROM },
        to: [{ email: opts.to }],
        ...(opts.replyTo ? { replyTo: { email: opts.replyTo } } : {}),
        subject: opts.subject,
        htmlContent: opts.html,
        textContent: opts.text,
      }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return true;
  } catch (e) {
    console.error('[mail] failed:', e.message);
    return false;
  }
}

function shell(env, content) {
  const site = esc(env.SITE_URL);
  return `<!doctype html><html><body style="margin:0;background:#050203;padding:32px 12px;font-family:'Courier New',Courier,monospace;color:#e8dcc8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0c0507;border:1px solid #5a0d14">
<tr><td style="padding:30px 32px 22px;border-bottom:1px solid #3a0a0f;text-align:center">
<div style="font-size:11px;letter-spacing:6px;color:#d0142c">TRANSMISSION FROM SECTOR ZERO</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:12px;color:#e8dcc8;margin-top:12px">KYPZERO</div>
<div style="font-size:11px;letter-spacing:4px;color:#8a7a72;margin-top:6px">HACK THE DARK</div></td></tr>
<tr><td style="padding:28px 32px;font-size:14px;line-height:1.75;color:#e8dcc8">${content}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #3a0a0f;font-size:11px;line-height:1.6;color:#7a6a64;text-align:center">
Sent from <a href="${site}" style="color:#d0142c">${site}</a><br>Questions? Just reply, or write to ${esc(env.ORG_EMAIL)}</td></tr>
</table></td></tr></table></body></html>`;
}

const row = (label, value) => `<tr><td style="padding:6px 0;color:#8a7a72;font-size:11px;letter-spacing:2px;width:120px;vertical-align:top">${label}</td><td style="padding:6px 0;color:#e8dcc8">${esc(value)}</td></tr>`;

/* ------------------------------------------------------------------ */
/* Middleware                                                          */
/* ------------------------------------------------------------------ */
const hits = new Map(); // best effort: per worker instance
const limiter = (max, windowMs) => async (c, next) => {
  const key = `${c.req.path}:${c.req.header('cf-connecting-ip') || 'local'}`;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) return c.json({ error: 'Too many signals. The void needs a moment. Try again later.' }, 429);
  list.push(now);
  hits.set(key, list);
  await next();
};

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const admin = async (c, next) => {
  if (!safeEqual(c.req.header('x-admin-key') || '', c.env.ADMIN_KEY || '')) return c.json({ error: 'Access denied.' }, 401);
  await next();
};

/* ------------------------------------------------------------------ */
/* Public routes                                                       */
/* ------------------------------------------------------------------ */
app.get('/events', async (c) => {
  const [{ results }, n] = await Promise.all([c.env.DB.prepare('SELECT * FROM events').all(), counts(c.env.DB)]);
  const list = results.map(rowToEvent).map((e) => publicEvent(e, n.get(e.id) || 0, c.env));
  list.sort((a, b) => a.date.localeCompare(b.date));
  return c.json(list);
});

app.get('/events/:id', async (c) => {
  const ev = await getEvent(c.env.DB, c.req.param('id'));
  if (!ev) throw new HttpError(404, 'This event has vanished.');
  const r = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?').bind(ev.id).first();
  return c.json(publicEvent(ev, r.n, c.env));
});

app.get('/stats', async (c) => {
  const r = await c.env.DB.prepare(`SELECT (SELECT COUNT(*) FROM events) AS events, (SELECT COUNT(*) FROM registrations) AS souls,
    (SELECT COUNT(DISTINCT lower(college)) FROM registrations) AS colleges`).first();
  return c.json(r);
});

app.post('/register', limiter(8, 10 * 60 * 1000), async (c) => {
  const b = await body(c);
  if (b.website) return c.json({ ok: true, ticket: 'KZ-000000', emailSent: false }); // honeypot
  const name = str(b.name, 80);
  const email = str(b.email, 120).toLowerCase();
  const phone = str(b.phone, 20);
  const college = str(b.college, 120);
  const fields = {};
  if (name.length < 2) fields.name = 'Tell us your name.';
  if (!EMAIL_RE.test(email)) fields.email = 'That email looks cursed. Check it.';
  if (!PHONE_RE.test(phone)) fields.phone = 'Enter a valid phone number.';
  if (college.length < 2) fields.college = 'Which college do you haunt?';
  if (Object.keys(fields).length) throw new HttpError(400, 'Some fields need attention.', fields);

  const db = c.env.DB;
  const ev = await getEvent(db, str(b.eventId, 60));
  if (!ev) throw new HttpError(404, 'This event has vanished.');
  if (ev.status !== 'open' || deadlinePassed(ev, c.env)) throw new HttpError(409, 'Registrations for this ritual are sealed.');

  const reg = {
    id: crypto.randomUUID(), ticket: `KZ-${hex(3).toUpperCase()}`, eventId: ev.id, eventTitle: ev.title,
    name, email, phone, college, createdAt: new Date().toISOString(),
  };
  let result;
  try {
    // The seat check and the insert are one statement, so two people can't take the last seat.
    result = await db.prepare(`INSERT INTO registrations (id, ticket, event_id, event_title, name, email, phone, college, created_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
      WHERE ?10 = 0 OR (SELECT COUNT(*) FROM registrations WHERE event_id = ?3) < ?10`)
      .bind(reg.id, reg.ticket, reg.eventId, reg.eventTitle, name, email, phone, college, reg.createdAt, ev.seats || 0).run();
  } catch (e) {
    if (/UNIQUE/i.test(e.message)) throw new HttpError(409, 'This email has already signed the pact for this event.');
    throw e;
  }
  if (!result.meta.changes) throw new HttpError(409, 'Every seat is taken. The circle is full.');

  const env = c.env;
  const [emailSent] = await Promise.all([
    sendMail(env, {
      to: email,
      subject: `Pact sealed: ${ev.title} [${reg.ticket}]`,
      text: `${name}, the pact is sealed.\n\nYou are registered for ${ev.title}.\nTicket: ${reg.ticket}\nWhen: ${fmtEventDate(ev.date)}\nWhere: ${ev.venue || 'TBA'}\n\n- KYPZERO`,
      html: shell(env, `
<p style="margin:0 0 14px">${esc(name)},</p>
<p style="margin:0 0 18px">The pact is sealed. Your name has been written into the servers of Sector Zero.
You are registered for <b style="color:#ff3b1f">${esc(ev.title)}</b>.</p>
<div style="border:1px dashed #b3001b;padding:16px 18px;margin:0 0 20px;text-align:center">
<div style="font-size:11px;letter-spacing:4px;color:#8a7a72">YOUR TICKET</div>
<div style="font-size:28px;letter-spacing:6px;color:#ff3b1f;margin-top:6px">${esc(reg.ticket)}</div></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row('EVENT', ev.title)}${row('WHEN', fmtEventDate(ev.date))}${row('WHERE', ev.venue || 'To be announced')}
${ev.teamSize ? row('TEAM SIZE', ev.teamSize) : ''}${row('NAME', name)}${row('COLLEGE', college)}${row('PHONE', phone)}
</table>
<p style="margin:22px 0 0">Keep this ticket. We will contact you with further instructions before the ritual begins.</p>
<p style="margin:14px 0 0;color:#8a7a72;font-style:italic">Don't look back.</p>`),
    }),
    sendMail(env, {
      to: env.ORG_EMAIL,
      replyTo: email,
      subject: `New registration: ${ev.title} (${name})`,
      text: `New registration for ${ev.title}\n\nTicket: ${reg.ticket}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nCollege: ${college}\nTime: ${reg.createdAt}`,
      html: shell(env, `<p style="margin:0 0 14px">A new soul signed the pact for <b style="color:#ff3b1f">${esc(ev.title)}</b>.</p>
<table role="presentation" width="100%">${row('TICKET', reg.ticket)}${row('NAME', name)}${row('EMAIL', email)}${row('PHONE', phone)}${row('COLLEGE', college)}${row('TIME', fmtStamp(reg.createdAt, env))}</table>`),
    }),
  ]);
  return c.json({ ok: true, ticket: reg.ticket, emailSent });
});

app.post('/contact', limiter(5, 10 * 60 * 1000), async (c) => {
  const b = await body(c);
  if (b.website) return c.json({ ok: true });
  const name = str(b.name, 80);
  const email = str(b.email, 120).toLowerCase();
  const message = str(b.message, 3000);
  const fields = {};
  if (name.length < 2) fields.name = 'Tell us your name.';
  if (!EMAIL_RE.test(email)) fields.email = 'That email looks cursed. Check it.';
  if (message.length < 5) fields.message = 'Say a little more.';
  if (Object.keys(fields).length) throw new HttpError(400, 'Some fields need attention.', fields);

  await c.env.DB.prepare('INSERT INTO messages (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), name, email, message, new Date().toISOString()).run();
  const env = c.env;
  const [delivered] = await Promise.all([
    sendMail(env, {
      to: env.ORG_EMAIL, replyTo: email, subject: `Signal received from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: shell(env, `<table role="presentation" width="100%">${row('FROM', name)}${row('EMAIL', email)}</table>
<p style="margin:18px 0 0;white-space:pre-wrap">${esc(message)}</p>`),
    }),
    sendMail(env, {
      to: email, subject: 'Your signal reached Sector Zero',
      text: `${name}, we received your message. Someone will answer from the dark soon.\n\n- KYPZERO`,
      html: shell(env, `<p style="margin:0 0 14px">${esc(name)},</p><p style="margin:0">Your signal reached us. Someone will answer from the dark soon.</p>
<p style="margin:14px 0 0;color:#8a7a72;font-style:italic">Stay near the light.</p>`),
    }),
  ]);
  return c.json({ ok: true, emailSent: delivered });
});

/* ------------------------------------------------------------------ */
/* Admin routes                                                        */
/* ------------------------------------------------------------------ */
app.use('/admin/*', admin);

app.get('/admin/check', (c) => c.json({
  ok: true, mail: c.env.BREVO_API_KEY ? 'live' : 'dry-run', provider: c.env.BREVO_API_KEY ? 'brevo' : 'dry-run',
  from: c.env.MAIL_FROM, storage: 'd1', storageReady: true,
}));

app.post('/admin/test-mail', async (c) => {
  const sent = await sendMail(c.env, {
    to: c.env.ORG_EMAIL, subject: 'Test transmission from Sector Zero',
    text: 'If you can read this, email delivery works.',
    html: shell(c.env, '<p style="margin:0">If you can read this, email delivery works. The pact emails will arrive like this one.</p>'),
  });
  return c.json({ ok: sent, mail: c.env.BREVO_API_KEY ? 'live' : 'dry-run' });
});

app.post('/admin/events', async (c) => {
  const ev = cleanEvent(await body(c), { id: hex(5), createdAt: new Date().toISOString() });
  await saveEvent(c.env.DB, ev);
  return c.json(ev, 201);
});

app.put('/admin/events/:id', async (c) => {
  const existing = await getEvent(c.env.DB, c.req.param('id'));
  if (!existing) throw new HttpError(404, 'Event not found.');
  const ev = cleanEvent(await body(c), existing);
  await saveEvent(c.env.DB, ev);
  return c.json(ev);
});

app.delete('/admin/events/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(c.req.param('id')).run();
  if (!r.meta.changes) throw new HttpError(404, 'Event not found.');
  return c.json({ ok: true });
});

async function listRegs(c) {
  const id = c.req.query('eventId');
  const stmt = id
    ? c.env.DB.prepare('SELECT * FROM registrations WHERE event_id = ? ORDER BY created_at DESC').bind(id)
    : c.env.DB.prepare('SELECT * FROM registrations ORDER BY created_at DESC');
  return (await stmt.all()).results.map(rowToReg);
}

app.get('/admin/registrations', async (c) => c.json(await listRegs(c)));

app.get('/admin/registrations.csv', async (c) => {
  const regs = await listRegs(c);
  const cols = ['ticket', 'eventTitle', 'name', 'email', 'phone', 'college', 'createdAt'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...regs.map((r) => cols.map((k) => cell(r[k])).join(','))].join('\r\n');
  return new Response(`\uFEFF${csv}`, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="registrations.csv"' },
  });
});

app.delete('/admin/registrations/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM registrations WHERE id = ?').bind(c.req.param('id')).run();
  if (!r.meta.changes) throw new HttpError(404, 'Registration not found.');
  return c.json({ ok: true });
});

app.get('/admin/messages', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, email, message, created_at AS createdAt FROM messages ORDER BY created_at DESC').all();
  return c.json(results);
});

app.notFound((c) => c.json({ error: 'Nothing lives here.' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, ...(err.fields ? { fields: err.fields } : {}) }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong in the dark. Try again.' }, 500);
});

export const onRequest = handle(app);
