import { createRenderer } from "./core/renderer.js";
import { createScene } from "./core/scene.js";
import { createCamera, updateCamera } from "./core/camera.js";

import { createStars, updateStars, handleStarClick } from "./systems/stars.js";

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();

createStars(scene, 500);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("click", () => handleStarClick());

function animate() {
  requestAnimationFrame(animate);

  updateCamera();
  updateStars(camera);

  renderer.render(scene, camera);
}

animate();
