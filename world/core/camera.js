import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";


export function createCamera() {
const camera = new THREE.PerspectiveCamera(
70,
window.innerWidth / window.innerHeight,
0.1,
2000
);


camera.position.set(0, 0, 0);


return camera;
}


export function createDreamyController(camera) {
let target = new THREE.Vector2();
let current = new THREE.Vector2();


const sensitivity = 0.0004;
const smoothness = 0.05;


window.addEventListener("mousemove", (e) => {
target.x += e.movementY * sensitivity;
target.y += e.movementX * sensitivity;
});


return function updateCamera() {
current.lerp(target, smoothness);


camera.rotation.x = current.x;
camera.rotation.y = current.y;
};
}
