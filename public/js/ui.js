const gsap = window.gsap;
const SECTIONS = ['home', 'events', 'about', 'contact'];
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,17}$/;
const GLYPHS = '!<>-_\\/[]{}=+*^?#01ΞΨ░▒▓';

function fmtDate(iso, withTime = true) {
  const d = new Date(iso);
  if (isNaN(d)) return 'TBA';
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  return withTime ? `${date} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : date;
}

export function scramble(el, text = el.dataset.text || el.textContent, duration = 0.8) {
  if (!el) return;
  el.dataset.text ||= text;
  const start = performance.now();
  cancelAnimationFrame(el._scr);
  const step = (now) => {
    const p = Math.min(1, (now - start) / (duration * 1000));
    const n = Math.floor(p * text.length);
    let out = text.slice(0, n);
    for (let i = n; i < text.length; i++) out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = out;
    if (p < 1) el._scr = requestAnimationFrame(step);
  };
  el._scr = requestAnimationFrame(step);
}

export class UI {
  constructor({ world, audio }) {
    this.world = world;
    this.audio = audio;
    this.current = null;
    this.enabled = false;
    this.events = [];
    this.filter = 'all';
    this.wheelAcc = 0;
    this.wheelLock = 0;
    this.startTime = performance.now();
    this.idleAt = performance.now();
    this.title = document.title;
    this._bind();
  }

  /* ---------------- wiring ---------------- */
  _bind() {
    document.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { e.preventDefault(); if (this.enabled) this.go(go.dataset.go); return; }
      const reg = e.target.closest('[data-register]');
      if (reg) { this.openEvent(reg.dataset.register, true); return; }
      const det = e.target.closest('[data-details]');
      if (det) { this.openEvent(det.dataset.details, false); return; }
      if (e.target.closest('[data-close]')) this.closeModal();
      const flt = e.target.closest('[data-filter]');
      if (flt) { this.filter = flt.dataset.filter; $$('[data-filter]').forEach((b) => b.classList.toggle('is-on', b === flt)); this.renderEvents(); }
      const faq = e.target.closest('.faq-q');
      if (faq) { faq.parentElement.classList.toggle('is-open'); this.audio.tick(); }
    });

    document.addEventListener('pointerover', (e) => {
      const n = e.target.closest('.nav a, .btn, .case, .faq-q');
      if (n && n !== this._lastHover) {
        this._lastHover = n;
        this.audio.tick();
        const label = n.querySelector('.nav-label');
        if (label) scramble(label, label.dataset.text || label.textContent, 0.45);
      }
    });

    addEventListener('wheel', (e) => this._wheel(e), { passive: true });
    addEventListener('keydown', (e) => {
      this.idleAt = performance.now();
      if (e.key === 'Escape') { this.closeModal(); return; }
      if (!this.enabled || this.modalOpen || e.target.closest('input, textarea, select')) return;
      if (/^[1-4]$/.test(e.key)) this.go(SECTIONS[+e.key - 1]);
      if (e.key === 'ArrowDown' || e.key === 'PageDown') this.step(1);
      if (e.key === 'ArrowUp' || e.key === 'PageUp') this.step(-1);
    });

    let ty = null;
    addEventListener('touchstart', (e) => { ty = e.target.closest('.panel, .modal') ? null : e.touches[0].clientY; }, { passive: true });
    addEventListener('touchend', (e) => {
      if (ty === null || !this.enabled || this.modalOpen) return;
      const dy = ty - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 60) this.step(Math.sign(dy));
      ty = null;
    }, { passive: true });

    ['pointermove', 'pointerdown'].forEach((ev) => addEventListener(ev, () => { this.idleAt = performance.now(); }, { passive: true }));

    const sound = $('#sound');
    sound.classList.toggle('is-muted', this.audio.muted);
    sound.addEventListener('click', () => {
      this.audio.init();
      this.audio.setMuted(!this.audio.muted);
      sound.classList.toggle('is-muted', this.audio.muted);
    });

    $$('.btn').forEach((b) => this._magnetic(b));
    $('#contact-form').addEventListener('submit', (e) => this._contact(e));

    document.addEventListener('visibilitychange', () => {
      document.title = document.hidden ? 'come back…' : this.title;
    });

    this.world?.on('pick', (d) => {
      if (d.type === 'monolith' && d.event) this.openEvent(d.event.id, false);
      if (d.type === 'eye') { this.audio.whisper(0.8); this.subtitle(['stop touching me', 'I see you', 'you came back', 'closer'][(Math.random() * 4) | 0], 1.8, { whisper: true }); }
      if (d.type === 'crt') { this.audio.buzz(0.4); }
    });

    setInterval(() => this._hud(), 100);
    setInterval(() => this._countdown(), 1000);
    setInterval(() => this._idle(), 2000);
  }

  _magnetic(el) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width / 2) / r.width;
      const dy = (e.clientY - r.top - r.height / 2) / r.height;
      gsap.to(el, { x: dx * 10, y: dy * 8, duration: 0.3, ease: 'power2.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }));
  }

  _tilt(card) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--rx', `${-py * 8}deg`);
      card.style.setProperty('--ry', `${px * 10}deg`);
      card.style.setProperty('--gx', `${(px + 0.5) * 100}%`);
      card.style.setProperty('--gy', `${(py + 0.5) * 100}%`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  }

  /* ---------------- navigation ---------------- */
  enterWorld(target) {
    this.enabled = true;
    document.body.classList.remove('is-intro');
    document.body.classList.add('is-world');
    this.world?.setMode('world');
    gsap.fromTo('.hud', { opacity: 0, y: (i) => (i ? 20 : -20) }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.15, ease: 'power3.out' });
    const name = SECTIONS.includes(target) ? target : 'home';
    if (name === 'home') {
      this.current = 'home';
      this._setNav('home');
      this._showPanel('home', 0.1);
    } else {
      this.current = 'home';
      this.go(name);
    }
  }

  step(dir) {
    const i = SECTIONS.indexOf(this.current);
    const next = SECTIONS[Math.max(0, Math.min(SECTIONS.length - 1, i + dir))];
    if (next !== this.current) this.go(next);
  }

  go(name) {
    if (!SECTIONS.includes(name) || name === this.current) return;
    const prev = this.current;
    this.current = name;
    this._setNav(name);
    history.replaceState(null, '', `#${name}`);
    if (prev) this._hidePanel(prev);
    this.audio.whoosh(2.2);
    if (this.world) {
      this.world.goTo(name, { duration: 3 });
      this._showPanel(name, 1.7);
    } else this._showPanel(name, 0.3);
    this.wheelLock = performance.now() + 1800;
  }

  _setNav(name) {
    $$('.nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.go === name));
  }

  _showPanel(name, delay = 0) {
    const el = $(`#sec-${name}`);
    gsap.killTweensOf(el);
    el.classList.add('is-active');
    el.scrollTop = 0;
    gsap.fromTo(el, { opacity: 0, clipPath: 'inset(0% 0% 100% 0%)' }, { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, delay, ease: 'power3.out', clearProps: 'clipPath' });
    gsap.fromTo($$('[data-reveal]', el), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, delay: delay + 0.2, ease: 'power3.out' });
    gsap.delayedCall(delay + 0.1, () => $$('[data-scramble]', el).forEach((h) => scramble(h, h.dataset.text || h.textContent, 1)));
  }

  _hidePanel(name) {
    const el = $(`#sec-${name}`);
    gsap.killTweensOf(el);
    gsap.to(el, { opacity: 0, duration: 0.45, ease: 'power2.in', onComplete: () => el.classList.remove('is-active') });
  }

  _wheel(e) {
    this.idleAt = performance.now();
    if (!this.enabled || this.modalOpen) return;
    const panel = e.target.closest('.panel');
    if (panel && panel.scrollHeight > panel.clientHeight + 4) {
      const atTop = panel.scrollTop <= 0;
      const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2;
      if ((e.deltaY > 0 && !atBottom) || (e.deltaY < 0 && !atTop)) return;
    }
    const now = performance.now();
    if (now < this.wheelLock) return;
    this.wheelAcc += e.deltaY;
    clearTimeout(this._wr);
    this._wr = setTimeout(() => { this.wheelAcc = 0; }, 260);
    if (Math.abs(this.wheelAcc) > 110) {
      const dir = Math.sign(this.wheelAcc);
      this.wheelAcc = 0;
      this.step(dir);
    }
  }

  /* ---------------- cinematic UI ---------------- */
  letterbox(on) {
    gsap.to('.letterbox', { height: on ? '11vh' : 0, duration: on ? 1.2 : 1.4, ease: 'power3.inOut' });
  }

  subtitle(text, dur = 3, { whisper = false, kicker = false } = {}) {
    const box = $('#subtitles');
    $$('.sub', box).forEach((old) => gsap.to(old, { opacity: 0, duration: 0.25, onComplete: () => old.remove() }));
    const el = document.createElement('div');
    el.className = `sub${whisper ? ' sub-whisper' : ''}${kicker ? ' sub-kicker' : ''}`;
    el.innerHTML = [...text].map((c) => `<span>${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
    box.appendChild(el);
    gsap.fromTo(el.children, { opacity: 0, y: 4, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.35, stagger: Math.min(0.045, 1.3 / text.length), ease: 'power2.out' });
    gsap.to(el, { opacity: 0, filter: 'blur(6px)', delay: dur, duration: 0.7, onComplete: () => el.remove() });
  }

  bigText(text, dur = 2.2) {
    const el = $('#bigtext');
    el.textContent = text;
    el.dataset.text = text;
    gsap.killTweensOf(el);
    gsap.set(el, { display: 'flex' });
    gsap.fromTo(el, { opacity: 0, scale: 1.18, letterSpacing: '0.6em' }, { opacity: 1, scale: 1, letterSpacing: '0.2em', duration: 0.9, ease: 'expo.out' });
    gsap.to(el, { opacity: 0, duration: 0.3, delay: dur, onComplete: () => gsap.set(el, { display: 'none' }) });
  }

  clearCinematic() {
    $$('#subtitles .sub').forEach((s) => s.remove());
    gsap.killTweensOf('#bigtext');
    gsap.set('#bigtext', { display: 'none', opacity: 0 });
    gsap.killTweensOf('#terminal');
    $('#terminal').textContent = '';
    this.vhs(false);
    this.crack(false);
  }

  vhs(on, label) {
    $('#vhs').hidden = !on;
    if (label) this.vhsLabel(label);
  }

  vhsLabel(text) {
    $('#vhs-state').textContent = text;
  }

  vhsClock(sec) {
    const total = 3 * 3600 + 13 * 60 + 7 + Math.floor(sec);
    const p = (n) => String(n).padStart(2, '0');
    $('#vhs-clock').textContent = `${p(Math.floor(total / 3600))}:${p(Math.floor(total / 60) % 60)}:${p(total % 60)} AM`;
  }

  crack(on) {
    const svg = $('#crack');
    if (on && !svg.childElementCount) {
      const cx = 610, cy = 270;
      let d = '';
      for (let i = 0; i < 16; i++) {
        let a = (i / 16) * Math.PI * 2 + Math.random() * 0.3, x = cx, y = cy;
        d += `M${x} ${y}`;
        const len = 120 + Math.random() * 520;
        for (let k = 0; k < len; k += 30) {
          a += (Math.random() - 0.5) * 0.5;
          x += Math.cos(a) * 30; y += Math.sin(a) * 30;
          d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      }
      for (const r of [40, 90, 150]) {
        for (let k = 0; k < 6; k++) {
          const a0 = Math.random() * Math.PI * 2, a1 = a0 + 0.3 + Math.random() * 0.5;
          d += `M${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r}L${cx + Math.cos(a1) * r * 1.05} ${cy + Math.sin(a1) * r * 1.05}`;
        }
      }
      svg.innerHTML = `<path d="${d}" />`;
    }
    svg.hidden = !on;
    if (on) gsap.fromTo(svg, { opacity: 0 }, { opacity: 1, duration: 0.08 });
  }

  terminal(text, dur = 2.4) {
    const el = $('#terminal');
    gsap.killTweensOf(el);
    el.textContent = '';
    gsap.set(el, { opacity: 1 });
    const chars = [...text];
    const state = { n: 0 };
    gsap.to(state, {
      n: chars.length, duration: Math.min(1.8, chars.length * 0.045), ease: 'none',
      onUpdate: () => { el.textContent = chars.slice(0, Math.round(state.n)).join('') + '█'; },
    });
    gsap.to(el, { opacity: 0, delay: dur, duration: 0.4, onComplete: () => { el.textContent = ''; } });
  }

  toast(msg, type = 'info') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast is-${type}`;
    gsap.killTweensOf(t);
    gsap.fromTo(t, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
    gsap.to(t, { opacity: 0, y: 10, delay: 4, duration: 0.5 });
  }

  /* ---------------- HUD ---------------- */
  _hud() {
    const s = (performance.now() - this.startTime) / 1000;
    const f = Math.floor((s % 1) * 25);
    const pad = (n) => String(Math.floor(n)).padStart(2, '0');
    $('#timecode').textContent = `${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
    if (this.world) {
      const r = this.world.rig;
      $('#coords').textContent = `SECTOR 0 · X ${r.x.toFixed(2)} Y ${r.y.toFixed(2)} Z ${r.z.toFixed(2)}`;
    }
  }

  _idle() {
    if (!this.enabled || this.modalOpen || document.hidden) return;
    if (performance.now() - this.idleAt > 35000) {
      this.idleAt = performance.now();
      if (this.world && Math.random() < 0.5) {
        this.world.phantom();
        this.audio.whisper(0.8);
        return;
      }
      this.world?.blink();
      this.world?.glitchPulse(0.35, 0.6);
      this.audio.whisper(0.5);
      this.subtitle(['we can see you', 'why did you stop?', 'are you still there?', 'the servers are listening'][(Math.random() * 4) | 0], 2.4, { whisper: true });
    }
  }

  /* ---------------- events ---------------- */
  async loadEvents() {
    try {
      const res = await fetch('/api/events');
      this.events = await res.json();
    } catch {
      this.events = [];
      this.toast('The signal is weak. Could not load events.', 'error');
    }
    this.renderEvents();
    this.world?.setEvents(this.events);
    this._countdown();
    fetch('/api/stats').then((r) => r.json()).then((s) => {
      $('#stat-events').textContent = s.events;
      $('#stat-souls').textContent = s.souls;
      $('#stat-colleges').textContent = s.colleges;
    }).catch(() => {});
  }

  renderEvents() {
    const box = $('#events-list');
    const now = Date.now();
    let list = this.events;
    if (this.filter === 'open') list = list.filter((e) => e.open);
    if (this.filter === 'past') list = list.filter((e) => !e.open || new Date(e.date).getTime() < now);
    if (!list.length) {
      box.innerHTML = `<div class="empty" data-reveal><p>No rituals found.</p><p class="dim">The servers are quiet. For now.</p></div>`;
      return;
    }
    box.innerHTML = list.map((ev) => {
      const idx = this.events.indexOf(ev) + 1;
      const pct = ev.seats ? Math.min(100, (ev.registered / ev.seats) * 100) : Math.min(100, ev.registered);
      const status = ev.open ? 'OPEN' : ev.full ? 'FULL' : 'SEALED';
      return `
      <article class="case" data-reveal>
        <div class="case-glare"></div>
        <div class="case-top"><span class="case-no">CASE #${String(idx).padStart(3, '0')} · ${esc((ev.mode || '').toUpperCase())}</span><span class="stamp stamp-${status.toLowerCase()}">${status}</span></div>
        <h3 class="case-title">${esc(ev.title)}</h3>
        ${ev.tagline ? `<p class="case-tag">${esc(ev.tagline)}</p>` : ''}
        <dl class="case-meta">
          <div><dt>WHEN</dt><dd>${fmtDate(ev.date)}</dd></div>
          <div><dt>WHERE</dt><dd>${esc(ev.venue || 'TBA')}</dd></div>
          ${ev.prize ? `<div><dt>BOUNTY</dt><dd>${esc(ev.prize)}</dd></div>` : ''}
          ${ev.teamSize ? `<div><dt>TEAM</dt><dd>${esc(ev.teamSize)}</dd></div>` : ''}
        </dl>
        ${ev.tags?.length ? `<div class="tags">${ev.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="seats"><div class="seats-bar"><i style="width:${pct}%"></i></div>
          <span>${ev.registered} ${ev.seats ? `/ ${ev.seats}` : ''} souls bound${ev.deadline ? ` · closes ${fmtDate(ev.deadline, false)}` : ''}</span></div>
        <div class="case-actions">
          ${ev.open ? `<button class="btn btn-blood" data-register="${esc(ev.id)}" data-cursor="SIGN">SIGN THE PACT</button>` : ''}
          <button class="btn btn-ghost" data-details="${esc(ev.id)}" data-cursor="READ">CASE FILE</button>
        </div>
      </article>`;
    }).join('');
    $$('.case', box).forEach((c) => this._tilt(c));
    $$('.btn', box).forEach((b) => this._magnetic(b));
    if (this.current === 'events') gsap.fromTo($$('.case', box), { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.07, duration: 0.7, ease: 'power3.out' });
  }

  _countdown() {
    const el = $('#countdown');
    const next = this.events.filter((e) => e.open && new Date(e.date).getTime() > Date.now()).sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    if (!next) { el.hidden = true; return; }
    el.hidden = false;
    let d = Math.max(0, new Date(next.date).getTime() - Date.now()) / 1000;
    const days = Math.floor(d / 86400); d -= days * 86400;
    const h = Math.floor(d / 3600); d -= h * 3600;
    const m = Math.floor(d / 60);
    const s = Math.floor(d - m * 60);
    const p = (n) => String(n).padStart(2, '0');
    $('#cd-name').textContent = next.title;
    $('#cd-time').innerHTML = `<b>${p(days)}</b><i>D</i><b>${p(h)}</b><i>H</i><b>${p(m)}</b><i>M</i><b>${p(s)}</b><i>S</i>`;
    el.dataset.register = next.id;
  }

  /* ---------------- modal / registration ---------------- */
  openEvent(id, focusForm) {
    const ev = this.events.find((e) => e.id === id);
    if (!ev) return;
    const body = $('#modal-body');
    const paras = (ev.description || '').split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
    body.innerHTML = `
      <div class="pact">
        <div class="pact-info">
          <p class="kicker">CASE FILE · ${esc((ev.mode || '').toUpperCase())}</p>
          <h2 class="pact-title glitch" data-text="${esc(ev.title)}">${esc(ev.title)}</h2>
          ${ev.tagline ? `<p class="pact-tag">${esc(ev.tagline)}</p>` : ''}
          <dl class="case-meta">
            <div><dt>WHEN</dt><dd>${fmtDate(ev.date)}</dd></div>
            <div><dt>WHERE</dt><dd>${esc(ev.venue || 'TBA')}</dd></div>
            ${ev.prize ? `<div><dt>BOUNTY</dt><dd>${esc(ev.prize)}</dd></div>` : ''}
            ${ev.teamSize ? `<div><dt>TEAM</dt><dd>${esc(ev.teamSize)}</dd></div>` : ''}
            ${ev.deadline ? `<div><dt>CLOSES</dt><dd>${fmtDate(ev.deadline, false)}</dd></div>` : ''}
            <div><dt>SOULS</dt><dd>${ev.registered}${ev.seats ? ` / ${ev.seats}` : ''}</dd></div>
          </dl>
          <div class="pact-desc">${paras}</div>
        </div>
        <div class="pact-form-wrap">
          ${ev.open ? this._formHtml(ev) : `<div class="sealed-note"><p class="kicker">REGISTRATION</p><h3>${ev.full ? 'THE CIRCLE IS FULL' : 'THIS RITUAL IS SEALED'}</h3><p class="dim">Registrations are closed for this event. Watch the other monoliths.</p></div>`}
        </div>
      </div>`;
    const modal = $('#modal');
    modal.hidden = false;
    this.modalOpen = true;
    document.body.classList.add('modal-open');
    gsap.fromTo('.modal-backdrop', { opacity: 0 }, { opacity: 1, duration: 0.5 });
    gsap.fromTo('.modal-card', { opacity: 0, y: 40, scale: 0.96, clipPath: 'inset(50% 0% 50% 0%)' }, { opacity: 1, y: 0, scale: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.out', clearProps: 'clipPath' });
    this.world?.glitchPulse(0.5, 0.5);
    this.world?.redPulse(0.3, 1);
    if (this.world) this.world.eyeDilate.target = 0.9;
    this.audio.hit(0.35);
    const form = $('#pact-form');
    if (form) {
      form.addEventListener('submit', (e) => this._register(e, ev));
      $$('.btn', body).forEach((b) => this._magnetic(b));
      if (focusForm) setTimeout(() => form.querySelector('input')?.focus({ preventScroll: true }), 500);
    }
  }

  _formHtml(ev) {
    return `
      <form id="pact-form" class="form" novalidate>
        <p class="kicker">SIGN THE PACT</p>
        <h3 class="form-title">Register for ${esc(ev.title)}</h3>
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <label class="field"><span>FULL NAME</span><input name="name" autocomplete="name" required maxlength="80" placeholder="Who are you?"><em></em></label>
        <label class="field"><span>EMAIL</span><input name="email" type="email" autocomplete="email" required maxlength="120" placeholder="where we send the transmission"><em></em></label>
        <label class="field"><span>PHONE</span><input name="phone" type="tel" autocomplete="tel" required maxlength="20" placeholder="+91 98765 43210"><em></em></label>
        <label class="field"><span>COLLEGE</span><input name="college" autocomplete="organization" required maxlength="120" placeholder="Which halls do you haunt?"><em></em></label>
        <label class="check"><input type="checkbox" name="consent" required><i></i><span>I understand there is no turning back.</span><em></em></label>
        <p class="form-error" role="alert"></p>
        <button class="btn btn-blood btn-lg btn-full" type="submit" data-cursor="SIGN"><span>SIGN IN BLOOD</span></button>
      </form>`;
  }

  _fieldErrors(form, errors) {
    $$('.field, .check', form).forEach((f) => {
      const name = f.querySelector('input').name;
      f.classList.toggle('has-error', !!errors[name]);
      f.querySelector('em').textContent = errors[name] || '';
    });
  }

  async _register(e, ev) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const errors = {};
    if ((data.name || '').trim().length < 2) errors.name = 'Tell us your name.';
    if (!EMAIL_RE.test((data.email || '').trim())) errors.email = 'That email looks cursed.';
    if (!PHONE_RE.test((data.phone || '').trim())) errors.phone = 'Enter a valid phone number.';
    if ((data.college || '').trim().length < 2) errors.college = 'Which college?';
    if (!form.consent.checked) errors.consent = 'You must accept.';
    this._fieldErrors(form, errors);
    const errBox = $('.form-error', form);
    errBox.textContent = '';
    if (Object.keys(errors).length) {
      gsap.fromTo('.modal-card', { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      this.audio.click();
      return;
    }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.querySelector('span').textContent = 'SIGNING…';
    this.world?.glitchPulse(0.4, 1);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, eventId: ev.id }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (out.fields) this._fieldErrors(form, out.fields);
        errBox.textContent = out.error || 'The ritual failed. Try again.';
        gsap.fromTo('.modal-card', { x: -12 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
        this.world?.redPulse(0.5, 0.8);
        return;
      }
      this._sealed(form, out, data, ev);
      this.loadEvents();
    } catch {
      errBox.textContent = 'The signal was lost. Check your connection and try again.';
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.querySelector('span').textContent = 'SIGN IN BLOOD';
    }
  }

  _sealed(form, out, data, ev) {
    const wrap = form.parentElement;
    wrap.innerHTML = `
      <div class="sealed">
        <svg class="seal-svg" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="92" /><circle cx="100" cy="100" r="80" />
          <path d="M40 100 Q100 50 160 100 Q100 150 40 100 Z" /><circle cx="100" cy="100" r="16" class="fill" />
        </svg>
        <p class="kicker">TRANSMISSION CONFIRMED</p>
        <h3 class="sealed-title glitch" data-text="PACT SEALED">PACT SEALED</h3>
        <p>You're registered for <b>${esc(ev.title)}</b>.</p>
        <div class="ticket"><span>YOUR TICKET</span><b>${esc(out.ticket)}</b></div>
        <p class="dim">${out.emailSent
          ? `A confirmation was sent to <b>${esc(data.email)}</b> from KYPZERO. Check your inbox (and the spam folder, the dark hides things).`
          : 'Your registration is saved. The confirmation email could not be sent right now; we will contact you directly.'}</p>
        <button class="btn btn-ghost" data-close>RETURN TO THE VOID</button>
      </div>`;
    gsap.fromTo('.seal-svg', { scale: 2.4, opacity: 0, rotate: -40 }, { scale: 1, opacity: 1, rotate: 0, duration: 1, ease: 'expo.out' });
    gsap.fromTo('.sealed > :not(svg)', { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.08, delay: 0.4, duration: 0.7, ease: 'power3.out' });
    this.audio.sealed();
    this.world?.blink();
    this.world?.redPulse(0.7, 2);
    this.world?.shake(0.25, 0.6);
  }

  closeModal() {
    if (!this.modalOpen) return;
    this.modalOpen = false;
    document.body.classList.remove('modal-open');
    if (this.world) this.world.eyeDilate.target = 0.35;
    gsap.to('.modal-card', { opacity: 0, y: 30, duration: 0.35, ease: 'power2.in' });
    gsap.to('.modal-backdrop', { opacity: 0, duration: 0.4, onComplete: () => { $('#modal').hidden = true; } });
  }

  /* ---------------- contact ---------------- */
  async _contact(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const errors = {};
    if ((data.name || '').trim().length < 2) errors.name = 'Tell us your name.';
    if (!EMAIL_RE.test((data.email || '').trim())) errors.email = 'That email looks cursed.';
    if ((data.message || '').trim().length < 5) errors.message = 'Say a little more.';
    $$('.field', form).forEach((f) => {
      const n = f.querySelector('input, textarea').name;
      f.classList.toggle('has-error', !!errors[n]);
      f.querySelector('em').textContent = errors[n] || '';
    });
    if (Object.keys(errors).length) return;
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    btn.querySelector('span').textContent = 'TRANSMITTING…';
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { this.toast(out.error || 'The signal failed.', 'error'); return; }
      form.reset();
      this.toast('Signal received. Someone will answer from the dark.', 'ok');
      this.audio.sealed();
      this.world?.redPulse(0.4, 1.4);
    } catch {
      this.toast('The signal was lost. Try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'TRANSMIT';
    }
  }
}
