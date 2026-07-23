import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const SFX_SEED = 1334;
export const SAMPLE_RATE = 44100;
export const SFX_FILES = [
  'ui-click-01.wav', 'player-step-01.wav', 'player-step-02.wav', 'player-attack-01.wav',
  'player-hurt-01.wav', 'player-defend-01.wav', 'enemy-alert-01.wav', 'enemy-chase-01.wav',
  'enemy-attack-intent-01.wav', 'battle-enter-01.wav', 'battle-victory-01.wav',
  'battle-defeat-01.wav', 'battle-escape-01.wav', 'corpse-harvest-01.wav',
  'item-obtain-01.wav', 'monster-meat-eat-01.wav', 'madness-rise-01.wav',
  'resistance-depleted-01.wav', 'relic-purify-01.wav', 'resistance-restore-01.wav',
  'extraction-progress-01.wav', 'extraction-success-01.wav'
];

const recipes = {
  'ui-click-01.wav': [.09, 190, 95, .38, .45], 'player-step-01.wav': [.14, 105, 58, .62, .75],
  'player-step-02.wav': [.15, 92, 51, .66, .79], 'player-attack-01.wav': [.23, 410, 72, .43, .56],
  'player-hurt-01.wav': [.27, 116, 47, .55, .68], 'player-defend-01.wav': [.22, 178, 82, .38, .48],
  'enemy-alert-01.wav': [.31, 180, 390, .31, .42], 'enemy-chase-01.wav': [.39, 132, 82, .46, .58],
  'enemy-attack-intent-01.wav': [.48, 91, 54, .51, .62], 'battle-enter-01.wav': [.62, 108, 46, .44, .54],
  'battle-victory-01.wav': [.72, 164, 244, .25, .34], 'battle-defeat-01.wav': [.84, 132, 42, .48, .58],
  'battle-escape-01.wav': [.42, 260, 112, .36, .46], 'corpse-harvest-01.wav': [.58, 126, 61, .73, .82],
  'item-obtain-01.wav': [.28, 235, 330, .25, .34], 'monster-meat-eat-01.wav': [.64, 104, 66, .74, .83],
  'madness-rise-01.wav': [.76, 72, 91, .57, .68], 'resistance-depleted-01.wav': [.68, 280, 48, .47, .58],
  'relic-purify-01.wav': [1.18, 76, 520, .35, .45], 'resistance-restore-01.wav': [.83, 112, 286, .24, .33],
  'extraction-progress-01.wav': [.55, 138, 202, .32, .42], 'extraction-success-01.wav': [.92, 126, 310, .24, .34]
};

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function lowPass(samples, coefficient) {
  let previous = 0;
  for (let i = 0; i < samples.length; i += 1) {
    previous += coefficient * (samples[i] - previous);
    samples[i] = previous;
  }
}

function synthesize(name, index) {
  const [duration, from, to, noiseAmount, noiseTone] = recipes[name];
  const count = Math.round(duration * SAMPLE_RATE);
  const output = new Float64Array(count), noise = new Float64Array(count);
  const random = seededRandom(SFX_SEED + index * 977);
  for (let i = 0; i < count; i += 1) noise[i] = random() * 2 - 1;
  lowPass(noise, .018 + noiseTone * .07);
  let phase = 0;
  for (let i = 0; i < count; i += 1) {
    const t = i / SAMPLE_RATE, progress = i / Math.max(1, count - 1);
    phase += (from * Math.pow(to / from, progress)) / SAMPLE_RATE;
    const attack = Math.min(1, t / Math.min(.018, duration * .15));
    const release = Math.pow(Math.max(0, 1 - progress), 1.8);
    const sine = Math.sin(phase * Math.PI * 2);
    const triangle = 2 * Math.abs(2 * (phase - Math.floor(phase + .5))) - 1;
    const transient = noise[i] * Math.exp(-t * (10 + noiseTone * 18));
    output[i] = Math.tanh(((.72 * sine + .28 * triangle) * (1 - noiseAmount * .55) + noise[i] * noiseAmount * .5 + transient * .7) * attack * release * 1.35);
  }
  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  const scale = peak ? (10 ** (-1.2 / 20)) / peak : 1;
  return Float32Array.from(output, (sample) => sample * scale);
}

export function encodeWav(samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24); buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  return buffer;
}

export async function generateSfx(outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const generated = [];
  for (const [index, name] of SFX_FILES.entries()) {
    const data = encodeWav(synthesize(name, index));
    await writeFile(path.join(outputDirectory, name), data);
    generated.push({ name, bytes: data.length });
  }
  return generated;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = fileURLToPath(new URL('../public/assets/audio/sfx/', import.meta.url));
  const files = await generateSfx(target);
  console.log(`Generated ${files.length} deterministic SFX files (seed ${SFX_SEED}):`);
  files.forEach(({ name, bytes }) => console.log(`- ${name} (${bytes} bytes)`));
}
