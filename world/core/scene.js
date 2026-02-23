import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function createSkySphere() {
  const geo = new THREE.SphereGeometry(1010, 64, 64);

  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: false,
    depthWrite: false,
    depthTest: true,
    uniforms: {
      time: { value: 0 },
      zenithColor: { value: new THREE.Color(0x03040a) },
      upperMidColor: { value: new THREE.Color(0x0b1840) },
      lowerMidColor: { value: new THREE.Color(0x22385e) },
      horizonColor: { value: new THREE.Color(0x6a5c5a) },
      galaxyAxis: { value: new THREE.Vector3(0.25, 0.95, 0.18).normalize() }
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
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
      varying vec3 vWorldPosition;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float layerCore(vec3 dir, float freq, float thresholdLow, float thresholdHigh, float maxIntensity) {
        float n = hash(dir * freq);
        return smoothstep(thresholdLow, thresholdHigh, n) * maxIntensity;
      }

      vec3 starLayer(
        vec3 dir,
        float freq,
        float thresholdLow,
        float thresholdHigh,
        float maxIntensity,
        vec3 coolColor,
        vec3 warmColor,
        float colorFreq
      ) {
        float core = layerCore(dir, freq, thresholdLow, thresholdHigh, maxIntensity);
        float glow = layerCore(dir + vec3(0.013, -0.017, 0.011), freq * 0.57, thresholdLow - 0.01, thresholdHigh, maxIntensity * 0.4);
        float temperature = hash(dir * colorFreq);
        vec3 starColor = mix(coolColor, warmColor, smoothstep(0.35, 0.92, temperature));
        return starColor * (core + glow);
      }

      void main() {
        vec3 dir = normalize(vWorldPosition);

        float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 base = mix(lowerMidColor, upperMidColor, smoothstep(0.1, 0.72, t));
        base = mix(base, zenithColor, smoothstep(0.55, 1.0, t));
        float horizonBand = 1.0 - smoothstep(0.0, 0.22, abs(dir.y));
        base = mix(base, horizonColor, horizonBand * 0.55);

        float planeDot = dot(dir, galaxyAxis);
        float galaxyBand = smoothstep(0.42, 0.0, abs(planeDot));
        float galaxyHaze = hash(dir * 14.0) * 0.35 + hash(dir * 6.2) * 0.65;
        vec3 nebula = vec3(0.12, 0.17, 0.28) * galaxyBand * smoothstep(0.3, 1.0, galaxyHaze) * 0.33;

        vec3 stars = vec3(0.0);

        vec3 layer1Dir = normalize(dir + vec3(0.03, -0.02, 0.01));
        float layer1MilkyBoost = 1.0 + galaxyBand * 1.2;
        stars += starLayer(
          layer1Dir,
          1950.0,
          0.9977,
          0.99996,
          0.32 * layer1MilkyBoost,
          vec3(0.68, 0.75, 0.92),
          vec3(0.85, 0.82, 0.72),
          1380.0
        );

        vec3 layer2Dir = normalize(dir + vec3(-0.014, 0.021, -0.008));
        float layer2MilkyBoost = 1.0 + galaxyBand * 1.45;
        stars += starLayer(
          layer2Dir,
          860.0,
          0.9956,
          0.9998,
          0.62 * layer2MilkyBoost,
          vec3(0.79, 0.86, 1.0),
          vec3(1.0, 0.92, 0.78),
          530.0
        );

        vec3 layer3Dir = normalize(dir + vec3(0.006, 0.004, -0.011));
        float brightCore = layerCore(layer3Dir, 360.0, 0.9979, 0.99995, 1.6 * (1.0 + galaxyBand * 0.7));
        float brightHalo = layerCore(layer3Dir + vec3(0.002, -0.003, 0.002), 280.0, 0.9965, 0.9997, 0.85);
        float spikes = layerCore(vec3(layer3Dir.x * 8.0, layer3Dir.y * 1.6, layer3Dir.z * 8.0), 120.0, 0.9992, 0.99998, 0.26);
        float twinkleMask = smoothstep(0.8, 1.0, hash(layer3Dir * 37.0));
        float twinkle = 1.0 + sin(time * 0.6 + hash(layer3Dir * 57.0) * 12.0) * 0.08 * twinkleMask;
        vec3 brightColor = mix(vec3(0.9, 0.95, 1.0), vec3(1.0, 0.9, 0.76), smoothstep(0.25, 0.9, hash(layer3Dir * 420.0)));
        stars += brightColor * (brightCore * twinkle + brightHalo + spikes);

        stars *= (1.0 - horizonBand * 0.78);

        vec3 color = base + nebula + stars;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.userData.update = (delta = 0.016) => {
    mat.uniforms.time.value += delta;
  };

  return sky;
}
