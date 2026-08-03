/**
 * UI foley, synthesised in WebAudio — inspired by (never sampled from)
 * PoE's currency clicks. Everything works silent; mute persists.
 */

const MUTE_KEY = 'exile-draft:muted';

let ctx: AudioContext | null = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  localStorage.setItem(MUTE_KEY, m ? '1' : '0');
}

function env(c: AudioContext, at: number, dur: number, peak = 0.2): GainNode {
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  gain.connect(c.destination);
  return gain;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Soft currency click — buys, button presses. */
export function click() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1900, t);
  osc.frequency.exponentialRampToValueAtTime(700, t + 0.05);
  osc.connect(env(c, t, 0.07, 0.12));
  osc.start(t); osc.stop(t + 0.08);
}

/** Metallic shink — cards dealing in. */
export function shink(delayMs = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delayMs / 1000;
  for (const [freq, det] of [[2800, 0], [4200, 8]] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime(det, t);
    osc.connect(env(c, t, 0.16, 0.05));
    osc.start(t); osc.stop(t + 0.18);
  }
}

/** Ember whoosh — the reroll burn. */
export function burn() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(2600, t + 0.28);
  filter.Q.value = 0.8;
  src.connect(filter);
  filter.connect(env(c, t, 0.3, 0.16));
  src.start(t); src.stop(t + 0.32);
}

/** Low heartbeat + hum — the Vaal moment. Fear is the feature. */
export function vaal() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  for (const beat of [0, 0.42]) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(58, t + beat);
    osc.frequency.exponentialRampToValueAtTime(38, t + beat + 0.16);
    osc.connect(env(c, t + beat, 0.2, 0.3));
    osc.start(t + beat); osc.stop(t + beat + 0.24);
  }
}

/** Combat hit tick. */
export function hit(heavy = false) {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = heavy ? 900 : 2200;
  src.connect(filter);
  filter.connect(env(c, t, heavy ? 0.16 : 0.06, heavy ? 0.22 : 0.08));
  src.start(t); src.stop(t + 0.2);
}

/** Kill toll. */
export function toll() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  for (const [freq, peak] of [[196, 0.18], [98, 0.14], [294, 0.06]] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(env(c, t, 1.4, peak));
    osc.start(t); osc.stop(t + 1.5);
  }
}
