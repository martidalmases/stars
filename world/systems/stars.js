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

const hits = raycaster.intersectObjects(stars);

stars.forEach((star) => {
  if (star === hits[0]?.object) {
    // Looked at → brighten and scale up
    star.material.color.lerp(new THREE.Color(0xfff4cc), 0.1);
    star.scale.lerp(new THREE.Vector3(1.5,1.5,1.5), 0.1);
  } else {
    // Not looked at → fade back
    star.material.color.lerp(new THREE.Color(0xffffff), 0.05);
    star.scale.lerp(new THREE.Vector3(1,1,1), 0.05);
  }
});
}


// Click interaction
export function handleStarClick() {

  if (!activeStar) return;

  console.log("Star clicked:", activeStar.userData.id);
}

