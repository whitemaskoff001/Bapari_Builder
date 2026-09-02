let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function unlockNotificationAudio() {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  unlocked = true;
}

export function playCrack() {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  const duration = 0.09;
  const sampleRate = audio.sampleRate;
  const frames = Math.floor(sampleRate * duration);
  const buffer = audio.createBuffer(1, frames, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    const t = i / frames;
    const env = Math.exp(-t * 55) * (t < 0.012 ? 1.4 : 0.7);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1600;
  const gain = audio.createGain();
  gain.gain.value = unlocked ? 0.55 : 0.35;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  src.start();
}
