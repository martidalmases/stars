import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

function createBackgroundStarField(radius = 980, count = 2500) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const luminosities = new Float32Array(count);

  const axis = new THREE.Vector3(0.28, 0.9, -0.22).normalize();

  for (let i = 0; i < count; i += 1) {
    const dir = new THREE.Vector3();
    let accepted = false;

    for (let attempt = 0; attempt < 12 && !accepted; attempt += 1) {
      dir
        .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        .normalize();

      const altitude = dir.y * 0.5 + 0.5;
      const horizonFade = THREE.MathUtils.smoothstep(altitude, 0.2, 1.0);
      const band = 1.0 - Math.min(1.0, Math.abs(dir.dot(axis)) / 0.45);
      const clustering = 0.45 + band * 0.55;
      const keepChance = horizonFade * clustering;

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

    const luminosity = Math.pow(Math.random(), 2.35);
    const size = 2.25 + Math.pow(Math.random(), 2.8) * 4.8;

    colors[i * 3] = starColor.r;
    colors[i * 3 + 1] = starColor.g;
    colors[i * 3 + 2] = starColor.b;
    sizes[i] = size;
    luminosities[i] = 0.28 + luminosity * 1.35;
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
    blending: THREE.AdditiveBlending,
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

        gl_PointSize = max(1.85, aSize * aLuminosity * (360.0 / depth));
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

        float core = exp(-20.0 * r * r);
        float halo = exp(-5.0 * r * r);

        float spikeX = exp(-120.0 * uv.x * uv.x) * exp(-3.0 * uv.y * uv.y);
        float spikeY = exp(-120.0 * uv.y * uv.y) * exp(-3.0 * uv.x * uv.x);
        float diagonal = exp(-85.0 * (uv.x + uv.y) * (uv.x + uv.y)) * exp(-6.0 * (uv.x - uv.y) * (uv.x - uv.y));

        float glare = (spikeX + spikeY + diagonal * 0.55) * clamp(vSize / 4.8, 0.06, 0.52) * glareBoost;
        float alpha = (core * 1.3 + halo * 0.58 + glare * 0.9) * vLuminosity;

        gl_FragColor = vec4(vColor, clamp(alpha, 0.0, 1.0));
      }
    `
  });

  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
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
        for (int i = 0; i < 5; i++) {
          sum += valueNoise(p) * amp;
          p = p * 2.03 + vec3(17.0, 31.0, 13.0);
          amp *= 0.5;
        }
        return sum;
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

        vec3 nebulaDirA = normalize(vec3(0.46, 0.31, -0.83));
        vec3 nebulaDirB = normalize(vec3(-0.57, 0.38, -0.72));
        float nebulaShapeA = pow(max(dot(vWorldDir, nebulaDirA), 0.0), 3.7);
        float nebulaShapeB = pow(max(dot(vWorldDir, nebulaDirB), 0.0), 4.4);

        float nebulaNoiseA = fbm(vWorldDir * vec3(8.6, 12.4, 8.6));
        float nebulaNoiseB = fbm(vWorldDir.zyx * vec3(10.8, 7.6, 11.6));
        float nebulaDetail = smoothstep(0.34, 0.72, nebulaNoiseA * 0.65 + nebulaNoiseB * 0.35);
        float nebulaFade = smoothstep(0.1, 0.85, y) * (1.0 - horizonBand);
        float nebulaMask = (nebulaShapeA * 0.66 + nebulaShapeB * 0.34) * nebulaDetail * nebulaFade;

        vec3 nebulaColor = vec3(0.28, 0.31, 0.52) * 0.58 + vec3(0.20, 0.13, 0.34) * 0.42;
        float nebulaCoreBoost = pow(clamp(nebulaMask, 0.0, 1.0), 0.68);
        skyColor += nebulaColor * nebulaMask * 0.72;
        skyColor += vec3(0.18, 0.16, 0.30) * nebulaCoreBoost * 0.24;

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
