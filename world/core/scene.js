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
    depthTest: false,
    uniforms: {
      time: { value: 0 },
      zenithColor: { value: new THREE.Color(0x05070f) },
      upperMidColor: { value: new THREE.Color(0x0d2153) },
      lowerMidColor: { value: new THREE.Color(0x304a72) },
      horizonColor: { value: new THREE.Color(0x887574) },
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

      vec3 starColor(vec3 dir, vec3 cool, vec3 warm, float freq) {
        float t = hash(dir * freq);
        return mix(cool, warm, smoothstep(0.25, 0.9, t));
      }

      void main() {
        vec3 dir = normalize(vDir);

        float y01 = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 sky = mix(lowerMidColor, upperMidColor, smoothstep(0.08, 0.72, y01));
        sky = mix(sky, zenithColor, smoothstep(0.55, 1.0, y01));

        float horizonBlend = 1.0 - smoothstep(0.0, 0.24, abs(dir.y));
        sky = mix(sky, horizonColor, horizonBlend * 0.42);

        float plane = abs(dot(dir, galaxyAxis));
        float galaxyBand = 1.0 - smoothstep(0.0, 0.42, plane);

        float hazeNoise = hash(dir * 5.0) * 0.6 + hash(dir * 12.0) * 0.4;
        vec3 nebula = vec3(0.08, 0.12, 0.21) * galaxyBand * smoothstep(0.32, 1.0, hazeNoise) * 0.45;

        vec3 stars = vec3(0.0);

        float l1 = starMask(dir + vec3(0.013, -0.017, 0.007), 1350.0, 0.9962, 0.9997);
        l1 *= (0.18 + 0.38 * galaxyBand);
        stars += starColor(dir, vec3(0.72, 0.78, 0.95), vec3(0.9, 0.86, 0.78), 610.0) * l1;

        float l2 = starMask(dir + vec3(-0.01, 0.02, -0.013), 720.0, 0.9946, 0.9994);
        l2 *= (0.35 + 0.65 * galaxyBand);
        stars += starColor(dir, vec3(0.82, 0.89, 1.0), vec3(1.0, 0.91, 0.76), 380.0) * l2;

        float core = starMask(dir + vec3(0.004, -0.003, 0.01), 260.0, 0.9965, 0.99992);
        float halo = starMask(dir + vec3(-0.006, 0.005, -0.004), 210.0, 0.9945, 0.9995) * 0.55;
        float spikes = starMask(vec3(dir.x * 7.0, dir.y * 1.3, dir.z * 7.0), 95.0, 0.9982, 0.99998) * 0.22;
        float twinkleGate = smoothstep(0.86, 1.0, hash(dir * 44.0));
        float twinkle = 1.0 + sin(time * 0.55 + hash(dir * 52.0) * 8.0) * 0.07 * twinkleGate;
        vec3 bright = starColor(dir, vec3(0.92, 0.96, 1.0), vec3(1.0, 0.9, 0.74), 280.0);
        stars += bright * (core * twinkle * (0.95 + galaxyBand * 0.45) + halo + spikes);

        stars *= (1.0 - horizonBlend * 0.75);

        vec3 color = sky + nebula + stars;
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
