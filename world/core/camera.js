import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

// Mòbil o tauleta (pantalla tàctil com a punter principal).
export const IS_TOUCH = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

export function createCamera() {
  // Estàs estirat dins el sac amb el cap una mica aixecat: ulls a l'origen,
  // terra mig metre per sota.
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 6000);
  camera.position.set(0, 0, 0);
  return camera;
}

// Mirar al voltant: ratolí bloquejat a l'ordinador, arrossegar el dit al mòbil.
export function createDreamyController(
  camera,
  {
    initialPitchDeg = 8,
    minPitchDeg = -42,
    maxPitchDeg = 80,
    maxYawDeg = 90,
    isBlocked = () => false
  } = {}
) {
  const deg = THREE.MathUtils.degToRad;
  let yaw = 0;
  let pitch = deg(initialPitchDeg);
  let targetYaw = yaw;
  let targetPitch = pitch;

  const sensitivity = 0.002;
  const touchSensitivity = 0.0042;
  const smoothness = 0.08;
  const minPitch = deg(minPitchDeg);
  const maxPitch = deg(maxPitchDeg);
  const maxYaw = deg(maxYawDeg);

  function nudge(dYaw, dPitch) {
    targetYaw = THREE.MathUtils.clamp(targetYaw + dYaw, -maxYaw, maxYaw);
    targetPitch = THREE.MathUtils.clamp(targetPitch + dPitch, minPitch, maxPitch);
  }

  window.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== document.body) return;
    nudge(-e.movementX * sensitivity, -e.movementY * sensitivity);
  });

  // Tàctil: arrossegar el cel (com agafar-lo amb el dit).
  let touchId = null;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener(
    "touchstart",
    (e) => {
      if (touchId !== null || isBlocked()) return;
      const t = e.changedTouches[0];
      touchId = t.identifier;
      lastX = t.clientX;
      lastY = t.clientY;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (touchId === null || isBlocked()) return;
      const t = [...e.changedTouches].find((c) => c.identifier === touchId);
      if (!t) return;
      nudge((t.clientX - lastX) * touchSensitivity, (t.clientY - lastY) * touchSensitivity);
      lastX = t.clientX;
      lastY = t.clientY;
      e.preventDefault();
    },
    { passive: false }
  );

  const endTouch = (e) => {
    if ([...e.changedTouches].some((c) => c.identifier === touchId)) touchId = null;
  };
  window.addEventListener("touchend", endTouch);
  window.addEventListener("touchcancel", endTouch);

  return function updateCamera() {
    yaw += (targetYaw - yaw) * smoothness;
    pitch += (targetPitch - pitch) * smoothness;
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.rotation.z = 0;
  };
}
