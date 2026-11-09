import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { createNoise2D, mulberry32, smoothstep } from "../core/noise.js";
import { stylizedMaterial } from "../core/materials.js";
import { groundHeight, groundSlope, edgeRadius, RIDGE_AZ, UPPER_AZ } from "./terrain.js";
import { LAYOUT, inClearZone } from "../bivac/layout.js";
import { generateSlabs } from "./slabs.js";

// ------------------------------------------------------------------
// Terra del cim (sòl, sota les lloses i l'herba)
// ------------------------------------------------------------------
function createGround() {
  const nT = 220;
  const nR = 120;
  const maxR = 500;
  const patch = createNoise2D(31);

  const positions = [];
  const colors = [];
  const indices = [];

  const soil = [0.12, 0.11, 0.085];
  const scree = [0.2, 0.2, 0.21];

  for (let j = 0; j <= nR; j += 1) {
    const r = maxR * Math.pow(j / nR, 2.3);
    for (let i = 0; i <= nT; i += 1) {
      const th = (i / nT) * Math.PI * 2;
      const x = Math.sin(th) * r;
      const z = -Math.cos(th) * r;
      positions.push(x, groundHeight(x, z), z);

      // Als pendents forts, tartera (pedra solta) en lloc de sòl.
      const slope = groundSlope(x, z);
      const p = patch(x * 0.3, z * 0.3) / 0.7;
      const k = smoothstep(0.55, 1.1, slope + p * 0.2);
      colors.push(
        soil[0] + (scree[0] - soil[0]) * k,
        soil[1] + (scree[1] - soil[1]) * k,
        soil[2] + (scree[2] - soil[2]) * k
      );
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

  const mesh = new THREE.Mesh(geo, stylizedMaterial({ vertexColors: true, rock: "ground" }));
  mesh.frustumCulled = false;
  return mesh;
}

// ------------------------------------------------------------------
// Roques: totes en una sola malla
// ------------------------------------------------------------------
class RockBuilder {
  // flat: facetes marcades (pedres trencades); si no, superfície suau (granit rodat).
  constructor(seed, { flat = true } = {}) {
    this.rng = mulberry32(seed);
    this.noise = createNoise2D(seed + 5);
    this.flat = flat;
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
  }

  // euler: rotació explícita [x, y, z] (si no, es fa servir tilt/rotY).
  add({ x, y, z, sx, sy, sz, rotY = 0, tilt = 0, euler = null, color = null, roughness = 0.32, flatTop = false, cuts = 3, detail = 1, noiseScale = 1.4 }) {
    const base = new THREE.IcosahedronGeometry(1, detail);
    const src = base.attributes.position;

    // Uneix els vèrtexs repetits per poder fer normals suaus.
    const map = new Map();
    const unique = [];
    const index = [];
    for (let i = 0; i < src.count; i += 1) {
      const key = `${src.getX(i).toFixed(4)},${src.getY(i).toFixed(4)},${src.getZ(i).toFixed(4)}`;
      let id = map.get(key);
      if (id === undefined) {
        id = unique.length;
        map.set(key, id);
        unique.push(new THREE.Vector3(src.getX(i), src.getY(i), src.getZ(i)));
      }
      index.push(id);
    }
    base.dispose();

    const planes = [];
    for (let c = 0; c < cuts; c += 1) {
      const n = new THREE.Vector3(this.rng() * 2 - 1, this.rng() * 1.2 - 0.2, this.rng() * 2 - 1).normalize();
      planes.push({ n, d: 0.55 + this.rng() * 0.3 });
    }
    const seed = this.rng() * 100;
    const rot = euler ? new THREE.Euler(euler[0], euler[1], euler[2], "YXZ") : new THREE.Euler(tilt, rotY, tilt * 0.6);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(rot),
      new THREE.Vector3(sx, sy, sz)
    );

    const shade = 0.85 + this.rng() * 0.3;
    const warm = (this.rng() - 0.3) * 0.035;
    const col = color || [0.27 * shade + warm, 0.26 * shade + warm * 0.5, 0.255 * shade - warm * 0.2];

    const pos = [];
    unique.forEach((v0) => {
      const v = v0.clone();
      const n =
        this.noise(v.x * noiseScale + seed, v.y * noiseScale) / 0.7 +
        (this.noise(v.z * noiseScale, v.x * noiseScale + seed) / 0.7) * 0.6;
      let d = 1 + roughness * n * 0.6;
      if (v.y < -0.35) d *= 0.85;
      v.multiplyScalar(d);
      if (v.y < -0.45) v.y = -0.45;
      if (flatTop && v.y > 0.55) v.y = 0.55;
      planes.forEach(({ n: pn, d: pd }) => {
        const k = v.dot(pn);
        if (k > pd) v.addScaledVector(pn, pd - k);
      });
      v.applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    const nrm = g.attributes.normal.array;

    const offset = this.positions.length / 3;
    for (let i = 0; i < pos.length; i += 1) {
      this.positions.push(pos[i]);
      this.normals.push(nrm[i]);
    }
    for (let i = 0; i < unique.length; i += 1) this.colors.push(col[0], col[1], col[2]);
    index.forEach((id) => this.indices.push(id + offset));
    g.dispose();
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setIndex(this.indices);
    const mesh = new THREE.Mesh(geo, stylizedMaterial({ flat: this.flat, vertexColors: true, rock: "block" }));
    mesh.frustumCulled = false;
    return mesh;
  }
}

// Blocs de granit arrodonits que afloren entre la molsa i l'herba.
function addBoulders(builder) {
  generateSlabs().forEach((s) => {
    builder.add({
      x: s.x,
      y: s.y,
      z: s.z,
      sx: s.length / 2,
      sy: s.thick,
      sz: s.width / 2,
      euler: [s.dip, s.yaw, s.roll],
      roughness: 0.22,
      noiseScale: 1.1,
      cuts: 2,
      detail: s.length > 1.2 ? 3 : 2
    });
  });
}

// Pedretes soltes.
function addPebbles(builder) {
  const rng = mulberry32(42);
  let placed = 0;
  for (let attempt = 0; attempt < 400 && placed < 90; attempt += 1) {
    const th = (rng() * 2 - 1) * Math.PI;
    const r = 0.9 + Math.pow(rng(), 0.7) * (edgeRadius(th) + 1);
    const x = Math.sin(th) * r;
    const z = -Math.cos(th) * r;
    const s = 0.04 + Math.pow(rng(), 3) * 0.16;
    if (inClearZone(x, z, s + 0.05)) continue;
    builder.add({
      x,
      y: groundHeight(x, z) + s * 0.15,
      z,
      sx: s * (0.9 + rng() * 0.6),
      sy: s * (0.5 + rng() * 0.3),
      sz: s * (0.9 + rng() * 0.6),
      rotY: rng() * 6,
      detail: 0
    });
    placed += 1;
  }
}

// Blocs grans a l'avantcim (esquerra) i algun a la dreta.
function addOutcrops(builder) {
  const rng = mulberry32(77);
  const list = [
    { th: -1.05, r: 5.6, s: 1.1 },
    { th: -1.38, r: 6.4, s: 1.6 },
    { th: -1.75, r: 5.6, s: 1.3 },
    { th: -2.08, r: 5.0, s: 0.95 },
    { th: 1.4, r: 4.9, s: 0.8 },
    { th: 1.7, r: 5.5, s: 1.1 }
  ];
  list.forEach(({ th, r, s }) => {
    const x = Math.sin(th) * r;
    const z = -Math.cos(th) * r;
    builder.add({
      x,
      y: groundHeight(x, z) + s * 0.1,
      z,
      sx: s * (1.0 + rng() * 0.4),
      sy: s * (0.6 + rng() * 0.3),
      sz: s * (0.8 + rng() * 0.4),
      euler: [(rng() - 0.5) * 0.3, rng() * Math.PI, 0.25 + rng() * 0.2],
      roughness: 0.3,
      cuts: 4
    });
  });

  // Cresta de l'avantcim: blocs grans i torres que retallen el cel.
  const up = [Math.sin((UPPER_AZ * Math.PI) / 180), -Math.cos((UPPER_AZ * Math.PI) / 180)];
  const side = [-up[1], up[0]];
  for (let i = 0; i < 9; i += 1) {
    const a = 7 + i * 1.5 + rng();
    const c = (rng() - 0.5) * 4;
    const x = up[0] * a + side[0] * c;
    const z = up[1] * a + side[1] * c;
    const s = 0.9 + rng() * 1.4;
    builder.add({
      x,
      y: groundHeight(x, z) + s * 0.2,
      z,
      sx: s * (0.7 + rng() * 0.5),
      sy: s * (0.9 + rng() * 0.9),
      sz: s * (0.6 + rng() * 0.4),
      euler: [(rng() - 0.5) * 0.25, rng() * Math.PI, 0.3],
      roughness: 0.35,
      cuts: 4
    });
  }
}

// Blocs dispersos al llarg de la carena (no gaire grans): en marquen el fil.
function addRidgeRocks(builder) {
  const rng = mulberry32(91);
  const dir = [Math.sin((RIDGE_AZ * Math.PI) / 180), -Math.cos((RIDGE_AZ * Math.PI) / 180)];
  for (let i = 0; i < 70; i += 1) {
    const a = 6 + Math.pow(rng(), 1.3) * 120;
    const c = (rng() - 0.5) * (3 + a * 0.08);
    const x = dir[0] * a + dir[1] * c;
    const z = dir[1] * a - dir[0] * c;
    const s = (0.4 + Math.pow(rng(), 2) * 1.3) * (1 + a * 0.012);
    builder.add({
      x,
      y: groundHeight(x, z) - s * 0.15,
      z,
      sx: s * (0.8 + rng() * 0.5),
      sy: s * (0.45 + rng() * 0.3),
      sz: s * (0.7 + rng() * 0.4),
      euler: [(rng() - 0.5) * 0.3, rng() * Math.PI, (rng() - 0.5) * 0.3],
      roughness: 0.3,
      cuts: 3,
      detail: 2
    });
  }
}

function addFita(builder) {
  const { x, z } = LAYOUT.fita;
  const rng = mulberry32(7);
  let y = groundHeight(x, z) - 0.03;
  const radii = [0.4, 0.36, 0.31, 0.27, 0.23, 0.19, 0.15, 0.11];
  radii.forEach((r, i) => {
    const sy = r * (0.46 + rng() * 0.12);
    const ox = i === 0 ? 0 : (rng() - 0.5) * 0.035;
    const oz = i === 0 ? 0 : (rng() - 0.5) * 0.035;
    builder.add({
      x: x + ox,
      y: y + sy * 0.45,
      z: z + oz,
      sx: r,
      sy,
      sz: r * (0.82 + rng() * 0.18),
      rotY: rng() * Math.PI,
      roughness: 0.18,
      flatTop: true,
      cuts: 2
    });
    y += sy * 0.97;
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
    roughness: 0.1,
    flatTop: true,
    cuts: 0
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

  // Granit rodat (suau).
  const smooth = new RockBuilder(11, { flat: false });
  addBoulders(smooth);
  addOutcrops(smooth);
  addRidgeRocks(smooth);
  group.add(smooth.build());

  // Pedres trencades (facetes): pedretes, fita i la llosa del fanal.
  const sharp = new RockBuilder(12, { flat: true });
  addPebbles(sharp);
  addFita(sharp);
  addSlab(sharp);
  group.add(sharp.build());

  return group;
}
