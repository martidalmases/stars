import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { mulberry32 } from "../core/noise.js";
import { stylizedMaterial } from "../core/materials.js";
import { groundHeight, edgeRadius, campWeight } from "./terrain.js";
import { inClearZone } from "../bivac/layout.js";

// Esquerdes a la roca del cim. Són línies que avancen fent ziga-zagues i a vegades
// es bifurquen. Les plantes només creixen dins d'aquestes esquerdes.

let cached = null;

export function generateCracks() {
  if (cached) return cached;
  const rng = mulberry32(1234);
  const cracks = [];

  function walk(x, z, heading, steps, width) {
    const pts = [];
    for (let i = 0; i < steps; i += 1) {
      const r = Math.hypot(x, z);
      const th = Math.atan2(x, -z);
      if (r > edgeRadius(th) + 0.6) break;
      if (inClearZone(x, z, 0.08)) break;
      pts.push({ x, z });
      heading += (rng() - 0.5) * 0.7;
      const step = 0.07 + rng() * 0.07;
      x += Math.cos(heading) * step;
      z += Math.sin(heading) * step;

      if (i > 6 && rng() < 0.035 && width > 0.012) {
        walk(x, z, heading + (rng() < 0.5 ? 1 : -1) * (0.6 + rng() * 0.6), Math.floor(steps * 0.5), width * 0.65);
      }
    }
    if (pts.length > 4) cracks.push({ points: pts, width });
  }

  let tries = 0;
  while (cracks.length < 70 && tries < 600) {
    tries += 1;
    const th = (rng() * 2 - 1) * Math.PI;
    const r = 0.8 + rng() * (edgeRadius(th) - 0.5);
    const x = Math.sin(th) * r;
    const z = -Math.cos(th) * r;
    if (inClearZone(x, z, 0.15)) continue;
    // Al campament (terra trepitjada) n'hi ha menys.
    if (campWeight(x, z) < 0.5 && rng() < 0.7) continue;
    walk(x, z, rng() * Math.PI * 2, 14 + Math.floor(rng() * 30), 0.014 + rng() * 0.022);
  }

  cached = cracks;
  return cracks;
}

// Punts al llarg de les esquerdes on creixen les plantes.
export function crackPlantSpots(seed = 5, spacing = 0.42) {
  const rng = mulberry32(seed);
  const spots = [];
  generateCracks().forEach(({ points, width }) => {
    let acc = rng() * spacing;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      acc += Math.hypot(b.x - a.x, b.z - a.z);
      if (acc >= spacing) {
        acc = rng() * spacing * 0.6;
        spots.push({ x: b.x + (rng() - 0.5) * 0.03, z: b.z + (rng() - 0.5) * 0.03, size: width / 0.036 });
      }
    }
  });
  return spots;
}

export function createCrackMesh() {
  const positions = [];
  const indices = [];

  generateCracks().forEach(({ points, width }) => {
    const n = points.length;
    const start = positions.length / 3;
    for (let i = 0; i < n; i += 1) {
      const p = points[i];
      const q = points[Math.min(n - 1, i + 1)];
      const o = points[Math.max(0, i - 1)];
      let dx = q.x - o.x;
      let dz = q.z - o.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const t = i / (n - 1);
      const w = width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)), 0.6) * 0.5;
      const y = groundHeight(p.x, p.z) + 0.012;
      positions.push(p.x - dz * w, y, p.z + dx * w, p.x + dz * w, y, p.z - dx * w);
    }
    for (let i = 0; i < n - 1; i += 1) {
      const a = start + i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(indices);

  const mat = stylizedMaterial({ color: [0.015, 0.015, 0.02], side: THREE.DoubleSide });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -4;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
