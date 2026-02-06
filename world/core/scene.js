import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";


export function createScene() {
const scene = new THREE.Scene();


return scene;
}


export function createSkySphere() {
const geo = new THREE.SphereGeometry(1010, 64, 64);


const mat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,

  uniforms: {
    topColor:    { value: new THREE.Color(0x02030a) },
    bottomColor: { value: new THREE.Color(0x101a2a) },

    offset:   { value: 20 },
    exponent: { value: 0.7 },

    time: { value: 0 }
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
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    uniform float time;

    varying vec3 vWorldPosition;


    // Simple hash noise
    float hash(vec2 p) {
      return fract(
        sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123
      );
    }


    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      vec2 u = f * f * (3.0 - 2.0 * f);

      return mix(a, b, u.x) +
             (c - a) * u.y * (1.0 - u.x) +
             (d - b) * u.x * u.y;
    }


    void main() {

      // Sky gradient
      float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;

      float base = clamp(
        pow(max(h, 0.0), exponent),
        0.0,
        1.0
      );


      vec3 color = mix(bottomColor, topColor, base);


      // ======================
      // Subtle Noise
      // ======================

      vec2 uv = normalize(vWorldPosition).xz * 6.0;

      float n = noise(uv + time * 0.02);

      color += n * 0.03; // intensity


      // ======================
      // Horizon Glow
      // ======================

      float horizon = smoothstep(-0.1, 0.25, h);

      vec3 glowColor = vec3(0.15, 0.18, 0.25);

      color += glowColor * (1.0 - horizon) * 0.4;


      gl_FragColor = vec4(color, 1.0);
    }
  `
});




const sky = new THREE.Mesh(geo, mat);

sky.userData.update = (delta) => {
  mat.uniforms.time.value += delta;
};

return sky;
}
