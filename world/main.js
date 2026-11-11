import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

import { createCamera, createDreamyController, IS_TOUCH } from "./core/camera.js";
import { createScene, createSkySphere } from "./core/scene.js";
import { createRenderer } from "./core/renderer.js";
import { updateEnvironment, shared } from "./core/environment.js";

import { createSummit } from "./landscape/summit.js";
import { createMountains } from "./landscape/mountains.js";
import { createCloudSea, createHighClouds } from "./effects/clouds.js";
import { createVegetation } from "./effects/grass.js";
import { createShootingStars } from "./effects/shootingStar.js";
import { createBivac } from "./bivac/bivac.js";

import { StoryStarSystem, STORY_STATE } from "./systems/stars.js";
import { StoryOverlay } from "./systems/storyOverlay.js";
import { CONSTELLATIONS, ACTIVE_CONSTELLATION } from "./data/constellation.js";

// Versió de l'escena (temporal). Ha de coincidir amb version.json.
const SCENE_VERSION = "0.16";
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

// Quan es tanca l'últim record (el 12), arriba el final.
let endingPending = null;
const storyOverlay = new StoryOverlay({
  dataUrl: "./data/story-slides.json",
  onClose: () => {
    if (!endingPending) return;
    const finish = endingPending;
    endingPending = null;
    finish();
  }
});
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
      // Última estrella: primer el record 12; en tancar-lo, es tanca la figura,
      // brilla uns segons i arriba el final.
      hasFinishedExperience = true;
      endingPending = () => {
        if (document.pointerLockElement === document.body) document.exitPointerLock();
        if (constellation.closed) storyStars.connectPair(index, 0);
        storyStars.celebrate();
        setTimeout(() => triggerEnding(star), 2600);
      };
      if (document.pointerLockElement === document.body) document.exitPointerLock();
      if (storyOverlay.hasSlide(index)) storyOverlay.open(index);
      else endingPending();
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

function fitToWindow() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  storyStars.setViewportSize(w, h);
}
let lastW = 0;
let lastH = 0;
window.addEventListener("resize", fitToWindow);

// ==============================
// Punter cap a l'estrella
// ==============================

const aimDot = document.getElementById("aim-dot");
const aimArrow = document.getElementById("aim-arrow");
const aimDir = new THREE.Vector3();
const aimTo = new THREE.Vector3();
const aimLocal = new THREE.Vector3();

function updateAim() {
  const target = storyStars.stars.find((st) => st.state === STORY_STATE.SELECTED);
  const hidden = !target || storyOverlay.isOpen() || hasFinishedExperience;
  aimDot.classList.toggle("is-hidden", hidden);
  if (hidden) {
    aimArrow.classList.add("is-hidden");
    return;
  }
  camera.getWorldDirection(aimDir);
  aimTo.copy(target.position).sub(camera.position).normalize();
  const angle = aimDir.angleTo(aimTo);
  // L'anell surt només quan l'estrella ja s'ha encès (ha crescut gairebé del tot).
  const lit = target.currentSize > target.selectedSize + target.baseSize * 1.3;
  aimDot.classList.toggle("is-on-target", angle < storyStars.coneAngle && lit);

  // La fletxa només surt quan l'estrella és lluny del centre (o fora de pantalla).
  const far = angle > THREE.MathUtils.degToRad(28);
  aimArrow.classList.toggle("is-hidden", !far);
  if (far) {
    aimLocal.copy(aimTo).applyQuaternion(camera.quaternion.clone().invert());
    const a = Math.atan2(-aimLocal.y, aimLocal.x);
    aimArrow.style.setProperty("--aim-angle", `${a.toFixed(3)}rad`);
  }
}


// ==============================
// Bucle d'animació
// ==============================

const clock = new THREE.Clock();

// Mentre la portada és a sobre, l'escena no es dibuixa (així la portada va fluida).
// Si s'obre world.html directament, sempre és activa.
let sceneActive = window.parent === window;
let warmupFrames = 3;
window.addEventListener("message", (event) => {
  if (event.data && event.data.sceneActive) sceneActive = true;
});

const rootStyle = document.documentElement.style;

function animate() {
  requestAnimationFrame(animate);
  if (!sceneActive && warmupFrames <= 0) return;
  warmupFrames -= 1;

  // Pantalla completa (F11) o canvi de mida: ajusta-ho sempre a la finestra.
  if (window.innerWidth !== lastW || window.innerHeight !== lastH) {
    lastW = window.innerWidth;
    lastH = window.innerHeight;
    fitToWindow();
  }

  const delta = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  updateEnvironment(t);
  updateCamera();
  storyStars.update();
  highClouds.update(delta);
  shootingStars.update(delta);
  bivac.update(camera);
  updateAim();
  sky.userData.update?.(delta);

  if (clickStarHint) {
    const showHint = storyStars.shouldShowClickHint() && !storyOverlay.isOpen() && !hasFinishedExperience;
    clickStarHint.classList.toggle("is-visible", showHint);
  }

  // La llum dels records segueix la flama del fanal.
  rootStyle.setProperty("--flame", shared.uLanternIntensity.value.toFixed(3));

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
