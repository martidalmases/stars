// Paviment de granit: el cim és una plataforma de blocs separats per diàclasis
// (esquerdes rectes), com a la foto de referència però en horitzontal.
// Es fa amb un diagrama de Voronoi sobre una graella allargada: blocs
// poligonals, més llargs en la direcció de les diàclasis principals.
// Funcions pures (sense three.js).

import { mulberry32, createNoise2D } from "../core/noise.js";
import { groundHeight, GROUND_Y } from "./terrain.js";
import { inClearZone } from "../bivac/layout.js";

const STRIKE = 0.45; // direcció de les diàclasis principals (radians)
const ALONG = 1.35; // mida dels blocs al llarg (m)
const ACROSS = 0.8; // mida dels blocs de través (m)
const EXTENT = 22; // radi de la zona amb paviment (m)

let cached = null;

function clip(poly, nx, nz, d) {
  // Queda la part on nx*x + nz*z <= d.
  const out = [];
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + nz * a[1] - d;
    const db = nx * b[0] + nz * b[1] - d;
    if (da <= 0) out.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function generatePavement() {
  if (cached) return cached;
  const rng = mulberry32(777);
  const jitterNoise = createNoise2D(13);
  const c = Math.cos(STRIKE);
  const s = Math.sin(STRIKE);
  const toWorld = (u, v) => [u * c - v * s, u * s + v * c];

  const n = Math.ceil(EXTENT / ACROSS) + 3;
  const pts = new Map();
  const key = (i, j) => `${i},${j}`;
  const site = (i, j) => {
    const k = key(i, j);
    if (!pts.has(k)) {
      const r1 = mulberry32((i * 92821) ^ (j * 68917) ^ 0x5bd1);
      // Fileres una mica desplaçades (com maons) + soroll.
      const shift = (j % 2) * 0.45;
      pts.set(k, [
        (i + 0.5 + shift + (r1() - 0.5) * 0.55) * ALONG,
        (j + 0.5 + (r1() - 0.5) * 0.45 + jitterNoise(i * 0.3, j * 0.3) * 0.3) * ACROSS
      ]);
    }
    return pts.get(k);
  };

  const blocks = [];
  for (let i = -n; i <= n; i += 1) {
    for (let j = -n * 2; j <= n * 2; j += 1) {
      const p = site(i, j);
      const center = toWorld(p[0], p[1]);
      if (Math.hypot(center[0], center[1]) > EXTENT) continue;

      // Cel·la de Voronoi en coordenades locals (escalades perquè siguin isòtropes).
      let poly = [
        [p[0] - ALONG * 2, p[1] - ACROSS * 3],
        [p[0] + ALONG * 2, p[1] - ACROSS * 3],
        [p[0] + ALONG * 2, p[1] + ACROSS * 3],
        [p[0] - ALONG * 2, p[1] + ACROSS * 3]
      ];
      for (let di = -2; di <= 2; di += 1) {
        for (let dj = -3; dj <= 3; dj += 1) {
          if (di === 0 && dj === 0) continue;
          const q = site(i + di, j + dj);
          // Mètrica allargada: les cel·les queden més llargues al llarg de STRIKE.
          const sx = 1 / (ALONG * ALONG);
          const sz = 1 / (ACROSS * ACROSS);
          const nx = (q[0] - p[0]) * sx;
          const nz = (q[1] - p[1]) * sz;
          const mx = (p[0] + q[0]) / 2;
          const mz = (p[1] + q[1]) / 2;
          poly = clip(poly, nx, nz, nx * mx + nz * mz);
          if (poly.length < 3) break;
        }
      }
      if (poly.length < 3) continue;

      const world = poly.map(([u, v]) => toWorld(u, v));
      let cx = 0;
      let cz = 0;
      world.forEach(([x, z]) => {
        cx += x;
        cz += z;
      });
      cx /= world.length;
      cz /= world.length;

      const ground = groundHeight(cx, cz);
      if (ground < GROUND_Y - 8) continue;
      // Sota el bivac els blocs queden enrasats amb el terra (les esterilles hi
      // reposen a sobre); no se'n treu cap.
      const flush = world.some(([x, z]) => inClearZone(x, z, 0.05));

      const pit = !flush && rng() < 0.07; // forat de terra (sense bloc): hi creixen plantes
      blocks.push({ poly: world, cx, cz, ground, pit, flush, seed: Math.floor(rng() * 1e6) });
    }
  }

  // Punts dins les esquerdes (on creixen les plantes).
  const spots = [];
  blocks.forEach((b) => {
    const r = mulberry32(b.seed);
    if (b.pit) {
      const k = 2 + Math.floor(r() * 3);
      for (let i = 0; i < k; i += 1) spots.push({ x: b.cx + (r() - 0.5) * 0.5, z: b.cz + (r() - 0.5) * 0.4, size: 1.2 });
      return;
    }
    for (let i = 0; i < b.poly.length; i += 1) {
      const a = b.poly[i];
      const e = b.poly[(i + 1) % b.poly.length];
      const len = Math.hypot(e[0] - a[0], e[1] - a[1]);
      // Cada aresta la comparteixen dos blocs: només la meitat de les vegades.
      if (r() < 0.5) continue;
      for (let t = 0.2 + r() * 0.3; t < len; t += 0.35 + r() * 0.6) {
        if (r() < 0.55) continue;
        const u = t / len;
        spots.push({ x: a[0] + (e[0] - a[0]) * u, z: a[1] + (e[1] - a[1]) * u, size: 0.8 + r() * 0.5 });
      }
    }
  });

  cached = { blocks, spots: spots.filter(({ x, z }) => !inClearZone(x, z, 0.03)) };
  return cached;
}
