import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { stylizedMaterial } from "../core/materials.js";
import { shared } from "../core/environment.js";
import { EMISSIVE, GLOW } from "../shaders/shaders.js";
import { smoothstep, clamp } from "../core/noise.js";
import { groundHeight } from "../landscape/terrain.js";
import { slabTopY } from "../landscape/summit.js";
import { LAYOUT } from "./layout.js";

const COLORS = {
  ownBag: [0.66, 0.2, 0.13],
  ownBagInner: [0.85, 0.55, 0.25],
  partnerBag: [0.16, 0.36, 0.42],
  ownMat: [0.8, 0.62, 0.2],
  partnerMat: [0.33, 0.52, 0.34],
  strap: [0.08, 0.08, 0.09],
  metal: [0.3, 0.31, 0.34],
  thermos: [0.18, 0.3, 0.24]
};

// ------------------------------------------------------------------
// Sac de dormir tipus "mòmia" amb farciment per franges.
// El cap és a z = 0 i els peus cap a -z.
// ------------------------------------------------------------------
function sleepingBagGeometry({ length = 1.95, width = 0.33, height = 0.2, baffles = 12 } = {}) {
  const nL = 110;
  const nA = 36;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= nL; i += 1) {
    const t = i / nL;
    const z = -t * length;

    const shoulder = smoothstep(0.0, 0.16, t);
    let w = width * (0.68 + 0.32 * shoulder) * (1 - 0.42 * smoothstep(0.35, 1.0, t));
    let h = height * (0.82 + 0.18 * shoulder) * (1 - 0.32 * smoothstep(0.5, 0.92, t));
    h *= 1 + 0.3 * smoothstep(0.84, 0.95, t); // els peus aixequen el sac

    const startCap = Math.pow(Math.sin((Math.PI / 2) * clamp(t / 0.07, 0, 1)), 0.55);
    const endCap = Math.pow(Math.sin((Math.PI / 2) * clamp((1 - t) / 0.06, 0, 1)), 0.55);
    const baffle = 1 + 0.045 * Math.cos(2 * Math.PI * baffles * t);
    w *= startCap * endCap * baffle;
    h *= startCap * endCap * baffle;

    for (let k = 0; k <= nA; k += 1) {
      const phi = (k / nA) * Math.PI * 2;
      const s = Math.sin(phi);
      const x = w * Math.cos(phi);
      const y = h * (s >= 0 ? s : s * 0.1) + h * 0.1 + 0.004;
      positions.push(x, y, z);
    }
  }

  const row = nA + 1;
  for (let i = 0; i < nL; i += 1) {
    for (let k = 0; k < nA; k += 1) {
      const a = i * row + k;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function placeOnGround(obj, x, z, lift = 0) {
  obj.position.set(x, groundHeight(x, z) + lift, z);
}

function createMat({ x, z, width, length, rot }, color) {
  const geo = new THREE.BoxGeometry(width, 0.028, length, 1, 1, 8);
  // Franges de l'esterilla d'escuma.
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    if (pos.getY(i) > 0) {
      const zz = pos.getZ(i);
      pos.setY(i, pos.getY(i) + 0.004 * Math.cos((zz / length) * Math.PI * 16));
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, stylizedMaterial({ color, flat: true }));
  placeOnGround(mesh, x, z, 0.014);
  mesh.rotation.y = rot;
  return mesh;
}

function createBag({ x, zHead, length, rot }, color, { closedHood = false } = {}) {
  const group = new THREE.Group();
  const bag = new THREE.Mesh(sleepingBagGeometry({ length }), stylizedMaterial({ color }));
  group.add(bag);

  if (closedHood) {
    // Caputxa tancada amb el cordó: algú dorm arraulit a dins.
    const knot = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 6),
      stylizedMaterial({ color: COLORS.strap })
    );
    knot.position.set(0.04, 0.2, -0.05);
    group.add(knot);
    const cord = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.006, 6, 20),
      stylizedMaterial({ color: [0.75, 0.75, 0.72] })
    );
    cord.position.set(0, 0.13, -0.03);
    cord.rotation.y = 0.2;
    group.add(cord);
  }

  group.position.set(x, groundHeight(x, zHead - length / 2) + 0.03, zHead);
  group.rotation.y = rot;
  return group;
}

function createBackpack(color, { lying = false } = {}) {
  const group = new THREE.Group();
  const mat = stylizedMaterial({ color });
  const dark = stylizedMaterial({ color: color.map((c) => c * 0.55) });
  const strapMat = stylizedMaterial({ color: COLORS.strap });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 6, 14), mat);
  body.scale.set(1.15, 1, 0.72);
  body.position.y = 0.3;
  group.add(body);

  const lid = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.16, 6, 12), dark);
  lid.rotation.z = Math.PI / 2;
  lid.scale.set(0.6, 1, 0.95);
  lid.position.set(0, 0.56, 0.02);
  group.add(lid);

  const pocket = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.1, 4, 10), dark);
  pocket.scale.set(1.2, 1, 0.45);
  pocket.position.set(0, 0.24, 0.1);
  group.add(pocket);

  [-0.08, 0.08].forEach((sx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.015), strapMat);
    strap.position.set(sx, 0.32, -0.115);
    strap.rotation.x = 0.08;
    group.add(strap);
  });

  // Esterilla enrotllada lligada a sota.
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 14), stylizedMaterial({ color: [0.5, 0.52, 0.55] }));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.09, 0.03);
  group.add(roll);

  if (lying) {
    group.rotation.set(0, 0.9, Math.PI / 2 - 0.12);
  } else {
    group.rotation.set(-0.2, 0.55, 0.03);
  }
  return group;
}

function createPole(from, to) {
  const group = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, len, 6), stylizedMaterial({ color: COLORS.metal }));
  shaft.position.y = len / 2;
  group.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.14, 8), stylizedMaterial({ color: COLORS.strap }));
  grip.position.y = len - 0.09;
  group.add(grip);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 10), stylizedMaterial({ color: COLORS.strap }));
  basket.position.y = 0.07;
  group.add(basket);

  group.position.copy(from);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return group;
}

function createLantern() {
  const group = new THREE.Group();
  const metal = stylizedMaterial({ color: [0.2, 0.2, 0.22] });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.025, 16), metal);
  base.position.y = 0.0125;
  group.add(base);

  const glassMat = new THREE.ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: EMISSIVE.vertex,
    fragmentShader: EMISSIVE.fragment
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.085, 16), glassMat);
  glass.position.y = 0.068;
  group.add(glass);

  [0, 1, 2, 3].forEach((i) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.09, 0.006), metal);
    const a = (i / 4) * Math.PI * 2 + 0.4;
    bar.position.set(Math.cos(a) * 0.04, 0.068, Math.sin(a) * 0.04);
    group.add(bar);
  });

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.035, 16), metal);
  cap.position.y = 0.128;
  group.add(cap);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.004, 6, 20, Math.PI), metal);
  handle.position.y = 0.145;
  group.add(handle);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.ShaderMaterial({
      uniforms: { ...shared, uStrength: { value: 0.55 } },
      vertexShader: GLOW.vertex,
      fragmentShader: GLOW.fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  glow.position.y = 0.07;
  group.add(glow);

  return { group, glow, lightOffset: 0.07 };
}

function createCup(color) {
  const group = new THREE.Group();
  const mat = stylizedMaterial({ color });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.032, 0.075, 16), mat);
  body.position.y = 0.0375;
  group.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.003, 6, 20), stylizedMaterial({ color: [0.15, 0.15, 0.17] }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.075;
  group.add(rim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 12, Math.PI), mat);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.036, 0.04, 0);
  group.add(handle);
  return group;
}

function createThermos() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 16), stylizedMaterial({ color: COLORS.thermos }));
  body.position.y = 0.12;
  group.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.06, 16), stylizedMaterial({ color: COLORS.metal }));
  cap.position.y = 0.27;
  group.add(cap);
  return group;
}

export function createBivac() {
  const group = new THREE.Group();

  group.add(createMat(LAYOUT.ownMat, COLORS.ownMat));
  group.add(createMat(LAYOUT.partnerMat, COLORS.partnerMat));
  group.add(createBag(LAYOUT.ownBag, COLORS.ownBag));
  group.add(createBag(LAYOUT.partnerBag, COLORS.partnerBag, { closedHood: true }));

  const packA = createBackpack(LAYOUT.packA.color);
  placeOnGround(packA, LAYOUT.packA.x, LAYOUT.packA.z);
  group.add(packA);

  const packB = createBackpack(LAYOUT.packB.color, { lying: true });
  placeOnGround(packB, LAYOUT.packB.x, LAYOUT.packB.z, 0.13);
  group.add(packB);

  // Bastons recolzats a la motxilla.
  const ax = LAYOUT.packA.x;
  const az = LAYOUT.packA.z;
  [
    [new THREE.Vector3(ax - 0.42, 0, az - 0.32), new THREE.Vector3(ax - 0.02, 0.92, az + 0.12)],
    [new THREE.Vector3(ax - 0.3, 0, az - 0.45), new THREE.Vector3(ax - 0.16, 0.95, az + 0.16)]
  ].forEach(([from, to]) => {
    const g = groundHeight(from.x, from.z);
    from.y += g;
    to.y += g;
    group.add(createPole(from, to));
  });

  // Fanalet, tasses i termo sobre la llosa.
  const top = slabTopY();
  const lantern = createLantern();
  lantern.group.position.set(LAYOUT.lantern.x, top, LAYOUT.lantern.z);
  group.add(lantern.group);
  shared.uLanternPos.value.set(LAYOUT.lantern.x, top + lantern.lightOffset, LAYOUT.lantern.z);

  LAYOUT.cups.forEach(({ x, z, color }, i) => {
    const cup = createCup(color);
    cup.position.set(x, top, z);
    cup.rotation.y = i * 2.1 + 0.4;
    group.add(cup);
  });

  const thermos = createThermos();
  placeOnGround(thermos, LAYOUT.thermos.x, LAYOUT.thermos.z);
  thermos.rotation.z = 0.05;
  group.add(thermos);

  function update(camera) {
    lantern.glow.quaternion.copy(camera.quaternion);
  }

  return { group, update };
}
