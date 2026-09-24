(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  let key = sessionStorage.getItem('kz_admin') || '';
  let events = [];
  let regs = [];

  const toast = (msg, type = '') => {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.className = 'toast'; }, 3500);
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-key': key, ...(opts.headers || {}) } });
    if (res.status === 401) { lock(); throw new Error('Access denied.'); }
    const out = res.headers.get('content-type')?.includes('json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error(out.error || 'Request failed');
    return out;
  }

  function lock() {
    key = '';
    sessionStorage.removeItem('kz_admin');
    $('#app').hidden = true;
    $('#login').hidden = false;
  }

  async function unlock() {
    const info = await api('/api/admin/check');
    sessionStorage.setItem('kz_admin', key);
    $('#login').hidden = true;
    $('#app').hidden = false;
    const live = info.mail === 'live';
    $('#mail-status').textContent = live ? `MAIL LIVE (${info.provider}) · ${info.from}` : 'MAIL DRY-RUN';
    $('#store-warn').hidden = info.storageReady;
    $('#mail-status').className = `pill ${live ? 'live' : 'dry'}`;
    $('#mail-warn').hidden = live;
    await Promise.all([loadEvents(), loadRegs(), loadMessages()]);
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    key = $('#key').value.trim();
    $('#login-err').textContent = '';
    try { await unlock(); } catch (err) { $('#login-err').textContent = err.message; }
  });
  $('#logout').addEventListener('click', lock);
  $('#test-mail').addEventListener('click', async () => {
    try {
      const r = await api('/api/admin/test-mail', { method: 'POST' });
      toast(r.ok ? 'Test email sent to kypzerorg@gmail.com' : r.mail === 'dry-run' ? 'Dry-run mode: set GMAIL_APP_PASSWORD first.' : 'Sending failed. Check the server log.', r.ok ? '' : 'error');
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ---------------- events ---------------- */
  async function loadEvents() {
    events = await (await fetch('/api/events')).json();
    $('#ev-count').textContent = `${events.length} total`;
    $('#events').innerHTML = events.length ? events.map((ev) => `
      <div class="ev ${$('#event-form').elements.eid.value === ev.id ? 'editing' : ''}">
        <div class="ev-top"><h3>${esc(ev.title)}</h3><span class="badge ${ev.status}">${ev.status === 'open' ? (ev.open ? 'OPEN' : ev.full ? 'FULL' : 'DEADLINE PASSED') : 'SEALED'}</span></div>
        <div class="meta">${fmt(ev.date)} · ${esc(ev.venue || 'TBA')} · ${esc(ev.mode)}</div>
        <div class="meta">${ev.registered} registered${ev.seats ? ` / ${ev.seats} seats` : ''}${ev.deadline ? ` · deadline ${esc(ev.deadline)}` : ''}</div>
        ${ev.seats ? `<div class="bar"><i style="width:${Math.min(100, (ev.registered / ev.seats) * 100)}%"></i></div>` : ''}
        <div class="actions">
          <button class="btn small" data-edit="${ev.id}">EDIT</button>
          <button class="btn small ghost" data-toggle="${ev.id}">${ev.status === 'open' ? 'SEAL' : 'OPEN'}</button>
          <button class="btn small ghost" data-regs="${ev.id}">REGISTRATIONS</button>
          <button class="btn small ghost danger" data-del="${ev.id}">DELETE</button>
        </div>
      </div>`).join('') : '<p class="muted">No events yet. Summon one.</p>';
    const sel = $('#reg-filter');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All events</option>' + events.map((e) => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
    sel.value = cur;
  }

  function fillForm(ev) {
    const f = $('#event-form');
    f.reset();
    f.elements.eid.value = ev?.id || '';
    if (ev) {
      ['title', 'tagline', 'description', 'date', 'deadline', 'venue', 'mode', 'status', 'prize', 'teamSize', 'seats'].forEach((k) => { if (f.elements[k]) f.elements[k].value = ev[k] ?? ''; });
      f.elements.tags.value = (ev.tags || []).join(', ');
    }
    $('#form-title').textContent = ev ? `EDITING: ${ev.title}` : 'SUMMON A NEW EVENT';
    $('#form-submit').textContent = ev ? 'SAVE CHANGES' : 'SUMMON EVENT';
    $('#form-err').textContent = '';
  }

  $('#form-reset').addEventListener('click', () => { fillForm(null); loadEvents(); });

  $('#event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const data = Object.fromEntries(new FormData(f));
    const id = data.eid;
    delete data.eid;
    try {
      if (id) await api(`/api/admin/events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      else await api('/api/admin/events', { method: 'POST', body: JSON.stringify(data) });
      toast(id ? 'Event updated.' : 'Event summoned. It is now carved into a monolith.');
      fillForm(null);
      await loadEvents();
    } catch (err) { $('#form-err').textContent = err.message; }
  });

  $('#events').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ev = events.find((x) => x.id === (b.dataset.edit || b.dataset.toggle || b.dataset.del || b.dataset.regs));
    if (!ev) return;
    try {
      if (b.dataset.edit) { fillForm(ev); await loadEvents(); scrollTo({ top: 0, behavior: 'smooth' }); }
      if (b.dataset.toggle) { await api(`/api/admin/events/${ev.id}`, { method: 'PUT', body: JSON.stringify({ status: ev.status === 'open' ? 'closed' : 'open' }) }); await loadEvents(); }
      if (b.dataset.del && confirm(`Delete "${ev.title}"? Registrations stay in the database.`)) { await api(`/api/admin/events/${ev.id}`, { method: 'DELETE' }); toast('Event deleted.'); await loadEvents(); }
      if (b.dataset.regs) { $('#reg-filter').value = ev.id; await loadRegs(); $('#regs').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    } catch (err) { toast(err.message, 'error'); }
  });

  /* ---------------- registrations ---------------- */
  async function loadRegs() {
    const id = $('#reg-filter').value;
    regs = await api(`/api/admin/registrations${id ? `?eventId=${encodeURIComponent(id)}` : ''}`);
    renderRegs();
  }

  function renderRegs() {
    const q = $('#reg-search').value.trim().toLowerCase();
    const list = q ? regs.filter((r) => [r.name, r.email, r.college, r.phone, r.ticket].some((v) => String(v).toLowerCase().includes(q))) : regs;
    $('#reg-count').textContent = `(${list.length})`;
    $('#regs').innerHTML = list.length ? list.map((r) => `
      <tr><td>${esc(r.ticket)}</td><td>${esc(r.eventTitle)}</td><td>${esc(r.name)}</td>
      <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td><td>${esc(r.phone)}</td><td>${esc(r.college)}</td>
      <td>${fmt(r.createdAt)}</td><td><button class="x" data-resend="${r.id}" title="Resend confirmation email">✉</button> <button class="x" data-rdel="${r.id}" title="Delete">✕</button></td></tr>`).join('')
      : '<tr><td colspan="8" class="empty">No souls bound yet.</td></tr>';
  }

  $('#reg-filter').addEventListener('change', loadRegs);
  $('#reg-search').addEventListener('input', renderRegs);
  $('#regs').addEventListener('click', async (e) => {
    const rs = e.target.closest('[data-resend]');
    if (rs) {
      try { const r = await api(`/api/admin/registrations/${rs.dataset.resend}/resend`, { method: 'POST' }); toast(r.ok ? `Email resent to ${r.to}` : 'Sending failed. Check the mail log.', r.ok ? '' : 'error'); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const b = e.target.closest('[data-rdel]');
    if (!b || !confirm('Delete this registration?')) return;
    try { await api(`/api/admin/registrations/${b.dataset.rdel}`, { method: 'DELETE' }); await Promise.all([loadRegs(), loadEvents()]); } catch (err) { toast(err.message, 'error'); }
  });

  $('#csv').addEventListener('click', async () => {
    const id = $('#reg-filter').value;
    const res = await fetch(`/api/admin/registrations.csv${id ? `?eventId=${encodeURIComponent(id)}` : ''}`, { headers: { 'x-admin-key': key } });
    if (!res.ok) { toast('Export failed.', 'error'); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    const ev = events.find((x) => x.id === id);
    a.href = url;
    a.download = `registrations-${ev ? ev.title.replace(/[^\w]+/g, '-').toLowerCase() : 'all'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  /* ---------------- messages ---------------- */
  async function loadMessages() {
    const msgs = await api('/api/admin/messages');
    $('#messages').innerHTML = msgs.length ? msgs.map((m) => `
      <div class="msg"><div class="from">${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a> · ${fmt(m.createdAt)}</div><p>${esc(m.message)}</p></div>`).join('')
      : '<p class="muted">No signals received yet.</p>';
  }

  if (key) unlock().catch(lock);
})();
