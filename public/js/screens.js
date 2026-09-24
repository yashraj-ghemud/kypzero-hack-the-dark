import * as THREE from 'three';

// A CRT screen whose picture is painted live on a canvas: typing, noise, big text, or an eye that follows you.
export class Screen {
  constructor(w = 256, h = 192) {
    this.c = document.createElement('canvas');
    this.c.width = w; this.c.height = h;
    this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mode = 'off';
    this.text = '';
    this.t0 = 0;
    this.last = -1;
    this.clear();
  }

  set(mode, text = '') {
    this.mode = mode;
    this.text = text;
    this.t0 = performance.now() / 1000;
    this.last = -1;
    if (mode === 'off') this.clear();
  }

  clear() {
    this.g.fillStyle = '#000';
    this.g.fillRect(0, 0, this.c.width, this.c.height);
    this.tex.needsUpdate = true;
  }

  update() {
    if (this.mode === 'off') return;
    const t = performance.now() / 1000;
    if (t - this.last < 1 / 15) return;
    this.last = t;
    const g = this.g, W = this.c.width, H = this.c.height, e = t - this.t0;
    g.fillStyle = '#030504';
    g.fillRect(0, 0, W, H);
    const noise = this.mode === 'noise' ? 1 : 0.22;
    for (let i = 0; i < 500; i++) {
      const v = (Math.random() * 255 * noise) | 0;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 3, 2);
    }
    g.textAlign = 'left';
    g.textBaseline = 'top';
    if (this.mode === 'type') {
      const n = Math.min(this.text.length, Math.floor(e * 9));
      const shown = this.text.slice(0, n) + (Math.floor(e * 3) % 2 ? '█' : ' ');
      g.fillStyle = '#7dffa6';
      g.font = '22px "Share Tech Mono", monospace';
      shown.split('\n').forEach((ln, i) => g.fillText(`${i === 0 ? '> ' : '  '}${ln}`, 16, 18 + i * 28));
    } else if (this.mode === 'text') {
      const lines = this.text.split('\n');
      const size = Math.min(52, (H - 30) / lines.length);
      g.font = `bold ${size}px "Share Tech Mono", monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ff2a14';
      g.shadowColor = '#ff2a14'; g.shadowBlur = 10;
      const jx = Math.random() < 0.2 ? (Math.random() - 0.5) * 12 : 0;
      lines.forEach((ln, i) => g.fillText(ln, W / 2 + jx, H / 2 + (i - (lines.length - 1) / 2) * size * 1.05));
      g.shadowBlur = 0;
    } else if (this.mode === 'eye') {
      const cx = W / 2, cy = H / 2;
      g.strokeStyle = '#9dffc4'; g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx - 90, cy); g.quadraticCurveTo(cx, cy - 70, cx + 90, cy); g.quadraticCurveTo(cx, cy + 70, cx - 90, cy);
      g.stroke();
      const px = Math.sin(e * 1.3) * 30, py = Math.cos(e * 0.9) * 8;
      g.fillStyle = '#9dffc4';
      g.beginPath(); g.arc(cx + px, cy + py, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000';
      g.beginPath(); g.arc(cx + px, cy + py, 11 + Math.sin(e * 5) * 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    this.tex.needsUpdate = true;
  }
}
