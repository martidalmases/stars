// On és cada cosa del bivac (en metres). La càmera (els teus ulls) és a (0, 0, 0)
// i mira cap a -z. +x és la dreta. El terra del campament és a y = -0.5.
// Pots moure objectes canviant aquests números.

export const LAYOUT = {
  ownMat: { x: 0.0, z: -0.78, width: 0.56, length: 1.92, rot: 0.0 },
  partnerMat: { x: 0.76, z: -0.48, width: 0.56, length: 1.92, rot: -0.05 },

  // El teu sac: el cap és sota la càmera, els peus cap endavant.
  ownBag: { x: 0.0, zHead: 0.16, length: 1.95, rot: 0.0 },
  // El sac del costat: tancat del tot, com algú que dorm arraulit a dins.
  partnerBag: { x: 0.76, zHead: 0.5, length: 1.95, rot: -0.05 },

  slab: { x: 0.42, z: -2.22, sx: 0.5, sz: 0.34 },
  lantern: { x: 0.38, z: -2.2 },
  cups: [
    { x: 0.16, z: -2.27, color: [0.78, 0.8, 0.84] },
    { x: 0.6, z: -2.34, color: [0.62, 0.16, 0.12] }
  ],
  thermos: { x: -0.56, z: -1.4 },

  packA: { x: -0.84, z: -0.22, color: [0.62, 0.3, 0.1] },
  packB: { x: 1.52, z: -1.58, color: [0.2, 0.28, 0.42] },

  // Fita de pedres del cim, al peu de l'avantcim.
  fita: { x: -2.6, z: -2.3 }
};

// Zones on no hi ha d'haver herba ni roques (rectangles x0, x1, z0, z1).
export const CLEAR_ZONES = [
  [-0.42, 1.12, -1.9, 0.9],
  [-0.12, 1.0, -2.55, -1.85],
  [-0.85, -0.3, -1.7, -1.1],
  [-1.45, -0.45, -1.1, 0.35],
  [1.2, 1.85, -1.9, -1.25],
  [-3.05, -2.15, -2.75, -1.85]
];

export function inClearZone(x, z, pad = 0) {
  return CLEAR_ZONES.some(([x0, x1, z0, z1]) =>
    x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad
  );
}
