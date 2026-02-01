import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export const stars = [];
let activeStar = null;
let currentStoryIndex = 0; // tracks which story star is active

// Heart-shaped story star positions
export const storyStarPositions = [
  new THREE.Vector3(-3, 1.0, -30),
  new THREE.Vector3(-1.5, 2.5, -30),
  new THREE.Vector3(0, 3.0, -30),
  new THREE.Vector3(1.5, 2.5, -30),
  new THREE.Vector3(3, 1.0, -30),
  new THREE.Vector3(-1.5, 1.8, -30),
  new THREE.Vector3(1.5, 1.8, -30),
  new THREE.Vector3(0, 1.5, -30)
];

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

export function createStars(scene, backgroundCount = 50) {
  stars.length = 0;

  // Story stars
  storyStarPositions.forEach((pos, i) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xfff4cc });
    const geometry = new THREE.SphereGeometry(0.4, 12, 12); // bigger for story stars

    const star = new THREE.Mesh(geometry, material);
    star.position.copy(pos);

    star.userData = {
      id: i,
      type: "story",
      active: i === 0,   // only first star responds initially
      clicked: false
    };

    stars.push(star);
    scene.add(star);
  });

  // Background filler stars
  for (let i = 0; i < backgroundCount; i++) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const geometry = new THREE.SphereGeometry(0.08, 12, 12);
    const star = new THREE.Mesh(geometry, material);

    const radius = 80;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.6 + 0.2;

    star.position.set(
      Math.cos(theta) * Math.sin(phi) * radius,
      Math.cos(phi) * radius + 10,
      Math.sin(theta) * Math.sin(phi) * radius
    );

    star.userData = { id: 100 + i, type: "background" };

    stars.push(star);
    scene.add(star);
  }
}

export function updateStars(camera) {
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(stars);

  const lookedAtStar = hits[0]?.object || null;

  stars.forEach((star, i) => {
    const isStory = star.userData.type === "story";

    if (isStory) {
      const activeIndex = currentStoryIndex;

      if (i === activeIndex) {
        // Only current story star responds
        const isLookedAt = star === lookedAtStar;

        // Target scale & color
        const targetScale = isLookedAt ? 2.0 : 1.5; // noticeable
        const targetColor = new THREE.Color(isLookedAt ? 0xffffaa : 0xfff4cc);

        star.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
        star.material.color.lerp(targetColor, 0.08);

        if (isLookedAt) activeStar = star;
      } else if (star.userData.clicked) {
        // Already clicked stars remain bright & big
        star.scale.lerp(new THREE.Vector3(2.0, 2.0, 2.0), 0.08);
        star.material.color.lerp(new THREE.Color(0xffffaa), 0.08);
      } else {
        // Future stars stay small
        star.scale.lerp(new THREE.Vector3(1.2, 1.2, 1.2), 0.08);
        star.material.color.lerp(new THREE.Color(0xfff4cc), 0.08);
      }
    } else {
      // Background stars flicker
      const targetScale = 0.8;
      const targetColor = new THREE.Color(0xffffff);
      star.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);
      const flicker = 0.85 + Math.random() * 0.3;
      star.material.color.copy(targetColor).multiplyScalar(flicker);
    }
  });
}

export function handleStarClick() {
  if (!activeStar) return;

  // Mark current story star as clicked
  activeStar.userData.clicked = true;
  activeStar = null;

  // Move to next star
  currentStoryIndex++;
  if (currentStoryIndex >= storyStarPositions.length) {
    currentStoryIndex = storyStarPositions.length - 1; // stop at last
  }

  console.log("Story star clicked:", currentStoryIndex);
}
