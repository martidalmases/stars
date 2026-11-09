import { shared } from "../core/environment.js";

// Força del vent actual (la fa variar updateEnvironment a core/environment.js).
// Útil si vols fer moure altres coses al mateix ritme que l'herba.
export function getWindStrength() {
  return shared.uWind.value;
}
