import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { createNoise2D, fbm, ridged, smoothstep } from "../core/noise.js";
import { shared } from "../core/environment.js";
import { MOUNTAIN } from "../shaders/shaders.js";
import { CLOUD_Y } from "./terrain.js";

// Capes de serralades, de més a prop a més lluny. Cada capa és una mica més alta i
// més esvaïda per la boira: això dona la sensació d'escala.
//   r0, r1: distància (m)   amp: alçada del cim més alt sobre el mar de núvols
//   feature: mida de les formes (més gran = muntanyes més amples i tranquil·les)
//   snowLine: on comença la neu (0 = base, 1 = cim)   fog: quanta boira agafa
//   peaks: cims protagonistes (az en graus, amplada en graus, quant sobresurten)
const LAYERS = [
  { r0: 110, r1: 230, amp: 36, feature: 60, seed: 3, snowLine: 0.84, fog: 0.82, peaks: [] },
  { r0: 250, r1: 395, amp: 52, feature: 85, seed: 8, snowLine: 0.76, fog: 0.88, peaks: [{ az: 18, width: 6, boost: 0.12 }] },
  { r0: 415, r1: 600, amp: 75, feature: 115, seed: 15, snowLine: 0.7, fog: 0.92, peaks: [{ az: -12, width: 7, boost: 0.15 }] },
  { r0: 620, r1: 880, amp: 105, feature: 150, seed: 21, snowLine: 0.64, fog: 0.95, peaks: [{ az: 50, width: 8, boost: 0.12 }] }
];

const HALF_ARC = 3.0; // ±172°: no s'hi veu cap tall en girar el cap.

function buildLayer(L) {
  const nT = 520;
  const nR = 44;
  const noise = createNoise2D(L.seed);
  const massifNoise = createNoise2D(L.seed + 100);
  const rMid = (L.r0 + L.r1) / 2;

  const count = (nT + 1) * (nR + 1);
  const raw = new Float32Array(count);
  let max = 0;

  const warpNoise = createNoise2D(L.seed + 200);
  const detailNoise = createNoise2D(L.seed + 300);
  for (let j = 0; j <= nR; j += 1) {
    const r = L.r0 + ((L.r1 - L.r0) * j) / nR;
    const tj = j / nR;
    // Cara davantera que s'aixeca del mar de núvols i esquena més suau.
    const radial = smoothstep(0.0, 0.32, tj) * (1 - smoothstep(0.72, 1.0, tj));
    for (let i = 0; i <= nT; i += 1) {
      const th = -HALF_ARC + (2 * HALF_ARC * i) / nT;
      const s = th * rMid;
      const u = s / L.feature;
      const v = (r - L.r0) / L.feature + 3.1;
      const wu = u + 0.5 * fbm(warpNoise, u * 0.6, v * 0.6, 3) / 0.7;
      const wv = v + 0.5 * fbm(warpNoise, u * 0.6 + 9.2, v * 0.6, 3) / 0.7;

      // Massís continu (sense pics aïllats) + carenes i valls erosionades a sobre.
      const mass = 0.55 + 0.45 * smoothstep(-0.5, 0.5, fbm(massifNoise, u * 0.22, 7.3, 3) / 0.7);
      const rid = ridged(noise, wu, wv, 5);
      const detail = fbm(detailNoise, u * 3.2, v * 3.2, 3) * 0.04;
      let h = mass * (0.42 + 0.58 * rid) + detail;

      L.peaks.forEach(({ az, width, boost }) => {
        const d = (th - THREE.MathUtils.degToRad(az)) / THREE.MathUtils.degToRad(width);
        h += boost * Math.exp(-d * d);
      });

      h = Math.max(0, h) * radial;
      raw[j * (nT + 1) + i] = h;
      if (h > max) max = h;
    }
  }

  const positions = new Float32Array(count * 3);
  const heights = new Float32Array(count);
  const base = CLOUD_Y - 15;

  for (let j = 0; j <= nR; j += 1) {
    const r = L.r0 + ((L.r1 - L.r0) * j) / nR;
    for (let i = 0; i <= nT; i += 1) {
      const idx = j * (nT + 1) + i;
      const th = -HALF_ARC + (2 * HALF_ARC * i) / nT;
      const h01 = raw[idx] / max;
      positions[idx * 3] = Math.sin(th) * r;
      positions[idx * 3 + 1] = base + h01 * (L.amp + 15);
      positions[idx * 3 + 2] = -Math.cos(th) * r;
      heights[idx] = h01;
    }
  }

  const indices = [];
  const row = nT + 1;
  for (let j = 0; j < nR; j += 1) {
    for (let i = 0; i < nT; i += 1) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aH", new THREE.BufferAttribute(heights, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uSnowLine: { value: L.snowLine },
      uFogAmount: { value: L.fog }
    },
    vertexShader: MOUNTAIN.vertex,
    fragmentShader: MOUNTAIN.fragment,
    side: THREE.DoubleSide
  });

  return new THREE.Mesh(geo, mat);
}

export function createMountains() {
  const group = new THREE.Group();
  LAYERS.forEach((layer) => group.add(buildLayer(layer)));
  return group;
}
