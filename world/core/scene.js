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

export function createSkySphere() {
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

      void main() {
        float y = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);

        float lowerMix = smoothstep(0.02, 0.36, pow(y, 1.7));
        float upperMix = smoothstep(0.34, 0.86, pow(y, 1.32));

        vec3 lowerGradient = mix(horizonColor, midColor, lowerMix);
        vec3 skyColor = mix(lowerGradient, zenithColor, upperMix);

        float horizonBand = exp(-pow(abs(vWorldDir.y) / 0.085, 2.0));
        skyColor += pollutionBandColor * horizonBand * 0.14;

        float nA = hash(vWorldDir * 210.0);
        float nB = hash(vWorldDir.zyx * 390.0);
        float noise = (nA * 0.65 + nB * 0.35) - 0.5;
        skyColor += noise * 0.018;

        gl_FragColor = vec4(clamp(skyColor, 0.0, 1.0), 1.0);
      }
    `
  });

  const sky = new THREE.Mesh(geo, nightGradientMat);
  sky.frustumCulled = false;
  sky.renderOrder = -2;

  const skyGroup = new THREE.Group();
  skyGroup.add(sky);
  skyGroup.add(createBackgroundStarField());

  console.log("[Sky] Sky dome ready with layered gradient and procedural star field.");
  return skyGroup;
}
