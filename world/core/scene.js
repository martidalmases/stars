import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";


export function createScene() {
const scene = new THREE.Scene();


return scene;
}


export function createSkySphere() {
const geo = new THREE.SphereGeometry(1010, 64, 64);


const mat = new THREE.ShaderMaterial({
  side: THREE.BackSide,

  transparent: false,
  depthWrite: false,
  depthTest: false,   // <<< IMPORTANT


  uniforms: {
    zenithColor: { value: new THREE.Color(0x04050c) },
    upperMidColor: { value: new THREE.Color(0x0b1f55) },
    lowerMidColor: { value: new THREE.Color(0x264f8d) },
    horizonColor: { value: new THREE.Color(0xe2dcbd) },
    horizonY: { value: 0.0 },
    horizonBlend: { value: 0.18 }
  },

  vertexShader: `
    varying vec3 vWorldPosition;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform vec3 zenithColor;
    uniform vec3 upperMidColor;
    uniform vec3 lowerMidColor;
    uniform vec3 horizonColor;
    uniform float horizonY;
    uniform float horizonBlend;
    varying vec3 vWorldPosition;


    void main() {
      vec3 dir = normalize(vWorldPosition);

      float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 color = mix(upperMidColor, zenithColor, smoothstep(0.35, 1.0, t));
      color = mix(lowerMidColor, color, smoothstep(0.06, 0.75, t));

      float horizon = 1.0 - smoothstep(0.0, horizonBlend, abs(dir.y - horizonY));
      color = mix(color, horizonColor, horizon * 0.85);
      gl_FragColor = vec4(color, 1.0);
    }
  `
});




const sky = new THREE.Mesh(geo, mat);
sky.frustumCulled = false;
sky.renderOrder = -1;

return sky;
}
