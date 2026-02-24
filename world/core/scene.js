import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function createSkySphere() {
  console.log("[Sky] Initializing debug sky dome (solid red shader)...");

  const geo = new THREE.SphereGeometry(1010, 64, 64);

  const redSkyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `
  });

  const sky = new THREE.Mesh(geo, redSkyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -2;

  console.log("[Sky] Sky dome ready with solid red shader.");
  return sky;
}
