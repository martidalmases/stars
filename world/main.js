import { createRenderer } from "./core/renderer.js";
import { createScene } from "./core/scene.js";
import { createCamera, updateCamera } from "./core/camera.js";

// Core
const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

// Resize
window.addEventListener("resize", onResize);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  updateCamera();
  renderer.render(scene, camera);
}

animate();

