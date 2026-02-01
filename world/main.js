import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { createCamera, updateCamera } from "./core/camera.js";
import { createStars, updateStars, handleStarClick } from "./systems/stars.js";

const scene = new THREE.Scene();

// Sky sphere
const skyGeo = new THREE.SphereGeometry(1000, 64, 64);
const skyMat = new THREE.MeshBasicMaterial({ color: 0x000011, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

const camera = createCamera();

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Stars
createStars(scene, 100); // 100 background stars

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Click
window.addEventListener("click", () => handleStarClick());

// Render loop
function animate() {
  requestAnimationFrame(animate);

  updateCamera();
  updateStars(camera);

  renderer.render(scene, camera);
}

animate();
