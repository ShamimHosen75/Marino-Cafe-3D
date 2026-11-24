import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Tube along a curve with a variable radius radiusFn(u) (u ∈ [0,1]). */
function taperedTube(curve, segments, radial, radiusFn) {
  const geo = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    curve.getPointAt(u, c);
    const r = radiusFn(u);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      p.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(idx, p.x, p.y, p.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const rand = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ */
/* Shrimp                                                              */
/* ------------------------------------------------------------------ */

const shrimpTexture = () =>
  canvasTexture(512, 128, (ctx, w, h) => {
    // u (x) runs head → tail, v (y) runs around the body.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f7b48e');
    g.addColorStop(0.35, '#ee7a45');
    g.addColorStop(0.5, '#e0592c');
    g.addColorStop(0.65, '#ee7a45');
    g.addColorStop(1, '#f7b48e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // shell segments
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.6) * (w / 9.5);
      ctx.fillStyle = 'rgba(255, 236, 220, 0.55)';
      ctx.fillRect(x, 0, 6, h);
      ctx.fillStyle = 'rgba(160, 40, 10, 0.25)';
      ctx.fillRect(x + 6, 0, 4, h);
    }
    // charred flecks from the pan
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(120, 30, 5, ${rand(0.08, 0.3)})`;
      ctx.beginPath();
      ctx.arc(rand(0, w), rand(0, h), rand(1, 4), 0, Math.PI * 2);
      ctx.fill();
    }
  });

function createShrimp(material) {
  const group = new THREE.Group();
  const pts = [];
  const R = 0.24;
  for (let i = 0; i <= 12; i++) {
    const a = -0.4 + (i / 12) * Math.PI * 1.25;
    pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, Math.sin(i * 0.5) * 0.015));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const body = taperedTube(curve, 80, 18, (u) => {
    const base = THREE.MathUtils.lerp(0.115, 0.032, Math.pow(u, 1.15));
    const seg = 1 + 0.06 * Math.pow(Math.sin(u * Math.PI * 9), 2);
    const cap = Math.min(1, Math.sin(Math.min(u * 7, Math.PI / 2)) * 1.0 + 0.15);
    return base * seg * cap;
  });
  const mesh = new THREE.Mesh(body, material);
  group.add(mesh);

  // tail fan
  const end = curve.getPointAt(1);
  const tan = curve.getTangentAt(1);
  const tailMat = new THREE.MeshStandardMaterial({ color: '#d2401c', roughness: 0.4 });
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), tailMat);
    fin.scale.set(1.25, 0.45, 0.22);
    fin.position.copy(end).addScaledVector(tan, 0.06);
    fin.position.z += side * 0.035;
    fin.lookAt(fin.position.clone().add(tan));
    fin.rotateY(side * 0.5);
    group.add(fin);
  }
  return group;
}

/* ------------------------------------------------------------------ */
/* Lemon wedge                                                         */
/* ------------------------------------------------------------------ */

const fleshTexture = () =>
  canvasTexture(256, 256, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = '#f7f0c9';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f2df63';
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.43, 0, Math.PI * 2);
    ctx.fill();
    // juice sacs
    for (let i = 0; i < 400; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(0.05, 0.41) * w;
      ctx.fillStyle = `rgba(255, 250, 200, ${rand(0.2, 0.6)})`;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#fbf6dc';
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * w * 0.45, cy + Math.sin(a) * h * 0.45);
      ctx.stroke();
    }
  });

function createLemon() {
  const group = new THREE.Group();
  const phiStart = 0;
  const phiLen = Math.PI / 2.6;
  const rind = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 32, 24, phiStart, phiLen),
    new THREE.MeshStandardMaterial({ color: '#f1cf2d', roughness: 0.38 }),
  );
  group.add(rind);
  const flesh = new THREE.MeshStandardMaterial({ map: fleshTexture(), roughness: 0.25, side: THREE.DoubleSide });
  for (const phi of [phiStart, phiStart + phiLen]) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.315, 32, -Math.PI / 2, Math.PI), flesh);
    face.rotation.y = Math.PI + phi;
    group.add(face);
  }
  group.scale.set(1, 1.35, 1);
  const wrap = new THREE.Group();
  wrap.add(group);
  return wrap;
}

/* ------------------------------------------------------------------ */
/* Chili, tomato, garlic, basil, parmesan, flakes                       */
/* ------------------------------------------------------------------ */

function createChili(redMat, stemMat) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, 0),
    new THREE.Vector3(0.02, 0.05, 0.01),
    new THREE.Vector3(0.05, -0.1, 0),
    new THREE.Vector3(0.12, -0.2, 0),
  ]);
  group.add(new THREE.Mesh(taperedTube(curve, 30, 12, (u) => 0.055 * Math.pow(1 - u, 0.6) * Math.min(1, u * 12 + 0.4)), redMat));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.09, 8), stemMat);
  stem.position.y = 0.24;
  group.add(stem);
  return group;
}

function createTomato(skinMat, cutMat) {
  const group = new THREE.Group();
  const half = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), skinMat);
  const cut = new THREE.Mesh(new THREE.CircleGeometry(0.108, 24), cutMat);
  cut.rotation.x = Math.PI / 2;
  group.add(half, cut);
  return group;
}

const tomatoCutTexture = () =>
  canvasTexture(128, 128, (ctx, w) => {
    ctx.fillStyle = '#e0412b';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#f3a173';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 18, 12, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f9d9a8';
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26, 2.5, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  });

function createGarlic(mat) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = Math.sin(t * Math.PI) * 0.07 * (1 - t * 0.35) + 0.002;
    pts.push(new THREE.Vector2(r, t * 0.2 - 0.1));
  }
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), mat);
  mesh.scale.set(1, 1, 0.75);
  const wrap = new THREE.Group();
  wrap.add(mesh);
  return wrap;
}

function createBasil(mat) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.17);
  s.quadraticCurveTo(0.13, -0.05, 0.0, 0.19);
  s.quadraticCurveTo(-0.13, -0.05, 0, -0.17);
  const geo = new THREE.ShapeGeometry(s, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, -x * x * 4.5 + y * y * 0.6);
  }
  geo.computeVertexNormals();
  const wrap = new THREE.Group();
  wrap.add(new THREE.Mesh(geo, mat));
  return wrap;
}

function createShaving(mat) {
  const geo = new THREE.BoxGeometry(rand(0.07, 0.12), 0.012, rand(0.04, 0.07), 3, 1, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + pos.getX(i) * pos.getX(i) * 4 + rand(-0.003, 0.003));
  }
  geo.computeVertexNormals();
  const wrap = new THREE.Group();
  wrap.add(new THREE.Mesh(geo, mat));
  return wrap;
}

function createFlake(mat) {
  const wrap = new THREE.Group();
  const m = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.018, 0.03)), mat);
  m.scale.set(1.4, 0.5, 1);
  wrap.add(m);
  return wrap;
}

/* ------------------------------------------------------------------ */
/* Fork + plate                                                        */
/* ------------------------------------------------------------------ */

function createFork() {
  const metal = new THREE.MeshStandardMaterial({ color: '#d9d6d0', metalness: 1, roughness: 0.22 });
  const group = new THREE.Group();
  // tines point down -y, handle up +y
  for (let i = 0; i < 4; i++) {
    const tine = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.42, 4, 8), metal);
    tine.position.set((i - 1.5) * 0.055, -0.33, 0);
    group.add(tine);
  }
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.17, 4, 12), metal);
  head.rotation.z = Math.PI / 2;
  head.scale.set(1, 1, 0.45);
  head.position.y = -0.1;
  group.add(head);
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.08, 0),
    new THREE.Vector3(0, 0.25, -0.02),
    new THREE.Vector3(0, 0.6, -0.06),
  ]);
  group.add(new THREE.Mesh(taperedTube(neckCurve, 20, 12, (u) => THREE.MathUtils.lerp(0.06, 0.022, Math.sin(u * Math.PI * 0.5))), metal));
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.58, -0.06),
    new THREE.Vector3(0, 1.4, -0.08),
    new THREE.Vector3(0, 2.4, -0.02),
    new THREE.Vector3(0, 2.75, 0.02),
  ]);
  const handle = new THREE.Mesh(
    taperedTube(handleCurve, 40, 14, (u) => THREE.MathUtils.lerp(0.022, 0.07, Math.pow(u, 1.4)) * Math.min(1, (1 - u) * 18 + 0.3)),
    metal,
  );
  handle.scale.z = 0.5;
  group.add(handle);
  return group;
}

const plateTexture = () =>
  canvasTexture(1024, 64, (ctx, w, h) => {
    // u around, v along profile (centre → rim)
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f5f0e7');
    g.addColorStop(0.55, '#efe8dc');
    g.addColorStop(0.8, '#e2d7c6');
    g.addColorStop(0.9, '#cbbba5');
    g.addColorStop(1, '#efe8dc');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = `rgba(90, 70, 50, ${rand(0.05, 0.22)})`;
      ctx.fillRect(rand(0, w), rand(0, h), 1.2, 1.2);
    }
  });

function createPlate() {
  const profile = [
    [0.0, 0.0],
    [0.95, 0.0],
    [1.12, 0.02],
    [1.5, 0.11],
    [1.78, 0.2],
    [1.82, 0.215],
    [1.8, 0.235],
    [1.5, 0.15],
    [1.12, 0.06],
    [0.0, 0.05],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // Lathe's v runs along the profile; flip so the top surface reads correctly.
  const geo = new THREE.LatheGeometry(profile.reverse(), 96);
  const mat = new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.45, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.04;
  const wrap = new THREE.Group();
  wrap.add(mesh);

  // Soft contact shadow under the plate
  const shadowTex = canvasTexture(256, 256, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(60,40,20,0.55)');
    g.addColorStop(0.6, 'rgba(60,40,20,0.25)');
    g.addColorStop(1, 'rgba(60,40,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.06;
  wrap.add(shadow);
  return wrap;
}

/* ------------------------------------------------------------------ */
/* Keyframes                                                           */
/* ------------------------------------------------------------------ */

/**
 * Each item has three poses in the dish group's local space:
 *   H = hero (twirled on the fork), B = ballet (floating, labelled), P = plated.
 * [x, y, z, rx, ry, rz, scale]
 */
const SHRIMP = [
  { H: [0.02, 0.52, 0.38, 0.5, 0.1, 0.3, 1], B: [-0.5, 1.2, 0.35, 0.3, 0.7, 1.4, 1.05], P: [-0.28, 0.5, 0.18, -1.1, 0.4, 0.1, 1] },
  { H: [-0.25, 0.25, 0.3, 0, 0, 0, 0], B: [0.98, -0.3, 0.35, 0.4, -0.6, -0.4, 1.05], P: [0.3, 0.46, 0.0, -1.2, -1.4, 0.0, 1] },
  { H: [0.25, 0.2, 0.3, 0, 0, 0, 0], B: [-0.18, -0.95, 0.55, -0.3, 0.5, 2.4, 1.0], P: [0.02, 0.44, -0.36, -1.1, 2.2, 0.1, 0.95] },
];

const LEMON = { H: [0.52, 0.72, 0.0, 0.3, -0.9, -0.5, 1], B: [0.72, 1.32, 0.1, 0.4, -1.4, -0.8, 1.0], P: [1.0, 0.24, 0.32, 0.1, -2.4, 1.3, 0.95] };

const CHILI = [
  { H: [0.25, 0.48, 0.32, 0.4, 0, 0.9, 0.55], B: [0.62, 0.55, 0.55, 0.3, 0.4, 0.9, 0.9], P: [-0.1, 0.52, 0.32, 1.3, 0.2, 0.5, 0.6] },
  { H: [0, 0, 0, 0, 0, 0, 0], B: [0.92, 0.3, 0.25, 1.2, 0.2, -0.5, 0.75], P: [0.45, 0.32, 0.4, 1.4, 1.2, 0.2, 0.55] },
  { H: [0, 0, 0, 0, 0, 0, 0], B: [0.5, 0.18, 0.7, -0.3, 1.0, 2.2, 0.7], P: [-0.6, 0.28, -0.1, 1.2, -0.8, 0, 0.55] },
];

const TOMATO = [
  { H: [0, 0, 0, 0, 0, 0, 0], B: [-0.3, 0.32, 0.72, 1.1, 0.2, 0.4, 1], P: [0.62, 0.24, 0.3, 0.1, 0, 0.1, 1] },
  { H: [0, 0, 0, 0, 0, 0, 0], B: [0.28, -0.55, 0.75, -0.6, 0.6, 0.2, 1], P: [-0.55, 0.26, 0.35, 0.2, 0, -0.1, 1] },
  { H: [0, 0, 0, 0, 0, 0, 0], B: [-0.72, -0.35, 0.4, 0.9, -0.3, 1.2, 0.9], P: [0.15, 0.36, 0.55, 0.3, 0.4, 0.2, 0.9] },
];

const GARLIC = [
  { H: [0, 0, 0, 0, 0, 0, 0], B: [-0.92, -0.05, 0.35, 0.4, 0.3, 0.9, 1.1], P: [0.0, 0.5, 0.1, 1.4, 0, 0.3, 0.7] },
  { H: [0, 0, 0, 0, 0, 0, 0], B: [-0.75, -0.25, 0.55, -0.3, 0.6, -0.6, 0.95], P: [-0.35, 0.42, -0.2, 1.3, 0.5, 0, 0.7] },
];

const BASIL = [
  { H: [-0.12, 0.58, 0.25, -0.8, 0.2, 0.6, 1], B: [-0.98, 0.62, 0.3, -0.4, 0.6, 0.7, 1.2], P: [0.12, 0.58, 0.1, -1.4, 0.2, 0.5, 1.15] },
  { H: [0, 0, 0, 0, 0, 0, 0], B: [-0.8, 0.85, 0.1, 0.3, -0.5, -0.4, 1], P: [-0.08, 0.56, -0.06, -1.3, 0.1, -1.4, 1.05] },
];

function scatter(n, fn) {
  return Array.from({ length: n }, (_, i) => fn(i));
}

const PARM = scatter(9, (i) => ({
  H: [rand(-0.22, 0.25), rand(0.48, 0.6), rand(0.0, 0.35), rand(0, 3), rand(0, 3), rand(0, 3), i < 6 ? 1 : 0],
  B: [rand(0.35, 0.8), rand(0.8, 1.15), rand(0.2, 0.6), rand(0, 3), rand(0, 3), rand(0, 3), 1.15],
  P: [rand(-0.35, 0.35), rand(0.47, 0.58), rand(-0.3, 0.35), rand(0, 0.4), rand(0, 3), rand(0, 0.4), 1],
}));

const FLAKES = scatter(16, () => ({
  H: [rand(-0.25, 0.3), rand(0.42, 0.62), rand(0.0, 0.4), rand(0, 3), rand(0, 3), rand(0, 3), 1],
  B: [rand(-0.9, 1.0), rand(-1.2, 1.3), rand(0.1, 0.8), rand(0, 3), rand(0, 3), rand(0, 3), 1.2],
  P: [rand(-0.5, 0.5), rand(0.35, 0.55), rand(-0.4, 0.45), rand(0, 3), rand(0, 3), rand(0, 3), 1],
}));

const FORK = { H: [0.16, 0.95, -0.05, 0.25, 0.25, -0.72, 1], B: [2.6, 3.6, -0.5, 0.25, 0.4, -0.9, 1], P: [0.2, 0.62, -0.15, -0.35, 0.2, -1.12, 0.62] };
const PLATE = { H: [0, -2.6, 0, 0, 0, 0, 0], B: [0, -2.6, 0, 0, 0, 0, 0], P: [0, -0.02, 0, 0, 0, 0, 1] };

/* ------------------------------------------------------------------ */

export function createIngredients() {
  const shrimpMat = new THREE.MeshStandardMaterial({ map: shrimpTexture(), roughness: 0.38 });
  const redMat = new THREE.MeshStandardMaterial({ color: '#c81f12', roughness: 0.22 });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#4d7a2a', roughness: 0.5 });
  const tomatoSkin = new THREE.MeshStandardMaterial({ color: '#d92b1a', roughness: 0.18 });
  const tomatoCut = new THREE.MeshStandardMaterial({ map: tomatoCutTexture(), roughness: 0.3 });
  const garlicMat = new THREE.MeshStandardMaterial({ color: '#efcf8f', roughness: 0.35 });
  const basilMat = new THREE.MeshStandardMaterial({ color: '#2f6a22', roughness: 0.45, side: THREE.DoubleSide });
  const parmMat = new THREE.MeshStandardMaterial({ color: '#f6e7b8', roughness: 0.6 });
  const flakeMat = new THREE.MeshStandardMaterial({ color: '#b5200f', roughness: 0.5 });

  const items = [];
  const named = {};
  const add = (obj, keys, name) => {
    items.push({ obj, keys, seed: Math.random() });
    if (name && !named[name]) named[name] = obj;
    return obj;
  };

  SHRIMP.forEach((k, i) => add(createShrimp(shrimpMat), k, i === 1 ? 'shrimp' : null));
  add(createLemon(), LEMON, 'lemon');
  CHILI.forEach((k) => add(createChili(redMat, stemMat), k, 'chili'));
  TOMATO.forEach((k) => add(createTomato(tomatoSkin, tomatoCut), k, 'tomato'));
  GARLIC.forEach((k) => add(createGarlic(garlicMat), k, 'garlic'));
  BASIL.forEach((k) => add(createBasil(basilMat), k, 'basil'));
  PARM.forEach((k) => add(createShaving(parmMat), k, 'parmesan'));
  FLAKES.forEach((k) => add(createFlake(flakeMat), k));
  const fork = add(createFork(), FORK, 'fork');
  const plate = add(createPlate(), PLATE, 'plate');
  items.find((it) => it.obj === fork).rigid = true;
  items.find((it) => it.obj === plate).rigid = true;

  // An anchor on the pasta itself for the "Linguine" label
  const linguine = new THREE.Object3D();
  linguine.position.set(-0.55, -1.05, 0.3);
  named.linguine = linguine;

  return { items, named, anchors: [linguine] };
}
