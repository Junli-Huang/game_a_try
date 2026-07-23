import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioService } from '../src/systems/audio-service.js';
import { cloneDefaultConfig } from '../src/config/default-config.js';

class FakeNode {
  constructor() { this.gain = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; this.frequency = { value: 0 }; this.playbackRate = { value: 1 }; }
  connect() { return this; }
  disconnect() {}
  start() { this.started = true; }
  stop() { this.stopped = true; this.onended?.(); }
}

class FakeContext {
  constructor() { this.destination = {}; this.currentTime = 0; this.gains = []; this.sources = []; this.oscillators = []; }
  resume() { return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
  decodeAudioData(data) { return Promise.resolve({ data }); }
  createGain() { const node = new FakeNode(); this.gains.push(node); return node; }
  createBufferSource() { const node = new FakeNode(); this.sources.push(node); return node; }
  createOscillator() { const node = new FakeNode(); this.oscillators.push(node); return node; }
}

function service(overrides = {}, dependencies = {}) {
  const config = cloneDefaultConfig();
  Object.assign(config.audio, overrides);
  return new AudioService(config, { AudioContext: FakeContext, now: () => 1000, random: () => .5, baseUrl: '/game_a_try/', ...dependencies });
}

test('disabled audio does not load and muted audio does not play', async () => {
  let calls = 0;
  const disabled = service({ enabled: false }, { fetch: async () => { calls += 1; } });
  await disabled.preload();
  assert.equal(calls, 0);
  const muted = service({ muted: true });
  assert.equal(muted.playSfx('click'), false);
  assert.equal(muted.context, null);
});

test('master and SFX volume combine for decoded buffers', () => {
  const audio = service({ masterVolume: .5, sfxVolume: .4 });
  audio.unlock();
  audio.buffers.set('ui-click-01.wav', {});
  assert.equal(audio.playSfx('click'), true);
  assert.equal(audio.context.gains.at(-1).gain.value, .55 * .5 * .4);
});

test('variants rotate and cooldown suppresses duplicate playback', () => {
  let now = 1000;
  const audio = service({}, { now: () => now });
  audio.unlock();
  audio.buffers.set('player-step-01.wav', {});
  audio.buffers.set('player-step-02.wav', {});
  assert.equal(audio.playSfx('move'), true);
  assert.equal(audio.playSfx('move'), false);
  now += 60;
  assert.equal(audio.playSfx('move'), true);
  assert.equal(audio.context.sources[0].buffer, audio.buffers.get('player-step-01.wav'));
  assert.equal(audio.context.sources[1].buffer, audio.buffers.get('player-step-02.wav'));
});

test('failed or unavailable assets fall back safely before unlock', () => {
  const audio = service();
  assert.doesNotThrow(() => audio.playSfx('alert'));
  assert.equal(audio.context.oscillators.length, 1);
});

test('dispose stops active nodes and releases decoded buffers', () => {
  const audio = service();
  audio.unlock(); audio.buffers.set('ui-click-01.wav', {});
  audio.playSfx('click');
  const source = audio.context.sources[0], context = audio.context;
  audio.dispose();
  assert.equal(source.stopped, true);
  assert.equal(audio.buffers.size, 0);
  assert.equal(context.closed, true);
  assert.equal(audio.context, null);
});
