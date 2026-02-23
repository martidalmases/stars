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
    count = 2500,
    radius = 990,
    size = 2.4,
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
    const colors = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      const v = randomOnSphere(this.radius);

      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;

      const shade = 0.75 + Math.random() * 0.25;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const starTexture = new THREE.TextureLoader().load(
      new URL("../star.png", import.meta.url).href
    );

    this.material = new THREE.PointsMaterial({
      map: starTexture,
      color: this.color,
      size: this.size,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.95,
      alphaTest: 0.02,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;

    return this.points;
  }

  update(delta = 0.016) {
    if (!this.material) return;

    this.time += delta;

    const pulse = 0.9 + Math.sin(this.time * 0.5) * 0.07;
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
    this.baseSize = 8;
    this.currentSize = this.baseSize;
    this.targetSize = this.baseSize;

    // Colors
    this.baseColor = new THREE.Color(0xf9fbff);
    this.highlightColor = new THREE.Color(0xffeea6);
    this.clickedColor = new THREE.Color(0xffa44d);

    this.material = null;
    this.mesh = null;
  }

  create() {
    const geo = new THREE.BufferGeometry();

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0], 3)
    );

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: this.baseColor.clone() },
        opacity: { value: 1.0 },
        size: { value: this.baseSize }
      },
      vertexShader: `
        uniform float size;
        varying float vOpacity;
        varying float vSize;
        varying float vDepth;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = max(1.0, abs(mvPosition.z));
          gl_PointSize = max(2.5, size * (340.0 / depth));
          gl_Position = projectionMatrix * mvPosition;
          vOpacity = 1.0;
          vSize = size;
          vDepth = depth;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        varying float vOpacity;
        varying float vSize;
        varying float vDepth;

        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float radius = length(uv);

          if (radius > 1.0) discard;

          float core = exp(-16.0 * radius * radius);
          float halo = exp(-5.5 * radius * radius);
          float spikeX = exp(-95.0 * uv.x * uv.x) * exp(-4.5 * uv.y * uv.y);
          float spikeY = exp(-95.0 * uv.y * uv.y) * exp(-4.5 * uv.x * uv.x);
          float glareStrength = clamp(vSize / 16.0, 0.08, 0.4);
          float glare = (spikeX + spikeY) * glareStrength;

          float nearBoost = mix(1.25, 0.95, clamp(vDepth / 1600.0, 0.0, 1.0));
          float alpha = (core * 1.35 + halo * 0.95 + glare * 0.55) * opacity * vOpacity * nearBoost;

          if (alpha <= 0.0) discard;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
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
        this.material.uniforms.opacity.value = 0.95;
        this.material.uniforms.color.value.copy(this.baseColor);

        break;

      case STORY_STATE.SELECTED:

        this.targetSize = this.baseSize * 4.8;
        this.material.uniforms.opacity.value = 1.25;
        this.material.uniforms.color.value.set(0xfff1b8);

        break;

      case STORY_STATE.CLICKED:

        this.targetSize = this.baseSize * 2.3;
        this.material.uniforms.opacity.value = 1.1;
        this.material.uniforms.color.value.copy(this.clickedColor);

        break;
    }
  }

  onLookAt(strength = 0) {
    if (this.state !== STORY_STATE.SELECTED) return;

    this.targetSize =
      this.baseSize * (4.6 + strength * 1.8);

    this.material.uniforms.color.value.lerp(this.highlightColor, 0.2);
  }

  update() {

    // Smooth size
    this.currentSize = THREE.MathUtils.lerp(
      this.currentSize,
      this.targetSize,
      0.1
    );

    this.material.uniforms.size.value = this.currentSize;


    // Smooth color reset
    if (this.state === STORY_STATE.SELECTED) {
      this.material.uniforms.color.value.lerp(this.baseColor, 0.02);
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
    onStarClick = () => {},
    clusterCenter = new THREE.Vector3(0, 260, -760),
    clusterScale = 110
  }) {
    this.camera = camera;
    this.scene = scene;
    this.radius = radius;
    this.coordinates = coordinates;
    this.onStarClick = onStarClick;
    this.clusterCenter = clusterCenter;
    this.clusterScale = clusterScale;

    this.stars = [];

    this.coneAngle = THREE.MathUtils.degToRad(18);

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
        .multiplyScalar(this.clusterScale)
        .add(this.clusterCenter);

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
