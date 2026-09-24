// Copies the browser libraries the site imports into public/vendor, so Cloudflare Pages
// can serve everything as static files (node_modules is not deployed).
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const out = 'public/vendor';
rmSync(out, { recursive: true, force: true });

const copy = (from, to) => {
  mkdirSync(to.replace(/\/[^/]*$/, ''), { recursive: true });
  cpSync(from, to, { recursive: true });
};

copy('node_modules/three/build/three.module.js', `${out}/three/build/three.module.js`);
copy('node_modules/three/build/three.core.js', `${out}/three/build/three.core.js`);
copy('node_modules/three/examples/jsm/postprocessing', `${out}/three/examples/jsm/postprocessing`);
copy('node_modules/three/examples/jsm/shaders', `${out}/three/examples/jsm/shaders`);
copy('node_modules/gsap/dist/gsap.min.js', `${out}/gsap/gsap.min.js`);

console.log('vendor files copied to public/vendor');
