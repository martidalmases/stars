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
  { r0: 110, r1: 225, amp: 40, feature: 70, seed: 3, snowLine: 0.66, fog: 0.82, peaks: [{ az: -36, width: 5, boost: 0.6 }] },
  { r0: 245, r1: 385, amp: 58, feature: 95, seed: 8, snowLine: 0.56, fog: 0.88, peaks: [{ az: 18, width: 4.5, boost: 0.7 }] },
  { r0: 405, r1: 585, amp: 82, feature: 130, seed: 15, snowLine: 0.48, fog: 0.92, peaks: [{ az: -12, width: 4.5, boost: 0.85 }, { az: 74, width: 6, boost: 0.5 }] },
  { r0: 605, r1: 870, amp: 118, feature: 170, seed: 21, snowLine: 0.42, fog: 0.95, peaks: [{ az: 50, width: 5.5, boost: 0.55 }, { az: -62, width: 7, boost: 0.5 }] }
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
  for (let j = 0; j <= nR; j += 1) {
    const r = L.r0 + ((L.r1 - L.r0) * j) / nR;
    const radial = Math.pow(Math.sin((Math.PI * j) / nR), 0.8);
    for (let i = 0; i <= nT; i += 1) {
      const th = -HALF_ARC + (2 * HALF_ARC * i) / nT;
      const s = th * rMid;
      const u = s / L.feature;
      const v = (r - L.r0) / L.feature + 3.1;
      // Distorsió suau perquè les carenes no siguin rectes.
      const wu = u + 0.45 * fbm(warpNoise, u * 0.7, v * 0.7, 2) / 0.7;
      const wv = v + 0.45 * fbm(warpNoise, u * 0.7 + 9.2, v * 0.7, 2) / 0.7;
      const massif = 0.22 + 0.78 * smoothstep(-0.35, 0.5, fbm(massifNoise, u * 0.35, 7.3, 3) / 0.7);
      const rid = ridged(noise, wu, wv, 4);
      let h = Math.pow(Math.max(0, rid * massif), 1.5);

      L.peaks.forEach(({ az, width, boost }) => {
        const d = (th - THREE.MathUtils.degToRad(az)) / THREE.MathUtils.degToRad(width);
        h += boost * Math.exp(-Math.pow(Math.abs(d), 1.4)) * (0.55 + 0.45 * rid);
      });

      h *= radial;
      raw[j * (nT + 1) + i] = h;
      if (h > max) max = h;
    }
  }

  const positions = new Float32Array(count * 3);
  const heights = new Float32Array(count);
  const base = CLOUD_Y - 30;

  for (let j = 0; j <= nR; j += 1) {
    const r = L.r0 + ((L.r1 - L.r0) * j) / nR;
    for (let i = 0; i <= nT; i += 1) {
      const idx = j * (nT + 1) + i;
      const th = -HALF_ARC + (2 * HALF_ARC * i) / nT;
      const h01 = raw[idx] / max;
      positions[idx * 3] = Math.sin(th) * r;
      positions[idx * 3 + 1] = base + h01 * (L.amp + 30);
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
