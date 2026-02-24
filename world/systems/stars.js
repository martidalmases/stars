// threejs-stars-github-pages.js
// Script per crear i controlar les estrelles (background + història)

import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

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
    this.baseColor = new THREE.Color(0xf3f5ff);
    this.highlightColor = new THREE.Color(0xffefc7);
    this.clickedColor = new THREE.Color(0xffc88d);

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
        size: { value: this.baseSize },
        time: { value: 0.0 },
        seed: { value: (this.index + 1) * 13.371 }
      },
      vertexShader: `
        uniform float size;
        uniform float time;
        uniform float seed;
        varying float vOpacity;
        varying float vSize;
        varying float vDepth;
        varying float vPulse;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = max(1.0, abs(mvPosition.z));
          float pulse = 1.0 + sin(time * (0.9 + fract(seed) * 0.6) + seed) * 0.03;
          gl_PointSize = max(1.85, size * pulse * (360.0 / depth));
          gl_Position = projectionMatrix * mvPosition;
          vOpacity = 1.0;
          vSize = size;
          vDepth = depth;
          vPulse = pulse;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        varying float vOpacity;
        varying float vSize;
        varying float vDepth;
        varying float vPulse;

        void main() {
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float radius = length(uv);

          if (radius > 1.0) discard;

          float core = exp(-20.0 * radius * radius);
          float halo = exp(-5.0 * radius * radius);
          float spikeX = exp(-120.0 * uv.x * uv.x) * exp(-3.0 * uv.y * uv.y);
          float spikeY = exp(-120.0 * uv.y * uv.y) * exp(-3.0 * uv.x * uv.x);
          float diagonal = exp(-85.0 * (uv.x + uv.y) * (uv.x + uv.y)) * exp(-6.0 * (uv.x - uv.y) * (uv.x - uv.y));

          float glareStrength = clamp(vSize / 4.8, 0.06, 0.52);
          float glare = (spikeX + spikeY + diagonal * 0.55) * glareStrength;

          float nearBoost = mix(1.18, 0.96, clamp(vDepth / 1600.0, 0.0, 1.0));
          float alpha = (core * 1.3 + halo * 0.58 + glare * 0.9) * opacity * vOpacity * nearBoost * vPulse;

          if (alpha <= 0.0) discard;

          gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
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
        this.material.uniforms.opacity.value = 0.9;
        this.material.uniforms.color.value.copy(this.baseColor);

        break;

      case STORY_STATE.SELECTED:

        this.targetSize = this.baseSize * 4.6;
        this.material.uniforms.opacity.value = 1.2;
        this.material.uniforms.color.value.set(0xfff1cf);

        break;

      case STORY_STATE.CLICKED:

        this.targetSize = this.baseSize * 2.2;
        this.material.uniforms.opacity.value = 1.0;
        this.material.uniforms.color.value.copy(this.clickedColor);

        break;
    }
  }

  onLookAt(strength = 0) {
    if (this.state !== STORY_STATE.SELECTED) return;

    this.targetSize =
      this.baseSize * (4.4 + strength * 1.8);

    this.material.uniforms.color.value.lerp(this.highlightColor, 0.16);
  }

  update() {

    // Smooth size
    this.currentSize = THREE.MathUtils.lerp(
      this.currentSize,
      this.targetSize,
      0.1
    );

    this.material.uniforms.size.value = this.currentSize;
    this.material.uniforms.time.value += 0.016;


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
    console.log("[StoryStars] Initializing story stars...");
    this._createStars();
    this._setupInput();

    if (this.stars.length > 0) {
      this.stars[0].setState(STORY_STATE.SELECTED);
    }

    console.log(`[StoryStars] Ready. Total stars: ${this.stars.length}`);
  }

  _createStars() {
    this.coordinates.forEach((dir, i) => {

      const pos = dir
        .clone()
        .multiplyScalar(this.clusterScale)
        .add(this.clusterCenter);

      const star = new StoryStar(i, pos);

      const tintRoll = Math.random();
      if (tintRoll < 0.18) {
        star.baseColor.set(0xdbe4ff);
      } else if (tintRoll > 0.9) {
        star.baseColor.set(0xffefd9);
      }

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
    console.log(`[StoryStars] Click handled for star #${star.index}`);

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

        const segment = new THREE.Vector3().subVectors(b.position, a.position);
        const mid = a.position.clone().add(b.position).multiplyScalar(0.5);
        const up = mid.clone().normalize();
        const control = mid.clone().add(up.multiplyScalar(segment.length() * 0.11));

        const curve = new THREE.QuadraticBezierCurve3(a.position, control, b.position);
        const points = curve.getPoints(28);
        const geo = new THREE.BufferGeometry().setFromPoints(points);

        const opacity = 0.26 + Math.min(0.24, segment.length() / 900.0);
        const mat = new THREE.LineBasicMaterial({
          color: 0xcfd9ef,
          transparent: true,
          opacity
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
