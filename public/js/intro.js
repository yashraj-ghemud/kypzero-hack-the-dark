// The intro film "TAPE 13". The full shot list lives in PLAN.md, section 3.
const gsap = window.gsap;

export function createIntro({ world, audio, ui, onDone }) {
  const W = world, R = world.rig, FX = world.fx, C = world.corr, H = world.hero;
  const home = W.stations.home;
  let finished = false;

  const now = new Date();
  const clock = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

  W.on('footstep', () => { if (W.mode === 'intro') audio.footstep(0.7); });
  W.on('crack', () => audio.crack(0.35));

  const tl = gsap.timeline({ paused: true, onComplete: finish });
  const at = (time, fn) => tl.call(fn, null, time);
  const tape = { s: 0 };
  tl.to(tape, { s: 64, duration: 64, ease: 'none', onUpdate: () => ui.vhsClock(tape.s) }, 0);

  /* ============ ACT 0 · TAPE ============ */
  tl.set(R, { x: 0.4, y: 1.6, z: -2.4, yaw: 0.78, pitch: -0.15, roll: 0, fov: 58, bob: 0 }, 0);
  tl.set(FX, { blackout: 0, static: 1, vhs: 1, sway: 1.2, invert: 0 }, 0);
  tl.set(C, { level: 0.3, chaos: 0.35, flashlight: 0.8 }, 0);
  at(0, () => {
    ui.letterbox(true);
    ui.vhs(true, '▶ PLAY');
    audio.tapeStart();
    audio.staticNoise(true, 0.18);
    W.chairSpin = 0.5;
    W.deskScreen.set('off');
  });
  at(0.4, () => ui.terminal('TAPE 13 OF 13\nRECOVERED FROM SECTOR ZERO — 2026', 1.8));
  tl.to(FX, { static: 0, duration: 0.9, ease: 'power2.in' }, 2.4);
  tl.to(FX, { vhs: 0.35, duration: 1.2 }, 2.4);
  at(2.6, () => { audio.staticNoise(false); audio.musicBox(true); audio.startDrone(0.1); });
  at(3.0, () => ui.subtitle('The last recording of Team 13.', 2.8, { kicker: true }));

  /* ============ ACT I · SAFETY ============ */
  tl.to(C, { level: 0.85, chaos: 0.07, duration: 1.2 }, 3.2);
  at(4.0, () => { W.deskScreen.set('type', 'hello?\n\nis someone there?'); audio.typing(20, 0.1); });
  at(5.4, () => ui.subtitle('Thirteen of us came down here to kill the Millennium Bug.', 3.6));
  tl.to(R, { yaw: 0, pitch: -0.03, x: 0, duration: 2.6, ease: 'power2.inOut' }, 6.4);
  tl.to(R, { bob: 1, duration: 1 }, 7.4);
  tl.to(R, { z: -9, duration: 7.2, ease: 'sine.inOut' }, 7.4);
  at(9.3, () => ui.subtitle('That was nine thousand, eight hundred and seventy-six days ago.', 3.6));
  tl.to(R, { yaw: -0.95, duration: 1.6, ease: 'power2.inOut' }, 10.0);
  tl.to(R, { yaw: 0, duration: 1.6, ease: 'power2.inOut' }, 12.0);
  at(13.0, () => ui.subtitle("The servers won't let us leave.", 2.8));
  at(13.6, () => {
    W.wallScreen.set('eye');
    W.wallOn(1.2);
    for (let i = 0; i < 5; i++) gsap.delayedCall(i * 0.25, () => audio.crtOn());
  });
  tl.to(R, { yaw: -0.45, duration: 1.4, ease: 'power2.inOut' }, 14.4);
  at(15.0, () => { W.wallScreen.set('text', 'WHO IS\nFILMING?'); audio.screenBurst(0.25); });
  at(16.2, () => audio.musicBoxBend(0.3, -350, 2.2));
  tl.to(R, { yaw: 0, duration: 1.4, ease: 'power2.inOut' }, 16.6);
  at(17.4, () => W.wallOff(1));
  tl.to(R, { bob: 0, duration: 1.2 }, 17.6);
  at(18.4, () => { audio.musicBox(false); audio.setDrone(0.05, 0.5); W.deskScreen.set('off'); });

  /* ============ ACT II · LIGHTS OUT ============ */
  tl.to(R, { z: -11, duration: 2.5, ease: 'sine.inOut' }, 18.4);
  at(19.0, () => { W.heroStand(-27); W.heroGlow = 1; audio.startHeartbeat(68); audio.rumble(); });
  at(20.0, () => ui.subtitle('...Marcus? Is that you?', 2.4));
  at(21.6, () => { H.twistHead(); audio.crack(0.9); });
  [[5, 22.6], [4, 23.1], [3, 23.6], [2, 24.1]].forEach(([i, t]) => at(t, () => { W.lightOff(i); audio.relay(); }));
  at(24.1, () => W.heroHide());
  at(24.5, () => { W.lightChaos(1, 1); W.heroStand(-16.5); W.heroGlow = 0.8; H.twistHead(-1.2); audio.buzz(0.6); });
  tl.fromTo(FX, { invert: 1 }, { invert: 0, duration: 0.1, immediateRender: false }, 24.62);
  at(25.1, () => { W.lightOff(1); audio.relay(); W.heroHide(); audio.startHeartbeat(120); });
  at(25.4, () => { W.lightChaos(0, 1); audio.buzz(1); });
  at(26.4, () => { W.lightOff(0); audio.relay(); audio.stopHeartbeat(); audio.breathing(true, 1); });
  tl.set(C, { flashlight: 0 }, 26.4);
  tl.to(FX, { sway: 2.4, duration: 1 }, 26.4);
  tl.set(C, { flashlight: 0.9 }, 27.4);
  tl.fromTo(C, { chaos: 0.7 }, { chaos: 0, duration: 0.9, immediateRender: false }, 27.4);
  at(28.2, () => {
    W.wallScreen.set('text', 'LOOK\nBEHIND\nYOU');
    W.wallOn(0.15, false);
    audio.screenBurst(0.7);
    W.glitchPulse(0.7, 0.5);
    W.shake(0.3, 0.4);
  });
  at(28.8, () => { ui.subtitle('look behind you', 2.4, { whisper: true }); audio.whisper(1); });
  at(29.6, () => audio.breathing(true, 1.9));
  tl.to(R, { yaw: Math.PI, duration: 3.4, ease: 'power1.inOut' }, 29.6);
  at(32.6, () => { audio.creak(1.6); W.chairSpin = 1.4; });
  at(33.9, () => { W.heroCeiling(-7.4); audio.drip(); });
  tl.to(R, { pitch: 0.66, duration: 1.6, ease: 'power2.inOut' }, 34.4);
  at(36.0, () => { H.flare(); audio.crack(1); audio.skitter(0.9); audio.stopHeartbeat(); });
  at(36.1, () => gsap.to(H.root.position, { z: -9.3, duration: 0.9, ease: 'steps(7)' }));

  /* ============ ACT III · THE FLOOR ============ */
  at(37.0, () => {
    W.heroHide();
    audio.scream(0.8);
    audio.fall();
    audio.breathing(false);
    ui.crack(true);
    W.shake(1.6, 1.2);
    W.glitchPulse(1, 0.8);
    W.chairSpin = 0.2;
  });
  tl.fromTo(FX, { static: 0.85 }, { static: 0, duration: 0.7, immediateRender: false }, 37.0);
  tl.to(FX, { vhs: 1, sway: 0.4, duration: 0.3 }, 37.0);
  tl.to(R, { y: 0.28, duration: 0.8, ease: 'bounce.out' }, 37.0);
  tl.to(R, { roll: 0.42, pitch: 0.3, yaw: Math.PI + 0.06, duration: 0.8, ease: 'power3.out' }, 37.0);
  tl.set(C, { flashlight: 0.28 }, 37.9);
  tl.fromTo(C, { chaos: 0.5 }, { chaos: 0.1, duration: 1.5, immediateRender: false }, 37.9);
  at(38.3, () => { W.heroStand(-5.5, true); audio.startHeartbeat(130); });
  at(38.6, () => W.heroWalk(-10.1, 3.1));
  at(41.8, () => W.heroCrouch());
  tl.to(C, { flashlight: 0.1, chaos: 0, duration: 1 }, 41.8);
  tl.to(C, { flashlight: 0.035, duration: 0.3 }, 42.9);
  at(42.9, () => W.heroLunge());
  at(43.15, () => { W.scare(); audio.scream(1.2); });
  tl.to(R, { fov: 42, duration: 0.3, ease: 'power4.out' }, 43.15);
  tl.fromTo(FX, { invert: 1 }, { invert: 0, duration: 0.08, immediateRender: false }, 43.5);
  at(44.0, () => { audio.tapeStop(); audio.stopHeartbeat(); ui.vhsLabel('■ NO SIGNAL'); W.heroHide(); });
  tl.set(FX, { static: 1 }, 44.0);
  tl.set(FX, { blackout: 1, static: 0 }, 44.7);
  at(44.7, () => { audio.silence(); ui.crack(false); ui.vhs(false); });

  /* ============ ACT IV · THE INVITATION ============ */
  at(45.6, () => { ui.terminal(`IT IS ${clock}\nON A ${day}.`, 2.6); audio.typing(22, 0.07); });
  at(48.6, () => { ui.terminal('YOU SHOULD BE ASLEEP.', 2.2); audio.typing(14, 0.07); });
  at(51.2, () => ui.bigText('YOU WERE INVITED.', 2.2));
  at(53.6, () => {
    W.lightsReset();
    C.color.set(0xff1a0a);
    C.alarm = 1;
    W.placeWatchersCorridor();
    W.wallScreen.set('text', 'RUN');
    W.wallOn(0.2, false);
    ui.vhs(true, '● REC');
    audio.staticNoise(true, 0.3);
  });
  tl.set(R, { x: 0, y: 1.65, z: -14, yaw: 0, pitch: 0, roll: 0, fov: 60 }, 53.6);
  tl.set(C, { level: 1, flashlight: 0.6, chaos: 0.12 }, 53.6);
  tl.set(FX, { static: 0.9, blackout: 0, vhs: 0.5, sway: 1 }, 53.6);
  tl.to(FX, { static: 0, duration: 0.5 }, 53.7);
  at(54.1, () => { audio.staticNoise(false); audio.alarm(5); audio.startDrone(0.3); });
  tl.to(R, { z: -97, duration: 4.4, ease: 'power2.in' }, 54.4);
  tl.to(R, { fov: 84, duration: 4.4, ease: 'power3.in' }, 54.4);
  tl.to(FX, { shake: 0.25, aberration: 1.4, duration: 4.4, ease: 'power2.in' }, 54.4);
  at(57.2, () => { W.openDoor(1.6); audio.door(); W.enterVoid(3.5); });

  /* ============ ACT V · THE OBSERVER ============ */
  tl.to(FX, { flash: 0.85, duration: 0.25 }, 58.7);
  at(58.95, () => W.placeWatchersPlatform(false));
  tl.to(FX, { flash: 0, duration: 1.3 }, 58.95);
  tl.to(R, { z: home.pos.z, y: home.pos.y, x: home.pos.x, duration: 3, ease: 'power3.out' }, 58.8);
  tl.to(R, { fov: 60, pitch: home.pitch, yaw: home.yaw, duration: 3, ease: 'power3.out' }, 58.8);
  tl.to(FX, { shake: 0, aberration: 0.3, vhs: 0, duration: 2 }, 58.8);
  at(58.8, () => { audio.setDrone(0.2, 1.5); ui.vhs(false); });
  at(60.3, () => W.leaveCorridor());
  at(60.9, () => { W.openEye(2.6); audio.boom(); });
  at(63.3, () => { W.watchersLook(); audio.crack(0.8); gsap.delayedCall(0.15, () => audio.crack(0.6)); });
  at(64.0, () => ui.letterbox(false));
  tl.to({}, { duration: 0.1 }, 64.2);

  function finish() {
    if (finished) return;
    finished = true;
    W.station = 'home';
    onDone?.();
  }

  return {
    play() { tl.play(0); },
    seek(t) { tl.pause(); tl.seek(t, false); },
    skip() {
      if (finished) return;
      tl.kill();
      audio.silence();
      audio.startDrone(0.2);
      ui.clearCinematic();
      ui.letterbox(false);
      W.skipToWorld('home');
      finish();
    },
    get done() { return finished; },
  };
}
