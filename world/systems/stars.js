import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export const stars = [];
let activeStar = null;
let currentStoryIndex = 0; // tracks which story star is active

// Heart-shaped story star positions (~500m in front of camera)
export const storyStarPositions = [
  new THREE.Vector3(-3, 10, -500),
  new THREE.Vector3(-1.5, 15, -500),
  new THREE.Vector3(0, 18, -500),
  new THREE.Vector3(1.5, 15, -500),
  new THREE.Vector3(3, 10, -500),
  new THREE.Vector3(-1.5, 12, -500),
  new THREE.Vector3(1.5, 12, -500),
  new THREE.Vector3(0, 11, -500)
];

// Utility: check if star is within cone of view
function isStarLookedAt(star, camera, coneAngle = Math.PI / 18) {
  const dirToStar = star.position.clone().sub(camera.position).normalize();
  const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const angle = cameraDir.angleTo(dirToStar);
  return angle < coneAngle;
}

export function createStars(scene, backgroundCount = 50) {
  stars.length = 0;
  star.material.fog = false;

  // Story stars
  storyStarPositions.forEach((pos, i) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xfff4cc });
    const geometry = new THREE.SphereGeometry(0.25, 12, 12); // smaller base
    star.material.fog = false;

    const star = new THREE.Mesh(geometry, material);
    star.position.copy(pos);

    star.userData = {
      id: i,
      type: "story",
      active: i === 0,
      clicked: false
    };

    stars.push(star);
    scene.add(star);
  });

  // Background stars
  for (let i = 0; i < backgroundCount; i++) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const geometry = new THREE.SphereGeometry(0.05, 8, 8);
    const star = new THREE.Mesh(geometry, material);

    const radius = 1000; // place around sky sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5 + 0.1;

    star.position.set(
      Math.cos(theta) * Math.sin(phi) * radius,
      Math.cos(phi) * radius + 20,
      Math.sin(theta) * Math.sin(phi) * radius
    );

    star.userData = { id: 100 + i, type: "background" };

    stars.push(star);
    scene.add(star);
  }
}

export function updateStars(camera) {
  stars.forEach((star, i) => {
    const isStory = star.userData.type === "story";

    if (isStory) {
      const activeIndex = currentStoryIndex;
      if (i === activeIndex) {
        const lookedAt = isStarLookedAt(star, camera, Math.PI / 12); // wider cone

        const targetScale = lookedAt ? 0.35 : 0.25;
        const targetColor = new THREE.Color(lookedAt ? 0xffffaa : 0xfff4cc);

        star.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
        star.material.color.lerp(targetColor, 0.08);

        if (lookedAt) activeStar = star;
      } else if (star.userData.clicked) {
        // previously clicked → stay bright/big
        star.scale.lerp(new THREE.Vector3(0.35, 0.35, 0.35), 0.08);
        star.material.color.lerp(new THREE.Color(0xffffaa), 0.08);
      } else {
        // future stars
        star.scale.lerp(new THREE.Vector3(0.15, 0.15, 0.15), 0.08);
        star.material.color.lerp(new THREE.Color(0xfff4cc), 0.08);
      }
    } else {
      // background stars
      star.scale.lerp(new THREE.Vector3(0.05, 0.05, 0.05), 0.05);
      const flicker = 0.85 + Math.random() * 0.3;
      star.material.color.copy(new THREE.Color(0xffffff)).multiplyScalar(flicker);
    }
  });
}

export function handleStarClick() {
  if (!activeStar) return;

  activeStar.userData.clicked = true;
  activeStar = null;

  currentStoryIndex++;
  if (currentStoryIndex >= storyStarPositions.length) {
    currentStoryIndex = storyStarPositions.length - 1; // stop at last
  }

  console.log("Story star clicked:", currentStoryIndex);
}
