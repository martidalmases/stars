// Forma del cim: un replà una mica pla però irregular, que cau per tots costats
// cap al mar de núvols. Funcions pures (sense three.js) per poder col·locar coses a sobre.

import { createNoise2D, fbm, smoothstep } from "../core/noise.js";

export const GROUND_Y = -0.5;
export const CLOUD_Y = -40;

const nBumps = createNoise2D(7);
const nDetail = createNoise2D(19);
const nEdge = createNoise2D(23);

// El·lipse del campament: aquí el terra és pla perquè hi caben les esterilles.
const CAMP = { cx: 0.36, cz: -0.85, rx: 1.55, rz: 2.15 };

// 0 dins el campament (pla), 1 fora.
export function campWeight(x, z) {
  const dx = (x - CAMP.cx) / CAMP.rx;
  const dz = (z - CAMP.cz) / CAMP.rz;
  return smoothstep(0.85, 1.5, Math.sqrt(dx * dx + dz * dz));
}

// Radi del replà en cada direcció (on comença la caiguda).
export function edgeRadius(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return 7.6 + 2.6 * fbm(nEdge, c * 1.3 + 4.0, s * 1.3 - 2.0, 3) / 0.7;
}

export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(x, -z);
  const w = campWeight(x, z);

  let y = GROUND_Y;
  y += w * (fbm(nBumps, x * 0.16, z * 0.16, 3) * 0.42 + fbm(nDetail, x * 0.62, z * 0.62, 2) * 0.13);
  // El cim és lleugerament bombat: cau suaument cap a les vores.
  const dome = Math.max(0, r - 2.5);
  y -= dome * dome * 0.028;

  const R = edgeRadius(theta);
  if (r > R) {
    const d = r - R;
    y -= Math.pow(d * 0.6, 1.65) + d * 0.25;
  }
  return y;
}

export function groundSlope(x, z) {
  const e = 0.15;
  const dx = groundHeight(x + e, z) - groundHeight(x - e, z);
  const dz = groundHeight(x, z + e) - groundHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}
