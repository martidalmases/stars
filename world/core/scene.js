import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

function createBackgroundStarField(radius = 980, count = 1400) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const luminosities = new Float32Array(count);

  const axis = new THREE.Vector3(0.24, 0.91, -0.24).normalize();
  const clusterAxes = [
    new THREE.Vector3(0.76, 0.29, -0.58).normalize(),
    new THREE.Vector3(-0.51, 0.45, 0.73).normalize(),
    new THREE.Vector3(0.12, 0.64, 0.76).normalize(),
    new THREE.Vector3(-0.26, 0.72, -0.64).normalize(),
    new THREE.Vector3(0.58, 0.52, 0.45).normalize()
  ];
  const clusterFrames = clusterAxes.map((clusterAxis) => {
    const tangentA = new THREE.Vector3(0, 1, 0).cross(clusterAxis);
    if (tangentA.lengthSq() < 0.0001) tangentA.set(1, 0, 0);
    tangentA.normalize();
    const tangentB = new THREE.Vector3().crossVectors(clusterAxis, tangentA).normalize();
    return { clusterAxis, tangentA, tangentB };
  });

  for (let i = 0; i < count; i += 1) {
    const dir = new THREE.Vector3();
    let accepted = false;

    for (let attempt = 0; attempt < 12 && !accepted; attempt += 1) {
      dir
        .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        .normalize();

      const yaw = Math.atan2(dir.x, -dir.z);
      const pitch = Math.asin(dir.y);
      const inViewLimits =
        Math.abs(yaw) <= THREE.MathUtils.degToRad(108) &&
        pitch >= THREE.MathUtils.degToRad(-26) &&
        pitch <= THREE.MathUtils.degToRad(84);

      if (!inViewLimits) continue;

      const altitude = dir.y * 0.5 + 0.5;
      const horizonFade = THREE.MathUtils.smoothstep(altitude, 0.17, 1.0);

      const galacticBand = 1.0 - Math.min(1.0, Math.abs(dir.dot(axis)) / 0.28);
      const bandDensity = Math.pow(Math.max(galacticBand, 0.0), 1.45);
      const bandStreak = 0.5 + 0.5 * Math.sin(dir.x * 11.0 + dir.z * 8.4 + dir.y * 3.2);

      let localCluster = 0;
      clusterFrames.forEach(({ clusterAxis, tangentA, tangentB }) => {
        const along = Math.max(0.0, dir.dot(clusterAxis));
        if (along <= 0.0) return;

        const lx = dir.dot(tangentA);
        const ly = dir.dot(tangentB);
        const filamentA = Math.exp(-(lx * lx / 0.004 + ly * ly / 0.018));
        const filamentB = Math.exp(-(lx * lx / 0.014 + ly * ly / 0.003));
        const filamentMix = Math.max(filamentA, filamentB);
        localCluster += Math.pow(along, 14.0) * filamentMix;
      });

      const clustering = 0.08 + bandDensity * (0.75 + bandStreak * 0.35) + localCluster * 1.05;
      const keepChance = THREE.MathUtils.clamp(horizonFade * clustering, 0.08, 0.98);

      accepted = Math.random() < keepChance;
    }

    if (!accepted) {
      dir
        .set(Math.random() * 2 - 1, Math.random() * 0.8 + 0.2, Math.random() * 2 - 1)
        .normalize();
    }

    const p = dir.multiplyScalar(radius);

    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    const tempRoll = Math.random();
    const starColor = new THREE.Color();

    if (tempRoll < 0.12) {
      starColor.set(0xcfd9ff);
    } else if (tempRoll < 0.92) {
      starColor.set(0xf3f5ff);
    } else {
      starColor.set(0xfff0dd);
    }

    const clumpBoost = Math.max(0, 1.0 - Math.min(1.0, Math.abs(dir.dot(axis)) / 0.3));
    const luminosity = Math.pow(Math.random(), 1.9) + clumpBoost * 0.18;
    const size = 3.15 + Math.pow(Math.random(), 2.0) * (4.55 + clumpBoost * 0.9);

    colors[i * 3] = starColor.r;
    colors[i * 3 + 1] = starColor.g;
    colors[i * 3 + 2] = starColor.b;
    sizes[i] = size;
    luminosities[i] = 0.42 + luminosity * 1.02;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aLuminosity", new THREE.BufferAttribute(luminosities, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    uniforms: {
      glareBoost: { value: 1.0 }
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aLuminosity;
      varying vec3 vColor;
      varying float vLuminosity;
      varying float vSize;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float depth = max(1.0, -mvPosition.z);

        vColor = aColor;
        vLuminosity = aLuminosity;
        vSize = aSize;

        gl_PointSize = max(3.15, aSize * aLuminosity * (430.0 / depth));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float glareBoost;
      varying vec3 vColor;
      varying float vLuminosity;
      varying float vSize;

      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r = length(uv);

        if (r > 1.0) discard;

        float core = exp(-16.0 * r * r);
        float halo = exp(-4.0 * r * r);
        float softDisc = smoothstep(1.0, 0.14, r);
        float alpha = (core * 0.95 + halo * 0.55 + softDisc * 0.2) * vLuminosity;

        gl_FragColor = vec4(vColor, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = true;
  stars.renderOrder = -1;

  return stars;
}

export function createSkySphere(camera = null) {
  console.log("[Sky] Initializing sky dome from HDRI texture (hdri_1)...");

  const geo = new THREE.SphereGeometry(1010, 64, 64);
  const hdriTexture = new THREE.TextureLoader().load("./systems/hdri_1.jpg");
  hdriTexture.colorSpace = THREE.SRGBColorSpace;
  hdriTexture.minFilter = THREE.LinearFilter;
  hdriTexture.magFilter = THREE.LinearFilter;

  const hdriMaterial = new THREE.MeshBasicMaterial({
    map: hdriTexture,
    side: THREE.BackSide
  });

  const sky = new THREE.Mesh(geo, hdriMaterial);
  sky.rotation.y = Math.PI;
  sky.frustumCulled = false;
  sky.renderOrder = -2;

  const skyGroup = new THREE.Group();
  skyGroup.add(sky);
  skyGroup.userData.update = () => {};

  console.log("[Sky] Sky dome ready with plain HDRI background.");
  return skyGroup;
}

function createCloudTexture({
  size = 256,
  density = 20,
  centerAlpha = 0.2,
  edgeAlpha = 0.0
} = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  for (let i = 0; i < density; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.12 + Math.random() * 0.34);
    const gradient = ctx.createRadialGradient(x, y, r * 0.12, x, y, r);
    gradient.addColorStop(0, `rgba(255,255,255,${centerAlpha})`);
    gradient.addColorStop(0.55, `rgba(222,232,250,${centerAlpha * 0.45})`);
    gradient.addColorStop(1, `rgba(165,182,220,${edgeAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createUpperCloudLayer(texture, count = 12) {
  const group = new THREE.Group();
  const clouds = [];

  for (let i = 0; i < count; i += 1) {
    const w = 280 + Math.random() * 320;
    const h = 72 + Math.random() * 68;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      map: null,
      transparent: false,
      opacity: 1.0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      color: new THREE.Color(0xff0000),
      wireframe: true
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2.25;
    mesh.rotation.z = Math.random() * Math.PI * 2;

    const base = new THREE.Vector3(
      (Math.random() * 2 - 1) * 700,
      90 + Math.random() * 130,
      -260 - Math.random() * 720
    );

    mesh.position.copy(base);
    mesh.renderOrder = -1;

    const drift = new THREE.Vector2((Math.random() * 2 - 1) * 2.2, 4.0 + Math.random() * 8.0);
    const pulseOffset = Math.random() * Math.PI * 2;

    clouds.push({ mesh, base, drift, pulseOffset });
    group.add(mesh);
  }

  const update = (dt, camera) => {
    if (camera) {
      group.position.copy(camera.position);
    }

    for (const cloud of clouds) {
      cloud.base.x += cloud.drift.x * dt;
      cloud.base.z += cloud.drift.y * dt;

      if (cloud.base.x > 760) cloud.base.x = -760;
      if (cloud.base.x < -760) cloud.base.x = 760;
      if (cloud.base.z > -140) cloud.base.z = -980;
      if (cloud.base.z < -980) cloud.base.z = -140;

      cloud.mesh.position.copy(cloud.base);
      cloud.mesh.material.opacity = 1.0;
    }
  };

  return { group, update };
}

function createLowerCloudFogLayer(texture, count = 70) {
  const group = new THREE.Group();
  const clouds = [];

  for (let i = 0; i < count; i += 1) {
    const w = 380 + Math.random() * 520;
    const h = 200 + Math.random() * 260;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      map: null,
      transparent: false,
      opacity: 1.0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      color: new THREE.Color(0xff0000),
      wireframe: true,
      blending: THREE.NormalBlending
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 0;

    const base = new THREE.Vector3(
      (Math.random() * 2 - 1) * 860,
      -34 + Math.random() * 80,
      -120 - Math.random() * 860
    );

    mesh.position.copy(base);

    const drift = new THREE.Vector3(
      (Math.random() * 2 - 1) * 1.9,
      (Math.random() * 2 - 1) * 0.12,
      7.0 + Math.random() * 14.0
    );
    const pulseOffset = Math.random() * Math.PI * 2;

    clouds.push({ mesh, base, drift, pulseOffset });
    group.add(mesh);
  }

  const update = (dt, camera) => {
    if (camera) {
      group.position.copy(camera.position);
    }

    for (const cloud of clouds) {
      cloud.base.addScaledVector(cloud.drift, dt);

      if (cloud.base.x > 920) cloud.base.x = -920;
      if (cloud.base.x < -920) cloud.base.x = 920;
      if (cloud.base.z > -60) cloud.base.z = -1020;
      if (cloud.base.z < -1020) cloud.base.z = -60;

      cloud.base.y = THREE.MathUtils.clamp(cloud.base.y + cloud.drift.y * dt, -96, 52);

      cloud.mesh.position.copy(cloud.base);
      if (camera) cloud.mesh.quaternion.copy(camera.quaternion);

      cloud.mesh.material.opacity = 1.0;
    }
  };

  return { group, update };
}
