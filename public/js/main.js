import { World } from './world.js';
import { Sound } from './audio.js';
import { UI, scramble } from './ui.js';
import { initCursor } from './cursor.js';
import { createIntro } from './intro.js';

const gsap = window.gsap;
const params = new URLSearchParams(location.search);
const lowPower = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4;

console.log('%c\n  YOU ARE LOOKING IN THE WRONG PLACE.\n  ...or the right one. Sector Zero is always hiring. kypzerorg@gmail.com\n',
  'color:#ff3b1f;background:#050203;font:14px monospace;padding:8px');

const BOOT = [
  '> establishing uplink to SECTOR_0 ............ OK',
  '> handshake: 0x0D 0x0D 0x0D',
  '> scanning processes ......................... 13 ACTIVE',
  '> process owner .............................. UNKNOWN',
  '> last login ................................. 13-09-1999 03:13:13',
  '> uptime ..................................... 9,876 DAYS',
  '> WARNING: something is compiling',
  '> incoming transmission: "we have been waiting"',
];

function typeBoot(el) {
  let line = 0, ch = 0;
  const tick = () => {
    if (line >= BOOT.length) { el.classList.add('is-done'); return; }
    const text = BOOT[line];
    ch += 2 + ((Math.random() * 3) | 0);
    el.textContent = BOOT.slice(0, line).join('\n') + (line ? '\n' : '') + text.slice(0, ch);
    if (ch >= text.length) { line++; ch = 0; setTimeout(tick, 120 + Math.random() * 260); } else setTimeout(tick, 18);
  };
  tick();
}

async function fontsReady() {
  const loads = ['400 100px "Rubik Wet Paint"', '700 64px "Cinzel"', '400 30px "Share Tech Mono"', '400 20px "Special Elite"'].map((f) => document.fonts.load(f));
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 3500))]);
}

(async () => {
  typeBoot(document.getElementById('boot'));
  await fontsReady();

  let world = null;
  try {
    world = new World(document.getElementById('world'), { lowPower });
  } catch (e) {
    console.error('WebGL unavailable', e);
    document.body.classList.add('no-webgl');
  }

  const audio = new Sound();
  const ui = new UI({ world, audio });
  initCursor({ world });
  ui.loadEvents();

  const target = location.hash.slice(1);
  const intro = world ? createIntro({ world, audio, ui, onDone: () => { $skip.hidden = true; ui.enterWorld(target); } }) : null;
  if (params.has('debug')) window.__kz = { world, ui, audio, intro };
  const gate = document.getElementById('gate');
  const $skip = document.getElementById('skip');
  document.body.classList.add('is-ready');
  scramble(document.querySelector('.gate-title .glitch'), 'KYPZERO', 1.4);

  const hideGate = () => {
    gsap.to(gate, { opacity: 0, duration: 0.9, ease: 'power2.in', onComplete: () => gate.remove() });
  };

  const start = (skipIntro) => {
    audio.init();
    hideGate();
    document.body.classList.remove('is-gate');
    try { sessionStorage.setItem('kz_seen', '1'); } catch { /* ignore */ }
    if (!world) { ui.enterWorld(target); return; }
    if (skipIntro) {
      intro.skip();
    } else {
      document.body.classList.add('is-intro');
      $skip.hidden = false;
      gsap.fromTo($skip, { opacity: 0 }, { opacity: 1, delay: 2, duration: 1 });
      intro.play();
    }
  };

  $skip.addEventListener('click', () => { $skip.hidden = true; intro?.skip(); });
  document.getElementById('enter').addEventListener('click', () => start(false));
  document.getElementById('enter-skip').addEventListener('click', () => start(true));

  if (params.has('skip')) {
    start(true);
    addEventListener('pointerdown', () => audio.resume(), { once: true });
  }
})();
