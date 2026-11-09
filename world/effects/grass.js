import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { mulberry32 } from "../core/noise.js";
import { grassMaterial } from "../core/materials.js";
import { groundHeight, groundSlope, edgeRadius } from "../landscape/terrain.js";
import { nearestSlabDistance } from "../landscape/slabs.js";
import { inClearZone } from "../bivac/layout.js";
import { createNoise2D, smoothstep } from "../core/noise.js";

// Geometria d'una mata d'herba (alçada 1, s'escala per instància).
function tuftGeometry(rng, { blades = 9, root = [0.05, 0.06, 0.04], tip = [0.22, 0.2, 0.12], width = 1, spread = 0.12, lean = 1 } = {}) {
  const positions = [];
  const colors = [];
  const heights = [];
  const indices = [];
  const segs = 4;

  for (let b = 0; b < blades; b += 1) {
    const facing = rng() * Math.PI * 2;
    const leanDir = rng() * Math.PI * 2;
    const leanAmt = (0.12 + rng() * 0.4) * lean;
    const h = 0.55 + rng() * 0.45;
    const w = (0.045 + rng() * 0.035) * width;
    const bx = (rng() - 0.5) * spread;
    const bz = (rng() - 0.5) * spread;
    const px = Math.cos(facing);
    const pz = Math.sin(facing);
    const start = positions.length / 3;

    for (let s = 0; s <= segs; s += 1) {
      const t = s / segs;
      const width = w * Math.pow(1 - t, 0.85) + 0.002;
      const off = leanAmt * t * t * h;
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
function flowerGeometry(petal = [0.6, 0.62, 0.66]) {
  const positions = [];
  const colors = [];
  const heights = [];
  const indices = [];
  const stem = [0.09, 0.11, 0.07];
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
  colors.push(0.6, 0.48, 0.2);
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

// Planta les mates als punts donats (a les esquerdes).
function plantAt({ geometry, spots, seed, minScale, maxScale, tints, keep = 1 }) {
  const rng = mulberry32(seed);
  const matrices = [];
  const tintValues = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();

  spots.forEach(({ x, z, size }) => {
    if (rng() > keep) return;
    const s = (minScale + Math.pow(rng(), 1.4) * (maxScale - minScale)) * (0.75 + 0.35 * Math.min(1.3, size));
    e.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, groundHeight(x, z) - 0.015, z), q, new THREE.Vector3(s * 0.9, s, s * 0.9));
    matrices.push(m.clone());
    const tint = tints[Math.floor(rng() * tints.length)];
    const v = 0.85 + rng() * 0.3;
    tintValues.push(tint[0] * v, tint[1] * v, tint[2] * v);
  });

  geometry.setAttribute("aTint", new THREE.InstancedBufferAttribute(new Float32Array(tintValues), 3));
  const mesh = new THREE.InstancedMesh(geometry, grassMaterial(), matrices.length);
  matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

// Llocs on té sentit que creixi herba: sòl entre lloses, sobretot arran de les
// vores (on s'acumula terra), mai sobre la roca ni als pendents forts.
function meadowSpots({ seed, count, maxExtra = 1.0 }) {
  const rng = mulberry32(seed);
  const meadow = createNoise2D(seed + 1);
  const spots = [];
  for (let attempt = 0; attempt < count * 20 && spots.length < count; attempt += 1) {
    const th = (rng() * 2 - 1) * Math.PI;
    const r = 0.5 + Math.pow(rng(), 0.85) * (edgeRadius(th) + maxExtra);
    const x = Math.sin(th) * r;
    const z = -Math.cos(th) * r;
    if (inClearZone(x, z, 0.02)) continue;
    if (groundSlope(x, z) > 0.75) continue;
    const d = nearestSlabDistance(x, z);
    if (d < 0.02) continue;
    // Més probable a tocar de la roca i on el prat és més dens.
    const edge = 1 - smoothstep(0.03, 0.6, d);
    const field = smoothstep(-0.4, 0.4, meadow(x * 0.4, z * 0.4) / 0.7);
    if (rng() > 0.15 + edge * 0.6 + field * 0.35) continue;
    spots.push({ x, z, size: 0.7 + edge * 0.5 });
  }
  return spots;
}

export function createVegetation() {
  const group = new THREE.Group();
  const rng = mulberry32(5);
  const grassSpots = meadowSpots({ seed: 5, count: 1600 });
  const flowerSpots = meadowSpots({ seed: 9, count: 230 });

  // Herba alpina: fulles fines i llargues.
  group.add(
    plantAt({
      geometry: tuftGeometry(rng, { blades: 14, width: 0.3, spread: 0.07, lean: 1.2, root: [0.035, 0.04, 0.025], tip: [0.2, 0.19, 0.11] }),
      spots: grassSpots,
      seed: 61,
      minScale: 0.12,
      maxScale: 0.3,
      tints: [[1, 1, 1], [1.3, 1.05, 0.7], [0.85, 0.95, 1.0]]
    })
  );

  // Flors blanques i liles, com a la primera versió.
  group.add(
    plantAt({
      geometry: flowerGeometry([0.62, 0.64, 0.68]),
      spots: flowerSpots.filter((_, i) => i % 3 !== 0),
      seed: 71,
      minScale: 0.12,
      maxScale: 0.22,
      tints: [[1, 1, 1], [1.0, 0.92, 0.95]]
    })
  );
  group.add(
    plantAt({
      geometry: flowerGeometry([0.38, 0.34, 0.6]),
      spots: flowerSpots.filter((_, i) => i % 3 === 0),
      seed: 73,
      minScale: 0.1,
      maxScale: 0.18,
      tints: [[1, 1, 1]]
    })
  );

  return group;
}
