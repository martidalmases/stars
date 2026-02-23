import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";


export function createCamera() {
const camera = new THREE.PerspectiveCamera(
90,
window.innerWidth / window.innerHeight,
0.001,
5000
);


camera.position.set(0, 0, 1);


return camera;
}


export function createDreamyController(camera) {
  let yaw = 0;
  let pitch = THREE.MathUtils.degToRad(25);

  let targetYaw = 0;
  let targetPitch = THREE.MathUtils.degToRad(25);

  const sensitivity = 0.002;
  const smoothness = 0.08;

  const minPitch = THREE.MathUtils.degToRad(-20);
  const maxPitch = THREE.MathUtils.degToRad(80);
  const maxYaw = Math.PI / 2; // +/- 90deg -> total 180deg scene

  window.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== document.body) return;

    targetYaw   -= e.movementX * sensitivity;
    targetPitch -= e.movementY * sensitivity;

    targetYaw = Math.max(
      -maxYaw,
      Math.min(maxYaw, targetYaw)
    );

    // Clamp vertical
    targetPitch = Math.max(
      minPitch,
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
