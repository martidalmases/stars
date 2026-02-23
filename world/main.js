import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

import { createCamera, createDreamyController } from "./core/camera.js";
import { createScene, createSkySphere } from "./core/scene.js";
import { createRenderer } from "./core/renderer.js";

import { StoryStarSystem } from "./systems/stars.js";

console.log("Imported all correctly");
// ==============================
// Setup
// ==============================

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

window.scene = scene;
window.camera = camera;

// ==============================
// Pointer Lock (Robust Linux/Chrome)
// ==============================

let isLocked = false;

document.body.addEventListener("click", () => {
  if (!isLocked) {
    document.body.requestPointerLock();
  }
});

document.addEventListener("pointerlockchange", () => {
  isLocked = document.pointerLockElement === document.body;

  console.log("Pointer lock:", isLocked ? "ON" : "OFF");
});

const hint = document.getElementById("esc-hint");

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === document.body) {
    hint.style.display = "block";
  } else {
    hint.style.display = "none";
  }
});

// ==============================
// Camera Controller
// ==============================

const updateCamera = createDreamyController(camera);
camera.far = 3000;
camera.updateProjectionMatrix();

// ==============================
// Sky
// ==============================

scene.add(createSkySphere());
console.log("Imported sky from main");

// ==============================
// Story Stars
// ==============================

const directions = [
new THREE.Vector3(-2.2, 1.55, -0.2),
new THREE.Vector3(-1.55, 1.95, 0.25),
new THREE.Vector3(-1.05, 1.45, -0.45),
new THREE.Vector3(-0.45, 2.35, 0.15),
new THREE.Vector3(0.15, 1.7, -0.35),
new THREE.Vector3(0.7, 2.2, 0.28),
new THREE.Vector3(1.35, 1.35, -0.25),
new THREE.Vector3(2.1, 1.95, 0.35),
new THREE.Vector3(1.7, 0.95, -0.15),
new THREE.Vector3(0.95, 0.75, 0.25),
new THREE.Vector3(0.05, 0.55, -0.2),
new THREE.Vector3(-1.0, 0.9, 0.18)
];

const storyStars = new StoryStarSystem({
camera,
scene,
coordinates: directions,
onStarClick: (index) => {
console.log("Story star clicked:", index);
},
clusterCenter: new THREE.Vector3(0, 260, -760),
clusterScale: 230
});
storyStars.init();

// ==============================
// Resize
// ==============================

window.addEventListener("resize", () => {
camera.aspect = window.innerWidth / window.innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(window.innerWidth, window.innerHeight);
});

// ==============================
// Animation Loop
// ==============================

let last = performance.now();

function animate(t) {
requestAnimationFrame(animate);

const delta = (t - last) / 1000;
last = t;

updateCamera();
storyStars.update();

if (sky.userData.update) {
  sky.userData.update(delta);
}

renderer.render(scene, camera);
}

// Start animation loop
animate();
