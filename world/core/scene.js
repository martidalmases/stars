import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function createSkySphere() {
  console.log("[Sky] Initializing night sky dome (dark vertical gradient + horizon haze)...");

  const geo = new THREE.SphereGeometry(1010, 64, 64);

  const nightGradientMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      horizonColor: { value: new THREE.Color(0x101a2c) },
      zenithColor: { value: new THREE.Color(0x010205) },
      pollutionBandColor: { value: new THREE.Color(0xc2c9d4) }
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
      uniform vec3 pollutionBandColor;
      varying vec3 vWorldDir;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      void main() {
        float y = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);

        float t = smoothstep(0.04, 0.62, pow(y, 2.15));
        vec3 skyColor = mix(horizonColor, zenithColor, t);

        float horizonBand = exp(-pow(abs(vWorldDir.y) / 0.085, 2.0));
        skyColor += pollutionBandColor * horizonBand * 0.14;

        float nA = hash(vWorldDir * 210.0);
        float nB = hash(vWorldDir.zyx * 390.0);
        float noise = (nA * 0.65 + nB * 0.35) - 0.5;
        skyColor += noise * 0.018;

        gl_FragColor = vec4(clamp(skyColor, 0.0, 1.0), 1.0);
      }
    `
  });

  const sky = new THREE.Mesh(geo, nightGradientMat);
  sky.frustumCulled = false;
  sky.renderOrder = -2;

  console.log("[Sky] Sky dome ready with atmospheric gradient and horizon haze.");
  return sky;
}
