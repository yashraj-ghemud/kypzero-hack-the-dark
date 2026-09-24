// Email templates. Email clients have no JavaScript and patchy CSS, so everything is tables and
// inline styles; motion comes from the animated hero GIF in public/mail/.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const C = {
  void: '#050203', ink: '#0c0507', panel: '#120608', line: '#3a0a0f', blood: '#b3001b',
  ember: '#ff3b1f', bone: '#e8dcc8', dim: '#8a7a72', paper: '#d9ccb2', paperInk: '#1c1310',
};
const SERIF = "Georgia,'Times New Roman',serif";
const MONO = "'Courier New',Courier,monospace";

/* ---------------- dates ---------------- */
// Event dates are wall-clock strings ("2026-10-31T18:00") in the organiser's timezone.
export function localToDate(s, offset = '+05:30') {
  if (!s) return null;
  if (/(Z|[+-]\d\d:\d\d)$/.test(s)) return new Date(s);
  const full = s.length === 10 ? `${s}T00:00:00` : s.length === 16 ? `${s}:00` : s;
  return new Date(`${full}${offset}`);
}

export function fmtEventDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s || '');
  if (!m) return 'To be announced';
  const d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)));
  return d.toLocaleString('en-IN', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', ...(m[4] ? { hour: '2-digit', minute: '2-digit' } : {}) });
}

export const fmtStamp = (iso, env) => new Date(iso).toLocaleString('en-IN', { timeZone: env.TIMEZONE || 'Asia/Kolkata' });

function countdown(ev, env) {
  const start = localToDate(ev.date, env.TZ_OFFSET);
  if (!start || isNaN(start)) return null;
  const ms = start.getTime() - Date.now();
  if (ms <= 0) return { big: 'NOW', small: 'THE RITUAL HAS ALREADY BEGUN' };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0
    ? { big: String(days), small: `${days === 1 ? 'DAY' : 'DAYS'} · ${hours} HOURS UNTIL THE RITUAL` }
    : { big: String(hours), small: 'HOURS UNTIL THE RITUAL' };
}

function creepyLine(iso, env) {
  const tz = env.TIMEZONE || 'Asia/Kolkata';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(d));
  if (hour < 5) return `You signed at <b>${time}</b>. Most people are asleep at that hour. We weren't.`;
  if (hour < 12) return `You signed at <b>${time}</b>. Early. Eager. The servers like that.`;
  if (hour < 18) return `You signed at <b>${time}</b>, in broad daylight. Brave. It won't help.`;
  return `You signed at <b>${time}</b>, just as the lights started to flicker.`;
}

function calendarUrl(ev, env) {
  const start = localToDate(ev.date, env.TZ_OFFSET);
  if (!start || isNaN(start)) return null;
  const end = new Date(start.getTime() + 24 * 3600000);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: `${ev.title} — KYPZERO`, dates: `${f(start)}/${f(end)}`,
    details: `${ev.tagline || ''}\n\nYou signed the pact. Don't be late.\n${env.SITE_URL}`, location: ev.venue || '',
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/* ---------------- building blocks ---------------- */
function barcode(code) {
  let bars = '';
  let dark = true;
  for (const ch of `*${code}*`) {
    const n = ch.charCodeAt(0);
    for (let k = 0; k < 5; k++) {
      const w = 1 + ((n >> k) & 1) + ((n >> (k + 2)) & 1);
      bars += `<td width="${w * 2}" style="width:${w * 2}px;height:44px;background:${dark ? C.bone : C.panel};font-size:0;line-height:0">&nbsp;</td>`;
      dark = !dark;
    }
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${bars}</tr></table>`;
}

function button(href, label, solid) {
  return `<td style="padding:6px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td bgcolor="${solid ? C.blood : C.ink}" style="border:1px solid ${solid ? C.ember : '#5a4a44'};padding:14px 22px">
<a href="${esc(href)}" style="font-family:${MONO};font-size:12px;letter-spacing:4px;color:#ffffff;text-decoration:none;font-weight:bold">${label}</a>
</td></tr></table></td>`;
}

const kicker = (t, color = C.ember) => `<div style="font-family:${MONO};font-size:11px;letter-spacing:6px;color:${color}">${t}</div>`;

function layout(env, { preheader, hero = true, body }) {
  const site = esc(env.SITE_URL);
  const stamp = new Date().toLocaleString('en-US', { timeZone: env.TIMEZONE || 'Asia/Kolkata', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).toUpperCase();
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>KYPZERO</title>
<style>
  @media (max-width:620px){ .wrap{width:100%!important} .pad{padding-left:20px!important;padding-right:20px!important} .stack{display:block!important;width:auto!important;box-sizing:border-box} .big{font-size:30px!important;letter-spacing:4px!important} }
  a{color:${C.ember}}
</style></head>
<body style="margin:0;padding:0;background:${C.void}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.void}">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.void}" style="background:${C.void}"><tr><td align="center" style="padding:28px 10px 40px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${C.ink};border:1px solid #5a0d14">
<tr><td style="padding:10px 16px;border-bottom:1px solid ${C.line}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:${MONO};font-size:11px;letter-spacing:3px;color:#ff4a3a">&#9679; REC</td>
<td align="right" style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:${C.dim}">${stamp} &middot; CH-13</td>
</tr></table></td></tr>
${hero ? `<tr><td style="line-height:0;font-size:0"><img src="${site}/mail/hero.gif" width="600" alt="KYPZERO — transmission received" style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#1a0306"></td></tr>` : ''}
${body}
<tr><td class="pad" style="padding:26px 36px 30px;border-top:1px solid ${C.line};text-align:center">
<div style="font-family:${MONO};font-size:10px;letter-spacing:3px;color:#4a2a2a">01001011 01011001 01010000 00110000</div>
<div style="font-family:${MONO};font-size:11px;line-height:1.8;color:#6a5a54;margin-top:10px">
This transmission will self-corrupt in 13 days.<br>
Sent from <a href="${site}" style="color:${C.ember};text-decoration:none">${site.replace(/^https?:\/\//, '')}</a> &middot; Reply to reach a human (probably): ${esc(env.ORG_EMAIL)}</div>
</td></tr>
</table></td></tr></table></body></html>`;
}

/* ---------------- the participant's ticket ---------------- */
export function confirmationMail(env, ev, reg, { soulNo = 1, seats = 0 } = {}) {
  const { name, email, college, phone, ticket } = reg;
  const cd = countdown(ev, env);
  const cal = calendarUrl(ev, env);
  const soul = `SOUL #${String(soulNo).padStart(3, '0')}${seats ? ` OF ${seats}` : ''}`;
  const first = esc(String(name).split(/\s+/)[0]);
  const detail = (label, value) => `<tr><td style="padding:5px 0;font-family:${MONO};font-size:10px;letter-spacing:3px;color:${C.ember};width:74px;vertical-align:top">${label}</td>
<td style="padding:5px 0;font-family:${MONO};font-size:13px;color:${C.bone}">${esc(value)}</td></tr>`;

  const body = `
<tr><td class="pad" style="padding:34px 40px 8px;text-align:center">
${kicker('CASE FILE #13 &middot; STATUS: ACCEPTED')}
<div class="big" style="font-family:${SERIF};font-size:38px;line-height:1.15;letter-spacing:8px;color:${C.bone};margin:14px 0 6px;font-weight:bold">THE PACT<br>IS SEALED</div>
<div style="font-family:${MONO};font-size:12px;letter-spacing:3px;color:${C.dim}">${esc(ev.title).toUpperCase()}</div>
</td></tr>

<tr><td class="pad" style="padding:22px 40px 6px;font-family:${SERIF};font-size:17px;line-height:1.7;color:${C.bone}">
<p style="margin:0 0 12px">${first}.</p>
<p style="margin:0 0 12px">${creepyLine(reg.createdAt, env)}</p>
<p style="margin:0">Your name has been written into the servers of Sector Zero. There is no unsubscribe from what happens next. Keep this ticket close.</p>
</td></tr>

<tr><td class="pad" style="padding:26px 30px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #5a0d14">
<tr>
<td class="stack" width="64%" valign="top" bgcolor="${C.panel}" style="padding:20px 22px;border-left:5px solid ${C.blood}">
<div style="font-family:${MONO};font-size:10px;letter-spacing:5px;color:${C.dim}">ADMIT ONE SOUL</div>
<div style="font-family:${SERIF};font-size:24px;font-weight:bold;letter-spacing:2px;color:#ffffff;margin:8px 0 12px">${esc(ev.title)}</div>
<table role="presentation" cellpadding="0" cellspacing="0">
${detail('WHEN', fmtEventDate(ev.date))}${detail('WHERE', ev.venue || 'To be announced')}
${ev.teamSize ? detail('TEAM', ev.teamSize) : ''}${detail('BEARER', name)}${detail('COVEN', college)}
</table></td>
<td class="stack" width="36%" valign="middle" align="center" bgcolor="#1a0709" style="padding:20px 14px;border-left:2px dashed #5a0d14;text-align:center">
<div style="font-family:${MONO};font-size:10px;letter-spacing:5px;color:${C.dim}">TICKET</div>
<div style="font-family:${MONO};font-size:24px;letter-spacing:3px;color:${C.ember};font-weight:bold;margin:8px 0">${esc(ticket)}</div>
<div style="font-family:${MONO};font-size:11px;letter-spacing:3px;color:${C.bone};border-top:1px solid #5a0d14;padding-top:8px;margin-top:4px">${soul}</div>
</td></tr>
<tr><td colspan="2" bgcolor="${C.panel}" style="padding:16px 10px 12px;border-top:2px dashed #5a0d14;text-align:center">
${barcode(ticket)}
<div style="font-family:${MONO};font-size:10px;letter-spacing:4px;color:${C.dim};margin-top:8px">${esc(ticket)} &middot; NON-TRANSFERABLE SOUL</div>
</td></tr>
</table></td></tr>

${cd ? `<tr><td class="pad" style="padding:22px 40px 4px;text-align:center">
<div style="font-family:${SERIF};font-size:64px;line-height:1;color:${C.ember};font-weight:bold">${cd.big}</div>
<div style="font-family:${MONO};font-size:11px;letter-spacing:5px;color:${C.bone};margin-top:8px">${cd.small}</div>
</td></tr>` : ''}

<tr><td align="center" style="padding:20px 20px 6px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
${cal ? button(cal, '&#128197; ADD TO CALENDAR', true) : ''}
${button(`${env.SITE_URL}/#events`, 'OPEN THE CASE FILE', false)}
</tr></table></td></tr>

<tr><td class="pad" style="padding:26px 40px 6px">
${kicker('SURVIVAL PROTOCOL')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
${[
    ['01', 'Bring your laptop, charger and college ID.'],
    ['02', 'Arrive 30 minutes before the ritual begins.'],
    ['03', 'Show this ticket at the gate. Screenshots accepted. Excuses are not.'],
    ['04', 'Do not look behind you.', true],
  ].map(([n, t, red]) => `<tr><td width="40" style="padding:9px 0;border-bottom:1px solid ${C.line};font-family:${MONO};font-size:13px;color:${C.ember};vertical-align:top">${n}</td>
<td style="padding:9px 0;border-bottom:1px solid ${C.line};font-family:${MONO};font-size:13px;line-height:1.6;color:${red ? C.ember : C.bone}">${red ? `<b>${t}</b> <span style="color:${C.dim}">(we mean it)</span>` : t}</td></tr>`).join('')}
</table></td></tr>

<tr><td class="pad" style="padding:28px 30px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="background:${C.paper};border-left:6px solid ${C.blood}">
<tr><td style="padding:20px 24px;font-family:${MONO};font-size:13px;line-height:1.9;color:${C.paperInk}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:${MONO};font-size:11px;letter-spacing:3px;color:${C.paperInk}">DOSSIER &middot; SUBJECT ${esc(ticket)}</td>
<td align="right"><span style="border:2px solid ${C.blood};color:${C.blood};font-family:${MONO};font-size:11px;letter-spacing:3px;padding:3px 8px;font-weight:bold">CLASSIFIED</span></td>
</tr></table>
<p style="margin:14px 0 0">Subject <b>${esc(name)}</b> entered Sector Zero on record. Contact frequency <span style="background:${C.paperInk};color:${C.paperInk}">${esc(phone).replace(/./g, '&#9608;')}</span> has been logged.
Subject is advised that the <span style="background:${C.paperInk};color:${C.paperInk}">&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;</span> on floor 13 is not part of the event.
KYPZERO cannot guarantee <span style="background:${C.paperInk};color:${C.paperInk}">&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;</span> after midnight. Participation is voluntary. Leaving is <span style="background:${C.paperInk};color:${C.paperInk}">&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;</span>.</p>
</td></tr></table></td></tr>

<tr><td class="pad" style="padding:22px 36px 26px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="font-family:${SERIF};font-size:16px;line-height:1.7;color:${C.bone}">
We will send final instructions before the ritual begins.<br>
<span style="font-style:italic;color:${C.dim}">Until then, stay near the light.</span><br>
<span style="font-family:${SERIF};font-size:20px;font-style:italic;color:${C.ember}">&mdash; The 13</span></td>
<td width="130" align="right" valign="middle"><img src="${esc(env.SITE_URL)}/mail/seal.png" width="120" height="120" alt="Pact sealed" style="display:block;border:0;width:120px;height:120px"></td>
</tr></table></td></tr>`;

  return {
    to: email,
    subject: `🩸 The pact is sealed: ${ev.title} [${ticket}]`,
    text: `${name}, the pact is sealed.\n\nYou are registered for ${ev.title}.\nTicket: ${ticket} (${soul})\nWhen: ${fmtEventDate(ev.date)}\nWhere: ${ev.venue || 'TBA'}\n\nSurvival protocol:\n01 Bring your laptop, charger and college ID.\n02 Arrive 30 minutes early.\n03 Show this ticket at the gate.\n04 Do not look behind you.\n\n— The 13\n${env.SITE_URL}`,
    html: layout(env, { preheader: `Ticket ${ticket} is inside. Don't read this alone.`, body }),
  };
}

/* ---------------- organiser notification ---------------- */
export function intakeReportMail(env, ev, reg, { soulNo = 1, seats = 0 } = {}) {
  const pct = seats ? Math.min(100, Math.round((soulNo / seats) * 100)) : 0;
  const row = (l, v) => `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};font-family:${MONO};font-size:10px;letter-spacing:3px;color:${C.ember};width:110px">${l}</td>
<td style="padding:7px 0;border-bottom:1px solid ${C.line};font-family:${MONO};font-size:14px;color:${C.bone}">${esc(v)}</td></tr>`;
  const body = `
<tr><td class="pad" style="padding:30px 40px 6px;text-align:center">
${kicker('SOUL INTAKE REPORT')}
<div style="font-family:${SERIF};font-size:54px;line-height:1.1;color:#ffffff;font-weight:bold;margin-top:10px">#${soulNo}</div>
<div style="font-family:${MONO};font-size:12px;letter-spacing:3px;color:${C.bone}">${seats ? `OF ${seats} SEATS &middot; ` : ''}${esc(ev.title).toUpperCase()}</div>
</td></tr>
${seats ? `<tr><td class="pad" style="padding:16px 40px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="${pct}%" bgcolor="${C.ember}" style="height:6px;font-size:0;line-height:0">&nbsp;</td>
<td bgcolor="#2a1214" style="height:6px;font-size:0;line-height:0">&nbsp;</td></tr></table>
<div style="font-family:${MONO};font-size:11px;color:${C.dim};margin-top:6px;text-align:right">${pct}% of the circle is full &middot; ${Math.max(0, seats - soulNo)} seats left</div>
</td></tr>` : ''}
<tr><td class="pad" style="padding:20px 40px 6px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row('TICKET', reg.ticket)}${row('NAME', reg.name)}${row('EMAIL', reg.email)}${row('PHONE', reg.phone)}${row('COLLEGE', reg.college)}${row('SIGNED', fmtStamp(reg.createdAt, env))}
</table></td></tr>
<tr><td align="center" style="padding:20px 20px 24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${button(`${env.SITE_URL}/admin`, 'OPEN CONTROL ROOM', true)}</tr></table>
<div style="font-family:${MONO};font-size:11px;color:${C.dim};margin-top:10px">Reply to this email to answer ${esc(reg.name)} directly.</div>
</td></tr>`;
  return {
    to: env.ORG_EMAIL,
    replyTo: reg.email,
    subject: `☠ Soul #${soulNo} bound: ${reg.name} → ${ev.title}`,
    text: `New registration for ${ev.title}\n\nSoul #${soulNo}${seats ? ` of ${seats}` : ''}\nTicket: ${reg.ticket}\nName: ${reg.name}\nEmail: ${reg.email}\nPhone: ${reg.phone}\nCollege: ${reg.college}\nTime: ${fmtStamp(reg.createdAt, env)}`,
    html: layout(env, { preheader: `${reg.name} from ${reg.college} just signed the pact.`, hero: false, body }),
  };
}

/* ---------------- contact form ---------------- */
export function signalMail(env, { name, email, message, createdAt }) {
  const body = `
<tr><td class="pad" style="padding:30px 40px 6px">
${kicker('INCOMING SIGNAL')}
<div style="font-family:${SERIF};font-size:26px;color:#ffffff;font-weight:bold;margin:10px 0 4px">${esc(name)}</div>
<div style="font-family:${MONO};font-size:13px;color:${C.dim}">${esc(email)} &middot; ${fmtStamp(createdAt, env)}</div>
</td></tr>
<tr><td class="pad" style="padding:16px 30px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="border:1px solid #1f3a2a">
<tr><td style="padding:18px 20px;font-family:${MONO};font-size:14px;line-height:1.7;color:#7dffa6;white-space:pre-wrap">&gt; ${esc(message)}<span style="color:#7dffa6">&#9608;</span></td></tr></table>
<div style="font-family:${MONO};font-size:11px;color:${C.dim};margin-top:10px">Reply to this email to answer ${esc(name)} directly.</div>
</td></tr>`;
  return {
    to: env.ORG_EMAIL, replyTo: email, subject: `📡 Signal from ${name}`,
    text: `From: ${name} <${email}>\n\n${message}`,
    html: layout(env, { preheader: String(message).slice(0, 90), hero: false, body }),
  };
}

export function signalReceivedMail(env, { name, email }) {
  const body = `
<tr><td class="pad" style="padding:32px 40px 30px;text-align:center">
${kicker('SIGNAL RECEIVED')}
<div class="big" style="font-family:${SERIF};font-size:32px;letter-spacing:6px;color:${C.bone};font-weight:bold;margin:14px 0 18px">WE HEARD YOU</div>
<p style="font-family:${SERIF};font-size:17px;line-height:1.7;color:${C.bone};margin:0 0 12px">${esc(String(name).split(/\s+/)[0])}, your message made it through the static.</p>
<p style="font-family:${SERIF};font-size:17px;line-height:1.7;color:${C.bone};margin:0 0 22px">Someone will answer from the dark soon. If the lights flicker while you wait, that's normal.</p>
<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${button(`${env.SITE_URL}/#events`, 'SEE THE RITUALS', true)}</tr></table>
</td></tr>`;
  return {
    to: email, subject: '📡 Your signal reached Sector Zero',
    text: `${name}, we received your message. Someone will answer from the dark soon.\n\n— KYPZERO\n${env.SITE_URL}`,
    html: layout(env, { preheader: 'Your message made it through the static.', body }),
  };
}
