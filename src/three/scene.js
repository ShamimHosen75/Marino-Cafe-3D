import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createNoodles } from './noodles.js';
import { createIngredients } from './ingredients.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = THREE.MathUtils.lerp;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
/** Map p from [a,b] → [0,1] (clamped). */
export const range = (p, a, b) => clamp01((p - a) / (b - a));

/**
 * Scroll story beats (p = 0..1 across the whole sticky section).
 * Shared with main.js so the DOM and the WebGL scene stay in lockstep.
 */
export const BEATS = {
  heroOut: [0.0, 0.14],
  toHelix: [0.03, 0.3],
  spread: [0.15, 0.36],
  tornado: [0.56, 0.68],
  plate: [0.64, 0.84],
};

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  // Warm key light from top-left, soft fill, cool-ish rim from behind.
  scene.add(new THREE.HemisphereLight('#fff4e2', '#6b3a1c', 0.9));
  const key = new THREE.DirectionalLight('#fff1dc', 2.4);
  key.position.set(-3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffe7c4', 1.4);
  rim.position.set(3, 2, -4);
  scene.add(rim);

  const dish = new THREE.Group();
  scene.add(dish);

  const noodles = createNoodles();
  dish.add(noodles.mesh);

  const ingredients = createIngredients();
  ingredients.items.forEach(({ obj }) => dish.add(obj));
  ingredients.anchors.forEach((a) => dish.add(a));

  /* -------------------------------------------------------------- */
  /* Responsive layout for the dish group in each beat               */
  /* -------------------------------------------------------------- */

  let layout;
  function computeLayout() {
    const aspect = window.innerWidth / window.innerHeight;
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * aspect;
    if (aspect < 0.8) {
      layout = {
        H: { pos: [0.05 * visW, -0.2 * visH, 0], rot: [0.22, -0.3, -0.06], s: visW * 0.34 },
        B: { pos: [0.02 * visW, -0.04 * visH, 0], rot: [0.05, 0, 0], s: Math.min(visW * 0.25, visH * 0.2) },
        P: { pos: [0, -0.06 * visH, 0], rot: [0.36, 0, 0], s: visW * 0.25 },
      };
    } else {
      layout = {
        H: { pos: [0.115 * visW, 0.0, 0], rot: [0.22, -0.3, -0.06], s: Math.min(visH * 0.29, visW * 0.19) },
        B: { pos: [0.0, -0.035 * visH, 0], rot: [0.05, 0, 0], s: visH * 0.245 },
        P: { pos: [0, -0.11 * visH, 0], rot: [0.2, 0, 0], s: Math.min(visH * 0.31, visW * 0.175) },
      };
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    computeLayout();
  }
  resize();

  /* -------------------------------------------------------------- */
  /* Per-frame update                                                */
  /* -------------------------------------------------------------- */

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  let spin = 0;
  let lastTime = 0;

  /**
   * @param {number} p      scroll progress 0..1
   * @param {number} time   seconds
   * @param {number} intro  0..1 load-in reveal
   */
  function update(p, time, intro) {
    const dt = Math.min(0.05, time - lastTime);
    lastTime = time;

    const e1 = easeInOut(range(p, ...BEATS.toHelix));
    const e2 = range(p, ...BEATS.spread);
    const e3 = easeInOut(range(p, ...BEATS.tornado));
    const e4 = easeInOut(range(p, ...BEATS.plate));
    const balletAmt = e1 * (1 - e4);

    // Dish group pose
    const { H, B, P } = layout;
    const g = (k) => lerp(lerp(H[k], B[k], e1), P[k], e4);
    for (let i = 0; i < 3; i++) {
      dish.position.setComponent(i, lerp(lerp(H.pos[i], B.pos[i], e1), P.pos[i], e4));
      dish.rotation[['x', 'y', 'z'][i]] = lerp(lerp(H.rot[i], B.rot[i], e1), P.rot[i], e4);
    }
    const scale = g('s') * lerp(0.86, 1, easeOut(intro));
    dish.scale.setScalar(scale);
    dish.position.y += (1 - intro) * -0.4 + Math.sin(time * 0.9) * 0.04 * (1 - e1);
    dish.rotation.y += Math.sin(time * 0.5) * 0.06 * (1 - e1) * (1 - e4);
    // slow turntable on the finished plate
    dish.rotation.y += e4 * Math.sin(time * 0.25) * 0.12;

    // Noodles
    spin += dt * (0.35 + e3 * 2.2) * balletAmt;
    noodles.uniforms.uMix1.value = e1;
    noodles.uniforms.uMix2.value = e4;
    noodles.uniforms.uTwist.value = e3 * (1 - e4);
    noodles.uniforms.uSpin.value = spin;
    noodles.uniforms.uTime.value = time;

    // Ingredients
    for (const it of ingredients.items) {
      const { obj, keys, seed, rigid } = it;
      const spreadT = easeInOut(clamp01(e2 * 1.35 - seed * 0.35));
      const plateT = easeInOut(clamp01(e4 * 1.4 - (rigid ? 0 : seed * 0.4)));

      // Tornado pose: pulled toward the axis, spun and lifted.
      const b = keys.B;
      const ang = 1.8 + seed * 1.5;
      const r = 0.35;
      const tx = (b[0] * Math.cos(ang) - b[2] * Math.sin(ang)) * r;
      const tz = (b[0] * Math.sin(ang) + b[2] * Math.cos(ang)) * r;
      const ty = b[1] * 0.4 + 0.15;

      tmpA.set(lerp(keys.H[0], b[0], spreadT), lerp(keys.H[1], b[1], spreadT), lerp(keys.H[2], b[2], spreadT));
      if (!rigid) tmpA.lerp(tmpB.set(tx, ty, tz), e3);
      tmpA.lerp(tmpB.set(keys.P[0], keys.P[1], keys.P[2]), plateT);
      // a little arc as things drop onto the plate
      if (!rigid) tmpA.y += Math.sin(plateT * Math.PI) * 0.5;
      obj.position.copy(tmpA);

      const rot = [3, 4, 5].map((i) => lerp(lerp(keys.H[i], b[i], spreadT), keys.P[i], plateT));
      const wobble = rigid ? 0 : balletAmt;
      obj.rotation.set(
        rot[0] + Math.sin(time * 0.7 + seed * 9) * 0.35 * wobble + e3 * (1 - e4) * seed * 4,
        rot[1] + time * 0.35 * wobble * (seed - 0.5),
        rot[2] + Math.cos(time * 0.6 + seed * 7) * 0.3 * wobble,
      );
      if (!rigid) obj.position.y += Math.sin(time * 1.1 + seed * 6.28) * 0.045 * wobble;

      const s = lerp(lerp(keys.H[6], b[6], spreadT), keys.P[6], plateT);
      obj.scale.setScalar(Math.max(0.0001, s));
      // Photo cut-outs (DOM) stand in for everything except the chili flakes.
      obj.visible = s > 0.001 && it.kind === 'flake';
      it.scale = s;
    }

    renderer.render(scene, camera);
  }

  /** Screen-space position (px) of a named ingredient, for label leader lines. */
  function project(name, out) {
    const obj = ingredients.named[name];
    if (!obj) return null;
    obj.getWorldPosition(tmpA);
    tmpA.project(camera);
    out.x = (tmpA.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-tmpA.y * 0.5 + 0.5) * window.innerHeight;
    return out;
  }

  /**
   * Screen-space pose of every ingredient, for the photo cut-outs.
   * px = CSS pixels per local unit of the ingredient (dish scale × item scale × perspective).
   */
  const sprites = ingredients.items.map((it) => ({ kind: it.kind, x: 0, y: 0, px: 0, rot: 0, front: true, seed: it.seed }));
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function screenSprites() {
    const dishZ = dish.getWorldPosition(tmpB).z;
    ingredients.items.forEach((it, i) => {
      const sp = sprites[i];
      it.obj.getWorldPosition(tmpA);
      const dist = camera.position.z - tmpA.z;
      sp.front = tmpA.z >= dishZ;
      sp.px = (dish.scale.x * (it.scale ?? 0) * window.innerHeight) / (2 * dist * halfTan);
      tmpA.project(camera);
      sp.x = (tmpA.x * 0.5 + 0.5) * window.innerWidth;
      sp.y = (-tmpA.y * 0.5 + 0.5) * window.innerHeight;
      sp.rot = it.obj.rotation.z + dish.rotation.z;
    });
    return sprites;
  }

  return { update, resize, project, screenSprites };
}
