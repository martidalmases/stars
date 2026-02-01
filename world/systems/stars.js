import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

const stars = [];
let activeStar = null;


// Create stars
export function createStars(scene, count = 20) {

  const geometry = new THREE.SphereGeometry(0.08, 12, 12);

  for (let i = 0; i < count; i++) {

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });

    const star = new THREE.Mesh(geometry, material);

    // Random position in sky dome
    const radius = 80;

    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.random() * Math.PI * 0.6 + 0.2;

    star.position.set(
      Math.cos(theta) * Math.sin(phi) * radius,
      Math.cos(phi) * radius + 10,
      Math.sin(theta) * Math.sin(phi) * radius
    );

    star.userData = {
      id: i,
      baseIntensity: 1
    };

    stars.push(star);
    scene.add(star);
  }
}


// Raycaster
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);


// Update highlighting
export function updateStars(camera) {
  // Raycast from center of screen
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(stars);

  stars.forEach((star) => {
    const isLookedAt = star === hits[0]?.object;

    // Target scale & color
    const targetScale = isLookedAt ? 1.5 : 1.0;
    const targetColor = new THREE.Color(isLookedAt ? 0xfff4cc : 0xffffff);

    // Smooth scale
    star.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);

    // Smooth color
    star.material.color.lerp(targetColor, 0.08);

    // Optional flicker for stars not being looked at
    if (!isLookedAt) {
      const flicker = 0.85 + Math.random() * 0.3; // 0.85 → 1.15
      star.material.color.multiplyScalar(flicker);
    }
  });

  // Store active star for clicks
  activeStar = hits[0]?.object || null;
}

// Click interaction
export function handleStarClick() {

  if (!activeStar) return;

  console.log("Star clicked:", activeStar.userData.id);
}

