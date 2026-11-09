import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { createNoise2D, mulberry32, smoothstep } from "../core/noise.js";
import { grassMaterial } from "../core/materials.js";
import { groundHeight, groundSlope, edgeRadius } from "../landscape/terrain.js";
import { inClearZone } from "../bivac/layout.js";

// Geometria d'una mata d'herba (alçada 1, s'escala per instància).
function tuftGeometry(rng, { blades = 9, root = [0.13, 0.15, 0.09], tip = [0.36, 0.4, 0.22] } = {}) {
  const positions = [];
  const colors = [];
  const heights = [];
  const indices = [];
  const segs = 4;

  for (let b = 0; b < blades; b += 1) {
    const facing = rng() * Math.PI * 2;
    const leanDir = rng() * Math.PI * 2;
    const lean = 0.12 + rng() * 0.4;
    const h = 0.55 + rng() * 0.45;
    const w = 0.035 + rng() * 0.03;
    const bx = (rng() - 0.5) * 0.12;
    const bz = (rng() - 0.5) * 0.12;
    const px = Math.cos(facing);
    const pz = Math.sin(facing);
    const start = positions.length / 3;

    for (let s = 0; s <= segs; s += 1) {
      const t = s / segs;
      const width = w * Math.pow(1 - t, 0.85) + 0.002;
      const off = lean * t * t * h;
      const cx = bx + Math.cos(leanDir) * off;
      const cz = bz + Math.sin(leanDir) * off;
      const y = t * h;
      positions.push(cx - px * width, y, cz - pz * width, cx + px * width, y, cz + pz * width);
      for (let k = 0; k < 2; k += 1) {
        colors.push(
          root[0] + (tip[0] - root[0]) * t,
          root[1] + (tip[1] - root[1]) * t,
          root[2] + (tip[2] - root[2]) * t
        );
        heights.push(y);
      }
    }
    for (let s = 0; s < segs; s += 1) {
      const a = start + s * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(positions.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("aHeight", new THREE.Float32BufferAttribute(heights, 1));
  geo.setIndex(indices);
  return geo;
}

// Flor alpina: tija fina amb una corol·la de pètals al capdamunt.
function flowerGeometry(petal = [0.82, 0.84, 0.88]) {
  const positions = [];
  const colors = [];
  const heights = [];
  const indices = [];
  const stem = [0.2, 0.26, 0.15];
  const segs = 4;
  const w = 0.012;

  for (let s = 0; s <= segs; s += 1) {
    const t = s / segs;
    const x = 0.08 * t * t;
    positions.push(x - w, t, 0, x + w, t, 0);
    colors.push(...stem, ...stem);
    heights.push(t, t);
  }
  for (let s = 0; s < segs; s += 1) {
    const a = s * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const center = positions.length / 3;
  const top = [0.08, 1.0, 0];
  positions.push(...top);
  colors.push(0.85, 0.72, 0.3);
  heights.push(1);
  const petals = 6;
  for (let p = 0; p < petals; p += 1) {
    const a0 = (p / petals) * Math.PI * 2;
    const r = 0.11;
    const i0 = positions.length / 3;
    positions.push(
      top[0] + Math.cos(a0 - 0.25) * r * 0.5, top[1] + 0.01, top[2] + Math.sin(a0 - 0.25) * r * 0.5,
      top[0] + Math.cos(a0) * r, top[1] + 0.03, top[2] + Math.sin(a0) * r,
      top[0] + Math.cos(a0 + 0.25) * r * 0.5, top[1] + 0.01, top[2] + Math.sin(a0 + 0.25) * r * 0.5
    );
    colors.push(...petal, ...petal, ...petal);
    heights.push(1, 1, 1);
    indices.push(center, i0, i0 + 1, center, i0 + 1, i0 + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(positions.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("aHeight", new THREE.Float32BufferAttribute(heights, 1));
  geo.setIndex(indices);
  return geo;
}

function scatter({ geometry, count, seed, minScale, maxScale, clump, density = 0.0, tints }) {
  const rng = mulberry32(seed);
  const clumpNoise = createNoise2D(seed + 3);
  const matrices = [];
  const tintValues = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  for (let attempt = 0; attempt < count * 12 && matrices.length < count; attempt += 1) {
    const th = (rng() * 2 - 1) * Math.PI;
    const R = edgeRadius(th);
    // Més densitat a prop: és on es veu.
    const r = 0.6 + Math.pow(rng(), 1.5) * (R + 1.2);
    const x = Math.sin(th) * r;
    const z = -Math.cos(th) * r;

    if (inClearZone(x, z, 0.05)) continue;
    if (groundSlope(x, z) > 0.7) continue;
    const c = clumpNoise(x * clump, z * clump) / 0.7;
    if (smoothstep(-0.35 + density, 0.35 + density, c) < rng()) continue;

    const s = minScale + Math.pow(rng(), 1.6) * (maxScale - minScale);
    e.set((rng() - 0.5) * 0.25, rng() * Math.PI * 2, (rng() - 0.5) * 0.25);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, groundHeight(x, z) - 0.01, z), q, new THREE.Vector3(s * 1.15, s, s * 1.15));
    matrices.push(m.clone());

    const tint = tints[Math.floor(rng() * tints.length)];
    const v = 0.88 + rng() * 0.24;
    tintValues.push(tint[0] * v, tint[1] * v, tint[2] * v);
  }

  geometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(new Float32Array(tintValues), 3));
  const mesh = new THREE.InstancedMesh(geometry, grassMaterial(), matrices.length);
  matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

export function createVegetation() {
  const group = new THREE.Group();
  const rng = mulberry32(5);

  group.add(
    scatter({
      geometry: tuftGeometry(rng),
      count: 1300,
      seed: 61,
      minScale: 0.1,
      maxScale: 0.32,
      clump: 0.45,
      tints: [
        [1, 1, 1],
        [1.15, 1.05, 0.8],
        [0.9, 1.05, 1.0]
      ]
    })
  );

  group.add(
    scatter({
      geometry: tuftGeometry(rng, { blades: 14, root: [0.16, 0.15, 0.09], tip: [0.46, 0.43, 0.26] }),
      count: 380,
      seed: 67,
      minScale: 0.22,
      maxScale: 0.42,
      clump: 0.3,
      density: 0.15,
      tints: [[1, 1, 1], [1.1, 1.0, 0.85]]
    })
  );

  group.add(
    scatter({
      geometry: flowerGeometry([0.84, 0.86, 0.9]),
      count: 140,
      seed: 71,
      minScale: 0.1,
      maxScale: 0.2,
      clump: 0.6,
      density: 0.1,
      tints: [[1, 1, 1], [1.0, 0.92, 0.95]]
    })
  );

  group.add(
    scatter({
      geometry: flowerGeometry([0.55, 0.52, 0.86]),
      count: 70,
      seed: 73,
      minScale: 0.09,
      maxScale: 0.16,
      clump: 0.7,
      density: 0.2,
      tints: [[1, 1, 1]]
    })
  );

  return group;
}
