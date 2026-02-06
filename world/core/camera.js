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
  let yaw = 0;
  let pitch = 0;

  let targetYaw = 0;
  let targetPitch = 0;

  const sensitivity = 0.002;
  const smoothness = 0.08;

  const maxPitch = Math.PI / 2 - 0.05;

  window.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== document.body) return;

    targetYaw   -= e.movementX * sensitivity;
    targetPitch -= e.movementY * sensitivity;

    // Clamp vertical
    targetPitch = Math.max(
      -maxPitch,
      Math.min(maxPitch, targetPitch)
    );
  });

  return function updateCamera() {
    // Smooth interpolation
    yaw   += (targetYaw - yaw) * smoothness;
    pitch += (targetPitch - pitch) * smoothness;

    // Apply rotation (FPS style)
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;
  };
}

