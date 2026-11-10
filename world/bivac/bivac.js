import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { stylizedMaterial } from "../core/materials.js";
import { shared } from "../core/environment.js";
import { EMISSIVE, GLOW } from "../shaders/shaders.js";
import { smoothstep, clamp, createNoise2D } from "../core/noise.js";
import { groundHeight } from "../landscape/terrain.js";
import { slabTopY, FLUSH_OFFSET } from "../landscape/summit.js";
import { generatePavement } from "../landscape/pavement.js";
import { LAYOUT } from "./layout.js";

const COLORS = {
  ownBag: [0.1, 0.2, 0.34],
  partnerBag: [0.16, 0.27, 0.13],
  ownMat: [0.55, 0.42, 0.14],
  partnerMat: [0.2, 0.32, 0.22],
  strap: [0.08, 0.08, 0.09],
  metal: [0.3, 0.31, 0.34],
  thermos: [0.18, 0.3, 0.24]
};

// ------------------------------------------------------------------
// Sac de dormir tipus "mòmia" amb algú a dins. El cap és a z = 0 i els peus
// cap a -z. La forma segueix un cos (espatlles, malucs, genolls, peus), la tela
// té arrugues irregulars i costures suaus, i la part de baix s'aplana sobre
// l'esterilla.
//   body: { head, chest, hips, knees, feet, curl, side }
// ------------------------------------------------------------------
const gauss = (t, c, s) => Math.exp(-((t - c) / s) * ((t - c) / s));

function sleepingBagGeometry({ length = 1.95, width = 0.33, height = 0.17, body = {}, seed = 1 } = {}) {
  const { head = 0, chest = 0.35, hips = 0.3, knees = 0.2, feet = 0.35, curl = 0, side = 0 } = body;
  const noise = createNoise2D(seed);
  const nL = 150;
  const nA = 56;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= nL; i += 1) {
    const t = i / nL;
    const z = -t * length;

    let w = width * (0.62 + 0.38 * smoothstep(0.0, 0.16, t)) * (1 - 0.42 * smoothstep(0.42, 1.0, t));
    w *= 1 + 0.1 * gauss(t, 0.47, 0.1) * hips + 0.06 * gauss(t, 0.2, 0.08);
    let h =
      height *
      (0.55 + head * gauss(t, 0.05, 0.05) + chest * gauss(t, 0.2, 0.09) + hips * gauss(t, 0.46, 0.1) +
        knees * gauss(t, 0.7, 0.07) + feet * gauss(t, 0.94, 0.035));
    // Corba del cos (algú mig de costat amb els genolls una mica doblegats).
    const xOff = curl * (0.06 * gauss(t, 0.68, 0.14) - 0.02 * gauss(t, 0.3, 0.15));

    const startCap = Math.pow(Math.sin((Math.PI / 2) * clamp(t / 0.06, 0, 1)), 0.6);
    const endCap = Math.pow(Math.sin((Math.PI / 2) * clamp((1 - t) / 0.05, 0, 1)), 0.5);
    w *= startCap * endCap;
    h *= startCap * endCap;

    for (let k = 0; k <= nA; k += 1) {
      const phi = (k / nA) * Math.PI * 2;
      const s = Math.sin(phi);
      const c = Math.cos(phi);
      // Secció arrodonida a dalt i aplanada a baix (la tela s'escampa sobre l'esterilla).
      let x = w * Math.sign(c) * Math.pow(Math.abs(c), 0.85);
      let y;
      if (s >= 0) {
        y = h * Math.pow(s, 0.9);
      } else {
        y = h * s * 0.06;
        x *= 1 + 0.12 * Math.min(1, -s * 3);
      }
      // El costat on recolza el cos és més ple.
      y *= 1 + side * c * 0.15 * Math.max(s, 0);

      if (s > -0.2) {
        // Costures dels compartiments: solcs suaus, no corrugat.
        const zz = t * length / 0.19;
        const seam = Math.min(zz % 1, 1 - (zz % 1));
        const groove = Math.exp(-(seam / 0.09) * (seam / 0.09)) * 0.012 * Math.max(s, 0);
        // Arrugues irregulars de la tela, més fortes a les zones flexionades.
        const flex = 0.6 + gauss(t, 0.3, 0.12) + gauss(t, 0.62, 0.1) * 1.3;
        const wr = noise(t * length * 5.0, phi * 1.6) * 0.011 * flex + noise(t * length * 13.0, phi * 4.0) * 0.004;
        const bulge = 1 + (wr - groove) / Math.max(h, 0.05);
        y = y * bulge;
        x = x * (1 + wr * 0.6);
      }
      positions.push(x + xOff, y + 0.004, z);
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

function createBag({ x, zHead, length, rot }, color, { sleeper = false } = {}) {
  const group = new THREE.Group();
  const body = sleeper
    ? { head: 0.55, chest: 0.5, hips: 0.55, knees: 0.4, feet: 0.4, curl: 1, side: 0.8 }
    : { head: 0, chest: 0.35, hips: 0.32, knees: 0.25, feet: 0.45, curl: 0.3, side: 0 };
  const bag = new THREE.Mesh(
    sleepingBagGeometry({ length, body, seed: sleeper ? 3 : 8 }),
    stylizedMaterial({ color, fabric: true })
  );
  group.add(bag);

  if (sleeper) {
    // Caputxa tancada amb el cordó estirat: algú dorm arraulit a dins.
    const dark = stylizedMaterial({ color: color.map((c) => c * 0.4), fabric: true });
    const pucker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), dark);
    pucker.scale.set(1.2, 0.85, 0.4);
    pucker.position.set(0, 0.1, 0.018);
    group.add(pucker);
    const toggle = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.02, 3, 6), stylizedMaterial({ color: COLORS.strap }));
    toggle.position.set(0.05, 0.06, 0.05);
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

// Fanal de tempesta clàssic: dipòsit, globus de vidre amb reixeta, xemeneia,
// tubs laterals i nansa. Dins hi ha una flameta.
function createLantern() {
  const group = new THREE.Group();
  const enamel = stylizedMaterial({ color: [0.32, 0.07, 0.05] });
  const metal = stylizedMaterial({ color: [0.16, 0.16, 0.17] });
  const lathe = (pts, mat, segs = 28) =>
    new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs), mat);

  // Dipòsit de combustible.
  group.add(lathe([[0, 0], [0.058, 0], [0.066, 0.008], [0.07, 0.024], [0.066, 0.04], [0.05, 0.05], [0.032, 0.054], [0, 0.054]], enamel));

  // Globus de vidre (encès) i flama.
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uBoost: { value: 0.75 } },
    vertexShader: EMISSIVE.vertex,
    fragmentShader: EMISSIVE.fragment
  });
  group.add(lathe([[0.026, 0.054], [0.04, 0.066], [0.047, 0.088], [0.045, 0.108], [0.036, 0.124], [0.026, 0.13]], glassMat));
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uBoost: { value: 1.6 } },
    vertexShader: EMISSIVE.vertex,
    fragmentShader: EMISSIVE.fragment
  });
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), flameMat);
  flame.scale.set(1, 2.2, 1);
  flame.position.y = 0.083;
  group.add(flame);

  // Reixeta de protecció.
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const pts = [
      [0.03, 0.054], [0.046, 0.068], [0.053, 0.09], [0.051, 0.11], [0.04, 0.128]
    ].map(([r, y]) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0018, 4, false), metal));
  }

  // Xemeneia i barret.
  group.add(lathe([[0.024, 0.128], [0.05, 0.136], [0.054, 0.144], [0.04, 0.152], [0.02, 0.158], [0.02, 0.176], [0.03, 0.18], [0.03, 0.186], [0, 0.19]], enamel));

  // Tubs laterals (porten l'aire de dalt al cremador).
  [-1, 1].forEach((sideSign) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sideSign * 0.06, 0.035, 0),
      new THREE.Vector3(sideSign * 0.066, 0.09, 0),
      new THREE.Vector3(sideSign * 0.058, 0.14, 0),
      new THREE.Vector3(sideSign * 0.04, 0.152, 0)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.006, 8, false), enamel));
  });

  // Nansa de filferro.
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.0022, 6, 28, Math.PI), metal);
  bail.position.y = 0.15;
  bail.rotation.y = 0.5;
  group.add(bail);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.ShaderMaterial({
      uniforms: { ...shared, uStrength: { value: 0.45 } },
      vertexShader: GLOW.vertex,
      fragmentShader: GLOW.fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  glow.position.y = 0.088;
  group.add(glow);

  return { group, glow, lightOffset: 0.09 };
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
  group.add(createBag(LAYOUT.partnerBag, COLORS.partnerBag, { sleeper: true }));

  // Dues motxilles estirades d'esquena a terra.
  function lyingPack({ x, z, color }, yaw) {
    const pack = new THREE.Group();
    const inner = createBackpack(color);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.12;
    pack.add(inner);
    placeOnGround(pack, x, z);
    pack.rotation.y = yaw;
    group.add(pack);
    return pack;
  }
  lyingPack(LAYOUT.packA, 0.35);
  lyingPack(LAYOUT.packB, 2.3);

  // Bastons estirats a terra al costat de la motxilla.
  const ax = LAYOUT.packA.x;
  const az = LAYOUT.packA.z;
  [
    [ax - 0.42, az + 0.45, ax - 0.12, az - 0.62],
    [ax - 0.5, az + 0.32, ax - 0.06, az - 0.7]
  ].forEach(([x0, z0, x1, z1]) => {
    const from = new THREE.Vector3(x0, groundHeight(x0, z0) + 0.012, z0);
    const to = new THREE.Vector3(x1, groundHeight(x1, z1) + 0.02, z1);
    const dir = to.clone().sub(from).normalize();
    group.add(createPole(from, from.clone().addScaledVector(dir, 1.1)));
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

  // El termo va al centre del bloc pla més proper (mai sobre una esquerda).
  const thermos = createThermos();
  const { blocks } = generatePavement();
  const spot = blocks
    .filter((b) => b.flush)
    // Que no quedi sota les esterilles.
    .filter((b) => !(b.cx > -0.5 && b.cx < 1.2 && b.cz > -2.0 && b.cz < 0.95))
    .reduce((best, b) => {
      const d = Math.hypot(b.cx - LAYOUT.thermos.x, b.cz - LAYOUT.thermos.z);
      return d < best.d ? { d, b } : best;
    }, { d: Infinity, b: null }).b;
  const tx = spot ? spot.cx : LAYOUT.thermos.x;
  const tz = spot ? spot.cz : LAYOUT.thermos.z;
  thermos.position.set(tx, groundHeight(tx, tz) + FLUSH_OFFSET, tz);
  group.add(thermos);

  function update(camera) {
    lantern.glow.quaternion.copy(camera.quaternion);
  }

  return { group, update };
}
