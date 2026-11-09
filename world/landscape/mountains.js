import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { createNoise2D, fbm, ridged, smoothstep } from "../core/noise.js";
import { shared } from "../core/environment.js";
import { MOUNTAIN } from "../shaders/shaders.js";
import { CLOUD_Y } from "./terrain.js";

// Capes de serralades, de més a prop a més lluny. Cada capa és més alta, més
// nevada i més esvaïda per la boira: això dona la sensació d'escala.
//   r0, r1: distància (m)   amp: alçada del cim més alt sobre el mar de núvols
//   feature: mida de les formes   snowLine: on comença la neu (0 = base, 1 = cim)
const LAYERS = [
  { r0: 150, r1: 270, amp: 40, feature: 55, seed: 3, snowLine: 0.6, fog: 0.8 },
  { r0: 290, r1: 445, amp: 72, feature: 85, seed: 8, snowLine: 0.44, fog: 0.82 },
  { r0: 470, r1: 675, amp: 112, feature: 120, seed: 15, snowLine: 0.33, fog: 0.85 },
  { r0: 700, r1: 965, amp: 165, feature: 165, seed: 21, snowLine: 0.26, fog: 0.88 }
];

const HALF_ARC = 2.35; // ±135°, més del que es pot veure girant el cap.

function buildLayer(L) {
  const nT = 340;
  const nR = 36;
  const noise = createNoise2D(L.seed);
  const massifNoise = createNoise2D(L.seed + 100);
  const rMid = (L.r0 + L.r1) / 2;

  const count = (nT + 1) * (nR + 1);
  const raw = new Float32Array(count);
  let max = 0;

  for (let j = 0; j <= nR; j += 1) {
    const r = L.r0 + ((L.r1 - L.r0) * j) / nR;
    const radial = Math.pow(Math.sin((Math.PI * j) / nR), 0.65);
    for (let i = 0; i <= nT; i += 1) {
      const th = -HALF_ARC + (2 * HALF_ARC * i) / nT;
      const s = th * rMid;
      const massif = 0.28 + 0.72 * smoothstep(-0.3, 0.45, fbm(massifNoise, s / (L.feature * 3.5), 7.3, 3) / 0.7);
      const rid = ridged(noise, s / L.feature, (r - L.r0) / L.feature + 3.1, 5);
      const h = Math.pow(Math.max(0, rid * massif * radial), 1.4);
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
