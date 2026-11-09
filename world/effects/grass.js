import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { mulberry32 } from "../core/noise.js";
import { grassMaterial } from "../core/materials.js";
import { groundHeight, SOIL_DEPTH } from "../landscape/terrain.js";
import { generatePavement } from "../landscape/pavement.js";

// Plantes alpines que creixen a les esquerdes entre blocs: tiges llargues i
// primes, algunes amb flor, que es mouen força amb el vent.
// Totes les mides són per a una planta d'alçada 1 (s'escala per instància).

class PlantBuilder {
  constructor(seed) {
    this.rng = mulberry32(seed);
    this.positions = [];
    this.colors = [];
    this.heights = [];
    this.phases = [];
    this.indices = [];
  }

  vertex(x, y, z, color, phase) {
    this.positions.push(x, y, z);
    this.colors.push(color[0], color[1], color[2]);
    this.heights.push(Math.max(0, y));
    this.phases.push(phase);
    return this.positions.length / 3 - 1;
  }

  // Tija corbada (cinta). Retorna el punt final.
  stem({ base, height, lean, dir, width, color, tip = color, phase, segs = 6 }) {
    const px = -Math.sin(dir);
    const pz = Math.cos(dir);
    let prev = null;
    let end = null;
    for (let s = 0; s <= segs; s += 1) {
      const t = s / segs;
      const off = lean * t * t * height;
      const x = base[0] + Math.cos(dir) * off;
      const z = base[1] + Math.sin(dir) * off;
      const y = t * height;
      const w = width * (1 - t * 0.6);
      const col = color.map((c, i) => c + (tip[i] - c) * t);
      const a = this.vertex(x - px * w, y, z - pz * w, col, phase);
      const b = this.vertex(x + px * w, y, z + pz * w, col, phase);
      if (prev) this.indices.push(prev[0], prev[1], a, prev[1], b, a);
      prev = [a, b];
      end = [x, y, z];
    }
    return end;
  }

  // Margarida: disc groc i pètals blancs, una mica inclinada.
  daisy(at, size, petal, phase) {
    const center = this.vertex(at[0], at[1] + size * 0.15, at[2], [0.55, 0.45, 0.15], phase);
    const n = 10;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const r = size;
      const p0 = this.vertex(at[0] + Math.cos(a - 0.14) * r * 0.25, at[1] + size * 0.08, at[2] + Math.sin(a - 0.14) * r * 0.25, petal, phase);
      const p1 = this.vertex(at[0] + Math.cos(a) * r, at[1] - size * 0.15, at[2] + Math.sin(a) * r, petal, phase);
      const p2 = this.vertex(at[0] + Math.cos(a + 0.14) * r * 0.25, at[1] + size * 0.08, at[2] + Math.sin(a + 0.14) * r * 0.25, petal, phase);
      this.indices.push(center, p0, p1, center, p1, p2);
    }
  }

  // Campaneta penjant (lila).
  bell(at, size, color, phase) {
    const n = 6;
    const tip = this.vertex(at[0], at[1], at[2], color, phase);
    const ring = [];
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      ring.push(this.vertex(at[0] + 0.3 * size + Math.cos(a) * size * 0.5, at[1] - size * 1.1, at[2] + Math.sin(a) * size * 0.5, color, phase));
    }
    for (let i = 0; i < n; i += 1) this.indices.push(tip, ring[i], ring[(i + 1) % n]);
  }

  // Espiga de gramínia: petites escates al llarg del final de la tija.
  spike(base, dir, height, color, phase) {
    for (let i = 0; i < 7; i += 1) {
      const t = 0.7 + i * 0.045;
      const y = height * t;
      const off = 0.06 * (t * t) * height;
      const x = base[0] + Math.cos(dir) * off;
      const z = base[1] + Math.sin(dir) * off;
      const side = i % 2 === 0 ? 1 : -1;
      const a = this.vertex(x, y, z, color, phase);
      const b = this.vertex(x + side * 0.025, y + 0.05, z + 0.01, color, phase);
      const c = this.vertex(x + side * 0.008, y + 0.07, z - 0.01, color, phase);
      this.indices.push(a, b, c);
    }
  }

  // Fulles basals primes i arquejades.
  leaves(count, color, phase) {
    for (let i = 0; i < count; i += 1) {
      const dir = this.rng() * Math.PI * 2;
      this.stem({
        base: [(this.rng() - 0.5) * 0.04, (this.rng() - 0.5) * 0.04],
        height: 0.18 + this.rng() * 0.18,
        lean: 1.2 + this.rng() * 0.8,
        dir,
        width: 0.012,
        color: [0.05, 0.06, 0.035],
        tip: color,
        phase: phase + this.rng() * 0.2,
        segs: 4
      });
    }
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(this.positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setAttribute("aHeight", new THREE.Float32BufferAttribute(this.heights, 1));
    geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(this.phases, 1));
    geo.setIndex(this.indices);
    return geo;
  }
}

const STEM = [0.07, 0.085, 0.05];
const STEM_TIP = [0.16, 0.17, 0.09];
const STRAW = [0.3, 0.25, 0.14];

// Varietats de mates. Cada una és una geometria que es repeteix moltes vegades.
const VARIETIES = [
  {
    name: "margarides",
    weight: 0.3,
    build(b) {
      b.leaves(5, [0.14, 0.16, 0.08], 0);
      const n = 2 + Math.floor(b.rng() * 3);
      for (let i = 0; i < n; i += 1) {
        const dir = b.rng() * Math.PI * 2;
        const phase = b.rng();
        const h = 0.75 + b.rng() * 0.3;
        const end = b.stem({ base: [(b.rng() - 0.5) * 0.05, (b.rng() - 0.5) * 0.05], height: h, lean: 0.15 + b.rng() * 0.25, dir, width: 0.006, color: STEM, tip: STEM_TIP, phase });
        b.daisy(end, 0.07 + b.rng() * 0.03, [0.62, 0.62, 0.6], phase);
      }
    }
  },
  {
    name: "campanetes",
    weight: 0.22,
    build(b) {
      b.leaves(4, [0.12, 0.14, 0.07], 0);
      const n = 2 + Math.floor(b.rng() * 3);
      for (let i = 0; i < n; i += 1) {
        const dir = b.rng() * Math.PI * 2;
        const phase = b.rng();
        const h = 0.65 + b.rng() * 0.35;
        const end = b.stem({ base: [(b.rng() - 0.5) * 0.05, (b.rng() - 0.5) * 0.05], height: h, lean: 0.35 + b.rng() * 0.3, dir, width: 0.005, color: STEM, tip: STEM_TIP, phase });
        b.bell(end, 0.05 + b.rng() * 0.015, [0.34, 0.3, 0.55], phase);
      }
    }
  },
  {
    name: "gramínies",
    weight: 0.48,
    build(b) {
      b.leaves(6, STRAW, 0);
      const n = 4 + Math.floor(b.rng() * 5);
      for (let i = 0; i < n; i += 1) {
        const dir = b.rng() * Math.PI * 2;
        const phase = b.rng();
        const h = 0.7 + b.rng() * 0.45;
        const base = [(b.rng() - 0.5) * 0.06, (b.rng() - 0.5) * 0.06];
        b.stem({ base, height: h, lean: 0.06 + b.rng() * 0.12, dir, width: 0.004, color: STEM, tip: STRAW, phase });
        b.spike(base, dir, h, [0.34, 0.29, 0.17], phase);
      }
    }
  }
];

export function createVegetation() {
  const group = new THREE.Group();
  const rng = mulberry32(5);
  const { spots } = generatePavement();

  // Diverses variants de cada mena perquè no es repeteixin.
  const variants = [];
  VARIETIES.forEach((v, vi) => {
    for (let k = 0; k < 3; k += 1) {
      const b = new PlantBuilder(100 + vi * 10 + k);
      v.build(b);
      variants.push({ geo: b.build(), weight: v.weight / 3, items: [] });
    }
  });

  const total = variants.reduce((a, v) => a + v.weight, 0);
  spots.forEach((spot) => {
    let r = rng() * total;
    const v = variants.find((x) => (r -= x.weight) <= 0) || variants[0];
    v.items.push(spot);
  });

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  variants.forEach(({ geo, items }) => {
    if (!items.length) return;
    const tints = [];
    const mesh = new THREE.InstancedMesh(geo, grassMaterial(), items.length);
    items.forEach(({ x, z, size }, i) => {
      const h = (0.3 + Math.pow(rng(), 1.3) * 0.34) * size;
      q.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.25, rng() * Math.PI * 2, (rng() - 0.5) * 0.25));
      // Neix al fons de l'esquerda, entre els blocs.
      m.compose(new THREE.Vector3(x, groundHeight(x, z) - SOIL_DEPTH + 0.01, z), q, new THREE.Vector3(h, h, h));
      mesh.setMatrixAt(i, m);
      const v = 0.85 + rng() * 0.3;
      tints.push(v, v, v * (0.9 + rng() * 0.2));
    });
    geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(new Float32Array(tints), 3));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });

  return group;
}
