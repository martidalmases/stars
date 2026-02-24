import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function createSkySphere() {
  console.log("[Sky] Initializing night sky dome (vertical atmospheric gradient)...");

  const geo = new THREE.SphereGeometry(1010, 64, 64);

  const nightGradientMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      horizonColor: { value: new THREE.Color(0x3f5f92) },
      zenithColor: { value: new THREE.Color(0x04070f) }
    },
    vertexShader: `
      varying vec3 vWorldDir;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 horizonColor;
      uniform vec3 zenithColor;
      varying vec3 vWorldDir;

      void main() {
        float y = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);

        float t = smoothstep(0.0, 1.0, pow(y, 1.35));
        vec3 skyColor = mix(horizonColor, zenithColor, t);

        gl_FragColor = vec4(skyColor, 1.0);
      }
    `
  });

  const sky = new THREE.Mesh(geo, nightGradientMat);
  sky.frustumCulled = false;
  sky.renderOrder = -2;

  console.log("[Sky] Sky dome ready with atmospheric gradient.");
  return sky;
}
