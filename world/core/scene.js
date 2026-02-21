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
    topColor: { value: new THREE.Color(0x05070f) },
    bottomColor: { value: new THREE.Color(0x1a2744) },
    horizonColor: { value: new THREE.Color(0x4d6b9a) },
    horizonZ: { value: 0.0 },
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
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform vec3 horizonColor;
    uniform float horizonZ;
    uniform float horizonBlend;
    varying vec3 vWorldPosition;


    void main() {
      vec3 dir = normalize(vWorldPosition);
      float h = smoothstep(-0.6, 0.9, dir.z - horizonZ);
      float base = smoothstep(0.0, 1.0, h);
      vec3 color = mix(bottomColor, topColor, base);
      float horizon = 1.0 - smoothstep(0.0, horizonBlend, abs(dir.z - horizonZ));
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
