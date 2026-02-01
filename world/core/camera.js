import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 1.6, 0); // eye height

// Rotation state
let pitch = 0;
let yaw = 0;
let targetPitch = 0;
let targetYaw = 0;

// Tuning
const sensitivity = 0.0015;
const smoothing = 0.08;
const maxPitch = Math.PI / 2.2;

// Pointer lock state
let locked = false;

// ESC hint
const hint = document.createElement("div");
hint.innerHTML = "Press ESC to exit";
hint.style.position = "fixed";
hint.style.bottom = "20px";
hint.style.left = "50%";
hint.style.transform = "translateX(-50%)";
hint.style.color = "rgba(255,255,255,0.6)";
hint.style.fontSize = "14px";
hint.style.fontFamily = "system-ui, sans-serif";
hint.style.pointerEvents = "none";
hint.style.opacity = "0";
hint.style.transition = "opacity 0.5s";
document.body.appendChild(hint);

// Request pointer lock on click
document.body.addEventListener("click", () => {
  if (!locked) document.body.requestPointerLock();
});

// Pointer lock change
document.addEventListener("pointerlockchange", () => {
  locked = document.pointerLockElement === document.body;
  hint.style.opacity = locked ? "1" : "0";
});

// Mouse movement
document.addEventListener("mousemove", (e) => {
  if (!locked) return;
  targetYaw   -= e.movementX * sensitivity;
  targetPitch -= e.movementY * sensitivity;
  targetPitch = Math.max(-maxPitch, Math.min(maxPitch, targetPitch));
});

// Public API
export function createCamera() {
  return camera;
}

export function updateCamera() {
  // Smoothly interpolate toward target (dreamy effect)
  yaw   += (targetYaw - yaw) * smoothing;
  pitch += (targetPitch - pitch) * smoothing;
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
}
