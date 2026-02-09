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
    topColor:    { value: new THREE.Color(0x79f2ff) },
    bottomColor: { value: new THREE.Color(0xff6bd6) }
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
    varying vec3 vWorldPosition;


    void main() {
      vec3 dir = normalize(vWorldPosition);
      float h = dir.y * 0.5 + 0.5;
      float base = smoothstep(0.0, 1.0, h);
      vec3 color = mix(bottomColor, topColor, base);
      gl_FragColor = vec4(color, 1.0);
    }
  `
});




const sky = new THREE.Mesh(geo, mat);
sky.frustumCulled = false;
sky.renderOrder = -1;

return sky;
}
