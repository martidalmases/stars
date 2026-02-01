import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();

  // Night sky background
  scene.background = new THREE.Color(0x000011);

  // Subtle fog for depth (won't wash out stars)
  scene.fog = new THREE.FogExp2(0x000011, 0.0002);

  // Ambient light (soft illumination for any terrain / objects)
  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  // Directional light (soft, to illuminate scene objects)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight.position.set(100, 200, 100);
  scene.add(dirLight);

  // Optional sky sphere for gradient / Milky Way texture
  const skyGeo = new THREE.SphereGeometry(1000, 64, 64);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x000011, // placeholder dark night
    side: THREE.BackSide
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  return scene;
}
