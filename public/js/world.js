import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as T from './textures.js';
import * as S from './shaders.js';
import { Figure } from './figure.js';
import { Screen } from './screens.js';

const gsap = window.gsap;
const V3 = THREE.Vector3;
const PI = Math.PI;
const TAU = PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

const EYE_POS = new V3(0, 26, -330);
const MONO_CENTER = new V3(-38, 0, -180);
const TREE_CENTER = new V3(44, 0, -188);
const TOWER_BASE = new V3(-85, -14, -300);
const MOON_POS = new V3(-160, 170, -700);
const LED_OFF = new THREE.Color(0.02, 0.02, 0.02);
const SICK = 0xcdf5dc;
const _w = new V3();
const _d = new V3();

function yawPitch(from, to) {
  const d = to.clone().sub(from).normalize();
  return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new V3();
const _s = new V3();
function setInstance(mesh, i, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  mesh.setMatrixAt(i, _m);
}

export class World {
  constructor(canvas, { lowPower = false } = {}) {
    this.canvas = canvas;
    this.lowPower = lowPower;
    this.handlers = {};
    this.timer = new THREE.Timer();
    this.timer.connect?.(document);
    this.time = 0;
    this.mouse = new THREE.Vector2();
    this.mouseSmooth = new THREE.Vector2();
    this.mode = 'intro';
    this.rig = { x: 0, y: 1.65, z: 4, yaw: 0, pitch: -0.03, roll: 0, fov: 58, bob: 0 };
    this.fx = { grain: 0.085, vignette: 1.15, aberration: 0.3, glitch: 0, blackout: 1, flash: 0, red: 0, shake: 0, sway: 1, parallax: 0, scan: 0.35, static: 0, vhs: 0, invert: 0 };
    this.corr = { level: 0, chaos: 0, color: new THREE.Color(SICK), flashlight: 0, alarm: 0 };
    this.chairSpin = 0;
    this.tiles = [];
    this.watchersMode = 'hidden';
    this.voidLevel = 0;
    this.eyeOpen = { v: 0 };
    this.eyeDilate = { v: 0.5, target: 0.35 };
    this.eyeTarget = new V3(0, 2, -120);
    this.nextBlink = 8;
    this.raycaster = new THREE.Raycaster();
    this.hovered = null;
    this.pointerOnCanvas = false;
    this.clickables = [];
    this.monoliths = [];
    this.station = null;
    this._init();
  }

  on(name, fn) { (this.handlers[name] ||= []).push(fn); }
  emit(name, ...args) { (this.handlers[name] || []).forEach((fn) => fn(...args)); }

  /* ================================================================ */
  _init() {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.lowPower ? 1 : 1.5));
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.2;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x020001);
    scene.fog = new THREE.FogExp2(0x030102, 0.028);

    const cam = (this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 2200));
    cam.rotation.order = 'YXZ';
    scene.add(cam);

    this._lights();
    this._corridor();
    this._figures();
    this._door();
    this._void();
    this._particles();
    this._post();
    this._stations();
    this.setEvents([]);

    const figs = [this.hero, ...this.watchers];
    figs.forEach((f, i) => { f.root.visible = true; f.root.position.set(i * 0.5, 0, -8); });
    this.renderer.compile(scene, cam); // compile everything up-front so the reveal never stutters
    figs.forEach((f) => { f.root.visible = false; });
    this.voidGroup.visible = false;

    addEventListener('resize', () => this.resize());
    addEventListener('pointermove', (e) => {
      this.mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.pointerOnCanvas = e.target === this.canvas;
    }, { passive: true });
    this.canvas.addEventListener('click', () => this._click());
    r.setAnimationLoop(() => this._tick());
  }

  /* ---------------- lights ---------------- */
  _lights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0x5a4a55, 0x0a0505, 0.2);
    s.add(this.hemi);

    const fl = (this.flashlight = new THREE.SpotLight(0xffe6c4, 0, 45, 0.42, 0.6, 1.3));
    fl.position.set(0.25, -0.18, 0.1);
    this.flTarget = new THREE.Object3D();
    this.flTarget.position.set(0, 0, -6);
    this.camera.add(fl, this.flTarget);
    fl.target = this.flTarget;

    this.cLights = [];
    for (let i = 0; i < 6; i++) {
      const z = -2 - i * 18;
      const L = new THREE.PointLight(0xd6f2ff, 0, 22, 1.5);
      L.position.set(0, 3.5, z);
      s.add(L);
      this.cLights.push({ light: L, z, base: i === 3 ? 0.45 : 1, next: rnd(1, 5), until: 0, fixtures: [], override: null, chaos: 0 });
    }

    this.eyeLight = new THREE.PointLight(0xff2a14, 0, 0, 0);
    this.eyeLight.position.set(0, 26, -300);
    this.moonLight = new THREE.DirectionalLight(0xff7a50, 0);
    this.moonLight.position.copy(MOON_POS);
    this.moonLight.target.position.set(0, 0, -200);
    this.crystalLight = new THREE.PointLight(0xff200a, 0, 45, 1.4);
    this.crystalLight.position.set(MONO_CENTER.x, 6, MONO_CENTER.z);
    this.crtLight = new THREE.PointLight(0x9dffc4, 0, 40, 1.4);
    this.crtLight.position.set(TREE_CENTER.x - 6, 4, TREE_CENTER.z + 6);
    this.beaconLight = new THREE.PointLight(0xff0000, 0, 90, 1.3);
    this.beaconLight.position.set(TOWER_BASE.x, TOWER_BASE.y + 74, TOWER_BASE.z);
    this.heroLight = new THREE.PointLight(0xd8ffe6, 0, 9, 1.4);
    this.heroGlow = 0;
    s.add(this.heroLight);
    this.screenLight = new THREE.PointLight(0xff2010, 0, 10, 1.5);
    this.screenLight.position.set(1.4, 1.4, -13.6);
    s.add(this.screenLight, this.eyeLight, this.moonLight, this.moonLight.target, this.crystalLight, this.crtLight, this.beaconLight);
  }

  /* ---------------- the corridor ---------------- */
  _corridor() {
    const g = (this.corridorGroup = new THREE.Group());
    this.scene.add(g);
    const L = 110, z0 = 6, z1 = -104, zm = (z0 + z1) / 2, W = 6, H = 4;

    const wallMat = new THREE.MeshStandardMaterial({ map: T.tex(T.concrete('#5b554f', 11), [L / 5, 1]), roughness: 0.92, metalness: 0.05, color: 0x9a9088 });
    const endMat = new THREE.MeshStandardMaterial({ map: T.tex(T.concrete('#5b554f', 12), [1.2, 1]), roughness: 0.92, color: 0x9a9088 });
    const ceilMat = new THREE.MeshStandardMaterial({ map: T.tex(T.concrete('#3b3632', 5), [1.5, L / 4]), roughness: 1, color: 0x6b6360 });
    const floorMat = new THREE.MeshStandardMaterial({ map: T.tex(T.tiles(), [3, L / 2]), roughness: 0.42, metalness: 0.25, color: 0x8d8580 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), floorMat);
    floor.rotation.x = -PI / 2; floor.position.set(0, 0, zm);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), ceilMat);
    ceil.rotation.x = PI / 2; ceil.position.set(0, H, zm);
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat);
    wl.rotation.y = PI / 2; wl.position.set(-W / 2, H / 2, zm);
    const wr = new THREE.Mesh(new THREE.PlaneGeometry(L, H), wallMat);
    wr.rotation.y = -PI / 2; wr.position.set(W / 2, H / 2, zm);
    const end = new THREE.Mesh(new THREE.PlaneGeometry(W, H), endMat);
    end.rotation.y = PI; end.position.set(0, H / 2, z0);
    g.add(floor, ceil, wl, wr, end);

    // structural ribs
    const metal = new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 0.55, metalness: 0.75 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const ribZ = [];
    for (let z = 0; z > z1 + 2; z -= 6) ribZ.push(z);
    const ribs = new THREE.InstancedMesh(box, metal, ribZ.length * 3);
    ribZ.forEach((z, i) => {
      setInstance(ribs, i * 3, -2.85, 2, z, 0.3, 4, 0.4);
      setInstance(ribs, i * 3 + 1, 2.85, 2, z, 0.3, 4, 0.4);
      setInstance(ribs, i * 3 + 2, 0, 3.8, z, 6, 0.4, 0.4);
    });
    g.add(ribs);

    // graffiti spots (racks leave gaps for them)
    this.graffitiSpots = [
      ['L', -13, "THEY'RE\nSTILL CODING"], ['L', -30, '13'], ['R', -40, "DON'T\nLOOK BACK"],
      ['R', -52, 'HACK OR\nBE HACKED'], ['L', -58, 'IT COMPILES\nIN BLOOD'], ['R', -72, 'WAKE UP'], ['L', -86, 'RUN'],
    ];
    const gaps = [...this.graffitiSpots.map(([sd, gz]) => [sd, gz, 2.6]), ['R', -6.5, 2.6], ['L', -5.2, 3.2], ['R', -13.6, 3.2]];

    // server racks + LEDs
    const rackMat = new THREE.MeshStandardMaterial({ map: T.tex(T.rack(), [1, 1]), color: 0x8a8a90, roughness: 0.6, metalness: 0.5 });
    const slots = [];
    for (let z = -1.5; z > -97; z -= 3) {
      for (const side of [-1, 1]) {
        const blocked = gaps.some(([sd, gz, half]) => (sd === 'L' ? -1 : 1) === side && Math.abs(gz - z) < half);
        if (!blocked && Math.random() > 0.1) slots.push([side, z, rnd(2.1, 2.7)]);
      }
    }
    const racks = new THREE.InstancedMesh(box, rackMat, slots.length);
    const perRack = 10;
    const leds = (this.leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: 0xffffff }), slots.length * perRack));
    this.ledColors = [];
    let li = 0;
    slots.forEach(([side, z, h], i) => {
      setInstance(racks, i, side * 2.45, h / 2, z, 0.9, h, 2.4);
      for (let k = 0; k < perRack; k++) {
        setInstance(leds, li, side * 1.995, rnd(0.3, h - 0.15), z + rnd(-1.05, 1.05));
        const p = Math.random();
        const c = p < 0.7 ? new THREE.Color(0.2, 4, 1.2) : p < 0.88 ? new THREE.Color(5, 0.3, 0.1) : new THREE.Color(0.4, 1.5, 5);
        this.ledColors.push(c);
        leds.setColorAt(li, c);
        li++;
      }
    });
    g.add(racks, leds);

    // fluorescent fixtures
    for (let z = -3; z > -100; z -= 6) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const tube = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 1.9), mat);
      tube.position.set(0, 3.9, z);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 2.1), metal);
      housing.position.set(0, 3.96, z);
      g.add(tube, housing);
      const nearest = this.cLights.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));
      nearest.fixtures.push(mat);
    }

    // cables along the ceiling
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.7, metalness: 0.2 });
    const cx = (v) => THREE.MathUtils.clamp(v, -2.7, 2.7);
    for (let i = 0; i < 34; i++) {
      const za = rnd(-100, 4), len = rnd(3, 9), x = rnd(-2.6, 2.6), x2 = cx(x + rnd(-1.2, 1.2));
      const pts = [new V3(x, 3.95, za), new V3(cx((x + x2) / 2 + rnd(-0.3, 0.3)), 3.95 - rnd(0.3, 1.5), za - len / 2), new V3(x2, 3.95, za - len)];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, rnd(0.015, 0.045), 5), cableMat));
    }
    this.danglers = [];
    for (let i = 0; i < 10; i++) {
      const pivot = new THREE.Group();
      pivot.position.set(rnd(-2.2, 2.2), 3.95, rnd(-100, 0));
      const dl = rnd(0.8, 2.3);
      const pts = [new V3(0, 0, 0), new V3(rnd(-0.1, 0.1), -dl * 0.5, rnd(-0.1, 0.1)), new V3(rnd(-0.2, 0.2), -dl, rnd(-0.2, 0.2))];
      pivot.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.022, 5), cableMat));
      pivot.userData.phase = rnd(0, TAU);
      g.add(pivot);
      this.danglers.push(pivot);
    }

    // paper on the floor
    const paper = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xa39c88, roughness: 1, side: THREE.DoubleSide }), 60);
    for (let i = 0; i < 60; i++) setInstance(paper, i, rnd(-2.3, 2.3), 0.005 + i * 0.0002, rnd(-100, 4), 1, 1, 1, -PI / 2, 0, rnd(0, TAU));
    g.add(paper);

    // graffiti
    for (const [side, z, text] of this.graffitiSpots) {
      const big = text === '13';
      const tx = T.tex(T.graffiti(text, { seed: z, w: big ? 512 : 1024, h: 512, size: big ? 320 : undefined }));
      tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping;
      const warn = text.startsWith("DON'T");
      const mat = new THREE.MeshStandardMaterial({
        map: tx, transparent: true, roughness: 0.4, emissive: 0xff1a10, emissiveMap: tx,
        emissiveIntensity: warn ? 1.1 : 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(big ? 2.6 : 3.4, big ? 2.6 : 1.7), mat);
      const s = side === 'L' ? -1 : 1;
      mesh.position.set(s * 2.97, 2.0, z);
      mesh.rotation.y = -s * PI / 2;
      g.add(mesh);
    }
    this._horrorProps(g, metal);
  }

  _horrorProps(g, metal) {
    const decal = (map, rough = 0.3) => {
      map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
      return new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, roughness: rough, metalness: 0.15 });
    };
    // blood drag trail down the whole corridor
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 100), decal(T.tex(T.bloodTrail()), 0.18));
    trail.rotation.x = -PI / 2; trail.position.set(0.25, 0.012, -53);
    // pool of blood under the workstation
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), decal(T.tex(T.bloodPool()), 0.06));
    pool.rotation.x = -PI / 2; pool.position.set(-1.5, 0.014, -6.2);
    g.add(trail, pool);
    // handprints: the door, the floor, the walls
    const hands = [
      [-1.6, 1.5, -103.86, 0, 1.3, 11], [1.3, 2.0, -103.86, 0, 1.4, 12], [0.1, 1.0, -103.86, 0, 1.1, 13],
      [-2.96, 1.3, -31.9, PI / 2, 1.0, 14], [2.96, 1.1, -41.8, -PI / 2, 1.1, 15], [2.96, 1.5, -2.2, -PI / 2, 0.9, 16],
    ];
    for (const [x, y, z, ry, sz, seed] of hands) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), decal(T.tex(T.handprints(3, seed)), 0.35));
      m.position.set(x, y, z); m.rotation.y = ry;
      g.add(m);
    }
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), decal(T.tex(T.handprints(2, 30 + i)), 0.2));
      m.rotation.set(-PI / 2, 0, rnd(0, TAU)); m.position.set(rnd(-0.6, 1.1), 0.015, -20 - i * 16 + rnd(-3, 3));
      g.add(m);
    }
    // tally marks, scratched into the wall
    const tally = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), decal(T.tex(T.tally()), 0.8));
    tally.position.set(2.965, 1.9, -6.5); tally.rotation.y = -PI / 2;
    g.add(tally);

    // abandoned workstation
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.8, metalness: 0.2 });
    const plastic = new THREE.MeshStandardMaterial({ color: 0x6b655a, roughness: 0.7, metalness: 0.1 });
    const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
    box(0.9, 0.06, 2.4, deskMat, -2.4, 0.76, -5.2);
    for (const [dx, dz] of [[-0.4, -1.1], [0.4, -1.1], [-0.4, 1.1], [0.4, 1.1]]) box(0.05, 0.74, 0.05, metal, -2.4 + dx, 0.37, -5.2 + dz);
    this.deskScreen = new Screen();
    this.deskNoise = new Screen();
    this.deskNoise.set('noise');
    [[-4.6, this.deskScreen], [-5.9, this.deskNoise]].forEach(([z, scr]) => {
      box(0.62, 0.52, 0.58, plastic, -2.5, 1.05, z);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.36), new THREE.MeshBasicMaterial({ map: scr.tex, color: new THREE.Color(1.5, 1.5, 1.5) }));
      sc.position.set(-2.185, 1.06, z); sc.rotation.y = PI / 2;
      g.add(sc);
    });
    box(0.2, 0.03, 0.5, plastic, -2.1, 0.8, -5.2);
    // the chair that keeps spinning
    const chair = (this.chair = new THREE.Group());
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x1c1a1c, roughness: 0.6, metalness: 0.3 });
    const cb = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), chairMat); m.position.set(x, y, z); chair.add(m); };
    cb(0.5, 0.08, 0.5, 0, 0.5, 0); cb(0.06, 0.62, 0.48, 0.25, 0.86, 0); cb(0.05, 0.42, 0.05, 0, 0.27, 0);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.05), chairMat); m.position.set(Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17); m.rotation.y = -a; chair.add(m); }
    chair.position.set(-1.35, 0, -5.2);
    g.add(chair);
    const fallen = chair.clone();
    fallen.position.set(1.0, 0.25, -24); fallen.rotation.set(0, 0.6, PI / 2);
    g.add(fallen);

    // 3x3 CRT wall
    this.wallScreen = new Screen();
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
      const z = -12.4 - col * 1.2, y = 0.45 + row * 0.86;
      box(0.8, 0.82, 1.12, plastic, 2.5, y, z);
      const mat = new THREE.MeshBasicMaterial({ map: this.wallScreen.tex, color: 0x000000 });
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.62), mat);
      sc.position.set(2.095, y, z); sc.rotation.y = -PI / 2;
      g.add(sc);
      this.tiles.push({ mat, v: 0 });
    }
    // EXIT sign and ceiling pipes
    const exitTex = T.tex(T.exitSign()); exitTex.wrapS = exitTex.wrapT = THREE.ClampToEdgeWrapping;
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshBasicMaterial({ map: exitTex, color: new THREE.Color(4, 0.25, 0.15) }));
    exit.position.set(-2.1, 3.35, -103.84);
    g.add(exit);
    for (const x of [-1.9, 1.75]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 110, 8), metal);
      p.rotation.x = PI / 2; p.position.set(x, 3.72, -49);
      g.add(p);
    }
  }

  /* ---------------- the creature + the 13 ---------------- */
  _figures() {
    this.hero = new Figure({ detail: true });
    this.hero.root.visible = false;
    this.hero.onStep = () => this.emit('footstep');
    this.scene.add(this.hero.root);
    this.watchers = [];
    for (let i = 0; i < 13; i++) {
      const w = new Figure({ detail: false });
      w.root.visible = false;
      w.onSnap = () => { if (this.mode === 'intro') this.emit('crack'); };
      this.scene.add(w.root);
      this.watchers.push(w);
    }
  }

  heroHide() {
    const h = this.hero;
    gsap.killTweensOf(h.root.position);
    h.reset();
    h.root.visible = false;
    this.heroGlow = 0;
  }

  heroStand(z, facingAway = false) {
    const h = this.hero;
    this.heroHide();
    h.root.visible = true;
    h.root.position.set(0, 0, z);
    h.root.rotation.set(0, facingAway ? PI : 0, 0);
  }

  heroCeiling(z) {
    const h = this.hero;
    this.heroHide();
    h.root.visible = true;
    h.pose('crawl', 0);
    h.root.rotation.set(-PI / 2, 0, 0);
    h.root.position.set(0, 3.5, z);
  }

  heroWalk(toZ, duration) {
    const h = this.hero;
    h.walking = true;
    gsap.to(h.root.position, { z: toZ, duration, ease: 'none', onComplete: () => { h.walking = false; } });
  }

  heroCrouch() {
    const h = this.hero;
    h.walking = false;
    h.pose('crouch', 0.8, 'power2.inOut');
    h.jitter = 0.2;
    h.lookMode = true;
  }

  heroLunge() {
    const h = this.hero;
    h.skull.getWorldPosition(_w);
    this.camera.getWorldDirection(_d);
    const target = this.camera.position.clone().add(_d.multiplyScalar(0.55));
    const p = h.root.position;
    gsap.to(p, { x: p.x + target.x - _w.x, y: p.y + target.y - _w.y, z: p.z + target.z - _w.z, duration: 0.3, ease: 'power4.in' });
    gsap.to(h.j.head.rotation, { z: 0.45, duration: 0.3, ease: 'power3.in' });
  }

  placeWatchersCorridor() {
    this.watchersMode = 'corridor';
    this.watchers.forEach((w, i) => {
      w.reset();
      const side = i % 2 ? 1 : -1;
      w.root.visible = true;
      w.root.position.set(side * 1.55, 0, -24 - i * 5.3);
      w.root.rotation.set(0, side > 0 ? PI / 2 : -PI / 2, 0);
      w.snapRate = 0.35;
    });
  }

  placeWatchersPlatform(looking) {
    this.watchersMode = 'platform';
    const center = new V3(0, 0, -160);
    this.watchers.forEach((w, i) => {
      w.reset();
      const a = PI / 2 + (i / 13) * TAU;
      w.root.visible = true;
      w.root.position.set(center.x + Math.cos(a) * 8.3, 0, center.z + Math.sin(a) * 8.3);
      w.root.rotation.y = Math.atan2(EYE_POS.x - w.root.position.x, EYE_POS.z - w.root.position.z);
      w.lookMode = !!looking;
      w.snapRate = 0.02;
    });
  }

  watchersLook() {
    this.watchers.forEach((w, i) => gsap.delayedCall(i * 0.06, () => { w.lookMode = true; w.snapRate = 1; gsap.delayedCall(0.4, () => { w.snapRate = 0.02; }); }));
  }

  phantom() {
    if (this.mode !== 'world' || this.hero.root.visible) return;
    const h = this.hero;
    this.camera.getWorldDirection(_d);
    _d.y = 0; _d.normalize();
    const side = new V3(-_d.z, 0, _d.x);
    this.heroStand(0);
    h.root.position.copy(this.camera.position).addScaledVector(_d, 8).addScaledVector(side, Math.random() < 0.5 ? -3.2 : 3.2);
    h.root.position.y -= 1.9;
    h.root.rotation.y = Math.atan2(this.camera.position.x - h.root.position.x, this.camera.position.z - h.root.position.z);
    h.lookMode = true;
    this.glitchPulse(0.5, 0.4);
    gsap.delayedCall(1.3, () => { this.glitchPulse(0.7, 0.4); this.heroHide(); });
  }

  /* ---------------- corridor control ---------------- */
  lightOff(i) { const L = this.cLights[i]; L.override = 0; L.chaos = 0; }
  lightChaos(i, v) { this.cLights[i].chaos = v; }
  lightsReset() { this.cLights.forEach((L) => { L.override = null; L.chaos = 0; }); }

  wallOn(duration = 1.2, stagger = true) {
    const order = this.tiles.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((i, k) => gsap.to(this.tiles[i], { v: 1, duration: 0.15, delay: stagger ? (k / order.length) * duration : 0 }));
  }

  wallOff(duration = 1) {
    this.tiles.forEach((tile, k) => gsap.to(tile, { v: 0, duration: 0.12, delay: (k / this.tiles.length) * duration }));
  }

  /* ---------------- blast door + facility wall ---------------- */
  _door() {
    const mat = new THREE.MeshStandardMaterial({ map: T.tex(T.stripes()), roughness: 0.6, metalness: 0.6, color: 0xaaaaaa });
    const geo = new THREE.BoxGeometry(3, 4, 0.25);
    this.doorL = new THREE.Mesh(geo, mat); this.doorL.position.set(-1.5, 2, -104);
    this.doorR = new THREE.Mesh(geo, mat); this.doorR.position.set(1.5, 2, -104);
    this.doorLampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.02, 0.01) });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16), this.doorLampMat);
    lamp.rotation.x = PI / 2; lamp.position.set(0, 3.72, -103.8);

    const shape = new THREE.Shape();
    shape.moveTo(-500, -200); shape.lineTo(500, -200); shape.lineTo(500, 320); shape.lineTo(-500, 320); shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-3, 0); hole.lineTo(-3, 4); hole.lineTo(3, 4); hole.lineTo(3, 0); hole.closePath();
    shape.holes.push(hole);
    const wallTex = T.tex(T.concrete('#2c2626', 21), [0.04, 0.04]);
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: 0x3a2e2e, roughness: 1, map: wallTex }));
    wall.position.z = -104.3; wall.rotation.y = PI;
    this.scene.add(this.doorL, this.doorR, lamp, wall);
  }

  openDoor(duration = 1.6) {
    gsap.to(this.doorL.position, { x: -4.6, duration, ease: 'power2.inOut' });
    gsap.to(this.doorR.position, { x: 4.6, duration, ease: 'power2.inOut' });
  }

  /* ---------------- THE VOID ---------------- */
  _void() {
    const v = (this.voidGroup = new THREE.Group());
    this.scene.add(v);

    this.skyMat = S.skyMaterial();
    v.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), this.skyMat));

    this.seaMat = S.seaMaterial();
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), this.seaMat);
    sea.rotation.x = -PI / 2; sea.position.set(0, -14, -300);
    v.add(sea);

    const stone = new THREE.MeshStandardMaterial({ map: T.tex(T.concrete('#3a3434', 31), [1, 8]), color: 0x8a7f7f, roughness: 0.9 });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 47), stone);
    bridge.position.set(0, -0.4, -127.5);
    v.add(bridge);
    const pillarGeo = new THREE.CylinderGeometry(0.9, 1.3, 14, 10);
    for (const z of [-114, -136]) {
      const p = new THREE.Mesh(pillarGeo, stone); p.position.set(0, -7.4, z); v.add(p);
    }
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1, 0.16), stone, 24);
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1;
      const hgt = rnd(0.3, 1.3);
      setInstance(posts, i, side * 1.5, hgt / 2, -106 - Math.floor(i / 2) * 3.8, 1, hgt, 1, rnd(-0.15, 0.15), 0, rnd(-0.2, 0.2));
    }
    v.add(posts);

    // candles
    const wax = new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.8, emissive: 0x2a1204 });
    this.flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2, 0.4) });
    const candleSpots = [];
    for (let z = -107; z > -150; z -= 2.4) if (Math.random() > 0.2) candleSpots.push([Math.random() > 0.5 ? 1.35 : -1.35, z + rnd(-0.5, 0.5), rnd(0.12, 0.35)]);
    const candles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 1, 8), wax, candleSpots.length);
    const flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 0.1, 6), this.flameMat, candleSpots.length);
    candleSpots.forEach(([x, z, h], i) => {
      setInstance(candles, i, x, h / 2, z, 1, h, 1);
      setInstance(flames, i, x, h + 0.06, z);
    });
    v.add(candles, flames);

    // ritual platform + sigil
    const platMat = new THREE.MeshStandardMaterial({ map: T.tex(T.concrete('#3a3434', 33), [6, 1]), color: 0x8a7f7f, roughness: 0.9 });
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(10, 8, 1.4, 64), platMat);
    plat.position.set(0, -0.7, -160);
    v.add(plat);
    const sigTex = T.tex(T.sigil());
    sigTex.wrapS = sigTex.wrapT = THREE.ClampToEdgeWrapping;
    this.sigilMat = new THREE.MeshBasicMaterial({ map: sigTex, transparent: true, color: new THREE.Color(2.2, 0.2, 0.12), blending: THREE.AdditiveBlending, depthWrite: false });
    this.sigil = new THREE.Mesh(new THREE.CircleGeometry(9.3, 64), this.sigilMat);
    this.sigil.rotation.x = -PI / 2; this.sigil.position.set(0, 0.03, -160);
    v.add(this.sigil);

    this._eye(v);
    this._monolithCircle(v);
    this._cableTree(v);
    this._tower(v);

    // moon + halo
    const moon = new THREE.Mesh(new THREE.SphereGeometry(40, 48, 32), new THREE.MeshBasicMaterial({ map: T.tex(T.moon()), color: new THREE.Color(1.5, 0.5, 0.35), fog: false }));
    moon.position.copy(MOON_POS);
    const glowTex = T.tex(T.glow());
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff3010, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.55 }));
    halo.position.copy(MOON_POS); halo.scale.setScalar(360);
    v.add(moon, halo);

    // floating debris
    const rockMat = (this.rockMat = new THREE.MeshStandardMaterial({ color: 0x2a2224, roughness: 1, flatShading: true }));
    const debris = (this.debris = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 90));
    debris.position.set(0, 0, -300);
    const avoid = [new V3(0, 2, -121), MONO_CENTER, TREE_CENTER, new V3(-85, 10, -300), new V3(-58, 6, -238), new V3(0, 2, -160), EYE_POS];
    let n = 0;
    while (n < 90) {
      const p = new V3(rnd(-230, 230), rnd(-10, 80), rnd(-140, -540));
      if (avoid.some((a) => a.distanceTo(p) < 38)) continue;
      const sc = rnd(0.6, 5.5);
      setInstance(debris, n++, p.x, p.y, p.z + 300, sc, sc * rnd(0.5, 1.2), sc, rnd(0, TAU), rnd(0, TAU), rnd(0, TAU));
    }
    v.add(debris);
  }

  _eye(v) {
    const root = (this.eyeRoot = new THREE.Group());
    root.position.copy(EYE_POS);
    root.lookAt(0, 1.9, -121);
    v.add(root);
    const R = 24;
    this.eyeMat = S.eyeMaterial();
    this.eyeball = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), this.eyeMat);
    this.eyeball.userData = { type: 'eye' };
    root.add(this.eyeball);
    this.clickables.push(this.eyeball);

    const flesh = new THREE.MeshStandardMaterial({ color: 0x3a0e0c, roughness: 0.5, metalness: 0.1, emissive: 0x160202, fog: false });
    this.lidU = new THREE.Mesh(new THREE.SphereGeometry(R * 1.03, 64, 32, 0, TAU, 0, PI / 2), flesh);
    this.lidL = new THREE.Mesh(new THREE.SphereGeometry(R * 1.03, 64, 32, 0, TAU, PI / 2, PI / 2), flesh);
    root.add(this.lidU, this.lidL);

    const torus = new THREE.TorusGeometry(R * 1.14, R * 0.32, 32, 120);
    const pos = torus.attributes.position;
    const nrm = torus.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const b = Math.sin(x * 0.35) * Math.cos(y * 0.3) * 1.6 + Math.sin(z * 0.8 + x * 0.2) * 0.8 + Math.random() * 0.25;
      pos.setXYZ(i, x + nrm.getX(i) * b, y + nrm.getY(i) * b, z + nrm.getZ(i) * b);
    }
    torus.computeVertexNormals();
    root.add(new THREE.Mesh(torus, flesh));

    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + rnd(-0.1, 0.1);
      const pts = [];
      const r0 = R * 1.3, r1 = R * rnd(2.2, 3.4);
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const rr = r0 + (r1 - r0) * t;
        const aa = a + Math.sin(t * 5 + i) * 0.12;
        pts.push(new V3(Math.cos(aa) * rr, Math.sin(aa) * rr, -t * R * rnd(0.8, 2.2) + rnd(-2, 2)));
      }
      root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, rnd(0.8, 2.4), 8), flesh));
    }
    const glowTex = T.tex(T.glow());
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff1a0a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, opacity: 0.1 }));
    glow.scale.setScalar(150);
    glow.position.set(0, 0, -12);
    root.add(glow);
  }

  _monolithCircle(v) {
    this.monoGroup = new THREE.Group();
    v.add(this.monoGroup);
    this.monoRockGeo = new THREE.DodecahedronGeometry(1, 0);
    this.crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6, 0),
      new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a0a, emissiveIntensity: 2.6, roughness: 0.2, metalness: 0.5, flatShading: true }),
    );
    this.crystal.position.set(MONO_CENTER.x, 6, MONO_CENTER.z);
    this.crystal.scale.set(1, 1.6, 1);
    v.add(this.crystal);
  }

  setEvents(events) {
    for (const m of this.monoliths) {
      this.monoGroup.remove(m.group);
      m.faceTex.dispose(); m.face.dispose();
    }
    this.clickables = this.clickables.filter((o) => o.userData.type !== 'monolith');
    this.monoliths = [];
    const list = events.slice(0, 10);
    const n = Math.max(6, list.length);
    const camPos = this.stations.events.pos;
    const away = Math.atan2(MONO_CENTER.z - camPos.z, MONO_CENTER.x - camPos.x);
    const spread = Math.min(PI * 0.95, n * 0.34);
    const radius = n > 7 ? 13 : 11;
    const side = new THREE.MeshStandardMaterial({ color: 0x0c0a0b, roughness: 0.5, metalness: 0.6 });
    const slabGeo = new THREE.BoxGeometry(3.2, 9, 0.7);
    for (let i = 0; i < n; i++) {
      const ev = list[i] || null;
      const a = away + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
      const grp = new THREE.Group();
      grp.position.set(MONO_CENTER.x + Math.cos(a) * radius, 0, MONO_CENTER.z + Math.sin(a) * radius);
      grp.lookAt(camPos.x, 0, camPos.z);
      const faceTex = T.tex(T.monolithFace(ev, i));
      faceTex.wrapS = faceTex.wrapT = THREE.ClampToEdgeWrapping;
      const base = ev ? 1.5 : 0.55;
      const face = new THREE.MeshStandardMaterial({ map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: base, roughness: 0.45, metalness: 0.3 });
      const slab = new THREE.Mesh(slabGeo, [side, side, side, side, face, side]);
      slab.position.y = 5.4;
      slab.userData = { type: 'monolith', event: ev, face, base };
      const rock = new THREE.Mesh(this.monoRockGeo, this.rockMat);
      rock.position.y = 0.4; rock.scale.set(2.3, 1.1, 1.5); rock.rotation.set(rnd(0, 1), rnd(0, 3), 0);
      grp.add(slab, rock);
      this.monoGroup.add(grp);
      if (ev) this.clickables.push(slab);
      this.monoliths.push({ group: grp, slab, face, faceTex, phase: rnd(0, TAU) });
    }
  }

  _cableTree(v) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x140d0d, roughness: 0.55, metalness: 0.35 });
    const tc = TREE_CENTER;
    for (let k = 0; k < 6; k++) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const y = -14 + i * 2.2;
        const ang = i * 0.45 + (k / 6) * TAU;
        const rad = 1.7 * (1 - i / 18) + 0.3;
        pts.push(new V3(tc.x + Math.cos(ang) * rad, y, tc.z + Math.sin(ang) * rad));
      }
      v.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.3 - k * 0.025, 7), mat));
    }
    const shell = new THREE.MeshStandardMaterial({ color: 0x2b2924, roughness: 0.7, metalness: 0.2 });
    const bodyGeo = new THREE.BoxGeometry(1.8, 1.5, 1.6);
    const screenGeo = new THREE.PlaneGeometry(1.42, 1.1);
    const messages = ['HELP', 'LET US OUT', '0xDEAD', '13', 'BEHIND YOU', 'SEGFAULT', 'WE ARE STILL HERE', 'KYPZERO', 'DO NOT LOG OUT'];
    const aboutPos = new V3(20, 3.2, -164);
    this.crts = [];
    for (let b = 0; b < 9; b++) {
      const hb = rnd(3, 15);
      const ab = (b / 9) * TAU + rnd(-0.2, 0.2);
      const dir = new V3(Math.cos(ab), 0, Math.sin(ab));
      const len = rnd(5, 9);
      const start = tc.clone().add(dir.clone().multiplyScalar(0.6)).setY(hb);
      const mid = tc.clone().add(dir.clone().multiplyScalar(len * 0.5)).setY(hb + rnd(1, 3));
      const endP = tc.clone().add(dir.clone().multiplyScalar(len)).setY(hb - rnd(0, 2));
      v.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, endP]), 30, 0.13, 6), mat));

      const hang = rnd(2, 5);
      const pivot = new THREE.Group();
      pivot.position.copy(endP);
      pivot.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(0.05, -hang / 2, 0), new V3(0, -hang + 0.75, 0)]), 8, 0.04, 5), mat));
      const crt = new THREE.Group();
      crt.position.y = -hang;
      const body = new THREE.Mesh(bodyGeo, shell);
      const sm = S.crtMaterial(T.crtText(messages[b]), rnd(0, 10));
      const screen = new THREE.Mesh(screenGeo, sm);
      screen.position.z = 0.81;
      screen.userData = { type: 'crt', mat: sm };
      crt.add(body, screen);
      pivot.add(crt);
      v.add(pivot);
      pivot.updateMatrixWorld(true);
      const wp = crt.getWorldPosition(new V3());
      crt.rotation.y = Math.atan2(aboutPos.x - wp.x, aboutPos.z - wp.z);
      pivot.userData.phase = rnd(0, TAU);
      this.crts.push({ pivot, mat: sm });
      this.clickables.push(screen);
    }
  }

  _tower(v) {
    const tp = TOWER_BASE, H = 72, N = 12;
    const leg = (sx, sz, t) => new V3(tp.x + sx * (6 - 5 * t), tp.y + t * H, tp.z + sz * (6 - 5 * t));
    const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N;
      corners.forEach(([sx, sz], c) => {
        const [nx, nz] = corners[(c + 1) % 4];
        pts.push(leg(sx, sz, t0), leg(sx, sz, t1));
        pts.push(leg(sx, sz, t0), leg(nx, nz, t1), leg(nx, nz, t0), leg(sx, sz, t1));
        pts.push(leg(sx, sz, t0), leg(nx, nz, t0));
      });
    }
    const lattice = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7a2a20 }));
    v.add(lattice);
    const top = new V3(tp.x, tp.y + H, tp.z);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 6, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a18, metalness: 0.6, roughness: 0.5 }));
    mast.position.copy(top).add(new V3(0, 3, 0));
    v.add(mast);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 0.4, 0.2), fog: false });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), this.beaconMat);
    beacon.position.copy(top).add(new V3(0, 6.5, 0));
    v.add(beacon);
    this.rings = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 96), m);
      ring.position.copy(beacon.position);
      ring.rotation.x = PI / 2;
      v.add(ring);
      this.rings.push(ring);
    }
  }

  /* ---------------- particles ---------------- */
  _makePoints(count, mat) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3), seed = new Float32Array(count), size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random();
      seed[i] = Math.random(); size[i] = rnd(0.4, 1.4);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  _particles() {
    this.ashMat = S.particleMaterial({
      colorA: new THREE.Color(1.8, 0.28, 0.05), colorB: new THREE.Color(0.45, 0.4, 0.4),
      boxMin: new V3(-150, -14, -430), boxSize: new V3(300, 90, 330), rise: 0.012, size: 7, opacity: 0,
    });
    this.voidGroup.add(this._makePoints(this.lowPower ? 1500 : 3500, this.ashMat));
    this.dustMat = S.particleMaterial({
      colorA: new THREE.Color(0.8, 0.78, 0.75), colorB: new THREE.Color(0.5, 0.5, 0.55),
      boxMin: new V3(-3, 0, -104), boxSize: new V3(6, 4, 110), rise: 0.004, size: 1.3, opacity: 0.4,
    });
    this.corridorGroup.add(this._makePoints(900, this.dustMat));
  }

  /* ---------------- post-processing ---------------- */
  _post() {
    const c = (this.composer = new EffectComposer(this.renderer));
    c.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.55, 0.78);
    c.addPass(this.bloom);
    this.horror = new ShaderPass(S.HorrorShader);
    c.addPass(this.horror);
    c.addPass(new OutputPass());
    this.horror.uniforms.uRes.value.set(innerWidth, innerHeight);
  }

  /* ---------------- stations ---------------- */
  _stations() {
    const wide = innerWidth > 900;
    const mk = (pos, focus, yawOff = 0, pitchOff = 0) => {
      const { yaw, pitch } = yawPitch(pos, focus);
      return { pos, yaw: yaw + (wide ? yawOff : 0), pitch: pitch + (wide ? pitchOff : -0.14) };
    };
    this.stations = {
      home: mk(new V3(0, 1.9, -121), new V3(0, 24, -330), 0, -0.15),
      events: mk(new V3(-14, 3.8, -158), new V3(-38, 4.8, -182), -0.36),
      about: mk(new V3(20, 3.2, -164), new V3(44, 3.5, -188), 0.36),
      contact: mk(new V3(-58, 6, -238), new V3(-85, 32, -300), -0.3),
    };
    if (!wide) this.stations.home.pitch = yawPitch(this.stations.home.pos, new V3(0, 24, -330)).pitch - 0.3;
  }

  goTo(name, { duration = 3.2 } = {}) {
    const st = this.stations[name];
    if (!st) return;
    this.station = name;
    const r = this.rig;
    const from = new V3(r.x, r.y, r.z);
    const to = st.pos.clone();
    this.camTween?.kill();
    if (duration <= 0) {
      Object.assign(r, { x: to.x, y: to.y, z: to.z, yaw: st.yaw, pitch: st.pitch, fov: 60 });
      return;
    }
    const mid = from.clone().lerp(to, 0.5);
    mid.y += from.distanceTo(to) * 0.16 + 2;
    const curve = new THREE.CatmullRomCurve3([from, mid, to]);
    const yaw0 = r.yaw, pitch0 = r.pitch;
    let dy = st.yaw - yaw0;
    dy = ((dy + PI) % TAU + TAU) % TAU - PI;
    const p = { t: 0 };
    const tl = (this.camTween = gsap.timeline());
    tl.to(p, {
      t: 1, duration, ease: 'power3.inOut',
      onUpdate: () => {
        const q = curve.getPoint(p.t);
        r.x = q.x; r.y = q.y; r.z = q.z;
        r.yaw = yaw0 + dy * p.t;
        r.pitch = pitch0 + (st.pitch - pitch0) * p.t;
      },
      onComplete: () => this.emit('arrive', name),
    }, 0);
    tl.to(r, { fov: 70, duration: duration * 0.5, ease: 'sine.inOut' }, 0);
    tl.to(r, { fov: 60, duration: duration * 0.5, ease: 'sine.inOut' }, duration * 0.5);
    tl.fromTo(this.fx, { glitch: 0.35 }, { glitch: 0, duration: 0.7, ease: 'power2.out' }, 0);
    tl.fromTo(this.fx, { aberration: 1.2 }, { aberration: 0.3, duration: duration, ease: 'power2.out' }, 0);
  }

  /* ---------------- cinematic helpers ---------------- */
  setMode(mode) {
    this.mode = mode;
    if (mode === 'world') {
      gsap.to(this.fx, { parallax: 1, sway: 0.55, duration: 2 });
      this.corr.flashlight = 0.4;
    }
  }

  enterVoid(duration = 3) {
    this.voidGroup.visible = true;
    const fog = this.scene.fog;
    const target = new THREE.Color(0x0b0204);
    if (duration <= 0) {
      this.voidLevel = 1; fog.density = 0.0032; fog.color.copy(target);
      return;
    }
    gsap.to(this, { voidLevel: 1, duration, ease: 'power2.out' });
    gsap.to(fog, { density: 0.0032, duration, ease: 'power2.out' });
    gsap.to(fog.color, { r: target.r, g: target.g, b: target.b, duration });
  }

  leaveCorridor() {
    this.corridorGroup.visible = false;
    this.corr.level = 0; this.corr.chaos = 0; this.corr.alarm = 0;
  }

  openEye(duration = 2.6) {
    const tl = gsap.timeline();
    tl.to(this.eyeOpen, { v: 0.32, duration: duration * 0.45, ease: 'power2.out' });
    tl.to(this.eyeOpen, { v: 1, duration: duration * 0.4, ease: 'power3.inOut' }, `+=${duration * 0.15}`);
    tl.fromTo(this.eyeDilate, { v: 1 }, { v: 0.2, duration: duration, ease: 'power2.out' }, 0);
  }

  blink() {
    if (this.blinking || this.eyeOpen.v < 0.95) return;
    this.blinking = true;
    gsap.timeline({ onComplete: () => { this.blinking = false; } })
      .to(this.eyeOpen, { v: 0, duration: 0.09, ease: 'power2.in' })
      .to(this.eyeOpen, { v: 1, duration: 0.24, ease: 'power2.out' }, '+=0.06');
  }

  shake(amount = 0.4, duration = 0.5) {
    gsap.fromTo(this.fx, { shake: amount }, { shake: 0, duration, ease: 'power2.out' });
  }

  glitchPulse(amount = 0.6, duration = 0.6) {
    gsap.fromTo(this.fx, { glitch: amount }, { glitch: 0, duration, ease: 'power2.out' });
  }

  redPulse(amount = 0.6, duration = 1.2) {
    gsap.fromTo(this.fx, { red: amount }, { red: 0, duration, ease: 'power2.out' });
  }

  scare() {
    this.hero.scream();
    gsap.fromTo(this.fx,
      { glitch: 1, aberration: 4, shake: 1.6, red: 0.9 },
      { glitch: 0.15, aberration: 0.8, shake: 0.2, red: 0.3, duration: 0.85, ease: 'power2.out' });
  }

  skipToWorld(station = 'home') {
    gsap.killTweensOf(this.rig);
    gsap.killTweensOf(this.corr);
    this.heroHide();
    this.placeWatchersPlatform(true);
    this.lightsReset();
    this.chairSpin = 0;
    this.corr.flashlight = 0.4;
    this.corr.color.set(SICK);
    gsap.killTweensOf(this.doorL.position); gsap.killTweensOf(this.doorR.position);
    this.doorL.position.x = -4.6; this.doorR.position.x = 4.6;
    gsap.killTweensOf(this);
    this.enterVoid(0);
    this.leaveCorridor();
    gsap.killTweensOf(this.eyeOpen);
    this.eyeOpen.v = 1;
    this.goTo(this.stations[station] ? station : 'home', { duration: 0 });
    gsap.killTweensOf(this.fx);
    Object.assign(this.fx, { shake: 0, aberration: 0.3, flash: 0, red: 0, static: 0, vhs: 0, invert: 0, sway: 1 });
    this.rig.bob = 0; this.rig.roll = 0;
    gsap.fromTo(this.fx, { blackout: 1, glitch: 0.7 }, { blackout: 0, glitch: 0, duration: 1.6, ease: 'power2.out' });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.horror.uniforms.uRes.value.set(w, h);
    const prev = this.stations;
    this._stations();
    if (this.mode === 'world' && this.station && prev && !this.camTween?.isActive()) {
      const st = this.stations[this.station];
      gsap.to(this.rig, { yaw: st.yaw, pitch: st.pitch, duration: 0.8, ease: 'power2.out' });
    }
  }

  /* ---------------- interaction ---------------- */
  _setHover(obj, on) {
    const d = obj.userData;
    if (d.type === 'monolith') {
      gsap.to(d.face, { emissiveIntensity: on ? d.base * 2.2 : d.base, duration: 0.3 });
      gsap.to(obj.scale, { x: on ? 1.05 : 1, y: on ? 1.05 : 1, z: on ? 1.05 : 1, duration: 0.4, ease: 'power2.out' });
    } else if (d.type === 'eye') {
      this.eyeDilate.target = on ? 0.95 : 0.35;
    } else if (d.type === 'crt') {
      d.mat.uniforms.uBoost.value = on ? 1.8 : 1;
    }
  }

  _updateHover() {
    if (this.mode !== 'world' || !this.pointerOnCanvas) {
      if (this.hovered) { this._setHover(this.hovered, false); this.hovered = null; this.emit('hover', null); }
      return;
    }
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hit = this.raycaster.intersectObjects(this.clickables, false)[0];
    const obj = hit ? hit.object : null;
    if (obj !== this.hovered) {
      if (this.hovered) this._setHover(this.hovered, false);
      this.hovered = obj;
      if (obj) this._setHover(obj, true);
      this.emit('hover', obj ? obj.userData : null);
    }
  }

  _click() {
    if (this.mode !== 'world' || !this.hovered) return;
    const d = this.hovered.userData;
    if (d.type === 'eye') { this.blink(); this.glitchPulse(0.5, 0.5); this.redPulse(0.4, 0.8); }
    if (d.type === 'crt') { d.mat.uniforms.uBoost.value = 4; setTimeout(() => { d.mat.uniforms.uBoost.value = 1.8; }, 180); this.glitchPulse(0.4, 0.4); }
    this.emit('pick', d);
  }

  /* ================================================================ */
  _tick() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.time += dt;
    const t = this.time;
    this.mouseSmooth.lerp(this.mouse, 1 - Math.exp(-dt * 5));
    this._updateCorridor(t, dt);
    if (this.voidGroup.visible) this._updateVoid(t, dt);
    const cp = this.camera.position;
    this.hero.update(t, dt, cp);
    const hp = this.hero.root.position;
    this.heroLight.position.set(hp.x, 3.2, hp.z + (this.hero.root.rotation.y === 0 ? -1.6 : 1.6));
    this.heroLight.intensity = this.hero.root.visible ? this.heroGlow * 7 : 0;
    if (this.watchersMode === 'corridor') {
      for (const w of this.watchers) if (!w.lookMode && cp.z < w.root.position.z + 13) w.lookMode = true;
    }
    for (const w of this.watchers) w.update(t, dt, cp);
    this._updateCamera(t);
    this._updateHover();

    const u = this.horror.uniforms, fx = this.fx;
    u.uTime.value = t;
    u.uGrain.value = fx.grain; u.uVignette.value = fx.vignette; u.uAberration.value = fx.aberration;
    u.uGlitch.value = fx.glitch; u.uBlackout.value = fx.blackout; u.uFlash.value = fx.flash;
    u.uRed.value = fx.red; u.uScan.value = fx.scan;
    u.uStatic.value = fx.static; u.uVHS.value = fx.vhs; u.uInvert.value = fx.invert;
    this.composer.render(dt);
  }

  _updateCorridor(t, dt) {
    const c = this.corr;
    if (this.corridorGroup.visible) {
      const alarmPulse = c.alarm ? 0.55 + 0.45 * Math.sin(t * 9) : 1;
      for (const L of this.cLights) {
        if (t > L.next) { L.until = t + rnd(0.04, 0.22); L.next = t + rnd(0.5, 6) * (L.base < 1 ? 0.3 : 1); }
        let lv = L.override ?? c.level * L.base * alarmPulse;
        if (L.override === null && t < L.until) lv *= 0.12;
        const ch = Math.max(c.chaos, L.chaos);
        if (ch > 0 && Math.random() < ch * 0.55) lv *= Math.random() * 0.15;
        L.light.intensity = lv * 9;
        L.light.color.copy(c.color);
        for (const m of L.fixtures) m.color.copy(c.color).multiplyScalar(0.03 + lv * 3.2);
      }
      for (let k = 0; k < 24; k++) {
        const i = (Math.random() * this.ledColors.length) | 0;
        this.leds.setColorAt(i, Math.random() > 0.3 ? this.ledColors[i] : LED_OFF);
      }
      this.leds.instanceColor.needsUpdate = true;
      for (const d of this.danglers) d.rotation.z = Math.sin(t * 0.8 + d.userData.phase) * 0.06;
      this.dustMat.uniforms.uTime.value = t;
      this.dustMat.uniforms.uOpacity.value = 0.15 + c.level * 0.45;
      const lamp = c.alarm ? 0.5 + 0.5 * Math.sin(t * 9) : 0.15;
      this.doorLampMat.color.setRGB(0.3 + lamp * 5, 0.05 + lamp * 0.3, 0.02 + lamp * 0.1);
      this.chair.rotation.y += this.chairSpin * dt;
      this.deskScreen.update(); this.deskNoise.update(); this.wallScreen.update();
      let sum = 0;
      for (const tile of this.tiles) { const f = tile.v * (0.85 + Math.random() * 0.3); tile.mat.color.setRGB(f * 1.6, f * 1.6, f * 1.6); sum += tile.v; }
      this.screenLight.intensity = (sum / this.tiles.length) * 7;
      this.screenLight.color.set(this.wallScreen.mode === 'text' ? 0xff2010 : 0x9dffc4);
    } else {
      for (const L of this.cLights) L.light.intensity = 0;
      this.screenLight.intensity = 0;
    }
    let fl = c.flashlight;
    if (c.chaos > 0 && Math.random() < c.chaos * 0.4) fl *= Math.random() * 0.3;
    this.flashlight.intensity = fl * 22;
    this.flTarget.position.set(this.mouseSmooth.x * 3.2, this.mouseSmooth.y * 2.2, -6);
  }

  _updateVoid(t, dt) {
    const vl = this.voidLevel;
    const eu = this.eyeMat.uniforms;
    eu.uTime.value = t;
    this.eyeDilate.v += (this.eyeDilate.target - this.eyeDilate.v) * (1 - Math.exp(-dt * 3));
    eu.uDilate.value = this.eyeDilate.v + Math.sin(t * 1.3) * 0.04;

    this.raycaster.setFromCamera(this.mouseSmooth, this.camera);
    const target = this.camera.position.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(60));
    this.eyeTarget.lerp(target, 1 - Math.exp(-dt * 2.5));
    this.eyeball.lookAt(this.eyeTarget);
    const o = this.eyeOpen.v;
    this.lidU.rotation.x = -1.12 * o;
    this.lidL.rotation.x = 0.92 * o;
    if (this.mode === 'world' && t > this.nextBlink) { this.blink(); this.nextBlink = t + rnd(4, 11); }

    this.seaMat.uniforms.uTime.value = t;
    this.seaMat.uniforms.uEyeGlow.value = vl * (0.35 + 0.65 * o);
    this.seaMat.uniforms.uFogDensity.value = this.scene.fog.density;
    this.seaMat.uniforms.uFogColor.value.copy(this.scene.fog.color);
    this.skyMat.uniforms.uLevel.value = vl;
    this.skyMat.uniforms.uTime.value = t;

    this.sigil.rotation.z = t * 0.04;
    const sp = 0.75 + 0.25 * Math.sin(t * 1.4);
    this.sigilMat.color.setRGB(2.2 * sp * vl, 0.2 * sp * vl, 0.12 * vl);
    const f = 0.85 + Math.random() * 0.3;
    this.flameMat.color.setRGB(6 * f, 2 * f, 0.4 * f);

    for (const m of this.monoliths) m.slab.position.y = 5.4 + Math.sin(t * 0.6 + m.phase) * 0.35;
    this.crystal.rotation.y += dt * 0.5;
    this.crystal.position.y = 6 + Math.sin(t * 0.9) * 0.4;
    this.crystalLight.intensity = vl * (16 + Math.sin(t * 2.1) * 4);

    for (const c of this.crts) {
      c.mat.uniforms.uTime.value = t;
      c.mat.uniforms.uLevel.value = vl;
      c.pivot.rotation.z = Math.sin(t * 0.55 + c.pivot.userData.phase) * 0.05;
      c.pivot.rotation.x = Math.cos(t * 0.4 + c.pivot.userData.phase) * 0.03;
    }
    this.crtLight.intensity = vl * (7 + Math.random() * 3);

    const blinkOn = Math.sin(t * 2.2) > 0.2 ? 1 : 0.08;
    this.beaconMat.color.setRGB(8 * blinkOn, 0.4 * blinkOn, 0.2 * blinkOn);
    this.beaconLight.intensity = vl * blinkOn * 40;
    this.rings.forEach((ring, i) => {
      const ph = (t * 0.22 + i / this.rings.length) % 1;
      ring.scale.setScalar(1 + ph * 26);
      ring.material.opacity = (1 - ph) * 0.45 * vl;
    });

    this.debris.rotation.y = t * 0.004;
    this.eyeLight.intensity = vl * 1.1 * (0.9 + 0.1 * Math.sin(t * 0.7)) * (0.4 + 0.6 * o);
    this.moonLight.intensity = vl * 0.6;
    this.hemi.intensity = 0.2 + vl * 0.15;
    this.hemi.color.setRGB(0.35, 0.29 - vl * 0.12, 0.33 - vl * 0.12);
    this.ashMat.uniforms.uTime.value = t;
    this.ashMat.uniforms.uOpacity.value = vl * 0.9;
  }

  _updateCamera(t) {
    const r = this.rig, fx = this.fx, cam = this.camera;
    const s = fx.sway, sh = fx.shake;
    let yaw = r.yaw + (Math.sin(t * 0.53) * 0.6 + Math.sin(t * 1.31) * 0.4) * 0.006 * s;
    let pitch = r.pitch + (Math.sin(t * 0.71) * 0.6 + Math.sin(t * 1.73) * 0.4) * 0.005 * s;
    yaw += -this.mouseSmooth.x * 0.07 * fx.parallax;
    pitch += this.mouseSmooth.y * 0.045 * fx.parallax;
    const bob = r.bob ? Math.abs(Math.sin(t * 3.6)) * 0.035 * r.bob : 0;
    cam.position.set(
      r.x + (Math.random() - 0.5) * 0.08 * sh + (r.bob ? Math.sin(t * 1.8) * 0.02 * r.bob : 0),
      r.y + bob + Math.sin(t * 1.9) * 0.01 * s + (Math.random() - 0.5) * 0.08 * sh,
      r.z,
    );
    cam.rotation.set(pitch + (Math.random() - 0.5) * 0.03 * sh, yaw + (Math.random() - 0.5) * 0.03 * sh, r.roll + (Math.random() - 0.5) * 0.02 * sh);
    if (Math.abs(cam.fov - r.fov) > 0.001) { cam.fov = r.fov; cam.updateProjectionMatrix(); }
  }
}
