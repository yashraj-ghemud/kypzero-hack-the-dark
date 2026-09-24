import * as THREE from 'three';

// Every texture in the world is painted at runtime on a canvas: no image downloads.

function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function tex(c, repeat = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function grain(g, w, h, r, amount) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function stains(g, w, h, r, count, rgb = [18, 8, 6]) {
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * w * 0.25;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.2 + r() * 0.35})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

export function concrete(base = '#4a4540', seed = 1) {
  const S = 512, r = rng(seed);
  const [c, g] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  grain(g, S, S, r, 34);
  stains(g, S, S, r, 36);
  for (let i = 0; i < 26; i++) {
    let x = r() * S, y = r() * S * 0.6;
    const len = 40 + r() * 260;
    g.strokeStyle = `rgba(${60 + r() * 70 | 0},${8 + r() * 12 | 0},6,${0.08 + r() * 0.22})`;
    g.lineWidth = 1 + r() * 4;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < len; k += 5) { x += (r() - 0.5) * 1.6; y += 5; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    let x = r() * S, y = r() * S;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 18; k++) { x += (r() - 0.5) * 34; y += (r() - 0.5) * 34; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

export function tiles(seed = 4) {
  const S = 512, r = rng(seed), n = 8, sz = S / n;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#0d0c0c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 40 + r() * 22 | 0;
    g.fillStyle = `rgb(${v},${v - 3},${v - 6})`;
    g.fillRect(i * sz + 2, j * sz + 2, sz - 4, sz - 4);
    if (r() < 0.15) {
      g.strokeStyle = 'rgba(0,0,0,0.7)'; g.beginPath();
      g.moveTo(i * sz + r() * sz, j * sz); g.lineTo(i * sz + r() * sz, j * sz + sz); g.stroke();
    }
  }
  grain(g, S, S, r, 26);
  stains(g, S, S, r, 22, [10, 4, 3]);
  stains(g, S, S, r, 5, [70, 4, 4]);
  return c;
}

export function rack(seed = 9) {
  const W = 256, H = 512, r = rng(seed);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#17181b'; g.fillRect(0, 0, W, H);
  for (let y = 8; y < H - 8; y += 22) {
    g.fillStyle = r() < 0.5 ? '#222328' : '#1c1d21';
    g.fillRect(10, y, W - 20, 19);
    g.fillStyle = '#0b0b0d';
    if (r() < 0.6) for (let x = 40; x < W - 40; x += 6) g.fillRect(x, y + 6, 3, 7);
    g.fillStyle = '#3a3b40'; g.fillRect(14, y + 4, 8, 11); g.fillRect(W - 22, y + 4, 8, 11);
    if (r() < 0.2) { g.fillStyle = '#c9c1a8'; g.fillRect(W - 90, y + 5, 40, 8); }
  }
  grain(g, W, H, r, 18);
  stains(g, W, H, r, 8, [8, 6, 4]);
  return c;
}

export function graffiti(text, { w = 1024, h = 512, seed = 1, color = '#8d0b0b', size } = {}) {
  const r = rng(Math.abs(seed * 97) + 3);
  const [c, g] = canvas(w, h);
  const lines = text.split('\n');
  const fs = size || Math.min(h / (lines.length * 1.25), 170);
  g.font = `${fs}px "Rubik Wet Paint", "Creepster", Impact, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate((r() - 0.5) * 0.1);
  lines.forEach((ln, i) => {
    const y = (i - (lines.length - 1) / 2) * fs * 1.05;
    g.fillStyle = color;
    g.shadowColor = 'rgba(90,0,0,0.8)'; g.shadowBlur = 10;
    g.fillText(ln, 0, y);
    g.shadowBlur = 0;
    const mw = g.measureText(ln).width;
    for (let k = 0; k < ln.length * 1.1; k++) {
      const x = -mw / 2 + r() * mw;
      const dy = y + fs * 0.28;
      const len = 8 + r() * r() * fs * 1.3;
      const wd = 2 + r() * 4;
      g.fillRect(x, dy, wd, len);
      g.beginPath(); g.arc(x + wd / 2, dy + len, wd * 0.9, 0, Math.PI * 2); g.fill();
    }
  });
  g.restore();
  return c;
}

export function stripes(seed = 13) {
  const S = 512, r = rng(seed);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#34322f'; g.fillRect(0, 0, S, S);
  const band = (y0, hgt) => {
    g.save(); g.beginPath(); g.rect(0, y0, S, hgt); g.clip();
    for (let x = -S; x < S * 2; x += 56) {
      g.fillStyle = '#b8901c';
      g.beginPath(); g.moveTo(x, y0 + hgt); g.lineTo(x + 28, y0 + hgt); g.lineTo(x + 28 + hgt, y0); g.lineTo(x + hgt, y0); g.fill();
    }
    g.restore();
  };
  band(0, 50); band(S - 70, 70);
  g.fillStyle = 'rgba(220,210,190,0.75)';
  g.font = 'bold 64px "Share Tech Mono", monospace'; g.textAlign = 'center';
  g.fillText('SECTOR 0', S / 2, S * 0.42);
  g.font = 'bold 30px "Share Tech Mono", monospace';
  g.fillText('AUTHORIZED PERSONNEL ONLY', S / 2, S * 0.52);
  g.fillStyle = 'rgba(160,10,10,0.8)';
  g.font = '44px "Rubik Wet Paint", Impact';
  g.fillText('DO NOT OPEN', S / 2, S * 0.68);
  grain(g, S, S, r, 30);
  stains(g, S, S, r, 20, [60, 20, 8]);
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 60; i++) {
    const x = r() * S, y = r() * S;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 20); g.stroke();
  }
  return c;
}

function wrapText(g, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

export function monolithFace(ev, index) {
  const W = 512, H = 1440, r = rng(index * 31 + 7);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#050304'; g.fillRect(0, 0, W, H);
  grain(g, W, H, r, 10);
  const red = '#ff2a14';
  g.strokeStyle = 'rgba(255,40,20,0.55)'; g.lineWidth = 3; g.strokeRect(28, 28, W - 56, H - 56);
  g.strokeStyle = 'rgba(255,40,20,0.25)'; g.lineWidth = 1; g.strokeRect(42, 42, W - 84, H - 84);

  // the eye sigil
  g.save(); g.translate(W / 2, 190);
  g.strokeStyle = red; g.lineWidth = 4; g.shadowColor = red; g.shadowBlur = 16;
  g.beginPath(); g.arc(0, 0, 92, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(-70, 0); g.quadraticCurveTo(0, -58, 70, 0); g.quadraticCurveTo(0, 58, -70, 0); g.stroke();
  g.fillStyle = red; g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill();
  g.restore();

  g.textAlign = 'center';
  g.fillStyle = red; g.shadowColor = red; g.shadowBlur = 12;
  if (ev) {
    g.font = '28px "Share Tech Mono", monospace';
    g.fillText(`CASE #${String(index + 1).padStart(3, '0')}`, W / 2, 350);
    g.font = '700 62px "Cinzel", serif';
    const lines = wrapText(g, ev.title.toUpperCase(), W - 110).slice(0, 5);
    lines.forEach((ln, i) => g.fillText(ln, W / 2, 470 + i * 76));
    let y = 470 + lines.length * 76 + 40;
    g.shadowBlur = 6;
    g.fillStyle = 'rgba(255,90,60,0.85)';
    g.font = '30px "Share Tech Mono", monospace';
    const d = new Date(ev.date);
    const date = isNaN(d) ? 'DATE UNKNOWN' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    g.fillText(date, W / 2, y); y += 50;
    g.font = '24px "Share Tech Mono", monospace';
    wrapText(g, (ev.venue || '').toUpperCase(), W - 120).slice(0, 2).forEach((ln) => { g.fillText(ln, W / 2, y); y += 36; });
    g.font = '30px "Share Tech Mono", monospace';
    g.fillStyle = ev.open ? '#ff3b1f' : 'rgba(255,60,40,0.4)';
    g.fillText(ev.open ? '[ REGISTRATION OPEN ]' : '[ SEALED ]', W / 2, H - 170);
    g.font = '22px "Share Tech Mono", monospace';
    g.fillStyle = 'rgba(255,60,40,0.6)';
    g.fillText('▼ TOUCH TO ENTER ▼', W / 2, H - 110);
  } else {
    g.font = '64px "Segoe UI Historic", "Noto Sans Runic", serif';
    for (let i = 0; i < 9; i++) {
      g.globalAlpha = 0.25 + r() * 0.6;
      let s = '';
      for (let k = 0; k < 5; k++) s += RUNES[(r() * RUNES.length) | 0];
      g.fillText(s, W / 2, 400 + i * 95);
    }
    g.globalAlpha = 1;
    g.font = '30px "Share Tech Mono", monospace';
    g.fillStyle = 'rgba(255,60,40,0.5)';
    g.fillText('[ NOT YET AWAKE ]', W / 2, H - 140);
  }
  g.shadowBlur = 0;
  g.globalAlpha = 0.18; g.fillStyle = red; g.font = '16px "Share Tech Mono", monospace';
  for (let i = 0; i < 40; i++) g.fillText(`0x${((r() * 0xffffff) | 0).toString(16).toUpperCase().padStart(6, '0')}`, 64 + (i % 2) * (W - 128), 330 + i * 26);
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 50; i++) {
    const x = r() * W, y = r() * H;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 40); g.stroke();
  }
  return c;
}

export function sigil(seed = 3) {
  const S = 1024, r = rng(seed), C = S / 2;
  const [c, g] = canvas(S, S);
  g.translate(C, C);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.shadowColor = '#fff'; g.shadowBlur = 10;
  [[490, 5], [462, 2], [340, 4], [318, 2], [120, 3]].forEach(([rad, lw]) => {
    g.lineWidth = lw; g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.stroke();
  });
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
    pts.push([Math.cos(a) * 455, Math.sin(a) * 455]);
  }
  g.lineWidth = 3; g.beginPath();
  for (let i = 0; i <= 7; i++) {
    const p = pts[(i * 3) % 7];
    i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]);
  }
  g.stroke();
  pts.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.stroke(); });
  g.font = '26px "Share Tech Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ring = '01001011 01011001 01010000 00110000 ✶ SECTOR ZERO ✶ 03:13 ✶ ';
  const chars = (ring + ring).split('');
  chars.forEach((ch, i) => {
    const a = (i / chars.length) * Math.PI * 2;
    g.save(); g.rotate(a); g.translate(0, -476); g.fillText(ch, 0, 0); g.restore();
  });
  g.font = '54px "Segoe UI Historic", serif';
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    g.save(); g.rotate(a); g.translate(0, -230); g.fillText(RUNES[(r() * RUNES.length) | 0], 0, 0); g.restore();
  }
  g.beginPath(); g.moveTo(-90, 0); g.quadraticCurveTo(0, -70, 90, 0); g.quadraticCurveTo(0, 70, -90, 0); g.stroke();
  g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.fill();
  return c;
}

export function moon(seed = 5) {
  const S = 512, r = rng(seed);
  const [c, g] = canvas(S, S);
  const gr = g.createLinearGradient(0, 0, S, S);
  gr.addColorStop(0, '#f2c9a0'); gr.addColorStop(1, '#9c4a2c');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, rad = 4 + r() * r() * 60;
    const cg = g.createRadialGradient(x, y, 0, x, y, rad);
    cg.addColorStop(0, `rgba(70,20,10,${0.2 + r() * 0.4})`);
    cg.addColorStop(0.8, 'rgba(70,20,10,0.1)');
    cg.addColorStop(1, 'rgba(255,220,190,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  grain(g, S, S, r, 20);
  return c;
}

export function glow() {
  const S = 256;
  const [c, g] = canvas(S, S);
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return c;
}

export function crtText(text) {
  const [c, g] = canvas(256, 192);
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '34px "Share Tech Mono", monospace';
  const lines = wrapText(g, text, 220);
  lines.forEach((ln, i) => g.fillText(ln, 128, 96 + (i - (lines.length - 1) / 2) * 40));
  const t = new THREE.CanvasTexture(c);
  return t;
}

/* ---------------- horror decals ---------------- */
export function bloodTrail(seed = 77) {
  const W = 128, H = 2048, r = rng(seed);
  const [c, g] = canvas(W, H);
  let x = W / 2;
  for (let y = 0; y < H; y += 6) {
    x += (r() - 0.5) * 5;
    x = Math.max(34, Math.min(W - 34, x));
    if (r() < 0.012) y += 40 + r() * 90; // gaps where it was lifted
    const w = 10 + Math.sin(y * 0.01) * 6 + r() * 10;
    g.fillStyle = `rgba(${60 + r() * 40 | 0},0,0,${0.55 + r() * 0.35})`;
    g.fillRect(x - w / 2, y, w, 7);
    if (r() < 0.5) {
      g.fillStyle = 'rgba(40,0,0,0.5)';
      g.fillRect(x - w / 2 - 6 + r() * 3, y, 1.5, 7);
      g.fillRect(x + w / 2 + 4 + r() * 3, y, 1.5, 7);
    }
  }
  for (let i = 0; i < 30; i++) {
    const cx = 20 + r() * (W - 40), cy = r() * H, rad = 3 + r() * 14;
    g.fillStyle = `rgba(70,0,0,${0.4 + r() * 0.5})`;
    g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function hand(g, x, y, s, rot, r) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = `rgba(${95 + r() * 40 | 0},0,0,${0.75 + r() * 0.2})`;
  g.beginPath(); g.ellipse(0, 0, 26, 30, 0, 0, Math.PI * 2); g.fill();
  [[-22, -38, -0.35, 30], [-9, -52, -0.1, 40], [5, -55, 0.05, 42], [18, -48, 0.2, 36], [31, -8, 0.9, 26]].forEach(([fx, fy, fr, fl]) => {
    g.save(); g.translate(fx, fy); g.rotate(fr);
    g.beginPath(); g.ellipse(0, 0, 6.5, fl / 2, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  });
  for (let k = 0; k < 4; k++) {
    const dx = -20 + r() * 40, len = 10 + r() * 70;
    g.fillRect(dx, 20, 3, len);
    g.beginPath(); g.arc(dx + 1.5, 20 + len, 3, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export function handprints(n = 3, seed = 5) {
  const S = 512, r = rng(seed);
  const [c, g] = canvas(S, S);
  for (let i = 0; i < n; i++) hand(g, 90 + r() * 330, 110 + r() * 250, 0.9 + r() * 0.7, (r() - 0.5) * 1.2, r);
  return c;
}

export function tally(seed = 21) {
  const W = 1024, H = 512, r = rng(seed);
  const [c, g] = canvas(W, H);
  g.strokeStyle = 'rgba(210,200,185,0.75)';
  g.lineCap = 'round';
  for (let row = 0; row < 5; row++) {
    for (let grp = 0; grp < 11; grp++) {
      const x0 = 30 + grp * 88 + r() * 8, y0 = 30 + row * 76 + r() * 6;
      g.lineWidth = 2 + r() * 2;
      for (let k = 0; k < 4; k++) {
        g.beginPath(); g.moveTo(x0 + k * 13, y0 + r() * 4); g.lineTo(x0 + k * 13 + (r() - 0.5) * 6, y0 + 54); g.stroke();
      }
      g.beginPath(); g.moveTo(x0 - 6, y0 + 44); g.lineTo(x0 + 50, y0 + 10); g.stroke();
    }
  }
  g.font = '64px "Rubik Wet Paint", Impact';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(140,8,8,0.9)';
  g.fillText('DAY 9876 — LET US OUT', W / 2, H - 40);
  return c;
}

export function bloodPool(seed = 8) {
  const S = 256, r = rng(seed);
  const [c, g] = canvas(S, S);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = r() * 60;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, rad = 30 + r() * 50;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(70,0,0,0.95)');
    gr.addColorStop(0.75, 'rgba(60,0,0,0.9)');
    gr.addColorStop(1, 'rgba(60,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return c;
}

export function exitSign() {
  const [c, g] = canvas(256, 96);
  g.fillStyle = '#100'; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#fff'; g.font = 'bold 64px "Share Tech Mono", monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('EXIT', 128, 50);
  return c;
}
