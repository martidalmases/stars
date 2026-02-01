import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {

  const scene = new THREE.Scene();

  // Dark night background
  scene.background = new THREE.Color(0x020207);

  // Subtle fog (optional now, useful later)
  scene.fog = new THREE.FogExp2(0x020207, 0.015);

  // Soft ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // Moon-like directional light
  const moon = new THREE.DirectionalLight(0x88aaff, 0.8);
  moon.position.set(10, 20, 10);
  scene.add(moon);

  return scene;
}

