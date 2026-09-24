import * as THREE from 'three';

const NOISE = /* glsl */ `
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i + vec3(0,0,0)), hash3(i + vec3(1,0,0)), f.x),
                 mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                 mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise3(p); p *= 2.03; a *= 0.5; } return v; }
`;

/* ---------------- THE OBSERVER (giant eye) ---------------- */
export function eyeMaterial() {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uTime: { value: 0 }, uDilate: { value: 0.3 }, uGlow: { value: 1.4 } },
    vertexShader: /* glsl */ `
      varying vec3 vPos; varying vec3 vN;
      void main(){
        vPos = position;
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uDilate, uGlow;
      varying vec3 vPos; varying vec3 vN;
      ${NOISE}
      void main(){
        vec3 p = normalize(vPos);
        float ang = acos(clamp(p.z, -1.0, 1.0));
        float phi = atan(p.y, p.x);
        float irisR = 0.43;
        float pupilR = 0.1 + 0.13 * uDilate;

        // sclera: sick yellowed white with bloodshot veins
        float blot = fbm3(vec3(p * 3.0) + 1.7);
        vec3 sclera = mix(vec3(0.42, 0.34, 0.26), vec3(0.62, 0.52, 0.4), blot);
        float vein = 1.0 - abs(noise3(vec3(phi * 5.0, ang * 7.0, 2.0)) * 2.0 - 1.0);
        vein = pow(vein, 10.0);
        float vein2 = pow(1.0 - abs(noise3(vec3(phi * 11.0, ang * 13.0, 7.0)) * 2.0 - 1.0), 14.0);
        float veins = clamp(vein + vein2 * 0.7, 0.0, 1.0) * smoothstep(irisR + 0.05, 1.5, ang);
        sclera = mix(sclera, vec3(0.5, 0.02, 0.02), veins);
        sclera = mix(sclera, vec3(0.22, 0.02, 0.02), smoothstep(0.9, 1.9, ang));

        // iris: fibrous ember streaks
        float streak = fbm3(vec3(phi * 9.0, ang * 4.0 - uTime * 0.05, uTime * 0.03));
        float fibers = noise3(vec3(phi * 40.0, ang * 2.0, 3.0));
        vec3 iris = mix(vec3(0.3, 0.015, 0.0), vec3(1.0, 0.32, 0.04), streak * 0.8 + fibers * 0.35);
        iris *= 0.55 + 0.6 * smoothstep(pupilR, pupilR + 0.2, ang);
        float limbal = smoothstep(irisR - 0.09, irisR, ang);
        iris = mix(iris, vec3(0.04, 0.0, 0.0), limbal);

        vec3 col = mix(iris, sclera, smoothstep(irisR, irisR + 0.025, ang));
        col = mix(vec3(0.0), col, smoothstep(pupilR, pupilR + 0.02, ang));

        float irisMask = (1.0 - smoothstep(irisR - 0.03, irisR, ang)) * smoothstep(pupilR, pupilR + 0.05, ang);
        col += vec3(1.0, 0.18, 0.03) * irisMask * uGlow * (0.35 + 0.65 * streak);

        // wet specular glint and edge darkening
        float fres = pow(1.0 - clamp(vN.z, 0.0, 1.0), 2.0);
        col *= 1.0 - fres * 0.75;
        vec3 L = normalize(vec3(-0.4, 0.5, 0.8));
        float spec = pow(max(dot(reflect(-L, vN), vec3(0.0, 0.0, 1.0)), 0.0), 60.0);
        col += vec3(1.0, 0.85, 0.8) * spec * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/* ---------------- BLOOD SEA ---------------- */
export function seaMaterial() {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uEye: { value: new THREE.Vector3(0, 26, -330) },
      uMoon: { value: new THREE.Vector3(-160, 170, -700) },
      uFogColor: { value: new THREE.Color(0x0b0204) },
      uFogDensity: { value: 0.0032 },
      uEyeGlow: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFogDensity, uEyeGlow;
      uniform vec3 uEye, uMoon, uFogColor;
      varying vec3 vW;
      ${NOISE}
      void main(){
        vec2 q = vW.xz * 0.045;
        float n1 = noise3(vec3(q * 3.0, uTime * 0.12));
        float n2 = noise3(vec3(q * 9.0 + 4.0, uTime * 0.25));
        float n3 = noise3(vec3(q * 3.0 + 7.0, uTime * 0.12));
        vec3 N = normalize(vec3((n1 - 0.5) * 0.45 + (n2 - 0.5) * 0.2, 1.0, (n3 - 0.5) * 0.45));
        vec3 V = normalize(vW - cameraPosition);
        vec3 R = reflect(V, N);
        vec3 toEye = normalize(uEye - vW);
        float e = pow(max(dot(R, toEye), 0.0), 70.0) * 3.0 + pow(max(dot(R, toEye), 0.0), 9.0) * 0.35;
        vec3 toMoon = normalize(uMoon - vW);
        float m = pow(max(dot(R, toMoon), 0.0), 120.0) * 1.6;
        float fres = pow(1.0 - max(dot(-V, N), 0.0), 3.0);
        vec3 col = vec3(0.025, 0.003, 0.004) + vec3(0.05, 0.0, 0.0) * n2;
        col += vec3(1.0, 0.1, 0.03) * e * uEyeGlow + vec3(1.0, 0.45, 0.25) * m * uEyeGlow;
        col += vec3(0.12, 0.01, 0.01) * fres * uEyeGlow;
        float d = length(vW - cameraPosition);
        float f = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
        gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
      }`,
  });
}

/* ---------------- SKY DOME ---------------- */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    fog: false,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uLevel: { value: 1 }, uEyeDir: { value: new THREE.Vector3(0, 26, -330).normalize() }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uLevel, uTime; uniform vec3 uEyeDir;
      varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(vec3(0.03, 0.004, 0.006), vec3(0.003, 0.0, 0.001), smoothstep(-0.05, 0.7, h));
        col += vec3(0.5, 0.05, 0.02) * exp(-abs(h) * 10.0) * 0.12;
        col += vec3(0.7, 0.05, 0.02) * pow(max(dot(d, normalize(uEyeDir)), 0.0), 6.0) * 0.12;
        float n = fbm3(vec3(d.x * 3.0 + uTime * 0.004, d.y * 9.0, d.z * 3.0));
        col += vec3(0.1, 0.012, 0.012) * n * smoothstep(-0.1, 0.25, h) * (1.0 - smoothstep(0.25, 0.8, h));
        gl_FragColor = vec4(col * uLevel, 1.0);
      }`,
  });
}

/* ---------------- CRT STATIC ---------------- */
export function crtMaterial(textTexture, seed) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uText: { value: textTexture }, uBoost: { value: 1 }, uLevel: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSeed, uBoost, uLevel; uniform sampler2D uText;
      varying vec2 vUv;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - 0.5;
        vec2 uv = 0.5 + c * (1.0 + dot(c, c) * 0.3);
        float st = h2(floor(uv * vec2(180.0, 130.0)) + floor(uTime * 24.0) + uSeed * 13.0);
        float roll = smoothstep(0.0, 0.12, fract(uv.y * 0.8 - uTime * 0.35 + uSeed));
        float scan = 0.75 + 0.25 * sin(uv.y * 420.0);
        vec3 col = vec3(st) * 0.5 * scan;
        float phase = fract(uTime * 0.13 + uSeed * 0.37);
        float show = step(0.45, phase);
        float jitter = (h2(vec2(floor(uTime * 12.0), uSeed)) - 0.5) * 0.02;
        float t = texture2D(uText, vec2(uv.x + jitter, uv.y)).r;
        col = mix(col, vec3(1.0, 0.12, 0.08) * t * 2.2 + col * 0.25, show * t);
        col *= roll * 0.45 + 0.65;
        col *= smoothstep(0.78, 0.3, length(c));
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
        gl_FragColor = vec4(col * vec3(0.8, 1.0, 0.88) * uBoost * uLevel, 1.0);
      }`,
  });
}

/* ---------------- PARTICLES (ash / dust) ---------------- */
export function particleMaterial({ colorA, colorB, boxMin, boxSize, rise, size, opacity }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uPR: { value: Math.min(window.devicePixelRatio, 1.5) },
      uBoxMin: { value: boxMin }, uBoxSize: { value: boxSize }, uRise: { value: rise },
      uSize: { value: size }, uOpacity: { value: opacity },
      uColorA: { value: colorA }, uColorB: { value: colorB },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed; attribute float aSize;
      uniform float uTime, uPR, uRise, uSize; uniform vec3 uBoxMin, uBoxSize;
      varying float vSeed; varying float vFade;
      void main(){
        vec3 p = position;
        p.y = fract(p.y + uTime * uRise * (0.4 + aSeed * 0.8));
        vec3 wp = uBoxMin + p * uBoxSize;
        wp.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.9;
        wp.z += cos(uTime * 0.23 + aSeed * 31.0) * 0.9;
        vec4 mv = modelViewMatrix * vec4(wp, 1.0);
        gl_PointSize = min(uSize * aSize * uPR * (60.0 / max(-mv.z, 0.1)), 28.0);
        vFade = smoothstep(0.0, 0.08, p.y) * smoothstep(1.0, 0.85, p.y);
        vSeed = aSeed;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA, uColorB; uniform float uTime, uOpacity;
      varying float vSeed; varying float vFade;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        float flick = 0.55 + 0.45 * sin(uTime * 2.7 + vSeed * 50.0);
        vec3 col = mix(uColorA, uColorB, step(0.5, fract(vSeed * 7.13)));
        gl_FragColor = vec4(col * flick, a * vFade * uOpacity);
      }`,
  });
}

/* ---------------- HORROR POST-FX ---------------- */
export const HorrorShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: 0.08 },
    uVignette: { value: 1.1 },
    uAberration: { value: 0.3 },
    uGlitch: { value: 0 },
    uBlackout: { value: 1 },
    uFlash: { value: 0 },
    uRed: { value: 0 },
    uScan: { value: 0.4 },
    uStatic: { value: 0 },
    uVHS: { value: 0 },
    uInvert: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uAberration, uGlitch, uBlackout, uFlash, uRed, uScan, uStatic, uVHS, uInvert;
    uniform vec2 uRes;
    varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      if (uGlitch > 0.001) {
        float band = floor(uv.y * 26.0);
        float tt = floor(uTime * 24.0);
        float r = rnd(vec2(band, tt));
        if (r < uGlitch * 0.45) uv.x += (rnd(vec2(band, tt + 1.0)) - 0.5) * 0.18 * uGlitch;
        if (rnd(vec2(tt, 3.0)) < uGlitch * 0.12) uv.y += (rnd(vec2(tt, 5.0)) - 0.5) * 0.05;
      }
      float trk = 0.0;
      if (uVHS > 0.001) {
        trk = 1.0 - smoothstep(0.0, 0.04, abs(uv.y - fract(uTime * 0.17)));
        uv.x += trk * (rnd(vec2(floor(uv.y * 200.0), uTime)) - 0.5) * 0.07 * uVHS;
        uv.x += (rnd(vec2(floor(uv.y * 240.0), floor(uTime * 30.0))) - 0.5) * 0.0025 * uVHS;
      }
      vec2 dir = uv - 0.5;
      float d = length(dir);
      vec2 off = dir * (0.003 + d * 0.012) * uAberration;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off + vec2(0.004 * uVHS, 0.0)).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off - vec2(0.004 * uVHS, 0.0)).b;
      col += trk * rnd(uv * 91.0 + uTime) * 0.5 * uVHS;
      col = mix(col, col * vec3(1.04, 1.0, 1.12) + 0.012, uVHS * 0.6);
      col *= 1.0 - uScan * 0.06 * (0.5 + 0.5 * sin(uv.y * uRes.y * 1.4 + uTime * 8.0));
      col += (rnd(uv * uRes + fract(uTime) * 91.7) - 0.5) * uGrain;
      col *= smoothstep(1.0, 0.25, d * uVignette);
      vec3 red = vec3(dot(col, vec3(0.6, 0.35, 0.15)) * 1.3, col.g * 0.25, col.b * 0.25);
      col = mix(col, red, clamp(uRed, 0.0, 1.0));
      float st = rnd(floor(uv * uRes * 0.5) + floor(uTime * 40.0) * 1.7);
      col = mix(col, vec3(st) * (0.7 + 0.3 * sin(uv.y * 900.0 + uTime * 60.0)) * 1.3, clamp(uStatic, 0.0, 1.0));
      col = mix(col, max(vec3(1.2) - col, 0.0), uInvert);
      col = mix(col, vec3(3.0, 2.8, 2.6), uFlash);
      col *= 1.0 - uBlackout;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};
