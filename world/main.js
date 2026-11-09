import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

import { createCamera, createDreamyController, IS_TOUCH } from "./core/camera.js";
import { createScene, createSkySphere } from "./core/scene.js";
import { createRenderer } from "./core/renderer.js";
import { updateEnvironment } from "./core/environment.js";

import { createSummit } from "./landscape/summit.js";
import { createMountains } from "./landscape/mountains.js";
import { createCloudSea, createHighClouds } from "./effects/clouds.js";
import { createVegetation } from "./effects/grass.js";
import { createShootingStars } from "./effects/shootingStar.js";
import { createBivac } from "./bivac/bivac.js";

import { StoryStarSystem } from "./systems/stars.js";
import { StoryOverlay } from "./systems/storyOverlay.js";
import { CONSTELLATIONS, ACTIVE_CONSTELLATION } from "./data/constellation.js";

// Versió de l'escena (temporal). Ha de coincidir amb version.json.
const SCENE_VERSION = "0.7";
window.parent?.postMessage({ sceneVersion: SCENE_VERSION }, "*");
console.log(`[laurins] escena versió ${SCENE_VERSION}`);

// Deixa respirar el navegador entre passos pesats: així la portada no es congela
// mentre l'escena es construeix en segon pla.
const breathe = () => new Promise((resolve) => setTimeout(resolve, 30));

// ==============================
// Escena bàsica
// ==============================

const scene = createScene();
const camera = createCamera();
const renderer = createRenderer();
document.body.appendChild(renderer.domElement);

const storyOverlay = new StoryOverlay({ dataUrl: "./data/story-slides.json" });
await storyOverlay.init();

let hasFinishedExperience = false;

const updateCamera = createDreamyController(camera, {
  isBlocked: () => storyOverlay.isOpen() || hasFinishedExperience
});

// ==============================
// Bloqueig del ratolí (ordinador)
// ==============================

const hint = document.getElementById("esc-hint");
const endingOverlay = document.getElementById("ending-overlay");
const endingTitle = document.getElementById("ending-title");
const endingText = document.getElementById("ending-text");
const clickStarHint = document.getElementById("click-star-hint");

if (IS_TOUCH) {
  clickStarHint.textContent = "mira l'estrella que brilla i toca-la";
}

document.body.addEventListener("click", () => {
  if (IS_TOUCH || storyOverlay.isOpen() || hasFinishedExperience) return;
  if (document.pointerLockElement !== document.body) {
    document.body.requestPointerLock?.();
  }
});

document.addEventListener("pointerlockchange", () => {
  hint.style.display = document.pointerLockElement === document.body ? "block" : "none";
});

// ==============================
// Gra de pel·lícula (textura de soroll generada un cop)
// ==============================

(function createGrainTexture() {
  const size = 180;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  document.documentElement.style.setProperty("--grain-texture", `url(${canvas.toDataURL()})`);
})();

// ==============================
// Paisatge
// ==============================

await breathe();
const sky = createSkySphere(camera, renderer);
scene.add(sky);
await breathe();
scene.add(createMountains());
await breathe();
scene.add(createCloudSea());

const highClouds = createHighClouds();
scene.add(highClouds.group);

// Bancs de boira entre les serralades, just per sobre del mar de núvols.
const mistBanks = createHighClouds({
  count: 14,
  seed: 7,
  elevation: [-3.2, -0.6],
  distance: [230, 640],
  widthRange: [220, 420],
  color: [0.052, 0.063, 0.094],
  opacity: [0.45, 0.75],
  speedDeg: [0.05, 0.12]
});
scene.add(mistBanks.group);
await breathe();

scene.add(createSummit());
await breathe();
scene.add(createVegetation());
await breathe();

const bivac = createBivac();
scene.add(bivac.group);

const shootingStars = createShootingStars();
scene.add(shootingStars.points);

// ==============================
// Constel·lació
// ==============================

const constellation = CONSTELLATIONS[ACTIVE_CONSTELLATION];
const STAR_DISTANCE = 900;

function skyPoint([u, v]) {
  const az = THREE.MathUtils.degToRad(constellation.center.az + (u * constellation.size.w) / 2);
  const el = THREE.MathUtils.degToRad(constellation.center.el + (v * constellation.size.h) / 2);
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    -Math.cos(az) * Math.cos(el)
  ).multiplyScalar(STAR_DISTANCE);
}

function triggerEnding(star) {
  if (!endingOverlay || !star) return;

  const endSlide = storyOverlay.getEndingSlide();
  endingTitle.textContent = endSlide.title;
  endingText.textContent = endSlide.text;

  const projected = star.position.clone().project(camera);
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

  endingOverlay.style.setProperty("--flash-x", `${x}px`);
  endingOverlay.style.setProperty("--flash-y", `${y}px`);
  endingOverlay.classList.add("is-active");
}

const storyStars = new StoryStarSystem({
  camera,
  scene,
  coordinates: constellation.points.map(skyPoint),
  clusterCenter: new THREE.Vector3(0, 0, 0),
  clusterScale: 1,
  onStarClick: (index, star) => {
    if (hasFinishedExperience) return;

    if (storyStars.isLastStar(index)) {
      // Última estrella: es tanca la figura, brilla uns segons i arriba el final.
      hasFinishedExperience = true;
      if (constellation.closed) storyStars.connectPair(index, 0);
      storyStars.celebrate();
      setTimeout(() => {
        if (document.pointerLockElement === document.body) document.exitPointerLock();
        triggerEnding(star);
      }, 2600);
      return;
    }

    if (document.pointerLockElement === document.body) {
      document.exitPointerLock();
    }

    if (storyOverlay.hasSlide(index)) {
      storyOverlay.open(index);
    }
  }
});
storyStars.init();
storyStars.setViewportSize(window.innerWidth, window.innerHeight);

// ==============================
// Redimensionar
// ==============================

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  storyStars.setViewportSize(window.innerWidth, window.innerHeight);
});

// ==============================
// Bucle d'animació
// ==============================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  updateEnvironment(t);
  updateCamera();
  storyStars.update();
  highClouds.update(delta);
  mistBanks.update(delta);
  shootingStars.update(delta);
  bivac.update(camera);
  sky.userData.update?.(delta);

  if (clickStarHint) {
    const showHint = storyStars.shouldShowClickHint() && !storyOverlay.isOpen() && !hasFinishedExperience;
    clickStarHint.classList.toggle("is-visible", showHint);
  }

  renderer.render(scene, camera);
}

// Compila els shaders abans del primer fotograma, sense bloquejar (si el navegador ho permet).
if (renderer.compileAsync) {
  try {
    await renderer.compileAsync(scene, camera);
  } catch (e) {
    console.warn("compileAsync", e);
  }
}

animate();

// Avisa la portada que l'escena ja està a punt (després d'un parell de fotogrames,
// quan els shaders ja s'han compilat).
requestAnimationFrame(() =>
  requestAnimationFrame(() => window.parent?.postMessage({ sceneReady: true }, "*"))
);
