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

      const clustering = 0.1 + bandDensity * 0.95 + localCluster * 1.1;
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
    const size = 2.8 + Math.pow(Math.random(), 2.1) * (3.6 + clumpBoost * 0.5);

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

        gl_PointSize = max(2.8, aSize * aLuminosity * (400.0 / depth));
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
  console.log("[Sky] Initializing night sky dome (3-color gradient + horizon haze + stars)...");

  const geo = new THREE.SphereGeometry(1010, 64, 64);

  const nightGradientMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      horizonColor: { value: new THREE.Color(0x101a2c) },
      midColor: { value: new THREE.Color(0x081126) },
      zenithColor: { value: new THREE.Color(0x010205) },
      pollutionBandColor: { value: new THREE.Color(0xc2c9d4) }
    },
    vertexShader: `
      varying vec3 vWorldDir;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 horizonColor;
      uniform vec3 midColor;
      uniform vec3 zenithColor;
      uniform vec3 pollutionBandColor;
      varying vec3 vWorldDir;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      float valueNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        float n000 = hash(i + vec3(0.0, 0.0, 0.0));
        float n100 = hash(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash(i + vec3(1.0, 1.0, 1.0));

        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);
        return mix(nxy0, nxy1, f.z);
      }

      float fbm(vec3 p) {
        float sum = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 3; i++) {
          sum += valueNoise(p) * amp;
          p = p * 2.03 + vec3(17.0, 31.0, 13.0);
          amp *= 0.5;
        }
        return sum;
      }

      float layeredNebula(vec3 p) {
        float n0 = fbm(p * vec3(4.9, 6.8, 5.4));
        float n1 = fbm((p + vec3(0.16, -0.06, 0.1)) * vec3(6.0, 4.4, 6.8));
        return n0 * 0.62 + n1 * 0.38;
      }

      float clusterField(vec3 dir) {
        vec3 axisA = normalize(vec3(0.76, 0.29, -0.58));
        vec3 axisB = normalize(vec3(-0.51, 0.45, 0.73));
        vec3 axisC = normalize(vec3(0.12, 0.64, 0.76));
        vec3 axisD = normalize(vec3(-0.26, 0.72, -0.64));
        vec3 axisE = normalize(vec3(0.58, 0.52, 0.45));

        float fA = pow(max(0.0, dot(dir, axisA)), 11.0);
        float fB = pow(max(0.0, dot(dir, axisB)), 11.0);
        float fC = pow(max(0.0, dot(dir, axisC)), 11.0);
        float fD = pow(max(0.0, dot(dir, axisD)), 11.0);
        float fE = pow(max(0.0, dot(dir, axisE)), 11.0);

        float clusterMix = fA + fB + fC + fD + fE;
        float band = 1.0 - min(1.0, abs(dot(dir, normalize(vec3(0.24, 0.91, -0.24)))) / 0.28);
        return clamp(clusterMix * 1.05 + band * 1.05, 0.0, 1.0);
      }

      void main() {
        float y = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);

        float lowerMix = smoothstep(0.00, 0.48, pow(y, 1.62));
        float upperMix = smoothstep(0.24, 0.94, pow(y, 1.24));

        vec3 lowerGradient = mix(horizonColor, midColor, lowerMix);
        vec3 skyColor = mix(lowerGradient, zenithColor, upperMix);

        float horizonBand = exp(-pow(abs(vWorldDir.y) / 0.085, 2.0));
        skyColor += pollutionBandColor * horizonBand * 0.14;

        float nA = hash(vWorldDir * 210.0);
        float nB = hash(vWorldDir.zyx * 390.0);
        float noise = (nA * 0.65 + nB * 0.35) - 0.5;
        skyColor += noise * 0.018;

        float nebulaNoiseA = layeredNebula(vWorldDir);
        float nebulaNoiseB = layeredNebula((vWorldDir + vec3(0.0, 0.18, 0.0)).zyx);
        float nebulaNoiseC = layeredNebula(vWorldDir + vec3(0.11, -0.05, 0.27));
        float azimuth = atan(vWorldDir.z, vWorldDir.x);
        float azimuthWrap = 0.5 + 0.5 * sin(azimuth * 2.0 + nebulaNoiseB * 1.2 + nebulaNoiseC * 0.7);
        float clusterDensity = clusterField(vWorldDir);

        float nebulaBand = mix(1.0, smoothstep(0.04, 0.95, 1.0 - abs(vWorldDir.y)), 0.3);
        float nebulaDetail = smoothstep(0.29, 0.76, nebulaNoiseA * 0.62 + nebulaNoiseB * 0.2 + nebulaNoiseC * 0.18);
        float nebulaFade = smoothstep(0.02, 0.96, y) * (1.0 - horizonBand * 0.82);
        float nebulaMask = nebulaBand * nebulaDetail * nebulaFade * (0.58 + 0.42 * azimuthWrap) * (0.52 + clusterDensity * 0.95);
        float dustLanes = smoothstep(0.52, 0.92, nebulaNoiseC) * nebulaBand * 0.68;

        float volumetric = smoothstep(0.36, 0.84, nebulaNoiseA * 0.74 + nebulaNoiseB * 0.26) * nebulaBand * nebulaFade;

        vec3 nebulaWhite = vec3(0.78, 0.80, 0.92);
        vec3 nebulaBlue = vec3(0.32, 0.47, 0.78);
        vec3 nebulaPurple = vec3(0.44, 0.26, 0.62);
        vec3 nebulaColor = mix(nebulaBlue, nebulaPurple, 0.34 + 0.66 * azimuthWrap);
        nebulaColor = mix(nebulaColor, nebulaWhite, smoothstep(0.28, 0.85, nebulaNoiseA) * 0.28);
        float nebulaCoreBoost = pow(clamp(nebulaMask, 0.0, 1.0), 1.25);
        skyColor += nebulaColor * nebulaMask * (0.26 + clusterDensity * 0.2);
        skyColor += nebulaColor * volumetric * (0.16 + clusterDensity * 0.1);
        skyColor += vec3(0.08, 0.09, 0.16) * nebulaCoreBoost * 0.14;
        skyColor -= vec3(0.022, 0.016, 0.03) * dustLanes;

        gl_FragColor = vec4(clamp(skyColor, 0.0, 1.0), 1.0);
      }
    `
  });

  const sky = new THREE.Mesh(geo, nightGradientMat);
  sky.frustumCulled = false;
  sky.renderOrder = -2;

  const cloudTexture = createSoftCloudTexture();
  const cloudLayer = createCloudPlaneLayer(cloudTexture);

  const skyGroup = new THREE.Group();
  skyGroup.add(sky);
  skyGroup.add(createBackgroundStarField());
  skyGroup.add(cloudLayer.group);

  skyGroup.userData.update = (dt) => {
    cloudLayer.update(dt, camera);
  };

  console.log("[Sky] Sky dome ready with layered gradient, procedural star field, and cloud planes.");
  return skyGroup;
}

function createSoftCloudTexture(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, size, size);

  for (let i = 0; i < 22; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.16 + Math.random() * 0.28);
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(0.55, "rgba(220,232,255,0.10)");
    g.addColorStop(1, "rgba(160,180,215,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createCloudPlaneLayer(texture, count = 14) {
  const group = new THREE.Group();
  const clouds = [];

  for (let i = 0; i < count; i += 1) {
    const w = 180 + Math.random() * 260;
    const h = 95 + Math.random() * 170;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.18 + Math.random() * 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
      color: new THREE.Color(0xb8c7df)
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;

    const base = new THREE.Vector3(
      (Math.random() * 2 - 1) * 620,
      250 + Math.random() * 120,
      (Math.random() * 2 - 1) * 620
    );

    mesh.position.copy(base);
    mesh.renderOrder = -1;

    const drift = new THREE.Vector2((Math.random() * 2 - 1) * 4.5, (Math.random() * 2 - 1) * 4.5);
    const pulseOffset = Math.random() * Math.PI * 2;

    clouds.push({ mesh, base, drift, pulseOffset });
    group.add(mesh);
  }

  const update = (dt, camera) => {
    if (camera) {
      group.position.x = camera.position.x;
      group.position.z = camera.position.z;
      group.position.y = camera.position.y + 220;
    }

    for (const cloud of clouds) {
      cloud.base.x += cloud.drift.x * dt;
      cloud.base.z += cloud.drift.y * dt;

      if (cloud.base.x > 680) cloud.base.x = -680;
      if (cloud.base.x < -680) cloud.base.x = 680;
      if (cloud.base.z > 680) cloud.base.z = -680;
      if (cloud.base.z < -680) cloud.base.z = 680;

      cloud.mesh.position.x = cloud.base.x;
      cloud.mesh.position.y = cloud.base.y;
      cloud.mesh.position.z = cloud.base.z;

      cloud.mesh.material.opacity = 0.13 + 0.12 * (0.5 + 0.5 * Math.sin(performance.now() * 0.00018 + cloud.pulseOffset));
    }
  };

  return { group, update };
}
