// Custom cursor: dot + lagging ring + ember trail. Also drives the DOM flashlight vignette.

const HOVER_SEL = 'a, button, input, textarea, select, label, [data-hover]';

export function initCursor({ world }) {
  const root = document.documentElement;
  addEventListener('pointermove', (e) => {
    root.style.setProperty('--mx', `${e.clientX}px`);
    root.style.setProperty('--my', `${e.clientY}px`);
  }, { passive: true });

  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.body.classList.add('has-cursor');

  const make = (cls, tag = 'div') => { const el = document.createElement(tag); el.className = cls; document.body.appendChild(el); return el; };
  const trail = make('cursor-trail', 'canvas');
  const ring = make('cursor-ring');
  const dot = make('cursor-dot');
  const label = document.createElement('span');
  label.className = 'cursor-label';
  ring.appendChild(label);
  const g = trail.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);

  const size = () => {
    trail.width = innerWidth * dpr; trail.height = innerHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener('resize', size);

  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, lx = x, ly = y;
  let domHover = false, worldHover = null;
  const parts = [];

  const spawn = (px, py, n, burst = false) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = burst ? 1 + Math.random() * 3.5 : Math.random() * 0.4;
      parts.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (burst ? 0.5 : 0.3), life: 0, max: 30 + Math.random() * 40, s: 1 + Math.random() * (burst ? 3 : 2.2) });
    }
    if (parts.length > 260) parts.splice(0, parts.length - 260);
  };

  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    const d = Math.hypot(x - lx, y - ly);
    if (d > 6) { spawn(x, y, Math.min(4, d / 10) | 0 || 1); lx = x; ly = y; }
    document.body.classList.remove('cursor-hidden');
  }, { passive: true });
  document.addEventListener('pointerleave', () => document.body.classList.add('cursor-hidden'));
  addEventListener('pointerdown', () => { ring.classList.add('is-down'); spawn(x, y, 16, true); });
  addEventListener('pointerup', () => ring.classList.remove('is-down'));

  const refresh = () => {
    const on = domHover || !!worldHover;
    ring.classList.toggle('is-hover', on);
    label.textContent = domHover ? (domHover.dataset?.cursor || '') : worldHover || '';
  };
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.(HOVER_SEL);
    domHover = t || false;
    refresh();
  });
  world?.on('hover', (d) => {
    worldHover = d ? ({ monolith: 'ENTER', eye: "DON'T", crt: 'LOOK' }[d.type] || ' ') : null;
    refresh();
  });

  const loop = () => {
    rx += (x - rx) * 0.16; ry += (y - ry) * 0.16;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    g.clearRect(0, 0, innerWidth, innerHeight);
    g.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life++; p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy = p.vy * 0.96 - 0.015;
      const k = 1 - p.life / p.max;
      if (k <= 0) { parts.splice(i, 1); continue; }
      const r = p.s * (0.6 + k);
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      grd.addColorStop(0, `rgba(255,${90 + 80 * k | 0},40,${0.7 * k})`);
      grd.addColorStop(1, 'rgba(180,0,20,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(p.x, p.y, r * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    requestAnimationFrame(loop);
  };
  loop();
}
