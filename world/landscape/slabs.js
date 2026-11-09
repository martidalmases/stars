// Lloses de roca que afloren al cim, com estrats inclinats que surten de terra.
// Entre llosa i llosa queda terra i és on creix l'herba.
// Funcions pures (sense three.js): també les fa servir la vegetació.

import { mulberry32, createNoise2D } from "../core/noise.js";
import { groundHeight, edgeRadius, GROUND_Y, UPPER_AZ } from "./terrain.js";
import { inClearZone } from "../bivac/layout.js";

// Direcció dels estrats (tots els afloraments van més o menys alineats).
const STRIKE = 0.5;
const DIP = 0.32;

let cached = null;

export function generateSlabs() {
  if (cached) return cached;
  const rng = mulberry32(2024);
  const density = createNoise2D(77);
  const slabs = [];
  const upperDir = [Math.sin((UPPER_AZ * Math.PI) / 180), -Math.cos((UPPER_AZ * Math.PI) / 180)];

  for (let attempt = 0; attempt < 5000 && slabs.length < 260; attempt += 1) {
    const th = (rng() * 2 - 1) * Math.PI;
    let r = 1.2 + Math.pow(rng(), 0.8) * (edgeRadius(th) + 1.5);
    // També n'hi ha a la pujada de l'avantcim.
    const upward = Math.cos(th - (UPPER_AZ * Math.PI) / 180);
    if (upward > 0.7) r += rng() * 9;
    const x = Math.sin(th) * r;
    const z = -Math.cos(th) * r;

    // Zones amb més roca i zones amb més prat.
    if (density(x * 0.25, z * 0.25) / 0.7 < -0.15 + rng() * 0.3 - 0.2) continue;

    const along = x * upperDir[0] + z * upperDir[1];
    const big = along > 4 ? 1.6 : 1;
    const length = (0.45 + Math.pow(rng(), 1.6) * 1.3) * big * (0.8 + Math.min(r, 10) * 0.05);
    const width = length * (0.45 + rng() * 0.35);
    const thick = length * (0.18 + rng() * 0.16);
    const yaw = STRIKE + (rng() - 0.5) * 0.7;

    if (inClearZone(x, z, length * 0.55)) continue;
    const clash = slabs.some((s) => Math.hypot(s.x - x, s.z - z) < (s.length + length) * 0.38);
    if (clash) continue;

    const ground = groundHeight(x, z);
    if (ground < GROUND_Y - 6) continue;

    slabs.push({
      x,
      z,
      y: ground - thick * 0.28,
      length,
      width,
      thick,
      yaw,
      dip: DIP * (0.6 + rng() * 0.8) * (rng() < 0.85 ? 1 : -1),
      roll: (rng() - 0.5) * 0.25
    });
  }

  cached = slabs;
  return slabs;
}

// Distància (aprox.) de (x, z) a la vora de la llosa: < 0 dins, > 0 fora.
export function slabDistance(s, x, z) {
  const c = Math.cos(-s.yaw);
  const sn = Math.sin(-s.yaw);
  const dx = x - s.x;
  const dz = z - s.z;
  const lx = dx * c - dz * sn;
  const lz = dx * sn + dz * c;
  const a = s.length / 2;
  const b = s.width / 2;
  const k = Math.sqrt((lx * lx) / (a * a) + (lz * lz) / (b * b));
  return (k - 1) * Math.min(a, b);
}

export function nearestSlabDistance(x, z) {
  let best = Infinity;
  for (const s of generateSlabs()) {
    if (Math.abs(s.x - x) > s.length + 1 || Math.abs(s.z - z) > s.length + 1) continue;
    best = Math.min(best, slabDistance(s, x, z));
  }
  return best;
}
