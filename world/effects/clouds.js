import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { shared } from "../core/environment.js";
import { CLOUD_SEA, HIGH_CLOUD } from "../shaders/shaders.js";
import { CLOUD_Y } from "../landscape/terrain.js";
import { mulberry32 } from "../core/noise.js";

// ------------------------------------------------------------------
// Mar de núvols: un pla ondulat i animat que tapa les valls.
// ------------------------------------------------------------------
export function createCloudSea() {
  const geo = new THREE.RingGeometry(0.5, 1000, 240, 120);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uCloudAmp: { value: 14 },
      uCloudLit: { value: new THREE.Vector3(0.105, 0.127, 0.18) },
      uCloudShadow: { value: new THREE.Vector3(0.034, 0.042, 0.064) }
    },
    vertexShader: CLOUD_SEA.vertex,
    fragmentShader: CLOUD_SEA.fragment
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = CLOUD_Y;
  mesh.frustumCulled = false;
  return mesh;
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
  color = [0.12, 0.14, 0.2],
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
