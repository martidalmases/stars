import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

// Settings
const lookSpeed = 0.002;
const maxPitch = Math.PI / 2.2;

let yaw = 0;
let pitch = 0;
let isDragging = false;
let lastX = 0;
let lastY = 0;

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

// Initial position (eye height)
camera.position.set(0, 1.6, 0);


// Mouse input
document.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});

document.addEventListener("mousemove", (e) => {

  if (!isDragging) return;

  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;

  lastX = e.clientX;
  lastY = e.clientY;

  yaw   -= dx * lookSpeed;
  pitch -= dy * lookSpeed;

  pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
});


// Touch (mobile support)
document.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) return;

  isDragging = true;

  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;
});

document.addEventListener("touchend", () => {
  isDragging = false;
});

document.addEventListener("touchmove", (e) => {

  if (!isDragging || e.touches.length !== 1) return;

  const dx = e.touches[0].clientX - lastX;
  const dy = e.touches[0].clientY - lastY;

  lastX = e.touches[0].clientX;
  lastY = e.touches[0].clientY;

  yaw   -= dx * lookSpeed;
  pitch -= dy * lookSpeed;

  pitch = Math.max(-maxPitch, Math.min(maxPitch, pitch));
});


// Public API

export function createCamera() {
  return camera;
}

export function updateCamera() {

  const euler = new THREE.Euler(
    pitch,
    yaw,
    0,
    "YXZ"
  );

  camera.quaternion.setFromEuler(euler);
}

