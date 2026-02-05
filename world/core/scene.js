import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";


export function createScene() {
const scene = new THREE.Scene();


return scene;
}


export function createSkySphere() {
const geo = new THREE.SphereGeometry(1010, 64, 64);


const mat = new THREE.ShaderMaterial({
side: THREE.BackSide,


uniforms: {
topColor: { value: new THREE.Color(0x020111) },
bottomColor: { value: new THREE.Color(0x0a1a2f) },
offset: { value: 33 },
exponent: { value: 0.6 }
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
uniform float offset;
uniform float exponent;


varying vec3 vWorldPosition;


void main() {
float h = normalize(vWorldPosition + offset).y;
float mixVal = max(pow(max(h, 0.0), exponent), 0.0);


gl_FragColor = vec4(mix(bottomColor, topColor, mixVal), 1.0);
}
`
});


return new THREE.Mesh(geo, mat);
}
