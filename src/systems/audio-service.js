export const SFX_DEFINITIONS = {
  click: { files: ['ui-click-01.wav'], volume: .55, cooldown: 35 },
  move: { files: ['player-step-01.wav', 'player-step-02.wav'], volume: .35, pitchVariation: .04, volumeVariation: .06, cooldown: 55 },
  attack: { files: ['player-attack-01.wav'], volume: .66, pitchVariation: .025, cooldown: 90 },
  hurt: { files: ['player-hurt-01.wav'], volume: .68, cooldown: 100 },
  defend: { files: ['player-defend-01.wav'], volume: .58, cooldown: 100 },
  alert: { files: ['enemy-alert-01.wav'], volume: .55, cooldown: 500 },
  chase: { files: ['enemy-chase-01.wav'], volume: .58, cooldown: 500 },
  intent: { files: ['enemy-attack-intent-01.wav'], volume: .7, cooldown: 650 },
  battle: { files: ['battle-enter-01.wav'], volume: .72, cooldown: 700 },
  victory: { files: ['battle-victory-01.wav'], volume: .65, cooldown: 800 },
  failure: { files: ['battle-defeat-01.wav'], volume: .72, cooldown: 800 },
  escape: { files: ['battle-escape-01.wav'], volume: .62, cooldown: 600 },
  harvest: { files: ['corpse-harvest-01.wav'], volume: .62, cooldown: 350 },
  item: { files: ['item-obtain-01.wav'], volume: .52, cooldown: 120 },
  eat: { files: ['monster-meat-eat-01.wav'], volume: .57, cooldown: 350 },
  madness: { files: ['madness-rise-01.wav'], volume: .46, cooldown: 850 },
  resistance_depleted: { files: ['resistance-depleted-01.wav'], volume: .68, cooldown: 2000 },
  purify: { files: ['relic-purify-01.wav'], volume: .62, cooldown: 500 },
  resistance_restore: { files: ['resistance-restore-01.wav'], volume: .55, cooldown: 500 },
  extract: { files: ['extraction-progress-01.wav'], volume: .58, cooldown: 1000 },
  extract_success: { files: ['extraction-success-01.wav'], volume: .7, cooldown: 1000 }
};

const FALLBACK_TONES = { click: 180, move: 90, attack: 260, hurt: 85, defend: 140, alert: 280, chase: 120, intent: 72, battle: 64, victory: 210, failure: 55, escape: 190, harvest: 105, item: 235, eat: 92, madness: 68, resistance_depleted: 52, purify: 310, resistance_restore: 180, extract: 150, extract_success: 230 };
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export class AudioService {
  constructor(config, dependencies = {}) {
    this.settings = { useGeneratedAssets: true, fallbackSynthEnabled: true, ...config.audio };
    this.AudioContext = dependencies.AudioContext || globalThis.AudioContext || globalThis.webkitAudioContext;
    this.fetch = dependencies.fetch || globalThis.fetch?.bind(globalThis);
    this.now = dependencies.now || (() => Date.now());
    this.random = dependencies.random || Math.random;
    this.baseUrl = dependencies.baseUrl ?? import.meta.env?.BASE_URL ?? '/';
    this.context = null; this.buffers = new Map(); this.loading = null;
    this.lastPlayed = new Map(); this.variantCursor = new Map(); this.activeSources = new Set(); this.disposed = false;
  }

  async preload() {
    if (!this.settings.enabled || !this.settings.useGeneratedAssets || !this.fetch || !this.AudioContext || this.disposed) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      this.ensureContext();
      const names = [...new Set(Object.values(SFX_DEFINITIONS).flatMap((definition) => definition.files))];
      await Promise.all(names.map(async (name) => {
        try {
          const response = await this.fetch(`${this.baseUrl}assets/audio/sfx/${name}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
          if (!this.disposed) this.buffers.set(name, buffer);
        } catch { /* Individual failures use the synthesised fallback. */ }
      }));
    })();
    return this.loading;
  }

  ensureContext() {
    if (!this.context && this.AudioContext && !this.disposed) this.context = new this.AudioContext();
    return this.context;
  }

  unlock() {
    if (!this.settings.enabled || this.settings.muted || this.disposed) return;
    try {
      const context = this.ensureContext();
      context?.resume?.().catch?.(() => {});
      this.preload().catch(() => {});
    } catch { /* Audio support is optional. */ }
  }

  playSfx(id, options = {}) {
    try {
      if (!this.settings.enabled || this.settings.muted || this.disposed) return false;
      const definition = SFX_DEFINITIONS[id];
      if (!definition) return false;
      const now = this.now();
      if (!options.force && now - (this.lastPlayed.get(id) ?? -Infinity) < (definition.cooldown || 0)) return false;
      this.lastPlayed.set(id, now); this.unlock();
      if (!this.context) return false;
      const cursor = this.variantCursor.get(id) || 0;
      const filename = definition.files[cursor % definition.files.length];
      this.variantCursor.set(id, cursor + 1);
      const variation = 1 + ((this.random() * 2 - 1) * (definition.volumeVariation || 0));
      const volume = clamp01(options.volume ?? definition.volume) * clamp01(this.settings.masterVolume) * clamp01(this.settings.sfxVolume) * variation;
      const buffer = this.buffers.get(filename);
      if (buffer) return this.playBuffer(buffer, volume, definition, options);
      return this.settings.fallbackSynthEnabled ? this.playFallback(id, volume) : false;
    } catch { return false; }
  }

  playBuffer(buffer, volume, definition, options) {
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = options.playbackRate ?? 1 + ((this.random() * 2 - 1) * (definition.pitchVariation || 0));
    gain.gain.value = volume; source.connect(gain).connect(this.context.destination);
    this.track(source, gain); source.start(); return true;
  }

  playFallback(id, volume) {
    const oscillator = this.context.createOscillator(), gain = this.context.createGain(), now = this.context.currentTime;
    oscillator.type = 'triangle'; oscillator.frequency.value = FALLBACK_TONES[id] || 120;
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, volume * .12), now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .14);
    oscillator.connect(gain).connect(this.context.destination);
    this.track(oscillator, gain); oscillator.start(); oscillator.stop(now + .16); return true;
  }

  track(source, gain) {
    this.activeSources.add(source);
    source.onended = () => { this.activeSources.delete(source); source.disconnect?.(); gain.disconnect?.(); };
  }

  playBgm() { this.unlock(); }
  stopBgm() {}
  setMuted(value) { this.settings.muted = Boolean(value); }
  setMasterVolume(value) { this.settings.masterVolume = clamp01(value); }
  setBgmVolume(value) { this.settings.bgmVolume = clamp01(value); }
  setSfxVolume(value) { this.settings.sfxVolume = clamp01(value); }
  dispose() {
    this.disposed = true;
    this.activeSources.forEach((source) => { try { source.stop?.(); source.disconnect?.(); } catch {} });
    this.activeSources.clear(); this.buffers.clear(); this.context?.close?.().catch?.(() => {}); this.context = null;
  }
}
