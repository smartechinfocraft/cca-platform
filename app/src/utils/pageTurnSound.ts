// ============================================================
//  utils/pageTurnSound.ts
//  A short paper-like "swoosh" for the flipbook, synthesized with
//  the Web Audio API (filtered white noise, quick attack/decay).
//  No external audio file to license/host — just a couple hundred
//  bytes of code that runs the same everywhere.
// ============================================================
let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

export function playPageTurnSound(volume = 0.35): void {
  try {
    const audioCtx = getContext();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const duration = 0.28;
    const sampleRate = audioCtx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // White noise shaped by a quick-attack/longer-decay envelope —
    // reads as a short paper "fwip" rather than a harsh static burst.
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const envelope = t < 0.08 ? t / 0.08 : Math.pow(1 - (t - 0.08) / 0.92, 1.8);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass sweep gives it a papery "whoosh" character instead of
    // sounding like plain radio static.
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(1800, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + duration);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start();
    noise.stop(audioCtx.currentTime + duration);
  } catch {
    // Audio isn't critical to the feature — fail silently (e.g. if the
    // browser blocks audio before any user gesture).
  }
}