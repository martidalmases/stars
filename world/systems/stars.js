import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export const stars = [];
let activeStar = null;

// Fixed story star positions (arrange as constellation)
export const storyStarPositions = [
  new THREE.Vector3(10, 40, -60),
  new THREE.Vector3(-15, 35, -55),
  new THREE.Vector3(5, 45, -50),
  new THREE.Vector3(-10, 42, -45),
  new THREE.Vector3(0, 38, -40)
];

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

export function createStars(scene, count = 50, storyPositions = storyStarPositions) {

  stars.length = 0;

  const storyCount = storyPositions.length;

  // Story stars
  for (let i = 0; i < storyCount; i++) {
    const material = new THREE.MeshBasicMaterial({ color: 0xfff4cc });
    const geometry = new THREE.SphereGeometry(0.2, 12, 12);

    const star = new THREE.Mesh(geometry, material);
    star.position.copy(storyPositions[i]);
    star.userData = { id: i, type: "story" };

    stars.push(star);
    scene.add(star);
  }

  // Background filler stars
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const geometry = new THREE.SphereGeometry(0.08, 12, 12);
    const star = new THREE.Mesh(geometry, material);

    const radius = 80;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI * 0.6 + 0.2;

    star.position.set(
      Math.cos(theta) * Math.sin(phi) * radius,
      Math.cos(phi) * radius + 10,
      Math.sin(theta) * Math.sin(phi) * radius
    );

    star.userData = { id: storyCount + i, type: "background" };
    stars.push(star);
    scene.add(star);
  }
}

export function updateStars(camera) {
  // Raycast from center
  raycaster.setFromCamera(center, camera);
  const hits = raycaster.intersectObjects(stars);
  const lookedAtStar = hits[0]?.object || null;

  stars.forEach((star) => {
    const isLookedAt = star === lookedAtStar;

    if (star.userData.type === "story") {
      const targetScale = isLookedAt ? 2.0 : 1.2;
      const targetColor = new THREE.Color(isLookedAt ? 0xffffcc : 0xfff4cc);

      star.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
      star.material.color.lerp(targetColor, 0.08);
    } else {
      const targetScale = 0.8;
      const targetColor = new THREE.Color(0xffffff);

      star.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.05);

      // subtle flicker for background stars
      const flicker = 0.85 + Math.random() * 0.3;
      star.material.color.copy(targetColor).multiplyScalar(flicker);
    }
  });

  activeStar = lookedAtStar;
}

export function handleStarClick() {
  if (!activeStar) return;
  console.log("Star clicked:", activeStar.userData.id);
}
