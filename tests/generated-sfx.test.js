import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateSfx, SAMPLE_RATE, SFX_FILES } from '../scripts/generate-sfx.mjs';
import { SFX_DEFINITIONS } from '../src/systems/audio-service.js';

test('generator creates every declared deterministic PCM16 mono WAV without clipping', async () => {
  const first = await mkdtemp(path.join(tmpdir(), 'fog-sfx-a-'));
  const second = await mkdtemp(path.join(tmpdir(), 'fog-sfx-b-'));
  await generateSfx(first); await generateSfx(second);
  const definedFiles = [...new Set(Object.values(SFX_DEFINITIONS).flatMap((definition) => definition.files))].sort();
  assert.deepEqual([...SFX_FILES].sort(), definedFiles);
  for (const name of SFX_FILES) {
    const a = await readFile(path.join(first, name)), b = await readFile(path.join(second, name));
    assert.equal(createHash('sha256').update(a).digest('hex'), createHash('sha256').update(b).digest('hex'));
    assert.equal(a.toString('ascii', 0, 4), 'RIFF');
    assert.equal(a.toString('ascii', 8, 12), 'WAVE');
    assert.equal(a.readUInt16LE(20), 1);
    assert.equal(a.readUInt16LE(22), 1);
    assert.equal(a.readUInt32LE(24), SAMPLE_RATE);
    assert.equal(a.readUInt16LE(34), 16);
    assert.ok(a.length > 44);
    let peak = 0;
    for (let offset = 44; offset < a.length; offset += 2) peak = Math.max(peak, Math.abs(a.readInt16LE(offset)));
    assert.ok(peak > 0 && peak < 32767);
  }
});
