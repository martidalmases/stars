import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { SHOOTING_STAR } from "../shaders/shaders.js";

// De tant en tant creua el cel un estel fugaç, sempre lluny de la constel·lació.
export function createShootingStars({ radius = 940, firstDelay = 22 } = {}) {
  const N = 28;
  const positions = new Float32Array(N * 3);
  const alphas = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) } },
    vertexShader: SHOOTING_STAR.vertex,
    fragmentShader: SHOOTING_STAR.fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;

  const deg = THREE.MathUtils.degToRad;
  const dirFrom = (az, el) =>
    new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));

  let wait = firstDelay;
  let active = null;

  function spawn() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const az0 = deg(side * (38 + Math.random() * 45));
    const el0 = deg(38 + Math.random() * 24);
    const az1 = az0 + deg(side * (9 + Math.random() * 8));
    const el1 = el0 - deg(7 + Math.random() * 6);
    active = {
      a: dirFrom(az0, el0),
      b: dirFrom(az1, el1),
      t: 0,
      duration: 0.75 + Math.random() * 0.45
    };
    points.visible = true;
  }

  const tmp = new THREE.Vector3();

  function update(dt) {
    if (!active) {
      wait -= dt;
      if (wait <= 0) spawn();
      return;
    }

    active.t += dt / active.duration;
    const head = active.t;
    const fade = Math.sin(Math.PI * Math.min(1, head));

    for (let i = 0; i < N; i += 1) {
      const p = Math.max(0, head - i * 0.014);
      tmp.copy(active.a).lerp(active.b, Math.min(1, p)).normalize().multiplyScalar(radius);
      positions[i * 3] = tmp.x;
      positions[i * 3 + 1] = tmp.y;
      positions[i * 3 + 2] = tmp.z;
      alphas[i] = head - i * 0.014 > 0 ? (1 - i / N) * fade : 0;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;

    if (head >= 1.25) {
      active = null;
      points.visible = false;
      wait = 25 + Math.random() * 35;
    }
  }

  return { points, update };
}
