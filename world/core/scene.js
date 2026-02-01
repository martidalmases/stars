import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();

  // Optional fog for depth / dreamy effect
  scene.fog = new THREE.FogExp2(0x000011, 0.0005); 
  // Adjust density (0.0005) to taste depending on scene scale

  // Ambient light to softly illuminate stars/scene
  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  // Optional directional light for scene objects (e.g., mountains)
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight.position.set(100, 200, 100);
  scene.add(dirLight);

  // Sky sphere placeholder (can later add gradient texture or Milky Way)
  const skyGeo = new THREE.SphereGeometry(1000, 64, 64);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x000011,
    side: THREE.BackSide
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  return scene;
}
