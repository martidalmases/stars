import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { shared } from "../core/environment.js";
import { CLOUD_SEA, CLOUD_SHELL, HIGH_CLOUD } from "../shaders/shaders.js";
import { CLOUD_Y } from "../landscape/terrain.js";
import { mulberry32 } from "../core/noise.js";

// ------------------------------------------------------------------
// Mar de núvols: una base fosca i 8 capes translúcides a sobre.
// ------------------------------------------------------------------

// Textura de soroll que es repeteix sense costures (R: formes grans, G: bonys).
function createCloudNoiseTexture(size = 256) {
  const rng = mulberry32(321);
  const lattice = (period) => {
    const g = new Float32Array(period * period);
    for (let i = 0; i < g.length; i += 1) g[i] = rng();
    return (x, y) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const fx = x - xi;
      const fy = y - yi;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const at = (i, j) => g[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
      const a = at(xi, yi);
      const b = at(xi + 1, yi);
      const c = at(xi, yi + 1);
      const d = at(xi + 1, yi + 1);
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    };
  };
  const octaves = [4, 8, 16, 32, 64].map((p) => ({ p, f: lattice(p) }));
  const octavesB = [8, 16, 32, 64].map((p) => ({ p, f: lattice(p) }));

  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let fbm = 0;
      let amp = 0.5;
      let norm = 0;
      octaves.forEach(({ p, f }) => {
        fbm += f((x / size) * p, (y / size) * p) * amp;
        norm += amp;
        amp *= 0.5;
      });
      fbm /= norm;
      // Billow: bonys arrodonits.
      let bil = 0;
      amp = 0.5;
      norm = 0;
      octavesB.forEach(({ p, f }) => {
        bil += (1 - Math.abs(f((x / size) * p, (y / size) * p) * 2 - 1)) * amp;
        norm += amp;
        amp *= 0.5;
      });
      bil /= norm;
      const i = (y * size + x) * 4;
      data[i] = Math.round(Math.min(1, Math.max(0, (fbm - 0.2) / 0.6)) * 255);
      data[i + 1] = Math.round(Math.min(1, Math.max(0, (bil - 0.35) / 0.55)) * 255);
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function createCloudSea() {
  const group = new THREE.Group();
  const noise = createCloudNoiseTexture();
  const colors = {
    uCloudLit: { value: new THREE.Vector3(0.15, 0.16, 0.19) },
    uCloudShadow: { value: new THREE.Vector3(0.018, 0.021, 0.03) }
  };

  const base = new THREE.Mesh(
    new THREE.CircleGeometry(1000, 96),
    new THREE.ShaderMaterial({
      uniforms: { ...shared, ...colors, uNoise: { value: noise } },
      vertexShader: CLOUD_SEA.vertex,
      fragmentShader: CLOUD_SEA.fragment
    })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = CLOUD_Y - 10;
  base.frustumCulled = false;
  group.add(base);

  // Capes: de baix a dalt, uns 22 m de gruix de núvol.
  const LAYERS = 12;
  const thickness = 22;
  const ring = new THREE.CircleGeometry(1000, 96);
  for (let i = 0; i < LAYERS; i += 1) {
    const layer = i / (LAYERS - 1);
    const mesh = new THREE.Mesh(
      ring,
      new THREE.ShaderMaterial({
        uniforms: { ...shared, ...colors, uNoise: { value: noise }, uLayer: { value: layer }, uLayerStep: { value: 0.62 / (LAYERS - 1) } },
        vertexShader: CLOUD_SHELL.vertex,
        fragmentShader: CLOUD_SHELL.fragment,
        transparent: true,
        depthWrite: false
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = CLOUD_Y - 10 + layer * thickness;
    mesh.renderOrder = -1 + i * 0.01;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  return group;
}

// ------------------------------------------------------------------
// Núvols alts: bandes primes i translúcides que llisquen lentament
// prop de l'horitzó, sense tapar la part del cel on hi ha la constel·lació.
// ------------------------------------------------------------------
function createStratusTexture(seed) {
  const rng = mulberry32(seed);
  const w = 512;
  const h = 192;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < 70; i += 1) {
    const t = rng();
    const x = w * (0.12 + 0.76 * t);
    const centerWeight = Math.sin(Math.PI * t);
    const y = h * (0.5 + (rng() - 0.5) * 0.28 * centerWeight);
    const rx = w * (0.05 + rng() * 0.12) * (0.6 + centerWeight * 0.6);
    const ry = h * (0.08 + rng() * 0.14) * (0.5 + centerWeight * 0.6);
    const alpha = (0.05 + rng() * 0.1) * (0.4 + centerWeight * 0.6);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.4})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createHighClouds({
  count = 8,
  seed = 99,
  elevation = [4, 15],
  distance = [520, 780],
  widthRange = [260, 500],
  color = [0.09, 0.105, 0.15],
  opacity = [0.3, 0.5],
  speedDeg = [0.12, 0.28]
} = {}) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const clouds = [];
  const deg = THREE.MathUtils.degToRad;
  const limit = deg(128);

  for (let i = 0; i < count; i += 1) {
    const width = widthRange[0] + rng() * (widthRange[1] - widthRange[0]);
    const geo = new THREE.PlaneGeometry(width, width * (0.2 + rng() * 0.1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: createStratusTexture(seed * 3 + i) },
        uColor: { value: new THREE.Vector3(color[0], color[1], color[2]) },
        uOpacity: { value: 0 }
      },
      vertexShader: HIGH_CLOUD.vertex,
      fragmentShader: HIGH_CLOUD.fragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    clouds.push({
      mesh,
      az: -limit + (2 * limit * (i + rng() * 0.7)) / count,
      el: deg(elevation[0] + rng() * (elevation[1] - elevation[0])),
      dist: distance[0] + rng() * (distance[1] - distance[0]),
      speed: deg(speedDeg[0] + rng() * (speedDeg[1] - speedDeg[0])) * (rng() < 0.75 ? 1 : -1),
      opacity: opacity[0] + rng() * (opacity[1] - opacity[0])
    });
  }

  function place(c) {
    const ce = Math.cos(c.el);
    c.mesh.position.set(
      Math.sin(c.az) * ce * c.dist,
      Math.sin(c.el) * c.dist,
      -Math.cos(c.az) * ce * c.dist
    );
    c.mesh.lookAt(0, c.mesh.position.y * 0.4, 0);
    // Apareix i desapareix suaument als extrems del recorregut.
    const edge = 1 - THREE.MathUtils.smoothstep(Math.abs(c.az), limit - deg(20), limit);
    c.mesh.material.uniforms.uOpacity.value = c.opacity * edge;
  }

  clouds.forEach(place);

  function update(dt) {
    clouds.forEach((c) => {
      c.az += c.speed * dt;
      if (c.az > limit) c.az = -limit;
      if (c.az < -limit) c.az = limit;
      place(c);
    });
  }

  return { group, update };
}
