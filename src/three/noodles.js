import * as THREE from 'three';

/**
 * Linguine bundle.
 *
 * Every strand is a thin tube whose centre line is computed on the GPU from
 * three parametric shapes:
 *   1. nest   – twirled around the fork with tails hanging down (hero)
 *   2. helix  – a slanted ribbon spiralling down (the ingredient dance)
 *   3. plate  – a swirled mound sitting on the plate (the masterpiece)
 * Uniforms blend between them with a per-strand stagger so the pasta flows
 * rather than snapping.
 */

const STRANDS = 170;
const SEGMENTS = 150;
const RADIAL = 6;

const GLSL_SHAPES = /* glsl */ `
  attribute float aT;
  attribute float aA;
  attribute vec4 aSeed;

  uniform float uMix1;
  uniform float uMix2;
  uniform float uTwist;
  uniform float uSpin;
  uniform float uTime;
  uniform float uRadius;

  varying float vShade;

  const float TAU = 6.28318530718;

  vec3 nestShape(float t, vec4 s) {
    float wrapEnd = 0.52 + s.x * 0.22;
    float u = clamp(t / wrapEnd, 0.0, 1.0);
    float turns = 1.4 + s.y * 1.6;
    float ang = s.z * TAU + u * turns * TAU;
    float h = mix(0.46, -0.3, u) + (s.w - 0.5) * 0.32 + 0.07 * sin(u * 9.0 + s.x * 20.0);
    float bulge = sin(u * 3.14159 * 0.92 + 0.18);
    float r = 0.16 + 0.4 * bulge + 0.07 * s.y;
    r += 0.05 * sin(u * 13.0 + s.w * 30.0) + 0.03 * sin(u * 29.0 + s.z * 17.0);
    vec3 p = vec3(cos(ang) * r, h, sin(ang) * r);
    // Tilt each strand's wrap plane a little so the nest looks tossed, not spooled.
    float tx = (s.x - 0.5) * 0.9;
    float tz = (s.y - 0.5) * 0.9;
    p.yz = mat2(cos(tx), -sin(tx), sin(tx), cos(tx)) * p.yz;
    p.xy = mat2(cos(tz), -sin(tz), sin(tz), cos(tz)) * p.xy;

    // Tails that slip off the fork and hang.
    float k = max(t - wrapEnd, 0.0) / (1.0 - wrapEnd);
    float len = 0.25 + s.w * s.w * 0.85;
    p.y -= k * len;
    p.xz *= 1.0 - 0.42 * k;
    p.x += sin(k * 5.0 + s.x * 12.0) * 0.07 * k;
    p.z += cos(k * 4.0 + s.y * 12.0) * 0.07 * k;

    // Gentle sway
    p.x += sin(uTime * 0.9 + p.y * 1.6) * 0.025 * (0.4 + k);
    return p;
  }

  vec3 helixShape(float t, vec4 s) {
    float turns = 2.35 + uTwist * 1.4;
    float th = t * turns * TAU + uSpin + uTwist * t * 2.5;
    float y = mix(1.55, -1.55, t);
    float R = 0.56 * mix(1.0, 0.45 + 0.55 * t, uTwist);
    vec3 radial = vec3(cos(th), 0.0, sin(th));
    float w = (s.x - 0.5) * 0.66;
    float d = (s.y - 0.5) * 0.14;
    vec3 p = radial * (R + w * 0.55) + vec3(0.0, y + d + w * 0.42, 0.0);
    p += vec3(
      sin(t * 41.0 + s.z * 30.0),
      cos(t * 37.0 + s.w * 30.0),
      sin(t * 33.0 + s.x * 20.0)
    ) * 0.014;
    return p;
  }

  vec3 plateShape(float t, vec4 s) {
    float dir = s.z > 0.5 ? 1.0 : -1.0;
    float ang = s.x * TAU + t * (3.5 + s.y * 4.5) * dir;
    float r = 0.06 + 0.9 * (0.5 + 0.5 * sin(t * (2.2 + s.w * 2.6) * 3.14159 + s.z * TAU));
    float y = 0.44 * (1.0 - r * r) * (0.78 + 0.22 * s.w) + 0.028 * sin(t * 31.0 + s.x * 10.0) + 0.03;
    return vec3(cos(ang) * r, y, sin(ang) * r * 0.96);
  }

  vec3 noodleAt(float t) {
    vec3 a = nestShape(t, aSeed);
    vec3 b = helixShape(t, aSeed);
    vec3 c = plateShape(t, aSeed);
    float m1 = smoothstep(0.0, 1.0, clamp((uMix1 - aSeed.w * 0.35) / 0.65, 0.0, 1.0));
    float m2 = smoothstep(0.0, 1.0, clamp((uMix2 - aSeed.x * 0.4) / 0.6, 0.0, 1.0));
    vec3 p = mix(mix(a, b, m1), c, m2);
    // A little lift while the strands are in flight so they "fall" onto the plate.
    p.y += sin(m2 * 3.14159) * 0.35 * (1.0 - t * 0.5);
    return p;
  }
`;

const GLSL_FRAME = /* glsl */ `
  float eps = 0.004;
  vec3 c0 = noodleAt(aT);
  vec3 tangent = normalize(noodleAt(min(aT + eps, 1.0)) - noodleAt(max(aT - eps, 0.0)));
  vec3 ref = abs(tangent.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 nx = normalize(cross(tangent, ref));
  vec3 ny = normalize(cross(nx, tangent));
  // Flat-ish linguine cross section
  float ca = cos(aA);
  float sa = sin(aA);
  float taper = smoothstep(0.0, 0.012, aT) * smoothstep(1.0, 0.988, aT);
  vec3 offset = (nx * ca * 1.45 + ny * sa * 0.7) * uRadius * taper;
  vec3 noodlePos = c0 + offset;
  vec3 objectNormal = normalize(nx * ca / 1.45 + ny * sa / 0.7);
  vShade = 0.82 + aSeed.y * 0.3;
`;

export function createNoodles() {
  const vertsPerStrand = (SEGMENTS + 1) * (RADIAL + 1);
  const count = STRANDS * vertsPerStrand;
  const aT = new Float32Array(count);
  const aA = new Float32Array(count);
  const aSeed = new Float32Array(count * 4);
  const position = new Float32Array(count * 3);
  const indices = [];

  let v = 0;
  for (let s = 0; s < STRANDS; s++) {
    const seed = [Math.random(), Math.random(), Math.random(), Math.random()];
    const base = s * vertsPerStrand;
    for (let i = 0; i <= SEGMENTS; i++) {
      for (let j = 0; j <= RADIAL; j++) {
        aT[v] = i / SEGMENTS;
        aA[v] = (j / RADIAL) * Math.PI * 2;
        aSeed.set(seed, v * 4);
        v++;
      }
    }
    for (let i = 0; i < SEGMENTS; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a = base + i * (RADIAL + 1) + j;
        const b = base + (i + 1) * (RADIAL + 1) + j;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  geometry.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 4));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);

  const uniforms = {
    uMix1: { value: 0 },
    uMix2: { value: 0 },
    uTwist: { value: 0 },
    uSpin: { value: 0 },
    uTime: { value: 0 },
    uRadius: { value: 0.017 },
  };

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#cf7d22'),
    roughness: 0.38,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${GLSL_SHAPES}`)
      .replace('#include <beginnormal_vertex>', GLSL_FRAME)
      .replace('#include <begin_vertex>', 'vec3 transformed = noodlePos;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vShade;')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( diffuse * vShade, opacity );',
      );
  };

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
