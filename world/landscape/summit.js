import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { createNoise2D, mulberry32, smoothstep, clamp } from "../core/noise.js";
import { stylizedMaterial } from "../core/materials.js";
import { groundHeight, groundSlope, campWeight, edgeRadius } from "./terrain.js";
import { LAYOUT, inClearZone } from "../bivac/layout.js";

// ------------------------------------------------------------------
// Terra del cim
// ------------------------------------------------------------------
function createGround() {
  const nT = 150;
  const nR = 72;
  const maxR = 60;
  const patch = createNoise2D(31);
  const patch2 = createNoise2D(37);

  const positions = [];
  const colors = [];
  const indices = [];

  const grass = [0.2, 0.235, 0.15];
  const dryGrass = [0.3, 0.29, 0.19];
  const rock = [0.35, 0.345, 0.37];
  const gravel = [0.29, 0.27, 0.255];

  for (let j = 0; j <= nR; j += 1) {
    const r = maxR * Math.pow(j / nR, 1.75);
    for (let i = 0; i <= nT; i += 1) {
      const th = (i / nT) * Math.PI * 2;
      const x = Math.sin(th) * r;
      const z = -Math.cos(th) * r;
      const y = groundHeight(x, z);
      positions.push(x, y, z);

      const slope = groundSlope(x, z);
      const p = patch(x * 0.35, z * 0.35) / 0.7;
      const p2 = patch2(x * 1.2, z * 1.2) / 0.7;
      const grassAmt = smoothstep(-0.25, 0.35, p) * (1 - smoothstep(0.35, 0.8, slope));
      const rockAmt = smoothstep(0.45, 1.1, slope);
      const c = [0, 0, 0];
      for (let k = 0; k < 3; k += 1) {
        let v = gravel[k] + (dryGrass[k] - gravel[k]) * smoothstep(-0.4, 0.6, p2) * 0.5;
        v += (grass[k] - v) * grassAmt;
        v += (rock[k] - v) * rockAmt;
        // Al campament, terra trepitjada.
        v += (gravel[k] - v) * (1 - campWeight(x, z)) * 0.55;
        c[k] = v * (0.92 + 0.16 * p2);
      }
      colors.push(c[0], c[1], c[2]);
    }
  }

  const row = nT + 1;
  for (let j = 0; j < nR; j += 1) {
    for (let i = 0; i < nT; i += 1) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, stylizedMaterial({ flat: true, vertexColors: true }));
  mesh.frustumCulled = false;
  return mesh;
}

// ------------------------------------------------------------------
// Roques: totes en una sola malla
// ------------------------------------------------------------------
class RockBuilder {
  constructor(seed) {
    this.rng = mulberry32(seed);
    this.noise = createNoise2D(seed + 5);
    this.positions = [];
    this.colors = [];
  }

  add({ x, y, z, sx, sy, sz, rotY = 0, tilt = 0, color = null, roughness = 0.32, flatTop = false }) {
    const base = new THREE.IcosahedronGeometry(1, 1);
    const pos = base.attributes.position;
    const seed = this.rng() * 100;
    const v = new THREE.Vector3();
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.6)),
      new THREE.Vector3(sx, sy, sz)
    );

    const shade = 0.88 + this.rng() * 0.24;
    const warm = this.rng() * 0.04;
    const col = color || [0.37 * shade + warm, 0.36 * shade + warm * 0.6, 0.39 * shade];

    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      const n =
        this.noise(v.x * 1.4 + seed, v.y * 1.4) / 0.7 +
        (this.noise(v.z * 1.4, v.x * 1.4 + seed) / 0.7) * 0.6;
      let d = 1 + roughness * n * 0.6;
      // Base aplanada perquè les roques reposin a terra.
      if (v.y < -0.35) d *= 0.85;
      v.multiplyScalar(d);
      if (v.y < -0.45) v.y = -0.45 - (v.y + 0.45) * 0.3;
      if (flatTop && v.y > 0.55) v.y = 0.55;
      v.applyMatrix4(m);
      this.positions.push(v.x, v.y, v.z);
      const lichen = clamp(n * 0.5 + 0.2, 0, 1) * 0.05;
      this.colors.push(col[0] - lichen * 0.3, col[1] + lichen * 0.2, col[2] - lichen);
    }
    base.dispose();
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(this.colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, stylizedMaterial({ flat: true, vertexColors: true }));
    mesh.frustumCulled = false;
    return mesh;
  }
}

function addScatteredRocks(builder) {
  const rng = mulberry32(42);
  let placed = 0;

  for (let attempt = 0; attempt < 400 && placed < 120; attempt += 1) {
    const th = (rng() * 2 - 1) * Math.PI;
    const R = edgeRadius(th);
    const r = 1.4 + Math.pow(rng(), 0.75) * (R + 3);
    const x = Math.sin(th) * r;
    const z = -Math.cos(th) * r;

    const s = 0.05 + Math.pow(rng(), 3.2) * 0.6;
    if (inClearZone(x, z, s + 0.1)) continue;
    if (s > 0.12 && campWeight(x, z) < 0.6) continue;

    const flat = 0.45 + rng() * 0.35;
    builder.add({
      x,
      y: groundHeight(x, z) + s * 0.1,
      z,
      sx: s * (0.9 + rng() * 0.6),
      sy: s * flat,
      sz: s * (0.9 + rng() * 0.6),
      rotY: rng() * Math.PI * 2,
      tilt: (rng() - 0.5) * 0.5
    });
    placed += 1;
  }

  // Blocs grans a les vores del cim per emmarcar la vista.
  const outcrops = [
    { th: -0.95, r: 7.6, s: 1.7 },
    { th: -1.38, r: 5.6, s: 1.15 },
    { th: -1.75, r: 4.6, s: 0.9 },
    { th: 1.02, r: 8.2, s: 2.3 },
    { th: 1.48, r: 6.3, s: 1.35 },
    { th: 1.85, r: 5.0, s: 1.0 },
    { th: 0.38, r: 10.6, s: 1.4 },
    { th: -0.42, r: 11.2, s: 1.05 },
    { th: 0.05, r: 12.5, s: 0.8 }
  ];
  outcrops.forEach(({ th, r, s }) => {
    const x = Math.sin(th) * r;
    const z = -Math.cos(th) * r;
    builder.add({
      x,
      y: groundHeight(x, z) + s * 0.05,
      z,
      sx: s * (1.1 + rng() * 0.4),
      sy: s * (0.55 + rng() * 0.25),
      sz: s * (0.9 + rng() * 0.4),
      rotY: rng() * Math.PI,
      tilt: (rng() - 0.5) * 0.35,
      roughness: 0.4
    });
    // Una pedra petita al costat.
    const a = rng() * Math.PI * 2;
    const x2 = x + Math.cos(a) * s * 1.3;
    const z2 = z + Math.sin(a) * s * 1.3;
    builder.add({
      x: x2,
      y: groundHeight(x2, z2),
      z: z2,
      sx: s * 0.42,
      sy: s * 0.3,
      sz: s * 0.38,
      rotY: rng() * 3
    });
  });
}

function addFita(builder) {
  const { x, z } = LAYOUT.fita;
  const rng = mulberry32(7);
  let y = groundHeight(x, z) + 0.02;
  const radii = [0.44, 0.38, 0.33, 0.28, 0.24, 0.2, 0.16, 0.12];
  radii.forEach((r, i) => {
    const sy = r * (0.34 + rng() * 0.1);
    builder.add({
      x: x + (rng() - 0.5) * 0.06 * i,
      y: y + sy * 0.7,
      z: z + (rng() - 0.5) * 0.06 * i,
      sx: r,
      sy,
      sz: r * (0.85 + rng() * 0.2),
      rotY: rng() * Math.PI,
      tilt: (rng() - 0.5) * 0.12,
      roughness: 0.22
    });
    y += sy * 1.25;
  });
}

function addSlab(builder) {
  const { x, z, sx, sz } = LAYOUT.slab;
  builder.add({
    x,
    y: groundHeight(x, z) + 0.035,
    z,
    sx,
    sy: 0.08,
    sz,
    rotY: 0.35,
    roughness: 0.12,
    flatTop: true
  });
}

// Alçada de la part superior de la llosa (per posar-hi el fanalet i les tasses).
export function slabTopY() {
  const { x, z } = LAYOUT.slab;
  return groundHeight(x, z) + 0.035 + 0.08 * 0.55;
}

export function createSummit() {
  const group = new THREE.Group();
  group.add(createGround());

  const rocks = new RockBuilder(11);
  addScatteredRocks(rocks);
  addFita(rocks);
  addSlab(rocks);
  group.add(rocks.build());

  return group;
}
