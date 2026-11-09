// Forma del cim. No és un cercle:
// - el bivac és en una espatlla rocosa que s'acaba de seguida endavant i a la dreta
//   (la vista s'obre cap al buit, el mar de núvols i les serralades),
// - endavant a la dreta en surt un esperó/carena que baixa i es perd dins la boira,
// - a l'esquerra i enrere el cim continua pujant uns metres (avantcim).
// Funcions pures (sense three.js) per poder col·locar coses a sobre.

import { createNoise2D, fbm, smoothstep } from "../core/noise.js";

// Estàs estirat amb el cap aixecat: els ulls (la càmera) són a 0, el terra a -0.6.
export const GROUND_Y = -0.6;
// Mar de núvols. Les muntanyes tenen la seva pròpia referència (MOUNTAIN_REF_Y)
// perquè pujar o baixar els núvols no les canviï.
export const CLOUD_Y = -24;
export const MOUNTAIN_REF_Y = -40;
// El sòl entre blocs és més avall que el cim dels blocs: així les esquerdes són fondes.
export const SOIL_DEPTH = 0.16;
export const PAVEMENT_RADIUS = 22;

const nBumps = createNoise2D(7);
const nDetail = createNoise2D(19);
const nEdge = createNoise2D(23);
const nRidge = createNoise2D(29);
const nLedge = createNoise2D(41);

const rad = (d) => (d * Math.PI) / 180;
const dirOf = (az) => [Math.sin(rad(az)), -Math.cos(rad(az))];

export const RIDGE_AZ = 42;
export const UPPER_AZ = -118;
const RIDGE_DIR = dirOf(RIDGE_AZ);
const UPPER_DIR = dirOf(UPPER_AZ);

// El·lipse del campament: aquí el terra és pla perquè hi caben les esterilles.
const CAMP = { cx: 0.36, cz: -0.85, rx: 1.55, rz: 2.15 };

export function campWeight(x, z) {
  const dx = (x - CAMP.cx) / CAMP.rx;
  const dz = (z - CAMP.cz) / CAMP.rz;
  return smoothstep(0.85, 1.5, Math.sqrt(dx * dx + dz * dz));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Radi del replà en cada direcció (on comença la caiguda forta).
// Endavant i a la dreta s'acaba aviat: la vista queda oberta.
export function edgeRadius(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const noise = fbm(nEdge, c * 1.3 + 4.0, s * 1.3 - 2.0, 3) / 0.7;
  const open = Math.exp(-Math.pow(angleDiff(theta, rad(30)) / rad(70), 2));
  return 6.4 - 2.4 * open + 1.4 * noise * (1 - open * 0.6);
}

function smax(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(x, -z);
  const w = campWeight(x, z);

  // Replà: roca ondulada amb petits graons (estrats).
  let y = GROUND_Y;
  const bumps = fbm(nBumps, x * 0.16, z * 0.16, 3) * 0.35 + fbm(nDetail, x * 0.62, z * 0.62, 2) * 0.1;
  const ledge = Math.floor((fbm(nLedge, x * 0.22, z * 0.22, 2) / 0.7 + 1) * 2.2) / 2.2;
  // Al començament de la carena no hi ha bonys: el llavi ha de quedar baix.
  const ra = x * RIDGE_DIR[0] + z * RIDGE_DIR[1];
  const rc = Math.abs(x * RIDGE_DIR[1] - z * RIDGE_DIR[0]);
  const lip = smoothstep(0.5, 2.0, ra) * (1 - smoothstep(2.0, 6.0, rc));
  y += w * (bumps + ledge * 0.1) * (1 - lip);
  const dome = Math.max(0, r - 2.5);
  y -= dome * dome * 0.03;

  const R = edgeRadius(theta);
  if (r > R) {
    const d = r - R;
    y -= Math.pow(d * 0.9, 1.6) + d * 0.6;
  }

  // Esperó: un graó sota el replà i després una carena llarga i suau que s'allunya
  // i s'enfonsa dins la boira. Té perfil còncau perquè es vegi des de dalt.
  const a1 = x * RIDGE_DIR[0] + z * RIDGE_DIR[1];
  if (a1 > 1.0) {
    const wobble = fbm(nRidge, a1 * 0.03, 3.3, 3) * 10 * smoothstep(10, 60, a1);
    const c1 = Math.abs(x * RIDGE_DIR[1] - z * RIDGE_DIR[0] + wobble);
    // Comença a la vora del campament amb un perfil còncau (primer baixa i
    // després s'aplana): així es veu des del bivac. Lluny, cau dins la boira.
    const t = Math.max(a1 - 2.6, 0);
    const crest =
      GROUND_Y - 0.17 * t + 0.0009 * Math.min(t, 80) * Math.min(t, 80) -
      0.0005 * Math.max(t - 80, 0) * Math.max(t - 80, 0) +
      fbm(nDetail, a1 * 0.12, 1.7, 3) * 0.7 * smoothstep(8, 25, a1);
    const width = 0.05 / (1 + a1 * 0.02);
    const ridge = crest - c1 * c1 * width - c1 * 0.35;
    // Dins el passadís de la carena mana la carena; als costats, la que sigui més alta.
    const inCorridor = 1 - smoothstep(1.5, 5.0, c1);
    const shaped = smax(y, ridge, 1.5) * (1 - inCorridor) + ridge * inCorridor;
    y = y + (shaped - y) * smoothstep(1.0, 2.0, a1) * w;
  }

  // Avantcim: el cim continua pujant uns metres a l'esquerra, enrere.
  const a2 = x * UPPER_DIR[0] + z * UPPER_DIR[1];
  if (a2 > 1.5) {
    const c2 = Math.abs(x * UPPER_DIR[1] - z * UPPER_DIR[0]);
    const rise = GROUND_Y + 4.2 * smoothstep(2.5, 13, a2) - 3.2 * smoothstep(14, 30, a2);
    const upper = rise - c2 * c2 * 0.06 - c2 * 0.2 + fbm(nBumps, a2 * 0.25, c2 * 0.25, 2) * 0.8;
    y = y + (smax(y, upper, 1.5) - y) * smoothstep(1.5, 3.5, a2);
  }

  return y;
}

export function groundSlope(x, z) {
  const e = 0.15;
  const dx = groundHeight(x + e, z) - groundHeight(x - e, z);
  const dz = groundHeight(x, z + e) - groundHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}
