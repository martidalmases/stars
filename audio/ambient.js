// So de l'escena: vent i grills generats per codi (sense fitxers) i, si hi és,
// la música de audio/musica.mp3.
// El navegador només deixa sonar res després d'un clic: per això start() es crida
// en clicar el botó de la portada.

const MUSIC_URL = "audio/musica.mp3";
const MUSIC_VOLUME = 0.35;
const WIND_VOLUME = 0.22;
const CRICKET_VOLUME = 0.05;

let ctx = null;
let master = null;
let started = false;
let muted = false;

function noiseBuffer(seconds = 3) {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    // Soroll "marró" (més greu que el blanc): sona a vent i no a estàtica.
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
  }
  return buf;
}

// Vent: soroll filtrat amb ràfegues que pugen i baixen a l'atzar.
function startWind() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(4);
  src.loop = true;

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 420;
  band.Q.value = 0.5;

  const gust = ctx.createGain();
  gust.gain.value = 0;

  const out = ctx.createGain();
  out.gain.value = WIND_VOLUME;

  src.connect(band).connect(gust).connect(out).connect(master);
  src.start();

  // Arrencada suau.
  gust.gain.setTargetAtTime(0.6, ctx.currentTime, 2.5);

  const schedule = () => {
    const now = ctx.currentTime;
    const strength = 0.35 + Math.random() * 0.75;
    const dur = 2 + Math.random() * 5;
    gust.gain.setTargetAtTime(strength, now, dur * 0.35);
    band.frequency.setTargetAtTime(280 + strength * 380, now, dur * 0.4);
    setTimeout(schedule, dur * 1000);
  };
  setTimeout(schedule, 3000);
}

// Grill: grups de "cri-cri" (polsos curts a ~4.5 kHz), amb pauses irregulars.
function startCricket(pan, rate, pitch) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = pitch;
  const env = ctx.createGain();
  env.gain.value = 0;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  const out = ctx.createGain();
  out.gain.value = CRICKET_VOLUME;
  osc.connect(env).connect(panner).connect(out).connect(master);
  osc.start();

  const chirp = () => {
    const now = ctx.currentTime + 0.05;
    const pulses = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pulses; i += 1) {
      const t = now + i * 0.045;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(1, t + 0.008);
      env.gain.linearRampToValueAtTime(0, t + 0.028);
    }
    // De tant en tant fa una pausa llarga.
    const next = Math.random() < 0.12 ? 4 + Math.random() * 6 : rate * (0.8 + Math.random() * 0.4);
    setTimeout(chirp, next * 1000);
  };
  setTimeout(chirp, 1500 + Math.random() * 3000);
}

function startMusic() {
  const audio = new Audio(MUSIC_URL);
  audio.loop = true;
  audio.preload = "auto";
  const src = ctx.createMediaElementSource(audio);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(master);
  audio.addEventListener("error", () => console.info("[so] No hi ha audio/musica.mp3: només ambient."));
  audio
    .play()
    .then(() => gain.gain.setTargetAtTime(MUSIC_VOLUME, ctx.currentTime + 2, 3))
    .catch(() => {});
}

// Es crida en qualsevol clic de la portada: prepara l'àudio (en silenci) perquè
// el navegador ja l'hagi autoritzat quan arribi el moment de sonar.
export function unlockAudio() {
  if (ctx) {
    ctx.resume?.();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
}

// Es crida just quan es fa la transició a l'escena.
export function startAmbient() {
  if (started) return;
  started = true;
  unlockAudio();
  ctx.resume?.();
  master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 1.5);

  startWind();
  startCricket(-0.6, 0.9, 4500);
  startCricket(0.5, 1.3, 4750);
  startMusic();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.3);
  return muted;
}
