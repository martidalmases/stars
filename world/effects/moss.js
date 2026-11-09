import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { createNoise2D, mulberry32 } from "../core/noise.js";
import { stylizedMaterial } from "../core/materials.js";
import { groundHeight, groundSlope, edgeRadius } from "../landscape/terrain.js";
import { generateSlabs, nearestSlabDistance } from "../landscape/slabs.js";
import { inClearZone } from "../bivac/layout.js";

// Coixins de molsa i bruc (taronges, verd oliva) arrecerats al peu dels blocs,
// com a les fotos de referència.

function cushionGeometry(seed) {
  const noise = createNoise2D(seed);
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n = noise(v.x * 2.2, v.z * 2.2 + v.y) / 0.7;
    const lumps = 1 + n * 0.18 + (noise(v.x * 6, v.z * 6) / 0.7) * 0.05;
    v.multiplyScalar(lumps);
    v.y = Math.max(v.y, -0.15);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function cushionSpots(count) {
  const rng = mulberry32(404);
  const spots = [];

  // Al peu dels blocs.
  generateSlabs().forEach((s) => {
    const k = Math.floor(1 + rng() * 3);
    for (let i = 0; i < k; i += 1) {
      const a = rng() * Math.PI * 2;
      const lx = Math.cos(a) * (s.length / 2 + 0.05 + rng() * 0.25);
      const lz = Math.sin(a) * (s.width / 2 + 0.05 + rng() * 0.25);
      const c = Math.cos(s.yaw);
      const sn = Math.sin(s.yaw);
      spots.push({ x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c, size: 0.7 + rng() * 0.8 });
    }
  });

  // Alguns al prat obert.
  for (let attempt = 0; attempt < 2000 && spots.length < count; attempt += 1) {
    const th = (rng() * 2 - 1) * Math.PI;
    const r = 0.8 + Math.pow(rng(), 0.8) * (edgeRadius(th) + 1);
    spots.push({ x: Math.sin(th) * r, z: -Math.cos(th) * r, size: 0.5 + rng() * 0.6 });
  }

  return spots.filter(
    ({ x, z }) => !inClearZone(x, z, 0.12) && groundSlope(x, z) < 0.8 && nearestSlabDistance(x, z) > -0.02
  );
}

export function createMoss() {
  const rng = mulberry32(505);
  const spots = cushionSpots(700);
  const tints = [
    [0.42, 0.19, 0.07],
    [0.36, 0.24, 0.08],
    [0.2, 0.23, 0.09],
    [0.13, 0.18, 0.08],
    [0.32, 0.3, 0.11]
  ];

  const matrices = [];
  const tintValues = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();

  spots.forEach(({ x, z, size }) => {
    const w = (0.12 + rng() * 0.22) * size;
    const h = w * (0.28 + rng() * 0.2);
    q.setFromEuler(new THREE.Euler((rng() - 0.5) * 0.2, rng() * Math.PI * 2, (rng() - 0.5) * 0.2));
    m.compose(new THREE.Vector3(x, groundHeight(x, z) - h * 0.1, z), q, new THREE.Vector3(w * (1 + rng() * 0.6), h, w));
    matrices.push(m.clone());
    const t = tints[Math.floor(rng() * tints.length)];
    const v = 0.8 + rng() * 0.4;
    tintValues.push(t[0] * v, t[1] * v, t[2] * v);
  });

  const geo = cushionGeometry(9);
  geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(new Float32Array(tintValues), 3));
  const mesh = new THREE.InstancedMesh(geo, stylizedMaterial({ moss: true, tint: true }), matrices.length);
  matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}
