import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

import { createCamera, createDreamyController } from "./core/camera.js";
import { createScene, createSkySphere } from "./core/scene.js";
import { createRenderer } from "./core/renderer.js";

import { BackgroundStars, StoryStarSystem } from "./systems/stars.js";

console.log("Imported all correctly");
// ==============================
// Setup
// ==============================

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

// ==============================
// Pointer Lock
// ==============================

document.body.addEventListener("click", () => {
  document.body.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === document.body) {
    console.log("Pointer locked");
  } else {
    console.log("Pointer unlocked");
  }
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

// ==============================
// Sky
// ==============================

scene.add(createSkySphere());

// ==============================
// Background Stars
// ==============================

const bgStars = new BackgroundStars({
count: 5000,
radius: 1000,
size: 1.5
});
scene.add(bgStars.create());

// ==============================
// Story Stars
// ==============================

const directions = [
new THREE.Vector3(1, 0, 0),
new THREE.Vector3(0.8, 0.2, 0.5),
new THREE.Vector3(0.3, 0.6, 0.7),
new THREE.Vector3(-0.2, 0.8, 0.5),
new THREE.Vector3(-0.6, 0.4, 0.2),
new THREE.Vector3(-0.9, 0.1, -0.2),
new THREE.Vector3(-0.7, -0.4, -0.5),
new THREE.Vector3(-0.3, -0.7, -0.6),
new THREE.Vector3(0.1, -0.8, -0.5),
new THREE.Vector3(0.4, -0.6, -0.3),
new THREE.Vector3(0.7, -0.3, 0.1),
new THREE.Vector3(0.9, -0.1, 0.4)
];

const storyStars = new StoryStarSystem({
camera,
scene,
coordinates: directions,
onStarClick: (index) => {
console.log("Story star clicked:", index);
}
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
bgStars.update(delta);
storyStars.update();

renderer.render(scene, camera);
}

// Start animation loop
animate();
