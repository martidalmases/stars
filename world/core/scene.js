import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function createSkySphere() {
  console.log("[Sky] Initializing procedural sky dome (base + emissive glow)...");

  const geo = new THREE.SphereGeometry(1010, 64, 64);

  const baseMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: false,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      time: { value: 0 },
      zenithColor: { value: new THREE.Color(0x02030a) },
      upperMidColor: { value: new THREE.Color(0x0b245e) },
      lowerMidColor: { value: new THREE.Color(0x244a82) },
      horizonColor: { value: new THREE.Color(0xf4cf9c) },
      galaxyAxis: { value: new THREE.Vector3(0.3, 0.92, -0.24).normalize() }
    },
    vertexShader: `
      varying vec3 vDir;

      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 zenithColor;
      uniform vec3 upperMidColor;
      uniform vec3 lowerMidColor;
      uniform vec3 horizonColor;
      uniform vec3 galaxyAxis;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float starMask(vec3 dir, float freq, float edge0, float edge1) {
        float n = hash(dir * freq);
        return smoothstep(edge0, edge1, n);
      }

      vec3 starColor(vec3 dir, float freq) {
        float t = hash(dir * freq);
        vec3 cool = vec3(0.76, 0.84, 1.0);
        vec3 neutral = vec3(0.95, 0.95, 0.93);
        vec3 warm = vec3(1.0, 0.88, 0.7);

        vec3 col = mix(cool, neutral, smoothstep(0.15, 0.6, t));
        col = mix(col, warm, smoothstep(0.65, 0.98, t));
        return col;
      }

      float twinkle(vec3 dir, float speed, float amount, float phaseFreq) {
        float gate = smoothstep(0.72, 1.0, hash(dir * (phaseFreq * 0.5)));
        float phase = hash(dir * phaseFreq) * 8.0;
        return 1.0 + sin(time * speed + phase) * amount * gate;
      }

      void main() {
        vec3 dir = normalize(vDir);

        float y01 = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 sky = mix(horizonColor, lowerMidColor, smoothstep(0.0, 0.24, y01));
        sky = mix(sky, upperMidColor, smoothstep(0.12, 0.7, y01));
        sky = mix(sky, zenithColor, smoothstep(0.55, 1.0, y01));

        float horizonBlend = 1.0 - smoothstep(0.0, 0.24, abs(dir.y));
        sky = mix(sky, horizonColor, horizonBlend * 0.34);

        float plane = abs(dot(dir, galaxyAxis));
        float galaxyBand = 1.0 - smoothstep(0.0, 0.42, plane);

        float hazeNoise = hash(dir * 5.0) * 0.6 + hash(dir * 12.0) * 0.4;
        vec3 nebula = vec3(0.08, 0.12, 0.21) * galaxyBand * smoothstep(0.32, 1.0, hazeNoise) * 0.45;

        vec3 stars = vec3(0.0);

        // Small stars: dense field
        float sSmall = starMask(dir + vec3(0.013, -0.017, 0.007), 1400.0, 0.9964, 0.9998);
        float bSmall = mix(0.12, 0.45, hash(dir * 510.0));
        float tSmall = twinkle(dir + vec3(0.02, 0.0, -0.01), 0.45, 0.05, 120.0);
        stars += starColor(dir, 610.0) * sSmall * bSmall * (0.4 + galaxyBand * 0.45) * tSmall;

        // Medium stars: brighter and less dense
        float sMedium = starMask(dir + vec3(-0.01, 0.02, -0.013), 760.0, 0.9951, 0.99965);
        float hMedium = starMask(dir + vec3(0.002, -0.004, 0.006), 240.0, 0.9935, 0.9992) * 0.22;
        float bMedium = mix(0.5, 1.15, hash(dir * 336.0));
        float tMedium = twinkle(dir + vec3(-0.01, 0.03, 0.01), 0.6, 0.08, 84.0);
        stars += starColor(dir, 380.0) * (sMedium * bMedium * tMedium + hMedium) * (0.55 + 0.65 * galaxyBand);

        // Large stars: sparse cores with halo/glare spikes
        float core = starMask(dir + vec3(0.004, -0.003, 0.01), 270.0, 0.9968, 0.99996);
        float halo = starMask(dir + vec3(-0.006, 0.005, -0.004), 220.0, 0.9948, 0.9997) * 0.85;
        float spikes = starMask(vec3(dir.x * 7.0, dir.y * 1.3, dir.z * 7.0), 100.0, 0.9985, 0.999995) * 0.28;
        float brightVariance = mix(0.9, 1.75, hash(dir * 123.0));
        float tLarge = twinkle(dir, 0.72, 0.12, 52.0);
        vec3 bright = starColor(dir, 280.0);
        stars += bright * ((core * brightVariance * tLarge * (0.95 + galaxyBand * 0.5)) + halo + spikes);

        stars *= (1.0 - horizonBlend * 0.75);

        vec3 color = sky + nebula + stars;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const glowMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      galaxyAxis: { value: new THREE.Vector3(0.3, 0.92, -0.24).normalize() },
      glowColor: { value: new THREE.Color(0x7fa9ff) },
      horizonGlowColor: { value: new THREE.Color(0xffd8a5) }
    },
    vertexShader: `
      varying vec3 vDir;

      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 galaxyAxis;
      uniform vec3 glowColor;
      uniform vec3 horizonGlowColor;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 dir = normalize(vDir);

        float y01 = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        float zenithFade = smoothstep(0.1, 1.0, y01);

        float plane = abs(dot(dir, galaxyAxis));
        float galaxyBand = 1.0 - smoothstep(0.0, 0.5, plane);

        float haze = hash(dir * 6.0) * 0.7 + hash(dir * 13.0) * 0.3;
        float pulse = 1.0 + sin(time * 0.13 + hash(dir * 81.0) * 6.28) * 0.08;

        float horizonGlow = (1.0 - smoothstep(0.0, 0.18, abs(dir.y))) * 0.36;
        float galaxyGlow = galaxyBand * smoothstep(0.42, 1.0, haze) * 0.17 * pulse;

        float bloomSeeds = smoothstep(0.9984, 0.99998, hash(dir * 182.0));
        float bloom = bloomSeeds * (0.08 + 0.22 * pulse);

        vec3 emissive = glowColor * (galaxyGlow + bloom) * zenithFade;
        emissive += horizonGlowColor * horizonGlow;

        float alpha = clamp(horizonGlow + galaxyGlow + bloom, 0.0, 0.55);
        gl_FragColor = vec4(emissive, alpha);
      }
    `
  });

  const baseSky = new THREE.Mesh(geo, baseMat);
  baseSky.frustumCulled = false;
  baseSky.renderOrder = -2;

  const glowSky = new THREE.Mesh(geo, glowMat);
  glowSky.frustumCulled = false;
  glowSky.renderOrder = -1;

  const skyGroup = new THREE.Group();
  skyGroup.add(baseSky);
  skyGroup.add(glowSky);
  skyGroup.userData.update = (delta = 0.016) => {
    baseMat.uniforms.time.value += delta;
    glowMat.uniforms.time.value += delta;
  };

  console.log("[Sky] Sky dome ready with emissive glow layer.");
  return skyGroup;
}
