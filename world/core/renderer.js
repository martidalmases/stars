import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";


export function createRenderer() {
const renderer = new THREE.WebGLRenderer({ antialias: true });


renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);


return renderer;
}
