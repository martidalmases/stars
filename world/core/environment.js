import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";
import { CLOUD_Y } from "../landscape/terrain.js";

// Paràmetres globals d'il·luminació i atmosfera. Tots els materials comparteixen
// aquests uniforms, així que canviar-los aquí afecta tota l'escena.

const v3 = (r, g, b) => new THREE.Vector3(r, g, b);

export const shared = {
  uTime: { value: 0 },
  uWind: { value: 1 },

  // Direcció cap a la lluna (darrere i a l'esquerra de la càmera).
  uMoonDir: { value: v3(-0.45, 0.5, 0.75).normalize() },
  uMoonColor: { value: v3(0.07, 0.085, 0.13) },
  uSkyAmbient: { value: v3(0.022, 0.027, 0.044) },
  uGroundAmbient: { value: v3(0.007, 0.007, 0.01) },

  uLanternPos: { value: v3(0, -0.4, -2) },
  uLanternColor: { value: v3(1.0, 0.52, 0.22) },
  uLanternIntensity: { value: 1.0 },

  // Boira de distància: es fon amb la claror de l'horitzó.
  uHazeColor: { value: v3(0.056, 0.068, 0.102) },
  // Boira baixa que s'acumula sobre el mar de núvols i a les valls.
  uMistColor: { value: v3(0.046, 0.057, 0.086) },
  uCloudY: { value: CLOUD_Y },
  uCloudColor: { value: v3(0.046, 0.057, 0.086) }
};

let flame = 1.25;
let flameTarget = 1.25;

export function updateEnvironment(t) {
  shared.uTime.value = t;

  // Ràfegues suaus de vent.
  shared.uWind.value = 0.8 + 0.3 * Math.sin(t * 0.21) + 0.18 * Math.sin(t * 0.53 + 1.3);

  // Parpelleig del fanal: una flama no és regular. Passeig aleatori suau
  // + petites espurnes de tant en tant.
  flameTarget += (Math.random() - 0.5) * 0.08;
  flameTarget += (1.25 - flameTarget) * 0.04;
  if (Math.random() < 0.012) flameTarget -= 0.12 + Math.random() * 0.1;
  flame += (flameTarget - flame) * 0.18;
  shared.uLanternIntensity.value = flame + 0.015 * Math.sin(t * 23.7);
}
