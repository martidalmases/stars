import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {

  const scene = new THREE.Scene();

  // Dark night background
  scene.background = new THREE.Color(0x020207);

  // Subtle fog
  scene.fog = new THREE.FogExp2(0x020207, 0.015);

  // Soft ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // Quick test object
  const geometry = new THREE.SphereGeometry(0.2, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xffdd99 });
  const sphere = new THREE.Mesh(geometry, material);

  sphere.position.set(0, 1.6, -3);
  scene.add(sphere);

  return scene;
}
