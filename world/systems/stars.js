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

function createStarTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.9)");
  gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.4)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return texture;
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

    this.points = [];
    this.materials = [];
    this.time = 0;
    this.texture = createStarTexture();
  }

  create() {
    const group = new THREE.Group();
    const buckets = [
      { size: this.size * 0.9, count: Math.floor(this.count * 0.35) },
      { size: this.size, count: Math.floor(this.count * 0.4) },
      { size: this.size * 1.1, count: this.count }
    ];

    let created = 0;

    buckets.forEach((bucket, index) => {
      const count = index === buckets.length - 1
        ? this.count - created
        : bucket.count;

      created += count;

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const v = randomOnSphere(this.radius);

        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
      }

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      const material = new THREE.PointsMaterial({
        color: this.color,
        size: bucket.size,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: false,
        map: this.texture,
        blending: THREE.AdditiveBlending
      });

      const points = new THREE.Points(geometry, material);
      group.add(points);
      this.points.push(points);
      this.materials.push(material);
    });

    return group;
  }

  update(delta = 0.016) {
    if (!this.materials.length) return;

    this.time += delta;

    const pulse = 0.85 + Math.sin(this.time * 0.8) * 0.1;

    this.materials.forEach((material) => {
      material.opacity = pulse;
    });
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
    this.texture = createStarTexture();
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
      depthWrite: false,
      depthTest: false,
      map: this.texture,
      blending: THREE.AdditiveBlending
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
