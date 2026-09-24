import * as THREE from 'three';

// The creature: an articulated rig with poses, a head that tracks the camera, and a jaw that unhinges.
const gsap = window.gsap;
const PI = Math.PI;
const TAU = PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => ((a + PI) % TAU + TAU) % TAU - PI;
const _v = new THREE.Vector3();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function skinCanvas() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#6a605b'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? 70 : 10},${(Math.random() * 20) | 0},${(Math.random() * 20) | 0},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(40,12,24,0.6)'; g.lineWidth = 1.4;
  for (let i = 0; i < 34; i++) {
    let x = Math.random() * 256, y = Math.random() * 256;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 12; k++) { x += rnd(-12, 12); y += rnd(-4, 14); g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

// The face is painted around u = 0.25 (the +Z side of a three.js sphere).
function faceCanvas() {
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#171313'; g.fillRect(0, 0, S, S);
  const cx = 128, cy = 250;
  const gr = g.createRadialGradient(cx, cy - 30, 10, cx, cy, 160);
  gr.addColorStop(0, '#d2c6b4'); gr.addColorStop(0.5, '#948676'); gr.addColorStop(0.85, '#3a302c'); gr.addColorStop(1, 'rgba(23,19,19,1)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, 84, 170, 0, 0, TAU); g.fill();
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${rnd(40, 100) | 0},${rnd(15, 40) | 0},${rnd(15, 40) | 0},${rnd(0.05, 0.22)})`;
    g.fillRect(cx + rnd(-80, 80), cy + rnd(-165, 165), rnd(1, 4), rnd(1, 4));
  }
  g.strokeStyle = 'rgba(50,50,90,0.45)'; g.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    let x = cx + (Math.random() < 0.5 ? -1 : 1) * rnd(45, 75), y = cy + rnd(-150, 60);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += rnd(-7, 7); y += rnd(4, 12); g.lineTo(x, y); }
    g.stroke();
  }
  for (const dx of [-24, 24]) {
    const sg = g.createRadialGradient(cx + dx, 226, 2, cx + dx, 226, 34);
    sg.addColorStop(0, '#000'); sg.addColorStop(0.55, 'rgba(0,0,0,0.96)'); sg.addColorStop(1, 'rgba(40,10,10,0)');
    g.fillStyle = sg; g.beginPath(); g.ellipse(cx + dx, 226, 27, 34, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(110,0,0,0.9)'; g.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      let x = cx + dx + rnd(-9, 9), y = 250;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 14; s++) { y += rnd(6, 11); x += rnd(-1.5, 1.5); g.lineTo(x, y); }
      g.stroke();
    }
  }
  g.fillStyle = '#1a0303'; g.beginPath(); g.ellipse(cx, 318, 30, 6, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(90,0,0,0.85)'; g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(cx - 28, 318); g.quadraticCurveTo(cx - 50, 302, cx - 62, 276);
  g.moveTo(cx + 28, 318); g.quadraticCurveTo(cx + 50, 302, cx + 62, 276);
  g.stroke();
  g.strokeStyle = 'rgba(18,4,4,0.85)'; g.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) {
    let x = cx + rnd(-60, 60), y = cy + rnd(-150, 120);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += rnd(-10, 10); y += rnd(-10, 10); g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

let M = null;
function mats() {
  if (M) return M;
  M = {
    skin: new THREE.MeshLambertMaterial({ map: texture(skinCanvas()) }),
    face: new THREE.MeshLambertMaterial({ map: texture(faceCanvas()) }),
    eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 12.5, 11), fog: false }),
    mouth: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.18, 0, 0) }),
    tooth: new THREE.MeshLambertMaterial({ color: 0xcbb99a }),
  };
  return M;
}

const GEO = new Map();
function capsule(r, len) {
  const k = `${r}:${len}`;
  if (!GEO.has(k)) GEO.set(k, new THREE.CapsuleGeometry(r, len, 4, 8));
  return GEO.get(k);
}
const HEAD_GEO = new THREE.SphereGeometry(0.14, 32, 24);
const EYE_GEO = new THREE.SphereGeometry(0.022, 10, 8);
const MOUTH_GEO = new THREE.SphereGeometry(0.034, 16, 10);
const TOOTH_GEO = new THREE.ConeGeometry(0.0055, 0.024, 5);

function sphPoint(u, v, r) {
  const phi = u * TAU, theta = (1 - v) * PI;
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

const POSES = {
  stand: {
    hips: 1.08, spine: [0.22, 0, 0], neck: [-0.12, 0, 0], head: [0.05, 0, 0.28],
    armL: [0.08, 0, -0.07], armR: [0.08, 0, 0.07], foreL: [-0.25, 0, 0], foreR: [-0.25, 0, 0],
    thighL: [0, 0, 0.03], thighR: [0, 0, -0.03], shinL: [0.06, 0, 0], shinR: [0.06, 0, 0], fingers: 0.35,
  },
  crawl: {
    hips: 1.08, spine: [0, 0, 0], neck: [0.45, 0, 0], head: [0.55, PI, 0.25],
    armL: [-1.25, 0, -0.95], armR: [-1.25, 0, 0.95], foreL: [1.25, 0, 0], foreR: [1.25, 0, 0],
    thighL: [-1.15, 0, -0.65], thighR: [-1.15, 0, 0.65], shinL: [1.55, 0, 0], shinR: [1.55, 0, 0], fingers: 0.9,
  },
  crouch: {
    hips: 0.45, spine: [1.0, 0, 0], neck: [-0.7, 0, 0], head: [-0.35, 0, 0.35],
    armL: [-1.1, 0, -0.35], armR: [-1.1, 0, 0.35], foreL: [-0.5, 0, 0], foreR: [-0.5, 0, 0],
    thighL: [-1.7, 0, -0.25], thighR: [-1.7, 0, 0.25], shinL: [2.1, 0, 0], shinR: [2.1, 0, 0], fingers: 0.1,
  },
};

export class Figure {
  constructor({ detail = true } = {}) {
    const m = mats();
    this.j = {};
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.body.scale.setScalar(1.1);
    this.root.add(this.body);
    this.hips = new THREE.Group();
    this.hips.position.y = 1.08;
    this.body.add(this.hips);

    const limb = (name, parent, len, r, x = 0, y = 0, z = 0) => {
      const j = new THREE.Group();
      j.position.set(x, y, z);
      parent.add(j);
      const mesh = new THREE.Mesh(capsule(r, len), m.skin);
      mesh.position.y = -len / 2;
      j.add(mesh);
      const end = new THREE.Group();
      end.position.y = -len;
      j.add(end);
      this.j[name] = j;
      return end;
    };

    const pelvis = new THREE.Mesh(capsule(0.1, 0.1), m.skin);
    pelvis.rotation.z = PI / 2; pelvis.scale.set(1, 1, 0.75);
    this.hips.add(pelvis);
    const spine = (this.j.spine = new THREE.Group());
    this.hips.add(spine);
    const torso = new THREE.Mesh(capsule(0.16, 0.44), m.skin);
    torso.position.y = 0.33; torso.scale.set(1.15, 1, 0.66);
    spine.add(torso);
    const chest = new THREE.Group();
    chest.position.y = 0.6;
    spine.add(chest);

    const neck = (this.j.neck = new THREE.Group());
    neck.position.y = 0.05;
    chest.add(neck);
    const neckMesh = new THREE.Mesh(capsule(0.04, 0.12), m.skin);
    neckMesh.position.y = 0.08;
    neck.add(neckMesh);
    this.look = new THREE.Group();
    this.look.position.y = 0.17;
    neck.add(this.look);
    const head = (this.j.head = new THREE.Group());
    this.look.add(head);
    this.jit = new THREE.Group();
    head.add(this.jit);
    const skull = (this.skull = new THREE.Mesh(HEAD_GEO, m.face));
    skull.position.y = 0.13; skull.scale.set(0.88, 1.25, 1);
    this.jit.add(skull);

    this.eyeMat = detail ? m.eye.clone() : null;
    this.eyes = [-0.047, 0.047].map((du) => {
      const e = new THREE.Mesh(EYE_GEO, this.eyeMat || m.eye);
      e.position.copy(sphPoint(0.25 + du, 0.56, 0.128));
      skull.add(e);
      return e;
    });

    const mouthPos = sphPoint(0.25, 0.378, 0.13);
    this.mouth = new THREE.Mesh(MOUTH_GEO, m.mouth);
    this.mouth.position.copy(mouthPos);
    this.mouth.scale.set(1, 0.18, 0.45);
    skull.add(this.mouth);
    this.jaw = new THREE.Group();
    this.jaw.position.copy(mouthPos);
    skull.add(this.jaw);
    this.jawBase = mouthPos.y;
    if (detail) {
      for (let i = 0; i < 8; i++) {
        const x = (i - 3.5) * 0.0085;
        const up = new THREE.Mesh(TOOTH_GEO, m.tooth);
        up.position.set(mouthPos.x + x, mouthPos.y + 0.004, mouthPos.z + 0.006 - Math.abs(x) * 0.25);
        up.rotation.x = PI;
        skull.add(up);
        const lo = new THREE.Mesh(TOOTH_GEO, m.tooth);
        lo.position.set(x, -0.004, 0.006 - Math.abs(x) * 0.25);
        this.jaw.add(lo);
      }
    }

    this.fingers = [];
    for (const [s, n] of [[-1, 'L'], [1, 'R']]) {
      let e = limb(`arm${n}`, chest, 0.44, 0.042, s * 0.25, -0.02, 0);
      e = limb(`fore${n}`, e, 0.44, 0.034);
      const palm = new THREE.Mesh(capsule(0.028, 0.05), m.skin);
      palm.position.y = -0.04; palm.scale.z = 0.5;
      e.add(palm);
      for (let f = 0; f < (detail ? 4 : 3); f++) {
        const fj = new THREE.Group();
        fj.position.set((f - 1.5) * 0.017, -0.08, 0);
        fj.rotation.z = (f - 1.5) * 0.08;
        const fm = new THREE.Mesh(capsule(0.008, 0.19), m.skin);
        fm.position.y = -0.1;
        fj.add(fm);
        e.add(fj);
        this.fingers.push(fj);
      }
    }
    for (const [s, n] of [[-1, 'L'], [1, 'R']]) {
      let e = limb(`thigh${n}`, this.hips, 0.5, 0.058, s * 0.1, 0, 0);
      e = limb(`shin${n}`, e, 0.48, 0.044);
      const foot = new THREE.Mesh(capsule(0.035, 0.14), m.skin);
      foot.rotation.x = PI / 2; foot.position.set(0, -0.03, 0.06);
      e.add(foot);
    }

    this.walking = false;
    this.phase = 0;
    this.jitter = 0;
    this.mouthOpen = 0;
    this.lookMode = false;
    this.snapRate = 0;
    this.onStep = null;
    this.onSnap = null;
    this.eyeFlare = 1;
    this.pose('stand', 0);
  }

  pose(name, duration = 0, ease = 'power2.inOut') {
    const p = POSES[name];
    this.poseName = name;
    for (const [key, val] of Object.entries(p)) {
      if (key === 'hips') {
        duration ? gsap.to(this.hips.position, { y: val, duration, ease }) : (this.hips.position.y = val);
      } else if (key === 'fingers') {
        this.fingers.forEach((f) => (duration ? gsap.to(f.rotation, { x: val, duration, ease }) : (f.rotation.x = val)));
      } else {
        const [x, y, z] = val;
        const r = this.j[key].rotation;
        duration ? gsap.to(r, { x, y, z, duration, ease }) : r.set(x, y, z);
      }
    }
  }

  twistHead(angle = 1.45) {
    gsap.to(this.j.head.rotation, { z: angle, duration: 0.35, ease: 'back.out(3)' });
  }

  flare(amount = 2.2) {
    gsap.fromTo(this, { eyeFlare: amount }, { eyeFlare: 1.3, duration: 0.8, ease: 'power2.out' });
  }

  scream() {
    this.jitter = 1;
    gsap.to(this, { mouthOpen: 1, duration: 0.22, ease: 'expo.out' });
    this.flare(2.8);
  }

  reset() {
    gsap.killTweensOf(this);
    this.walking = false;
    this.jitter = 0;
    this.mouthOpen = 0;
    this.lookMode = false;
    this.look.rotation.set(0, 0, 0);
    this.jit.rotation.set(0, 0, 0);
    this.jit.position.set(0, 0, 0);
    this.eyeFlare = 1;
    this.root.rotation.set(0, 0, 0);
    this.pose('stand', 0);
  }

  update(t, dt, camPos) {
    if (!this.root.visible) return;
    if (this.walking) {
      const prev = Math.sin(this.phase);
      this.phase += dt * 4.4;
      const s = Math.sin(this.phase);
      if (Math.sign(prev) !== Math.sign(s)) this.onStep?.();
      this.j.thighL.rotation.x = s * 0.5;
      this.j.thighR.rotation.x = -s * 0.5;
      this.j.shinL.rotation.x = Math.max(0, -s) * 0.9 + 0.06;
      this.j.shinR.rotation.x = Math.max(0, s) * 0.9 + 0.06;
      this.j.armL.rotation.x = 0.08 - s * 0.25;
      this.j.armR.rotation.x = 0.08 + s * 0.25;
      this.hips.position.y = 1.08 + Math.abs(Math.cos(this.phase)) * 0.035;
      this.j.spine.rotation.z = Math.sin(this.phase * 0.5) * 0.08;
    }
    const jt = this.jitter;
    if (jt > 0) {
      this.jit.rotation.set(rnd(-0.35, 0.35) * jt, rnd(-0.5, 0.5) * jt, rnd(-0.6, 0.6) * jt);
      this.jit.position.set(rnd(-0.02, 0.02) * jt, rnd(-0.01, 0.01) * jt, 0);
    } else if (Math.random() < 0.012) {
      this.jit.rotation.z = rnd(-0.6, 0.6);
    } else {
      this.jit.rotation.z *= 0.9;
    }
    if (this.lookMode && camPos) {
      this.j.neck.updateWorldMatrix(true, false);
      _v.copy(camPos);
      this.j.neck.worldToLocal(_v);
      const yaw = Math.atan2(_v.x, _v.z);
      const pitch = THREE.MathUtils.clamp(-Math.atan2(_v.y - 0.3, Math.hypot(_v.x, _v.z)), -0.8, 0.8);
      const d = wrap(yaw - this.look.rotation.y);
      if (this.snapRate > 0) {
        if (Math.abs(d) > 0.2 && Math.random() < this.snapRate) {
          this.look.rotation.y = yaw;
          this.look.rotation.x = pitch;
          this.onSnap?.();
        }
      } else {
        this.look.rotation.y += d * (1 - Math.exp(-dt * 4));
        this.look.rotation.x += (pitch - this.look.rotation.x) * (1 - Math.exp(-dt * 4));
      }
    }
    if (camPos) {
      this.eyes[0].getWorldPosition(_v);
      const dist = _v.distanceTo(camPos);
      const k = this.eyeMat ? Math.max(1, dist / 7) : THREE.MathUtils.clamp(dist / 12, 1, 1.8);
      if (this.eyeMat) { const b = THREE.MathUtils.clamp(dist * 2.2, 0.9, 14) / 14; this.eyeMat.color.setRGB(14 * b, 12.5 * b, 11 * b); }
      this.eyes.forEach((e) => e.scale.setScalar(Math.max(this.eyeFlare, k)));
    }
    this.mouth.scale.y = 0.18 + this.mouthOpen * 1.9;
    this.mouth.scale.x = 1 + this.mouthOpen * 0.3;
    this.jaw.position.y = this.jawBase - this.mouthOpen * 0.055;
  }
}
