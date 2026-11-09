// Forma de la constel·lació: 12 estrelles, una per cada mes que fa que sou junts.
// Les estrelles s'encenen en l'ordre de la llista.
//
// Cada punt és [u, v], entre -1 i 1:
//   u: -1 esquerra, 1 dreta     v: -1 a baix, 1 a dalt
// center: on es col·loca al cel (az: graus a la dreta, el: graus d'alçada).
// size: amplada i alçada de la figura (en graus).
// closed: si l'última estrella s'uneix amb la primera en acabar.
//
// Per canviar la forma, posa el nom a ACTIVE_CONSTELLATION o afegeix-ne una de nova.

export const ACTIVE_CONSTELLATION = "cor";

function heartPoints() {
  // Comença a la punta de baix i puja pel costat esquerre: la forma de cor
  // només s'endevina quan ja hi ha mitja figura feta.
  const pts = [];
  for (let k = 0; k < 12; k += 1) {
    const t = Math.PI + (k * Math.PI) / 6;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x / 16, (y + 2.75) / 14.25]);
  }
  return pts;
}

export const CONSTELLATIONS = {
  cor: {
    center: { az: 0, el: 36 },
    size: { w: 44, h: 30 },
    closed: true,
    points: heartPoints()
  },

  // La silueta de dos cims: el teu i el seu.
  muntanya: {
    center: { az: 0, el: 34 },
    size: { w: 56, h: 26 },
    closed: false,
    points: [
      [-1.0, -0.85],
      [-0.78, -0.35],
      [-0.6, 0.05],
      [-0.42, 0.55],
      [-0.28, 0.95],
      [-0.12, 0.45],
      [0.02, 0.15],
      [0.2, 0.6],
      [0.38, 1.0],
      [0.58, 0.45],
      [0.8, -0.1],
      [1.0, -0.8]
    ]
  }
};
