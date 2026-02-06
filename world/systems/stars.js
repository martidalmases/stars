// threejs-stars-github-pages.js
// Script per crear i controlar les estrelles (background + història)

import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

// ==============================
// Utils
// ==============================

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
    size = 100,
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
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });

    this.points = new THREE.Points(geometry, this.material);

    return this.points;
  }

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
  constructor(index, position) {
    this.index = index;
    this.position = position.clone();

    this.state = STORY_STATE.STANDBY;

    // Sizes
    this.baseSize = 3; // same as background
    this.currentSize = this.baseSize;
    this.targetSize = this.baseSize;

    // Colors
    this.baseColor = new THREE.Color(0xffffff);
    this.highlightColor = new THREE.Color(0xFFE9A3);
    this.clickedColor = new THREE.Color(0xFFD27D);

    this.material = null;
    this.mesh = null;
  }

  create() {
    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0], 3)
    );

    this.material = new THREE.PointsMaterial({
      color: this.baseColor.clone(),
      size: this.baseSize,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });

    this.mesh = new THREE.Points(geo, this.material);

    this.mesh.position.copy(this.position);
    this.mesh.userData.storyIndex = this.index;

    return this.mesh;
  }

  setState(state) {
    this.state = state;

    switch (state) {
      case STORY_STATE.STANDBY:

        this.targetSize = this.baseSize;
        this.material.opacity = 0.9;
        this.material.color.copy(this.baseColor);

        break;

      case STORY_STATE.SELECTED:

        this.targetSize = this.baseSize * 3;
        this.material.opacity = 2;

        break;

      case STORY_STATE.CLICKED:

        this.targetSize = this.baseSize * 1.6;
        this.material.opacity = 0.95;
        this.material.color.copy(this.clickedColor);

        break;
    }
  }

  onLookAt(strength = 0) {
    if (this.state !== STORY_STATE.SELECTED) return;

    this.targetSize =
      this.baseSize * (2.2 + strength * 0.6);

    this.material.color.lerp(this.highlightColor, 0.1);
  }

  update() {

    // Smooth size
    this.currentSize = THREE.MathUtils.lerp(
      this.currentSize,
      this.targetSize,
      0.1
    );

    this.material.size = this.currentSize;


    // Smooth color reset
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
    coordinates = [],
    onStarClick = () => {}
  }) {
    this.camera = camera;
    this.scene = scene;
    this.radius = radius;
    this.coordinates = coordinates;
    this.onStarClick = onStarClick;

    this.stars = [];

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

      const pos = dir
        .clone()
        .normalize()
        .multiplyScalar(this.radius);

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


    this.onStarClick(star.index, star);

    star.setState(STORY_STATE.CLICKED);


    const next = this.stars[star.index + 1];

    if (next) next.setState(STORY_STATE.SELECTED);


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

        const geo =
          new THREE.BufferGeometry().setFromPoints(points);

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

      if (
        star === active &&
        star.state === STORY_STATE.SELECTED
      ) {
        star.onLookAt(1);
      }

      star.update();
    });
  }
}
