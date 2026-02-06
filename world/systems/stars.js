// threejs-stars-github-pages.js
// Script per crear i controlar les estrelles (background + història)

import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

// ==============================
// Utils
// ==============================

// Funció random coords sphere
function randomOnSphere(radius) {
  const u = Math.random();
  const v = Math.random();

  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);

  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi)
  );
}

// ==============================
// Background Stars
// ==============================

export class BackgroundStars {
  constructor({
    count = 4000,
    radius = 1000,
    size = 1,
    color = 0xffffff
  } = {}) {
    this.count = count;
    this.radius = radius;
    this.size = size;
    this.color = color;

    this.points = null;
    this.material = null;
    this.time = 0;
  }

  create() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const v = randomOnSphere(this.radius);

      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    }

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );

    this.material = new THREE.PointsMaterial({
      color: this.color,
      size: this.size,
      transparent: false,
      opacity: 0.9,
      depthWrite: false
    });

    this.points = new THREE.Points(geometry, this.material);

    return this.points;
  }

  // Efecte pulsació
  update(delta = 0.016) {
    if (!this.material) return;

    this.time += delta;

    const pulse = 0.85 + Math.sin(this.time * 0.8) * 0.1;
    this.material.opacity = pulse;
  }
}

// ==============================
// Story Stars
// ==============================

export const STORY_STATE = {
  STANDBY: "standby",
  SELECTED: "selected",
  CLICKED: "clicked"
};

class StoryStar {
  constructor(index, position, baseSize = 0.5, color = 0xffffff) {
    this.index = index;
    this.position = position.clone();

    this.state = STORY_STATE.STANDBY;

    this.baseSize = baseSize;

    // Colors
    this.baseColor = new THREE.Color(color);
    this.highlightColor = new THREE.Color(0x88ccff); // Blau suau

    this.currentScale = baseSize;
    this.targetScale = baseSize;

    this.material = null;
    this.mesh = null;
  }

  create() {
    const geo = new THREE.SphereGeometry(20, 16, 16);

    this.material = new THREE.MeshBasicMaterial({
      color: this.baseColor.clone(),
      transparent: true
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.copy(this.position);
    this.mesh.scale.setScalar(this.baseSize);
    this.mesh.userData.storyIndex = this.index;

    return this.mesh;
  }

  setState(state) {
    this.state = state;

    switch (state) {
      case STORY_STATE.STANDBY:
        this.material.opacity = 0.9;
        this.targetScale = this.baseSize;
        this.material.color.copy(this.baseColor);
        break;

      case STORY_STATE.SELECTED:
        this.material.opacity = 1.0;
        this.targetScale = this.baseSize * 1.2;
        break;

      case STORY_STATE.CLICKED:
        this.material.opacity = 0.95;
        this.targetScale = this.baseSize * 1.05;
        this.material.color.copy(this.highlightColor);
        break;
    }
  }

  // Quan està dins del con
  onLookAt(strength = 0) {
    if (this.state !== STORY_STATE.SELECTED) return;

    // Target scale
    this.targetScale = this.baseSize * (1.2 + strength * 0.3);

    // Target color
    this.material.color.lerp(this.highlightColor, 0.1);
  }

  // Suavitzar transicions
  update() {
    // Scale smooth
    this.currentScale = THREE.MathUtils.lerp(
      this.currentScale,
      this.targetScale,
      0.1
    );

    this.mesh.scale.setScalar(this.currentScale);

    // Color smooth back to base
    if (this.state === STORY_STATE.SELECTED) {
      this.material.color.lerp(this.baseColor, 0.02);
    }
  }
}

// ==============================
// Story Star Manager
// ==============================

export class StoryStarSystem {
  constructor({
    camera,
    scene,
    radius = 1000,
    coordinates = [], // direccions Vector3
    onStarClick = () => {}
  }) {
    this.camera = camera;
    this.scene = scene;
    this.radius = radius;
    this.coordinates = coordinates;
    this.onStarClick = onStarClick;

    this.stars = [];

    // Angle del con (15º)
    this.coneAngle = THREE.MathUtils.degToRad(15);

    this.lines = [];
  }

  init() {
    this._createStars();
    this._setupInput();

    if (this.stars.length > 0) {
      this.stars[0].setState(STORY_STATE.SELECTED);
    }
  }

  _createStars() {
    this.coordinates.forEach((dir, i) => {
      const pos = dir.clone().normalize().multiplyScalar(this.radius);

      const star = new StoryStar(i, pos);

      const mesh = star.create();
      this.scene.add(mesh);

      this.stars.push(star);
    });
  }

  _setupInput() {
    window.addEventListener("click", () => this._handleClick());
  }

  // ==============================
  // Cone-based selection
  // ==============================

  _getStarInCone() {
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);

    let bestStar = null;
    let bestAngle = this.coneAngle;

    this.stars.forEach((star) => {
      const toStar = star.position
        .clone()
        .sub(this.camera.position)
        .normalize();

      const angle = camDir.angleTo(toStar);

      if (angle < bestAngle) {
        bestAngle = angle;
        bestStar = star;
      }
    });

    return bestStar;
  }

  _handleClick() {
    const star = this._getStarInCone();

    if (!star) return;

    if (star.state !== STORY_STATE.SELECTED) return;

    // Callback extern
    this.onStarClick(star.index, star);

    // Marcar com clicked
    star.setState(STORY_STATE.CLICKED);

    // Activar següent
    const next = this.stars[star.index + 1];
    if (next) next.setState(STORY_STATE.SELECTED);

    // Dibuixar constel·lació
    this._tryDrawLine();
  }

  _tryDrawLine() {
    for (let i = 0; i < this.stars.length - 1; i++) {
      const a = this.stars[i];
      const b = this.stars[i + 1];

      if (
        a.state === STORY_STATE.CLICKED &&
        b.state === STORY_STATE.CLICKED
      ) {
        if (this.lines[i]) continue;

        const points = [a.position, b.position];

        const geo = new THREE.BufferGeometry().setFromPoints(points);

        const mat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8
        });

        const line = new THREE.Line(geo, mat);
        this.scene.add(line);

        this.lines[i] = line;
      }
    }
  }

  update() {
    const active = this._getStarInCone();

    this.stars.forEach((star) => {
      if (star === active && star.state === STORY_STATE.SELECTED) {
        star.onLookAt(1);
      }

      star.update();
    });
  }
}
