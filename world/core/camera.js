import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 1.6, 0); // eye level

// Rotation variables
let pitch = 0;
let yaw = 0;
const sensitivity = 0.002; // adjust speed

// Request pointer lock when clicking
document.body.addEventListener("click", () => {
  document.body.requestPointerLock();
});

// Mouse move handler
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== document.body) return;

  yaw   -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;

  const maxPitch = Math.PI / 2 - 0.05; // prevent flipping
  pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
});

export function createCamera() {
  return camera;
}

export function updateCamera() {
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
}
