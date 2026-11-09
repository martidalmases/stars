import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { stylizedMaterial } from "../core/materials.js";
import { shared } from "../core/environment.js";
import { EMISSIVE, GLOW } from "../shaders/shaders.js";
import { smoothstep, clamp } from "../core/noise.js";
import { groundHeight } from "../landscape/terrain.js";
import { slabTopY } from "../landscape/summit.js";
import { LAYOUT } from "./layout.js";

const COLORS = {
  ownBag: [0.5, 0.14, 0.09],
  partnerBag: [0.11, 0.24, 0.3],
  ownMat: [0.55, 0.42, 0.14],
  partnerMat: [0.2, 0.32, 0.22],
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
    const baffle = 1 + 0.028 * Math.cos(2 * Math.PI * baffles * t) + 0.012 * Math.sin(2 * Math.PI * 3.3 * t + 1.0);
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

// Caixa amb cantonades arrodonides (per a motxilles i bosses).
function roundedBox(w, h, d, r, seg = 4) {
  const geo = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const c = new THREE.Vector3(
      THREE.MathUtils.clamp(v.x, -inner.x, inner.x),
      THREE.MathUtils.clamp(v.y, -inner.y, inner.y),
      THREE.MathUtils.clamp(v.z, -inner.z, inner.z)
    );
    const off = v.clone().sub(c);
    if (off.lengthSq() > 0) off.setLength(r);
    pos.setXYZ(i, c.x + off.x, c.y + off.y, c.z + off.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Bombat suau (com un farcit de tela).
function puff(geo, amount) {
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) / (size.x / 2);
    const y = pos.getY(i) / (size.y / 2);
    const z = pos.getZ(i);
    const k = 1 + amount * (1 - Math.min(1, x * x)) * (1 - Math.min(1, y * y));
    pos.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  return geo;
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
    // Caputxa tancada amb el cordó estirat: algú dorm arraulit a dins.
    const dark = stylizedMaterial({ color: color.map((c) => c * 0.45) });
    const pucker = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), dark);
    pucker.scale.set(1.25, 0.9, 0.45);
    pucker.position.set(0, 0.12, 0.02);
    group.add(pucker);
    const toggle = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.02, 3, 6), stylizedMaterial({ color: COLORS.strap }));
    toggle.position.set(0.05, 0.075, 0.06);
    toggle.rotation.z = 0.4;
    group.add(toggle);
  }

  group.position.set(x, groundHeight(x, zHead - length / 2) + 0.03, zHead);
  group.rotation.y = rot;
  return group;
}

// Motxilla de muntanya. Local: l'esquena mira a -z, la butxaca davantera a +z,
// la base a y = 0.
function createBackpack(color) {
  const group = new THREE.Group();
  const main = stylizedMaterial({ color });
  const dark = stylizedMaterial({ color: color.map((c) => c * 0.6) });
  const strapMat = stylizedMaterial({ color: COLORS.strap });
  const buckle = stylizedMaterial({ color: [0.32, 0.32, 0.34] });

  // Cos principal, una mica més estret a dalt.
  const bodyGeo = puff(roundedBox(0.34, 0.56, 0.22, 0.07, 3), 0.18);
  const bp = bodyGeo.attributes.position;
  for (let i = 0; i < bp.count; i += 1) {
    const k = 1 - 0.12 * (bp.getY(i) / 0.28 + 1) * 0.5;
    bp.setX(i, bp.getX(i) * k);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, main);
  body.position.y = 0.3;
  group.add(body);

  // Tapa superior que sobresurt una mica.
  const lid = new THREE.Mesh(puff(roundedBox(0.32, 0.1, 0.25, 0.045, 3), 0.25), dark);
  lid.position.set(0, 0.6, 0.015);
  lid.rotation.x = 0.06;
  group.add(lid);

  // Butxaca davantera.
  const pocket = new THREE.Mesh(puff(roundedBox(0.24, 0.24, 0.06, 0.03, 2), 0.35), dark);
  pocket.position.set(0, 0.22, 0.125);
  group.add(pocket);

  // Corretges de compressió laterals i de la tapa.
  [0.2, 0.38].forEach((y) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.022, 0.235), strapMat);
    strap.position.set(0, y, 0.004);
    group.add(strap);
    [-1, 1].forEach((side) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.028), buckle);
      b.position.set(side * 0.181, y, 0.06);
      group.add(b);
    });
  });
  [-0.07, 0.07].forEach((x) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, 0.27), strapMat);
    strap.position.set(x, 0.655, 0.015);
    group.add(strap);
  });

  // Tirants a l'esquena.
  [-0.08, 0.08].forEach((x) => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x * 0.7, 0.52, -0.11),
      new THREE.Vector3(x, 0.32, -0.19),
      new THREE.Vector3(x * 1.4, 0.1, -0.11)
    );
    const strap = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.018, 6, false), strapMat);
    strap.scale.set(1.6, 1, 0.6);
    group.add(strap);
  });

  // Esterilla enrotllada lligada a sota, amb dues cintes.
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.44, 16), stylizedMaterial({ color: [0.32, 0.34, 0.36] }));
  roll.rotation.z = Math.PI / 2;
  roll.position.set(0, 0.065, 0.05);
  group.add(roll);
  [-0.12, 0.12].forEach((x) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.008, 6, 16), strapMat);
    band.rotation.y = Math.PI / 2;
    band.position.set(x, 0.065, 0.05);
    group.add(band);
  });

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

  // Motxilla dreta, recolzada enrere i girada cap a tu.
  const packA = new THREE.Group();
  const packAInner = createBackpack(LAYOUT.packA.color);
  packAInner.rotation.x = 0.1;
  packA.add(packAInner);
  placeOnGround(packA, LAYOUT.packA.x, LAYOUT.packA.z);
  packA.rotation.y = Math.atan2(-LAYOUT.packA.x, -LAYOUT.packA.z) + 0.25;
  group.add(packA);

  // Motxilla estirada d'esquena a terra.
  const packB = new THREE.Group();
  const packBInner = createBackpack(LAYOUT.packB.color);
  packBInner.rotation.x = -Math.PI / 2;
  packBInner.position.y = 0.12;
  packB.add(packBInner);
  placeOnGround(packB, LAYOUT.packB.x, LAYOUT.packB.z);
  packB.rotation.y = 2.3;
  group.add(packB);

  // Bastons recolzats a la motxilla dreta: el puny descansa sobre la tapa.
  packA.updateMatrixWorld(true);
  const rest = new THREE.Vector3(0, 0.6, -0.02).applyMatrix4(packAInner.matrixWorld);
  [
    [-0.36, 0.22, 0.04],
    [-0.28, 0.34, -0.04]
  ].forEach(([dx, dz, spread]) => {
    const from = new THREE.Vector3(rest.x + dx, 0, rest.z + dz);
    from.y = groundHeight(from.x, from.z);
    const top = rest.clone().add(new THREE.Vector3(spread, 0.0, spread));
    const dir = top.clone().sub(from).normalize();
    const to = from.clone().addScaledVector(dir, 1.1);
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
