const TONES = { click: 440, alert: 620, chase: 330, intent: 180, battle: 120, attack: 520, hurt: 150, defend: 260, escape: 740, victory: 880, failure: 90, harvest: 300, item: 660, eat: 210, madness: 140, extract: 500 };
export class AudioService {
  constructor(config) { this.settings = { ...config.audio }; this.context = null; }
  unlock() { if (!this.settings.enabled || this.settings.muted) return; this.context ||= new (window.AudioContext || window.webkitAudioContext)(); this.context.resume?.().catch(() => {}); }
  playSfx(id) {
    try {
      if (!this.settings.enabled || this.settings.muted) return;
      this.unlock(); if (!this.context) return;
      const oscillator = this.context.createOscillator(), gain = this.context.createGain();
      oscillator.frequency.value = TONES[id] || 400; oscillator.type = 'sine';
      gain.gain.setValueAtTime(.0001, this.context.currentTime); gain.gain.exponentialRampToValueAtTime(.08 * this.settings.masterVolume * this.settings.sfxVolume, this.context.currentTime + .01); gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + .16);
      oscillator.connect(gain).connect(this.context.destination); oscillator.start(); oscillator.stop(this.context.currentTime + .18);
    } catch { /* Audio must never block gameplay. */ }
  }
  playBgm() { this.unlock(); }
  stopBgm() {}
  setMuted(value) { this.settings.muted = value; }
  setMasterVolume(value) { this.settings.masterVolume = value; }
  setBgmVolume(value) { this.settings.bgmVolume = value; }
  setSfxVolume(value) { this.settings.sfxVolume = value; }
}
