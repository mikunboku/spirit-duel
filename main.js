import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
$('#stage').appendChild(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a1226, 18, 60);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
camera.position.set(0, 2.2, 12);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.setViewOffset(w, h, 0, Math.round(h * 0.17), w, h);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- stage
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function buildStage() {
  // sky
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(260, 90), new THREE.MeshBasicMaterial({
    fog: false,
    map: canvasTex(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#0a0820'); gr.addColorStop(0.45, '#3a1c52'); gr.addColorStop(0.72, '#b4483f'); gr.addColorStop(0.86, '#f0a04a'); gr.addColorStop(1, '#2a1420');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${rand(0.1, 0.8)})`; g.fillRect(rand(w), rand(h * 0.45), 1.5, 1.5); }
      for (let i = 0; i < 26; i++) {
        const x = rand(w), y = rand(h * 0.3, h * 0.75), rw = rand(90, 260), rh = rand(8, 22);
        const cg = g.createRadialGradient(x, y, 0, x, y, rw); cg.addColorStop(0, 'rgba(40,18,50,.55)'); cg.addColorStop(1, 'rgba(40,18,50,0)');
        g.save(); g.translate(x, y); g.scale(1, rh / rw); g.translate(-x, -y); g.fillStyle = cg; g.fillRect(x - rw, y - rw, rw * 2, rw * 2); g.restore();
      }
      const mg = g.createRadialGradient(760, 130, 0, 760, 130, 120); mg.addColorStop(0, 'rgba(255,240,210,1)'); mg.addColorStop(0.22, 'rgba(255,235,200,.95)'); mg.addColorStop(0.25, 'rgba(255,220,180,.25)'); mg.addColorStop(1, 'rgba(255,220,180,0)');
      g.fillStyle = mg; g.fillRect(600, 0, 320, 300);
    }),
  }));
  sky.position.set(0, 26, -70); scene.add(sky);

  // ground
  const gtex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#17141b'; g.fillRect(0, 0, w, h);
    const s = 64;
    for (let y = 0; y < h; y += s) for (let x = -s; x < w; x += s) {
      const ox = (y / s) % 2 ? s / 2 : 0, v = rand(38, 74);
      g.fillStyle = `rgb(${v + 6},${v},${v + 10})`;
      g.beginPath(); g.roundRect(x + ox + 3, y + 3, s - 6, s - 6, 9); g.fill();
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + ox + 6, y + 5, s - 14, 3);
    }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(0,0,0,${rand(0.25)})`; g.fillRect(rand(w), rand(h), 2, 2); }
  });
  gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.repeat.set(14, 14); gtex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.62, metalness: 0.15 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // buildings
  const winTex = () => canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#15121a'; g.fillRect(0, 0, w, h);
    for (let y = 30; y < h - 40; y += 62) for (let x = 22; x < w - 30; x += 58) {
      const lit = Math.random() < 0.3;
      g.fillStyle = lit ? `rgb(255,${rand(170, 215) | 0},110)` : '#07060b';
      g.fillRect(x, y, 30, 40);
      g.fillStyle = '#231d2a'; g.fillRect(x - 3, y + 40, 36, 4);
    }
  });
  const rng = [[-17, 9, -9, 7], [-10, 12, -11, 6], [-4, 8, -10, 5], [2, 13, -12, 6], [9, 9.5, -10, 6.5], [16, 11.5, -11, 7], [-24, 12, -12, 7], [23, 9, -10, 7]];
  for (const [x, h, z, w] of rng) {
    const t = winTex();
    const m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), m); b.position.set(x, h / 2, z); scene.add(b);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0x100d15, roughness: 1 }));
    roof.position.set(x, h + 1.1, z); roof.rotation.y = Math.PI / 4; scene.add(roof);
  }
  // low wall
  const wall = new THREE.Mesh(new THREE.BoxGeometry(80, 1.1, 0.6), new THREE.MeshStandardMaterial({ color: 0x2a2530, roughness: 0.9 }));
  wall.position.set(0, 0.55, -5.2); wall.receiveShadow = true; wall.castShadow = true; scene.add(wall);

  // lamps
  for (const x of [-12, -4, 4, 12]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 4.6, 8), new THREE.MeshStandardMaterial({ color: 0x0c0c10, metalness: 0.7, roughness: 0.4 }));
    pole.position.set(x, 2.3, -4.2); pole.castShadow = true; scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.1, 1.0) }));
    bulb.position.set(x, 4.7, -4.2); scene.add(bulb);
    if (Math.abs(x) < 6) { const pl = new THREE.PointLight(0xffb060, 26, 16, 1.8); pl.position.copy(bulb.position); scene.add(pl); }
  }

  // lights
  scene.add(new THREE.HemisphereLight(0x8a78c8, 0x2a1a18, 0.9));
  const key = new THREE.DirectionalLight(0xffc890, 2.4);
  key.position.set(-6, 10, 8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -4, near: 1, far: 40 });
  key.shadow.bias = -0.0005; scene.add(key);
  const rim = new THREE.DirectionalLight(0x7090ff, 1.6); rim.position.set(5, 6, -10); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xd8dcff, 1.3); fill.position.set(2, 4, 12); scene.add(fill);
}
buildStage();

// ---------------------------------------------------------------- audio
let actx = null, master = null;
function initAudio() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
}
function noise(dur, freq, q, vol, type = 'lowpass', decay = dur) {
  if (!actx) return;
  const n = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(); const t = actx.currentTime;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(f).connect(g).connect(master); src.start();
}
function tone(f0, f1, dur, vol, type = 'sine') {
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(); o.stop(t + dur + 0.02);
}
const SFX = {
  whoosh: () => noise(0.18, 900, 0.8, 0.25, 'bandpass'),
  hit: () => { noise(0.09, 1800, 0.7, 0.7); tone(170, 45, 0.16, 0.9); },
  heavy: () => { noise(0.22, 1100, 0.6, 0.9); tone(120, 28, 0.38, 1.0); tone(60, 30, 0.5, 0.6, 'triangle'); },
  rush: () => { noise(0.05, 2400, 0.8, 0.45); tone(210, 70, 0.07, 0.6); },
  guard: () => { noise(0.07, 3200, 3, 0.5, 'bandpass'); tone(520, 300, 0.08, 0.3, 'square'); },
  cutin: () => { tone(90, 700, 0.35, 0.35, 'sawtooth'); noise(0.5, 2500, 0.5, 0.3, 'highpass'); },
  stop: () => { tone(900, 30, 1.3, 0.5, 'sawtooth'); tone(1400, 40, 1.5, 0.25); noise(1.2, 400, 0.4, 0.35); },
  tick: () => tone(1900, 1500, 0.03, 0.18, 'square'),
  resume: () => { tone(40, 800, 0.5, 0.4, 'sawtooth'); noise(0.3, 3000, 0.5, 0.3, 'highpass'); },
  ko: () => { tone(200, 20, 1.2, 1.0); noise(0.9, 700, 0.5, 0.9); },
  start: () => { tone(330, 330, 0.12, 0.3, 'square'); setTimeout(() => tone(660, 660, 0.3, 0.3, 'square'), 130); },
};

// ---------------------------------------------------------------- effects
const glowTex = canvasTex(128, 128, (g, w) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
const streakTex = canvasTex(256, 64, (g, w, h) => {
  const r = g.createLinearGradient(0, 0, w, 0); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2.6, 0, 0, 7); g.fill();
});
const particles = [];
function spawn(pos, opt) {
  const m = new THREE.SpriteMaterial({ map: opt.tex || glowTex, color: opt.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, rotation: opt.rot || 0 });
  const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.set(opt.sx, opt.sy ?? opt.sx, 1); scene.add(s);
  particles.push({ s, v: opt.v || new THREE.Vector3(), life: opt.life, t: 0, grow: opt.grow || 0, g: opt.g || 0, sx: opt.sx, sy: opt.sy ?? opt.sx });
}
function burst(pos, color, n, power) {
  spawn(pos, { color: 0xffffff, sx: 0.9 * power, life: 0.1, grow: 5 });
  spawn(pos, { color, sx: 1.3 * power, life: 0.2, grow: 4 });
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 2), sp = rand(3, 10) * power;
    spawn(pos, { color: i % 3 ? color : 0xffffff, sx: rand(0.12, 0.3), life: rand(0.25, 0.55), g: 9,
      v: new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp * 0.8 + 2, rand(-2, 2)) });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.t += dt;
    if (p.t >= p.life) { scene.remove(p.s); p.s.material.dispose(); particles.splice(i, 1); continue; }
    p.v.y -= p.g * dt; p.s.position.addScaledVector(p.v, dt);
    const k = p.t / p.life, sc = 1 + p.grow * p.t;
    p.s.scale.set(p.sx * sc, p.sy * sc, 1); p.s.material.opacity = 1 - k * k;
  }
}

const fxLayer = $('#fx');
const tmpV = new THREE.Vector3();
function sfxText(text, pos, color, size = 64, slow = false) {
  tmpV.copy(pos).project(camera);
  const el = document.createElement('div');
  el.className = 'sfx' + (slow ? ' slow' : '');
  el.textContent = text;
  el.style.left = ((tmpV.x * 0.5 + 0.5) * window.innerWidth) + 'px';
  el.style.top = ((-tmpV.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  el.style.fontSize = size + 'px'; el.style.color = color;
  el.style.setProperty('--r', rand(-18, 18) + 'deg');
  fxLayer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
function banner(text, stay = false) {
  const el = $('#banner span'); el.className = ''; el.textContent = text; void el.offsetWidth; el.className = stay ? 'stay' : 'show';
}
function flash(a = 0.8, ms = 160) {
  const f = $('#flash'); f.style.transition = 'none'; f.style.opacity = a; void f.offsetWidth;
  f.style.transition = `opacity ${ms}ms`; f.style.opacity = 0;
}

// ---------------------------------------------------------------- body (the human user)
function limb(len, r, mat) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - r * 2, 6, 12), mat);
  m.position.y = -len / 2; m.castShadow = true; pivot.add(m);
  return pivot;
}
function makeBody(pal) {
  const coat = new THREE.MeshStandardMaterial({ color: pal.coat, roughness: 0.55, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: pal.pants, roughness: 0.7 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99872, roughness: 0.6 });
  const trim = new THREE.MeshStandardMaterial({ color: pal.trim, roughness: 0.3, metalness: 0.9, emissive: pal.trim, emissiveIntensity: 0.15 });
  const hairM = new THREE.MeshStandardMaterial({ color: pal.hair, roughness: 0.5 });
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.96; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.36, 6, 14), coat);
  chest.scale.set(1.18, 1, 0.78); chest.position.y = 0.36; chest.castShadow = true; torso.add(chest);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.14, 12, 1, true), coat);
  collar.material.side = THREE.DoubleSide; collar.position.y = 0.72; torso.add(collar);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 20), trim); belt.rotation.x = Math.PI / 2; belt.scale.set(1.12, 0.78, 1); belt.position.y = 0.06; torso.add(belt);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 6, 20, Math.PI), trim); chain.position.set(0.02, 0.56, 0.15); chain.rotation.z = Math.PI; torso.add(chain);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.36, 0.78, 16, 1, true, 0.35, Math.PI * 2 - 0.7), coat);
  skirt.scale.z = 0.8; skirt.position.y = -0.36; skirt.castShadow = true; hips.add(skirt);
  const head = new THREE.Group(); head.position.y = 0.8; torso.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), skin); skull.scale.set(0.92, 1.1, 1); skull.position.y = 0.1; skull.castShadow = true; head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM); hair.position.set(0, 0.125, -0.012); hair.castShadow = true; head.add(hair);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.03, 16, 1, false, -0.9, 1.8), hairM); cap.position.set(0, 0.16, 0.1); head.add(cap);
  const mk = (len, r, m) => limb(len, r, m);
  const arm = (sx) => {
    const sh = mk(0.34, 0.068, coat); sh.position.set(sx * 0.27, 0.6, 0);
    const el = mk(0.33, 0.058, coat); el.position.y = -0.33; sh.add(el);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 10), skin); hand.position.y = -0.36; el.add(hand);
    torso.add(sh); return { sh, el };
  };
  const leg = (sx) => {
    const hp = mk(0.48, 0.09, dark); hp.position.set(sx * 0.11, -0.02, 0);
    const kn = mk(0.46, 0.075, dark); kn.position.y = -0.46; hp.add(kn);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.27), new THREE.MeshStandardMaterial({ color: 0x0a0a0d, roughness: 0.4 }));
    foot.position.set(0, -0.46, 0.06); foot.castShadow = true; kn.add(foot);
    hips.add(hp); return { hp, kn };
  };
  const j = { root, hips, torso, head, aL: arm(1), aR: arm(-1), lL: leg(1), lR: leg(-1) };
  root.scale.setScalar(1.05);
  return j;
}
// pose = [hipsY, torsoX, headX, aL.sh, aL.el, aR.sh, aR.el, lL.hp, lL.kn, lR.hp, lR.kn, rootX]
function bodyPose(f, t) {
  const s = Math.sin, st = f.state, k = f.stateT;
  let p = [0.96 + s(t * 2.2) * 0.008, 0.04, 0, 0.12, -0.25, 0.1, -0.3, -0.16, 0.12, 0.2, 0.14, 0];
  if (st === 'walk') { const w = s(t * 9) * 0.5; p = [0.95 + Math.abs(s(t * 9)) * 0.02, 0.1 * f.moveDir, 0, -w * 0.6, -0.4, w * 0.6, -0.4, w, Math.max(0, -w) * 0.9 + 0.1, -w, Math.max(0, w) * 0.9 + 0.1, 0]; }
  else if (st === 'guard' || st === 'block') p = [0.86, 0.16, 0.2, -1.25, -1.85, -1.05, -1.95, -0.5, 0.75, 0.35, 0.55, 0];
  else if (st === 'attack' || st === 'cast') {
    const big = st === 'cast' || f.move?.cost;
    p = [0.93, 0.12, -0.05, big ? -2.6 : -1.5, big ? -0.1 : -0.05, 0.35, -0.9, -0.35, 0.3, 0.4, 0.25, 0];
    if (f.move?.rush) p[3] = -1.5 + s(t * 40) * 0.06;
  }
  else if (st === 'hit') p = [0.9, -0.45, -0.35, 0.7 + s(k * 30) * 0.2, -0.6, 0.9, -0.5, -0.5, 0.4, 0.3, 0.5, 0];
  else if (st === 'down' || st === 'ko') {
    const up = st === 'down' && k > f.downDur - 0.4 ? clamp((k - (f.downDur - 0.4)) / 0.4, 0, 1) : 0;
    p = [lerp(0.2, 0.96, up) + f.airY, -0.1, -0.1, lerp(-1.2, 0.1, up), -0.3, lerp(-0.9, 0.1, up), -0.4, lerp(-0.5, -0.1, up), 0.4, lerp(-0.2, 0.1, up), 0.2, lerp(-Math.PI / 2, 0, up)];
  }
  else if (st === 'win') p = [0.96, -0.06, -0.15, 0.2, -0.3, -2.9, -0.2, -0.2, 0.05, 0.2, 0.05, 0];
  return p;
}
function applyBody(f, t, dt) {
  const tg = bodyPose(f, t), c = f.pose, j = f.body, K = f.state === 'hit' ? 30 : 16;
  for (let i = 0; i < tg.length; i++) c[i] = damp(c[i], tg[i], K, dt);
  j.hips.position.y = c[0]; j.torso.rotation.x = c[1]; j.head.rotation.x = c[2];
  j.aL.sh.rotation.x = c[3]; j.aL.el.rotation.x = c[4]; j.aR.sh.rotation.x = c[5]; j.aR.el.rotation.x = c[6];
  j.lL.hp.rotation.x = c[7]; j.lL.kn.rotation.x = c[8]; j.lR.hp.rotation.x = c[9]; j.lR.kn.rotation.x = c[10];
  j.hips.rotation.x = c[11];
}

// ---------------------------------------------------------------- music & voice
const BPM = { fight: 132, plan: 92 };
const CH = [[146.83, 174.61, 220.0], [116.54, 146.83, 174.61], [130.81, 164.81, 196.0], [110.0, 138.59, 164.81]];
const music = { mode: 'off', step: 0, next: 0, gain: null, noiseBuf: null, on: true };
function mOsc(type, f, t, dur, vol, cut) {
  const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (cut) { const fl = actx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(cut, t); fl.Q.value = 4; o.connect(fl); node = fl; }
  node.connect(g).connect(music.gain); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function mNoise(t, dur, vol, type, freq) {
  const s = actx.createBufferSource(); s.buffer = music.noiseBuf;
  const fl = actx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(music.gain); s.start(t, Math.random() * 0.5, dur + 0.02);
}
function mStep(s, t, mode) {
  const bar = (s >> 4) & 3, i = s & 15, ch = CH[bar], sp = 60 / BPM[mode] / 4;
  if (mode === 'fight') {
    if (i % 4 === 0) { const k = mOsc('sine', 150, t, 0.22, 0.9); k.frequency.exponentialRampToValueAtTime(42, t + 0.16); }
    if (i === 4 || i === 12) { mNoise(t, 0.16, 0.42, 'bandpass', 1800); mOsc('triangle', 190, t, 0.08, 0.25); }
    mNoise(t, 0.03, i % 4 === 2 ? 0.2 : 0.09, 'highpass', 7000);
    if (i % 2 === 0) mOsc('sawtooth', (i === 6 || i === 14 ? ch[0] : ch[0] / 2), t, sp * 1.7, 0.34, 520);
    const arp = [0, 1, 2, 1, 2, 0, 2, 1][i >> 1];
    if (i % 2 === 1 || i === 0) mOsc('square', ch[arp] * (bar % 2 && i > 8 ? 4 : 2), t, sp * 1.4, 0.07, 2600);
    if (i === 0) for (const f of ch) mOsc('sawtooth', f, t, sp * 15, 0.045, 900);
  } else {
    if (i === 0 || i === 10) mOsc('triangle', ch[0] / 2, t, sp * 7, 0.4);
    if (i % 4 === 2) mOsc('sine', ch[(i >> 2) % 3] * 2, t, sp * 5, 0.12);
    if (i === 0) for (const f of ch) mOsc('sine', f, t, sp * 15, 0.06);
    if (i === 8) mNoise(t, 0.05, 0.05, 'highpass', 6000);
  }
}
function musicInit() {
  if (music.gain) return;
  music.gain = actx.createGain(); music.gain.gain.value = 0.3; music.gain.connect(master);
  const n = actx.sampleRate, b = actx.createBuffer(1, n, n), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  music.noiseBuf = b;
  setInterval(() => {
    if (music.mode === 'off' || actx.state !== 'running') return;
    if (music.next < actx.currentTime) music.next = actx.currentTime + 0.05;
    while (music.next < actx.currentTime + 0.3) { mStep(music.step, music.next, music.mode); music.next += 60 / BPM[music.mode] / 4; music.step = (music.step + 1) % 64; }
  }, 70);
}
function setMusic(mode) { if (music.mode !== mode) { music.mode = mode; music.step = 0; } }
function speak(text, side = 0) {
  if (!music.on || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.pitch = side ? 0.2 : 0.75; u.rate = 1.1; u.volume = 1;
    const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith('ja')); if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* voice is optional */ }
}

const VKEYS = ['start', 'light1', 'light2', 'heavy', 'heavyhit', 'leap', 'rush', 'stop', 'charge', 'guard', 'hit1', 'hit2', 'ko', 'win'];
const vbuf = {}; let vgain = null;
function voiceInit() {
  if (vgain) return; vgain = actx.createGain(); vgain.gain.value = 1.6; vgain.connect(master);
  for (const sd of [0, 1]) for (const k of VKEYS) fetch(`assets/voice/v${sd}_${k}.mp3`).then((r) => r.arrayBuffer()).then((b) => actx.decodeAudioData(b)).then((b) => { vbuf[`${sd}_${k}`] = b; }).catch(() => {});
}
function voice(side, key, delay = 0) {
  if (!actx || !vgain || !music.on) return;
  if (Array.isArray(key)) key = key[rand(key.length) | 0];
  const b = vbuf[`${side}_${key}`]; if (!b) return;
  const src = actx.createBufferSource(); src.buffer = b; src.connect(vgain); src.start(actx.currentTime + delay);
}

// ---------------------------------------------------------------- rules of the game
const CELLS = 8, TICKS = 6, TURNS = 8;
const cellX = (c) => (c - (CELLS - 1) / 2) * 2.4;
const CONDS = {
  any: ['いつでも', () => true],
  near: ['相手が近い', (f, o, d) => d <= 1],
  mid: ['相手が中間', (f, o, d) => d === 2 || d === 3],
  far: ['相手が遠い', (f, o, d) => d >= 4],
  windup: ['相手が構えている', (f, o) => o.windup],
  fguard: ['相手が前回ガードした', (f, o) => o.lastAct === 'guard'],
  g25: ['ゲージ25以上', (f) => f.gauge >= 25],
  g50: ['ゲージ50以上', (f) => f.gauge >= 50],
  g100: ['ゲージ100', (f) => f.gauge >= 100],
  hplow: ['自分の体力が半分以下', (f) => f.hp <= 50],
  fhplow: ['相手の体力が半分以下', (f, o) => o.hp <= 50],
  frozen: ['相手が止まっている', (f, o) => o.frozen > 0],
};
const ACTS = {
  approach: { name: '近づく', desc: '1マス前へ。' },
  retreat: { name: '離れる', desc: '1マス後ろへ。移動は攻撃より先なので、近距離の攻撃をかわせる。' },
  guard: { name: 'ガード', desc: '拳をほぼ防ぎ、ゲージ+10。なぎ払いには破られる。' },
  light: { name: '拳', desc: '近距離。8ダメージ。一番速く、構え中の相手をつぶせる。' },
  heavy: { name: 'なぎ払い', desc: '近距離。1ステップ構えて、次のステップで20ダメージ。ガードを破る。' },
  leap: { name: '飛びかかり', cost: 25, desc: '3マス先まで届く。14ダメージ。ゲージ25。' },
  rush: { name: 'ラッシュ', cost: 50, desc: '近距離。30ダメージ。ゲージ50。' },
  stop: { name: '時間停止', cost: 100, desc: '相手を3ステップ止める。ゲージ100。' },
  charge: { name: 'ためる', desc: 'ゲージ+20。' },
  wait: { name: '何もしない', desc: '' },
};
const LABEL = { heavy: '構え…', heavyHit: 'なぎ払い！', frozen: '停止中', wait: '…' };
const DMG = { light: [8, 1], leap: [14, 4], rush: [30, 10], heavy: [20, 14] };
const LEVELS = [
  { name: '突進型', hint: '相手は近づいて拳を出すだけです。拳はガードで防げて、防ぐたびにゲージが溜まります。溜まったゲージの使い道を考えてみましょう。',
    rules: [['near', 'none', 'light'], ['any', 'none', 'approach']] },
  { name: '守り型', hint: '相手は近づくとずっとガードします。ガードを破れる行動はどれでしょう。',
    rules: [['near', 'none', 'guard'], ['any', 'none', 'approach']] },
  { name: '重撃型', hint: 'なぎ払いは1ステップ構えてから当たります。構えている間にできることがあります。',
    rules: [['near', 'none', 'heavy'], ['any', 'none', 'approach']] },
  { name: '間合い型', hint: '相手は近づかれると離れ、中間から飛びかかってきます。ステージの端まで追い詰めると逃げ場がなくなります。',
    rules: [['mid', 'g25', 'leap'], ['near', 'none', 'retreat'], ['any', 'none', 'charge']] },
  { name: '達人', hint: '相手の作戦を上から順に読み、「こう動けば相手はこう返す」を組み立ててください。相手の3番目のブロックが弱点です。',
    rules: [['g100', 'none', 'stop'], ['windup', 'none', 'light'], ['fguard', 'near', 'heavy'], ['near', 'g50', 'rush'], ['near', 'none', 'light'], ['any', 'none', 'approach']] },
];
const HOWTO = `
  <b>作戦ブロック</b>を上から並べて戦います。1ターンは6ステップ。毎ステップ、ブロックを上から調べて、<b>最初に条件が当てはまった1つ</b>だけを実行します。相手も同じ仕組みで動き、相手の作戦は画面右に見えています。<br>
  同じステップの中では <b>移動 → 拳 → 飛びかかり → ラッシュ → なぎ払い</b> の順に処理されます。ゲージが足りない行動のブロックは飛ばされます。
  <table>${Object.entries(ACTS).filter(([k]) => k !== 'wait').map(([, a]) => `<tr><td>${a.name}</td><td>${a.desc}</td></tr>`).join('')}</table>
  ${TURNS}ターン以内に相手の体力を0にすれば勝ち。時間切れは体力の多い方の勝ちです。`;

const MOVES = {
  light: { anim: 'punch', dur: 0.5, hit: 0.2, fwd: 1.0, text: ['ドッ', 'バシッ', 'ガッ'] },
  heavy: { anim: 'swipe', dur: 0.8, hit: 0.42, fwd: 1.1, heavy: true, text: ['ドゴォ', 'バキィ'] },
  leap: { anim: 'jumpattack', dur: 1.0, hit: 0.62, fwd: 1.5, heavy: true, cost: 25, text: ['ズドォン'] },
  rush: { anim: 'punch', dur: 1.95, rush: true, from: 0.3, to: 1.5, every: 0.085, final: 1.68, fwd: 1.05, heavy: true, cost: 50, text: ['ドグシャァ'] },
};
const COL = [{ hex: 0x35e6d0, css: '#35e6d0' }, { hex: 0xff4d7a, css: '#ff4d7a' }];

// ---------------------------------------------------------------- fighter
class Fighter {
  constructor(side, base, clips, hbase, hclips) {
    this.side = side; this.col = COL[side]; this.facing = side === 0 ? 1 : -1;
    // the human user (paladin)
    this.human = SkeletonUtils.clone(hbase);
    this.human.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      const tint = (m0) => { const m = m0.clone(); m.color.multiply(side === 1 ? new THREE.Color(2.3, 1.05, 1.05) : new THREE.Color(1.9, 1.9, 2.0)); if (m.specular) m.specular.multiplyScalar(1.6); return m; };
      o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
    });
    this.hroot = new THREE.Group(); this.hroot.add(this.human); scene.add(this.hroot);
    this.hmixer = new THREE.AnimationMixer(this.human);
    this.hact = {};
    for (const [n, c] of Object.entries(hclips)) this.hact[n] = this.hmixer.clipAction(c);
    this.stand = SkeletonUtils.clone(base);
    this.rimU = { value: new THREE.Color(this.col.hex) };
    this.mats = [];
    this.stand.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.frustumCulled = false;
      const src = Array.isArray(o.material) ? o.material : [o.material];
      const out = src.map((m0) => {
        const m = m0.clone(); m.transparent = true; m.opacity = 0.5;
        if (side === 1) m.color.multiply(new THREE.Color(1.0, 0.55, 0.62));
        if (m.emissive) { m.emissive.set(this.col.hex); m.emissiveIntensity = 0.1; }
        if (m.isMeshPhongMaterial || m.isMeshStandardMaterial) {
          const u = this.rimU;
          m.onBeforeCompile = (sh) => {
            sh.uniforms.rimColor = u;
            sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
              `#include <emissivemap_fragment>
               float rimF = pow(1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0), 2.6);
               totalEmissiveRadiance += rimColor * rimF;`);
          };
        }
        this.mats.push(m); return m;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    });
    this.standRoot = new THREE.Group(); this.standRoot.add(this.stand); scene.add(this.standRoot);
    this.light = new THREE.PointLight(this.col.hex, 0, 7, 1.6); scene.add(this.light);
    this.mixer = new THREE.AnimationMixer(this.stand);
    this.actions = {};
    for (const [n, c] of Object.entries(clips)) this.actions[n] = this.mixer.clipAction(c);
    this.reset();
  }
  reset() {
    this.cell = this.side === 0 ? 2 : 5; this.x = cellX(this.cell); this.xOff = 0; this.xOffV = 0;
    this.hp = 100; this.gauge = 0; this.windup = false; this.frozen = 0; this.lastAct = null; this.act = null; this.cancelled = false;
    this.state = 'idle'; this.stateT = 0; this.move = null; this.moveName = null; this.moveDir = 0; this.airY = 0; this.downDur = 99;
    this.sFwd = -0.6; this.sY = 0.3; this.sZ = -0.55; this.opacity = 0.45; this.cur = null;
    this.mixer.stopAllAction(); this.play('idle', { loop: true, fade: 0 });
    this.hcur = null; this.hname = null; this.hmixer.stopAllAction(); this.hplay('idle', { loop: true, fade: 0 });
  }
  play(name, { loop = false, dur = null, fade = 0.08 } = {}) {
    const a = this.actions[name]; if (!a) return null;
    a.reset(); a.paused = false; a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop;
    a.timeScale = dur ? a.getClip().duration / dur : 1;
    if (this.cur && this.cur !== a && fade > 0) a.crossFadeFrom(this.cur, fade, false); else if (this.cur && this.cur !== a) this.cur.stop();
    a.play(); this.cur = a; this.curName = name; return a;
  }
  hplay(name, { loop = false, dur = null, fade = 0.12 } = {}) {
    const a = this.hact[name]; if (!a) return;
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop;
    a.timeScale = dur ? a.getClip().duration / dur : 1;
    if (this.hcur && this.hcur !== a && fade > 0) a.crossFadeFrom(this.hcur, fade, false); else if (this.hcur && this.hcur !== a) this.hcur.stop();
    a.play(); this.hcur = a; this.hname = name;
  }
  set(state, moveName = null) {
    this.state = state; this.stateT = 0; this.moveName = moveName; this.move = moveName ? MOVES[moveName] : null;
    if (state === 'idle') { if (this.hname !== 'idle') this.hplay('idle', { loop: true, fade: 0.2 }); }
    else if (state === 'walk') this.hplay('walk', { loop: true, dur: 0.75 });
    else if (state === 'guard') this.hplay('block', { loop: true });
    else if (state === 'attack') { if (moveName === 'rush') this.hplay('casting', { dur: 2.0 }); else this.hplay('slash', { dur: moveName === 'heavy' ? 1.1 : 0.8 }); }
    else if (state === 'cast') this.hplay('powerup', { dur: 1.3 });
    else if (state === 'hit') this.hplay('impact', { dur: 0.5, fade: 0.05 });
    else if (state === 'ko') this.hplay('death', { dur: 1.9, fade: 0.08 });
    else if (state === 'win') this.hplay('casting', { loop: true, dur: 2.6, fade: 0.3 });
  }
  idle() { if (this.state === 'ko' || this.state === 'win') return; this.set('idle'); if (this.curName !== 'idle') this.play('idle', { loop: true, fade: 0.18 }); }
  frame(dt) {
    if (this.frozen > 0 && this.state !== 'ko') return;
    this.stateT += dt; this.mixer.update(dt); this.hmixer.update(dt);
    this.x = damp(this.x, cellX(this.cell), this.moveName === 'leap' ? 7 : 9, dt);
    this.xOff += this.xOffV * dt; this.xOffV = damp(this.xOffV, 0, this.state === 'ko' ? 5 : 10, dt);
    if (this.state === 'ko') { this.airT += dt; this.airY = Math.max(0, this.airV * this.airT - 9 * this.airT * this.airT); }
    else { this.xOff = damp(this.xOff, 0, 7, dt); if (this.state === 'hit' && this.stateT > 0.42) this.idle(); }
  }
  render(dt, t) {
    const frozen = this.frozen > 0 && this.state !== 'ko';
    const px = clamp(this.x + this.xOff, -9.4, 9.4);
    const r = this.hroot; r.position.set(px, 0, 0); r.rotation.y = this.facing * Math.PI / 2;
    const st = this.state, m = this.move;
    let fwd = -0.6, y = 0.3 + (frozen ? 0 : Math.sin(t * 1.7 + this.side) * 0.07), z = -0.55, op = 0.6;
    if (st === 'attack') {
      fwd = m.fwd; y = 0.02; z = 0.2; op = 0.97;
      if (this.moveName === 'leap') fwd = lerp(0.5, m.fwd, clamp(this.stateT / m.hit, 0, 1));
      if (m.rush) fwd += Math.sin(t * 60) * 0.04;
    } else if (st === 'cast') { fwd = 0.5; y = 0.25; z = 0.1; op = 0.95; }
    else if (st === 'guard') { fwd = 0.55; y = 0.02; z = 0.15; op = 0.88; }
    else if (st === 'win') { fwd = 0.2; y = 0.1; z = -0.9; op = 0.9; }
    else if (st === 'ko') { op = 0; }
    else if (st === 'hit') { op = 0.3; }
    const K = st === 'attack' ? 22 : 9;
    this.sFwd = damp(this.sFwd, fwd, K, dt); this.sY = damp(this.sY, y, K, dt); this.sZ = damp(this.sZ, z, K, dt);
    this.opacity = damp(this.opacity, op, st === 'ko' ? 2 : 12, dt);
    this.standRoot.position.set(px + this.facing * this.sFwd, this.sY, this.sZ);
    this.standRoot.rotation.y = this.facing * Math.PI / 2;
    this.standRoot.visible = this.opacity > 0.02;
    for (const mt of this.mats) { mt.opacity = this.opacity; if (mt.emissive) mt.emissiveIntensity = 0.05 + this.opacity * 0.06; }
    this.rimU.value.set(this.col.hex).multiplyScalar(0.35 + this.opacity * 0.55 + (this.gauge >= 100 ? 0.5 + Math.sin(t * 9) * 0.3 : 0));
    this.light.position.set(this.standRoot.position.x, 1.6, 1.2); this.light.intensity = this.opacity * 7;
  }
}

function rushStreak(f, foe) {
  const x0 = f.x + f.facing * 1.4, x1 = foe.x - f.facing * 0.2;
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Vector3(lerp(x0, x1, rand(0.2, 1)), rand(0.9, 2.3), rand(0, 0.7));
    spawn(p, { tex: streakTex, color: i ? 0xffffff : f.col.hex, sx: rand(1.2, 2.2), sy: rand(0.28, 0.5), life: 0.09, rot: f.facing > 0 ? rand(-0.25, 0.25) : Math.PI + rand(-0.25, 0.25) });
  }
}
function note(text, f, color = '#fff', size = 24, dy = 0) {
  tmpV.set(f.x + f.xOff, 2.75 + dy, 0).project(camera);
  const el = document.createElement('div'); el.className = 'sfx plain'; el.textContent = text;
  el.style.left = ((tmpV.x * 0.5 + 0.5) * window.innerWidth) + 'px'; el.style.top = ((-tmpV.y * 0.5 + 0.5) * window.innerHeight) + 'px';
  el.style.fontSize = size + 'px'; el.style.color = color; el.style.setProperty('--r', '0deg');
  fxLayer.appendChild(el); el.addEventListener('animationend', () => el.remove());
}

// ---------------------------------------------------------------- game state
const G = { mode: 'load', t: 0, clock: 0, speed: 1, hitstop: 0, shake: 0, slow: 0, cutinT: 0, stopFx: false, over: false, zoom: 0,
  level: 0, turn: 1, tick: 0, menaceT: 0, tickT: 0, winner: null,
  prog: [['near', 'none', 'light'], ['any', 'none', 'approach']] };
let P = null, E = null;
const waiters = [];
const sleep = (s) => new Promise((res) => waiters.push({ t: G.clock + s, res }));
const other = (f) => (f === P ? E : P);
const dist = () => Math.abs(P.cell - E.cell);

function cutin(kind, f, label) {
  const c = $('#cutin');
  c.className = 'layer'; void c.offsetWidth;
  c.querySelector('.strip').style.backgroundImage = `url(assets/img/cutin_${kind}.jpg)`;
  c.querySelector('.label').textContent = label || '';
  c.className = 'layer on' + (f.side === 1 ? ' right foe' : '');
  G.cutinT = 0.8; SFX.cutin();
}
function stopFx(on) {
  if (G.stopFx === on) return; G.stopFx = on;
  if (on) {
    canvas.style.filter = 'grayscale(.92) contrast(1.25) brightness(.85)';
    const r = $('#stopring i'); r.className = ''; void r.offsetWidth; r.className = 'go';
    flash(0.9, 260); SFX.stop(); G.shake = 0.4;
  } else { canvas.style.filter = ''; flash(0.5, 200); SFX.resume(); }
}

// ---------------------------------------------------------------- program UI
const rulesEl = $('#rules'), frulesEl = $('#frules');
const opt = (obj, sel, extra = '') => extra + Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${Array.isArray(v) ? v[0] : v.name + (v.cost ? `（${v.cost}）` : '')}</option>`).join('');
function drawRules() {
  rulesEl.innerHTML = G.prog.map(([c1, c2, a], i) => `
    <div class="rule" data-i="${i}"><span class="no">${i + 1}</span><span class="kw">もし</span>
      <select class="c" data-k="0">${opt(CONDS, c1)}</select><span class="kw">かつ</span>
      <select class="c ${c2 === 'none' ? 'none' : ''}" data-k="1">${opt(Object.fromEntries(Object.entries(CONDS).filter(([k]) => k !== 'any')), c2, `<option value="none"${c2 === 'none' ? ' selected' : ''}>―</option>`)}</select>
      <span class="kw">なら</span><select class="a" data-k="2">${opt(Object.fromEntries(Object.entries(ACTS).filter(([k]) => k !== 'wait')), a)}</select>
      <button data-b="up" title="上へ">▲</button><button data-b="down" title="下へ">▼</button><button data-b="del" title="削除">×</button></div>`).join('');
  $('#add').style.display = G.prog.length >= 6 ? 'none' : '';
}
function drawFoeRules() {
  frulesEl.innerHTML = LEVELS[G.level].rules.map(([c1, c2, a], i) => `
    <div class="rule" data-i="${i}"><span class="no">${i + 1}</span><span class="kw">もし</span><span class="tag c">${CONDS[c1][0]}</span>
      ${c2 !== 'none' ? `<span class="kw">かつ</span><span class="tag c">${CONDS[c2][0]}</span>` : ''}
      <span class="kw">なら</span><span class="tag a">${ACTS[a].name}</span></div>`).join('');
}
rulesEl.addEventListener('change', (e) => {
  if (G.mode !== 'plan') return;
  const row = e.target.closest('.rule'); if (!row) return;
  G.prog[+row.dataset.i][+e.target.dataset.k] = e.target.value; drawRules();
});
rulesEl.addEventListener('click', (e) => {
  const b = e.target.dataset.b; if (!b || G.mode !== 'plan') return;
  const i = +e.target.closest('.rule').dataset.i, p = G.prog;
  if (b === 'up' && i > 0) [p[i - 1], p[i]] = [p[i], p[i - 1]];
  if (b === 'down' && i < p.length - 1) [p[i + 1], p[i]] = [p[i], p[i + 1]];
  if (b === 'del' && p.length > 1) p.splice(i, 1);
  drawRules();
});
$('#add').addEventListener('click', () => { if (G.mode === 'plan' && G.prog.length < 6) { G.prog.push(['any', 'none', 'guard']); drawRules(); } });
function fire(side, idx) {
  const el = side === 0 ? rulesEl : frulesEl;
  el.querySelectorAll('.rule').forEach((r, i) => r.classList.toggle('fire', i === idx));
}
function bubble(side, text) { const b = $('#bub' + side); b.textContent = text || ''; b.classList.toggle('on', !!text); }
function drawSteps() {
  $('#steps').innerHTML = Array.from({ length: TICKS }, (_, i) => `<i class="${i + 1 === G.tick ? 'on' : i + 1 < G.tick ? 'done' : ''}"></i>`).join('');
  $('#lv').innerHTML = `レベル${G.level + 1} ${LEVELS[G.level].name}<small>ターン ${Math.min(G.turn, TURNS)} / ${TURNS}</small>`;
  $('#timer b').textContent = Math.min(G.turn, TURNS);
}
function setMode(mode) {
  G.mode = mode;
  const run = mode === 'run';
  $('#plan').classList.toggle('running', run);
  $('#run').disabled = mode !== 'plan'; $('#run').textContent = run ? '実行中' : '▶ 実行';
  rulesEl.querySelectorAll('select').forEach((s) => { s.disabled = mode !== 'plan'; });
  setMusic(run ? 'fight' : mode === 'plan' ? 'plan' : music.mode);
}

// ---------------------------------------------------------------- turn engine
function decide(f, o, rules) {
  if (f.frozen > 0) return { act: 'frozen', idx: -1 };
  if (f.windup) return { act: 'heavyHit', idx: f.windupIdx };
  const d = dist();
  for (let i = 0; i < rules.length; i++) {
    const [c1, c2, a] = rules[i];
    if (!CONDS[c1][1](f, o, d)) continue;
    if (c2 !== 'none' && !CONDS[c2][1](f, o, d)) continue;
    if ((ACTS[a].cost || 0) > f.gauge) continue;
    return { act: a, idx: i };
  }
  return { act: 'wait', idx: -1 };
}
function applyHit(att, tgt, dmg, guarded, m, big) {
  const pos = new THREE.Vector3(tgt.x - tgt.facing * 0.1, rand(1.15, 1.6), 0.4);
  tgt.hp = Math.max(0, tgt.hp - dmg);
  if (guarded) {
    spawn(pos, { color: 0x9fd0ff, sx: 1.2, life: 0.14, grow: 5 }); SFX.guard(); tgt.xOffV = -tgt.facing * 3;
    if (big) { sfxText('ガキン', pos, '#bfe0ff', 44); G.shake = Math.max(G.shake, 0.12); voice(tgt.side, 'guard', 0.1); }
  } else {
    burst(pos, att.col.hex, big ? (m.heavy ? 22 : 12) : 5, m.heavy && big ? 1.5 : big ? 1 : 0.6);
    if (big) { (m.heavy ? SFX.heavy : SFX.hit)(); sfxText(m.text[rand(m.text.length) | 0], pos.clone().add(new THREE.Vector3(0, 0.6, 0)), att.col.css, m.heavy ? 88 : 56); }
    else SFX.rush();
    G.hitstop = Math.max(G.hitstop, big ? (m.heavy ? 0.13 : 0.07) : 0.012);
    G.shake = Math.max(G.shake, big ? (m.heavy ? 0.45 : 0.18) : 0.07);
    if (big && tgt.hp > 0 && !(tgt.frozen > 0) && Math.random() < 0.6) voice(tgt.side, ['hit1', 'hit2'], 0.12);
    if (!(tgt.frozen > 0)) { tgt.set('hit'); tgt.xOffV = -tgt.facing * (m.heavy ? 7 : 4); }
  }
  if (big && dmg >= 1) note('-' + Math.round(dmg), tgt, '#fff', 26);
}
async function attack(f, foe, key) {
  const mk = key === 'heavyHit' ? 'heavy' : key, m = MOVES[mk], d = dist();
  const inRange = mk === 'leap' ? d <= 3 : d <= 1;
  if (mk === 'leap' && inRange && d > 1) f.cell = foe.cell - f.facing;
  const guarded = foe.act === 'guard' && !(foe.frozen > 0);
  const total = DMG[mk][guarded ? 1 : 0];
  const land = (dmg, big) => {
    if (!inRange) { if (big) { SFX.whoosh(); note('届かない', f, '#aab', 22); } return; }
    applyHit(f, foe, dmg, guarded, m, big);
    if (!big) return;
    if (guarded) { if (mk === 'light') foe.gauge = Math.min(100, foe.gauge + 10); if (mk === 'heavy') note('ガードを破った', f, '#ffd766', 22, 0.5); }
    else { if (!m.cost) f.gauge = Math.min(100, f.gauge + 10); foe.gauge = Math.min(100, foe.gauge + 5); }
    if (mk !== 'heavy' && foe.windup) { foe.windup = false; foe.cancelled = true; note('構えをつぶした', f, '#9dff6a', 22, 0.5); }
    if (mk === 'heavy') foe.cell = clamp(foe.cell + f.facing, 0, CELLS - 1);
  };
  f.set('attack', mk);
  if (m.rush) {
    cutin('rush', f, 'ラッシュ'); voice(f.side, 'rush', 0.15);
    f.play('punch', { loop: true, dur: 0.17, fade: 0.05 });
    await sleep(m.from);
    const n = Math.floor((m.to - m.from) / m.every);
    for (let i = 0; i < n; i++) { rushStreak(f, foe); if (inRange) { land(total * 0.6 / n, false); if (i % 3 === 0) sfxText('ドド', new THREE.Vector3(foe.x + rand(-0.6, 0.6), rand(1.6, 2.6), 0), f.col.css, 44); } else if (i % 4 === 0) SFX.whoosh(); await sleep(m.every); }
    f.play('swipe', { dur: 0.35, fade: 0.04 });
    await sleep(m.final - m.to);
    land(total * 0.4, true);
    await sleep(m.dur - m.final);
  } else {
    f.play(m.anim, { dur: m.dur, fade: 0.05 }); SFX.whoosh(); voice(f.side, mk === 'light' ? ['light1', 'light2'] : mk === 'heavy' ? 'heavyhit' : 'leap');
    await sleep(m.hit); land(total, true); await sleep(0.38);
  }
  if (f.state === 'attack') f.idle();
}
async function runTick() {
  const F = [P, E], rules = [G.prog, LEVELS[G.level].rules];
  F.forEach((f, i) => {
    const d = decide(f, F[1 - i], rules[i]);
    f.act = d.act; f.cancelled = false; if (d.act === 'heavy') f.windupIdx = d.idx;
    fire(i, d.idx); bubble(i, LABEL[d.act] || ACTS[d.act].name);
  });
  await sleep(0.5);
  for (const f of F) { const c = ACTS[f.act]?.cost; if (c) f.gauge -= c; }

  // time stop
  const st = F.filter((f) => f.act === 'stop');
  if (st.length === 2) { for (const f of st) { f.set('cast'); f.play('roar', { dur: 0.9 }); note('相殺', f, '#fff', 24); } SFX.guard(); await sleep(0.8); }
  else if (st.length === 1) {
    const f = st[0], o = other(f);
    f.set('cast'); f.play('roar', { dur: 1.0 }); cutin('stop', f, '時よ、凍れ'); voice(f.side, 'stop', 0.15);
    await sleep(0.45);
    o.frozen = 4; o.windup = false; o.act = 'frozen'; bubble(o.side, LABEL.frozen); fire(o.side, -1); stopFx(true);
    await sleep(0.45);
  }
  // movement
  let moved = false;
  for (const f of F) {
    const o = other(f);
    if (f.act === 'approach') { if (dist() > 1) { f.cell += f.facing; moved = true; f.set('walk'); f.moveDir = 1; } else note('これ以上近づけない', f, '#aab', 18); }
    if (f.act === 'retreat') { const c = f.cell - f.facing; if (c >= 0 && c < CELLS) { f.cell = c; moved = true; f.set('walk'); f.moveDir = -1; } else note('後ろは壁', f, '#aab', 18); }
  }
  if (moved) { SFX.whoosh(); await sleep(0.42); }
  // stances
  let pause = false;
  for (const f of F) {
    if (f.act === 'guard') { f.set('guard'); }
    if (f.act === 'charge') { f.gauge = Math.min(100, f.gauge + 20); f.set('cast'); f.play('roar', { dur: 1.2 }); note('ゲージ +20', f, f.col.css, 22);
      for (let i = 0; i < 10; i++) spawn(new THREE.Vector3(f.x + rand(-0.7, 0.7), rand(0.2, 1), rand(-0.3, 0.5)), { color: f.col.hex, sx: rand(0.12, 0.25), life: rand(0.5, 0.9), v: new THREE.Vector3(0, rand(2, 4), 0) });
      tone(220, 660, 0.4, 0.25, 'triangle'); voice(f.side, 'charge'); pause = true; }
    if (f.act === 'heavy') { f.windup = true; f.set('attack', 'heavy'); const a = f.play('swipe', { dur: 0.8, fade: 0.1 }); a.time = a.getClip().duration * 0.16; a.paused = true;
      note('構え', f, '#ffd766', 22); tone(140, 90, 0.3, 0.3, 'sawtooth'); voice(f.side, 'heavy'); pause = true; }
  }
  if (pause) await sleep(0.55);
  // attacks, fastest first
  for (const key of ['light', 'leap', 'rush', 'heavyHit']) {
    const g = F.filter((f) => f.act === key && !f.cancelled && f.hp > 0 && !(f.frozen > 0));
    if (!g.length) continue;
    await Promise.all(g.map((f) => attack(f, other(f), key)));
    if (P.hp <= 0 || E.hp <= 0) return;
  }
  // end of step
  for (const f of F) {
    f.lastAct = f.act;
    if (f.act === 'heavyHit' || f.cancelled) f.windup = false;
    if (!f.windup && f.state !== 'ko') { if (f.state === 'walk' || f.state === 'guard' || f.state === 'cast' || f.state === 'attack') f.idle(); }
    if (f.frozen > 0) f.frozen--;
  }
  if (G.stopFx && !(P.frozen > 0) && !(E.frozen > 0)) stopFx(false);
}
async function runTurn() {
  setMode('run'); SFX.start();
  for (G.tick = 1; G.tick <= TICKS; G.tick++) {
    drawSteps();
    await runTick();
    if (P.hp <= 0 || E.hp <= 0) return finish([P, E].filter((f) => f.hp <= 0));
    await sleep(0.3);
  }
  G.tick = 0; G.turn++; bubble(0, ''); bubble(1, ''); fire(0, -1); fire(1, -1); drawSteps();
  if (G.turn > TURNS) return timeUp();
  setMode('plan');
}
function finish(losers) {
  G.over = true; setMode('over'); bubble(0, ''); bubble(1, '');
  const draw = losers.length === 2, w = draw ? null : other(losers[0]);
  for (const v of losers) { v.frozen = 0; v.set('ko'); v.airT = 0; v.airV = 6.5; v.xOffV = -v.facing * 4; v.play('dying', { dur: 1.6 }); voice(v.side, 'ko', 0.3); }
  P.frozen = E.frozen = 0; if (G.stopFx) { G.stopFx = false; canvas.style.filter = ''; }
  G.slow = 1.6; G.hitstop = 0.28; G.shake = 0.8; SFX.ko(); flash(0.9, 400); G.winner = w;
  if (w) setTimeout(() => cutin('finish', w, ''), 350);
  setTimeout(() => { banner(draw ? 'DRAW' : 'K.O.', true); }, 1300);
  if (w) setTimeout(() => { w.set('win'); w.play('flex', { loop: true, fade: 0.3 }); voice(w.side, 'win', 0.4); }, 1700);
  setTimeout(() => showResult(w, draw ? '相打ちです。' : ''), 4200);
}
function timeUp() {
  G.over = true; setMode('over'); banner('TIME UP', true);
  const w = P.hp === E.hp ? null : P.hp > E.hp ? P : E; G.winner = w;
  if (w) { w.set('win'); w.play('flex', { loop: true, fade: 0.3 }); }
  setTimeout(() => showResult(w, `${TURNS}ターンが終わりました。残り体力 ${Math.round(P.hp)} 対 ${Math.round(E.hp)}。`), 2200);
}
function showResult(w, msg) {
  G.mode = 'result'; setMusic('plan'); $('#banner span').className = ''; $('#plan').style.display = 'none';
  const last = G.level === LEVELS.length - 1;
  $('#restext').textContent = w === P ? 'YOU WIN' : w === E ? 'YOU LOSE' : 'DRAW';
  $('#resmsg').textContent = msg + (w === P ? (last ? '全レベル制覇です。' : `レベル${G.level + 1}「${LEVELS[G.level].name}」を攻略しました。`) : '相手の作戦をもう一度読んで、ブロックの順番と条件を見直してみましょう。');
  $('#again').textContent = w === P ? (last ? '最初から' : '次のレベルへ') : '作戦を練り直す';
  $('#result').style.display = 'flex';
}
function startLevel() {
  P.reset(); E.reset(); waiters.length = 0;
  Object.assign(G, { hitstop: 0, shake: 0, slow: 0, cutinT: 0, stopFx: false, over: false, turn: 1, tick: 0, winner: null });
  canvas.style.filter = ''; $('#cutin').className = 'layer'; $('#banner span').className = '';
  $('#title').style.display = 'none'; $('#result').style.display = 'none'; $('#hud').style.display = 'block'; $('#plan').style.display = 'grid';
  $('#fname').textContent = LEVELS[G.level].name.toUpperCase() === LEVELS[G.level].name ? 'RIVAL' : `RIVAL ― ${LEVELS[G.level].name}`;
  $('#hint').textContent = `ヒント：${LEVELS[G.level].hint}`;
  bubble(0, ''); bubble(1, ''); drawRules(); drawFoeRules(); drawSteps(); setMode('plan');
  banner(`LEVEL ${G.level + 1}`); SFX.start(); setTimeout(() => voice(0, 'start'), 900);
}

// ---------------------------------------------------------------- buttons
$('#run').addEventListener('click', () => { if (G.mode === 'plan') runTurn().catch((e) => console.error(e)); });
$('#speed').addEventListener('click', () => { G.speed = G.speed === 1 ? 2 : 1; $('#speed').textContent = `速さ ×${G.speed}`; });
$('#sound').addEventListener('click', () => { music.on = !music.on; master.gain.value = music.on ? 0.5 : 0; if (!music.on && window.speechSynthesis) speechSynthesis.cancel(); $('#sound').textContent = music.on ? '音 ON' : '音 OFF'; });
$('#help').addEventListener('click', () => { $('#helpbox').style.display = 'flex'; });
$('#helpclose').addEventListener('click', () => { $('#helpbox').style.display = 'none'; });
$('#start').addEventListener('click', () => { initAudio(); musicInit(); voiceInit(); G.level = 0; startLevel(); });
$('#again').addEventListener('click', () => { initAudio(); musicInit(); voiceInit(); if (G.winner === P) G.level = (G.level + 1) % LEVELS.length; startLevel(); });
$('#howto').innerHTML = HOWTO; $('#howto2').innerHTML = HOWTO;
window.addEventListener('keydown', (e) => { if (e.code === 'Enter' && G.mode === 'plan' && !['SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) $('#run').click(); });

// ---------------------------------------------------------------- HUD
function drawHud() {
  [P, E].forEach((f, i) => {
    const w = clamp(f.hp, 0, 100) + '%', hp = $('#hp' + i), g = $('#g' + i);
    hp.querySelector('.fill').style.width = w; hp.querySelector('.trail').style.width = w; hp.classList.toggle('low', f.hp <= 25);
    g.querySelector('i').style.width = clamp(f.gauge, 0, 100) + '%'; g.classList.toggle('full', f.gauge >= 100);
    $('#gn' + i).textContent = `体力 ${Math.round(f.hp)} ・ ゲージ ${Math.round(f.gauge)}`;
    const b = $('#bub' + i);
    if (b.classList.contains('on')) { tmpV.set(f.x + f.xOff, 2.35, 0).project(camera); b.style.left = ((tmpV.x * 0.5 + 0.5) * window.innerWidth) + 'px'; b.style.top = ((-tmpV.y * 0.5 + 0.5) * window.innerHeight) + 'px'; }
  });
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(0, 2.2, 12), camLook = new THREE.Vector3(0, 1.5, 0);
function step(raw) {
  G.t += raw;
  let dt = raw * G.speed;
  if (G.cutinT > 0) { G.cutinT -= raw; dt = 0; if (G.cutinT <= 0) $('#cutin').className = 'layer'; }
  if (G.hitstop > 0) { G.hitstop -= raw; dt = 0; }
  if (G.slow > 0) { G.slow -= raw; dt = raw * 0.22; }
  G.clock += dt;
  for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].t <= G.clock) { const w = waiters[i]; waiters.splice(i, 1); w.res(); }
  if (P) {
    P.frame(dt); E.frame(dt); P.render(raw, G.t); E.render(raw, G.t);
    if (G.stopFx) { G.tickT -= raw; if (G.tickT <= 0) { G.tickT = 0.5; SFX.tick(); } }
    G.menaceT -= raw;
    if (G.menaceT <= 0) { G.menaceT = 0.45; if (G.mode === 'run') for (const f of [P, E]) if (f.gauge >= 100) sfxText('ゴ', new THREE.Vector3(f.x + rand(-1, 1), rand(1.6, 3), 0), f.col.css, 38, true); }
    drawHud();
    const mid = (P.x + E.x) / 2, d = Math.abs(P.x - E.x);
    const rushing = [P, E].some((f) => f.state === 'attack' && f.move && f.move.rush) || G.slow > 0;
    G.zoom = damp(G.zoom, rushing ? 1 : 0, 5, raw);
    const cd = clamp(9.5 + d * 0.95, 12, 26) * (1 - G.zoom * 0.2);
    camPos.set(damp(camPos.x, mid, 6, raw), damp(camPos.y, 2.15 - G.zoom * 0.35, 6, raw), damp(camPos.z, cd, 6, raw));
    camLook.set(camPos.x, 1.55, 0);
    G.shake = Math.max(0, G.shake - raw * 1.6);
    camera.position.set(camPos.x + rand(-1, 1) * G.shake * 0.35, camPos.y + rand(-1, 1) * G.shake * 0.35, camPos.z);
    camera.lookAt(camLook);
  }
  updateParticles(raw);
  composer.render();
}
renderer.setAnimationLoop(() => step(Math.min(clock.getDelta(), 0.05)));

// ---------------------------------------------------------------- loading
const NAMES = ['idle', 'punch', 'swipe', 'jumpattack', 'roar', 'flex', 'dying', 'walk'];
const HNAMES = ['idle', 'walk', 'block', 'impact', 'death', 'casting', 'powerup', 'attack', 'slash'];
async function load() {
  const loader = new FBXLoader();
  const msg = $('#loadmsg'); let done = 0; const total = NAMES.length + HNAMES.length + 2;
  const tick = () => { done++; msg.textContent = `読み込み中… ${done} / ${total}`; };
  msg.textContent = `読み込み中… 0 / ${total}`;
  const hload = Promise.all([
    loader.loadAsync('assets/paladin/Paladin.fbx').then((o) => (tick(), o)),
    ...HNAMES.map((n) => loader.loadAsync(`assets/paladin/${n}.fbx`).then((o) => (tick(), o))),
  ]);
  const [base, ...anims] = await Promise.all([
    loader.loadAsync('assets/mutant/Mutant.fbx?v=2').then((o) => (tick(), o)),
    ...NAMES.map((n) => loader.loadAsync(`assets/mutant/${n}.fbx`).then((o) => (tick(), o))),
  ]);
  base.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(base), h = box.max.y - box.min.y;
  base.scale.multiplyScalar(2.85 / h);
  const clips = {};
  NAMES.forEach((n, i) => {
    const c = anims[i].animations[0]; c.name = n;
    for (const tr of c.tracks) if (/Hips\.position$/.test(tr.name)) { const v = tr.values; for (let k = 3; k < v.length; k += 3) { v[k] = v[0]; v[k + 2] = v[2]; } }
    clips[n] = c;
  });
  const [hbase, ...hanims] = await hload;
  hbase.updateMatrixWorld(true);
  const hb = new THREE.Box3().setFromObject(hbase);
  hbase.scale.multiplyScalar(1.85 / (hb.max.y - hb.min.y));
  const hclips = {};
  HNAMES.forEach((n, i) => {
    const c = hanims[i].animations[0]; c.name = 'h_' + n;
    if (n !== 'death') for (const tr of c.tracks) if (/Hips\.position$/.test(tr.name)) { const v = tr.values; for (let k = 3; k < v.length; k += 3) { v[k] = v[0]; v[k + 2] = v[2]; } }
    hclips[n] = c;
  });
  P = new Fighter(0, base, clips, hbase, hclips); E = new Fighter(1, base, clips, hbase, hclips);
  await Promise.all(['rush', 'stop', 'finish'].map((k) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = `assets/img/cutin_${k}.jpg`; })));
  window.__game = { G, P: () => P, E: () => E, LEVELS, startLevel, runTurn, drawRules };
  G.mode = 'title';
  msg.textContent = '';
  const b = $('#start'); b.disabled = false; b.textContent = 'はじめる';
}
load().catch((e) => { console.error(e); $('#loadmsg').textContent = '読み込みに失敗しました: ' + e.message; });
