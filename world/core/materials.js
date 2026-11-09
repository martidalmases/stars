import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { shared } from "./environment.js";
import { STYLIZED, GRASS } from "../shaders/shaders.js";

const v3 = (c) => new THREE.Vector3(c[0], c[1], c[2]);

// color: [r, g, b] en valors de pantalla (0..1).
// flat: facetes visibles (roques, terra). vertexColors: usa l'atribut aColor.
export function stylizedMaterial({
  color = [1, 1, 1],
  flat = false,
  vertexColors = false,
  rock = null, // "ground" (textura vista des de dalt) o "block" (en tres direccions)
  side = THREE.FrontSide
} = {}) {
  const defines = {};
  if (flat) defines.FLAT = "";
  if (vertexColors) defines.USE_ACOLOR = "";
  if (rock === "ground") defines.ROCK_GROUND = "";
  if (rock === "block") defines.ROCK = "";

  return new THREE.ShaderMaterial({
    defines,
    uniforms: { ...shared, uColor: { value: v3(color) } },
    vertexShader: STYLIZED.vertex,
    fragmentShader: STYLIZED.fragment,
    side
  });
}

export function grassMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: v3([1, 1, 1]) } },
    vertexShader: GRASS.vertex,
    fragmentShader: STYLIZED.fragment,
    side: THREE.DoubleSide
  });
}
