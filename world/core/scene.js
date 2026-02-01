import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const skyGeo = new THREE.SphereGeometry(1000, 64, 64);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x000011, // dark night base
    side: THREE.BackSide // render inside of sphere
  });

  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  return sky;
}
