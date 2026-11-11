// So de l'escena a partir de fitxers en bucle de la carpeta audio/:
//   audio/musica.(ogg|mp3|m4a|wav)
//   audio/vent.(ogg|mp3|m4a|wav)
//   audio/grills.(ogg|mp3|m4a|wav)
// Si en falta algun, simplement no sona. Tots comencen a volum 0 i pugen suaument
// quan apareix l'escena.
//
// Els bucles es fan amb Web Audio (sense el petit silenci que deixa <audio loop>).

const TRACKS = [
  { name: "vent", volume: 0.5, fadeIn: 4, delay: 0 },
  { name: "grills", volume: 0.25, fadeIn: 6, delay: 1.5 },
  { name: "musica", volume: 0.45, fadeIn: 8, delay: 2.5 }
];
const EXTENSIONS = ["ogg", "mp3", "m4a", "wav"];

let ctx = null;
let master = null;
let started = false;
let muted = false;
const buffers = new Map();
let loading = null;

async function loadTrack(name) {
  for (const ext of EXTENSIONS) {
    try {
      const res = await fetch(`audio/${name}.${ext}`);
      if (!res.ok) continue;
      const data = await res.arrayBuffer();
      return await ctx.decodeAudioData(data);
    } catch (e) {
      // prova la següent extensió
    }
  }
  console.info(`[so] No hi ha cap fitxer audio/${name}.*`);
  return null;
}

function loadAll() {
  if (!loading) {
    loading = Promise.all(
      TRACKS.map(async (t) => {
        const buf = await loadTrack(t.name);
        if (buf) buffers.set(t.name, buf);
      })
    );
  }
  return loading;
}

// Qualsevol clic de la portada: prepara l'àudio (en silenci) i comença a carregar
// els fitxers, perquè tot estigui a punt quan arribi l'escena.
export function unlockAudio() {
  if (ctx) {
    ctx.resume?.();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  loadAll();
}

// Just quan apareix l'escena.
export async function startAmbient() {
  if (started) return;
  started = true;
  unlockAudio();
  ctx.resume?.();
  await loadAll();

  const now = ctx.currentTime;
  TRACKS.forEach(({ name, volume, fadeIn, delay }) => {
    const buf = buffers.get(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(volume, now + delay + fadeIn);
    src.connect(gain).connect(master);
    // Cada bucle comença en un punt diferent perquè no soni sempre igual.
    src.start(now, name === "musica" ? 0 : Math.random() * buf.duration);
  });
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.3);
  return muted;
}
