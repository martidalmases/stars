import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });

  renderer.setSize(window.innerWidth, window.innerHeight);
  // Amb el gra i la vinyeta per sobre, no cal resolució de retina: és el que més
  // feina estalvia a la targeta gràfica.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 1.35;

  return renderer;
}
