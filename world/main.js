import { createRenderer } from "./core/renderer.js";
import { createScene } from "./core/scene.js";
import { createCamera, updateCamera } from "./core/camera.js";

import { createStars, updateStars, handleStarClick } from "./systems/stars.js";

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

// Create stars
createStars(scene, 50); // 50 filler stars + fixed story stars

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Click → star interaction
window.addEventListener("click", () => handleStarClick());

// Render loop
function animate() {
  requestAnimationFrame(animate);

  updateCamera();
  updateStars(camera);

  renderer.render(scene, camera);
}

animate();
