import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function createSkySphere() {
  console.log("[Sky] Initializing procedural sky dome (base + emissive glow)...");

  const geo = new THREE.SphereGeometry(1010, 64, 64);

  const baseMat = new THREE.MeshBasicMaterial({
  color: 0xff00ff,
  side: THREE.BackSide
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
