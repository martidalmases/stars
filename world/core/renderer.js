import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 1.35;

  console.log("[Renderer] ACES tone mapping enabled. Exposure:", renderer.toneMappingExposure);

  return renderer;
}
