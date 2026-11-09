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
  uMoonColor: { value: v3(0.115, 0.14, 0.205) },
  uSkyAmbient: { value: v3(0.032, 0.04, 0.064) },
  uGroundAmbient: { value: v3(0.01, 0.01, 0.015) },

  uLanternPos: { value: v3(0, -0.4, -2) },
  uLanternColor: { value: v3(1.0, 0.52, 0.22) },
  uLanternIntensity: { value: 1.0 },

  // Boira de distància: es fon amb la claror de l'horitzó.
  uHazeColor: { value: v3(0.072, 0.088, 0.13) },
  // Boira baixa que s'acumula sobre el mar de núvols i a les valls.
  uMistColor: { value: v3(0.06, 0.074, 0.11) },
  uCloudY: { value: CLOUD_Y },
  uCloudColor: { value: v3(0.06, 0.074, 0.11) }
};

export function updateEnvironment(t) {
  shared.uTime.value = t;

  // Ràfegues suaus de vent.
  shared.uWind.value = 0.8 + 0.3 * Math.sin(t * 0.21) + 0.18 * Math.sin(t * 0.53 + 1.3);

  // Parpelleig del fanalet.
  shared.uLanternIntensity.value =
    1.25 + 0.06 * Math.sin(t * 11.0) + 0.04 * Math.sin(t * 23.7 + 0.4) + 0.03 * Math.sin(t * 5.3);
}
