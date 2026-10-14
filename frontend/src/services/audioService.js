// =============================================================================
// Scholarwise Web Audio Service
// Enterprise-grade, browser-resilient synthesizer for ambient sounds & chimes
// Uses 100% Web Audio API — zero external mp3 downloads, zero latency, 100% offline
// =============================================================================

class ScholarwiseAudioService {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.ambientGain = null;
    this.ambientNodes = [];
    this.currentAmbient = null;
    this.ambientVolume = 0.4;
    this.masterVolume = 0.8;
    this.isMuted = false;
    this.chimeType = "tibetan"; // "tibetan" | "crystal" | "ding"
    this.unlocked = false;
    this.listeners = new Set();
    this.clockInterval = null;

    // Auto-unlock on first user gesture anywhere on the window
    this.setupAutoUnlock();
  }

  setupAutoUnlock() {
    if (typeof window === "undefined") return;
    const unlockEvents = ["pointerdown", "keydown", "touchstart"];
    const handleGesture = () => {
      this.initContext();
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().then(() => {
          this.unlocked = true;
          this.notify();
        });
      } else {
        this.unlocked = true;
        this.notify();
      }
      unlockEvents.forEach((evt) => window.removeEventListener(evt, handleGesture));
    };
    unlockEvents.forEach((evt) => window.addEventListener(evt, handleGesture, { passive: true, once: true }));
  }

  initContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      this.ctx = new AudioContextClass();

      // Master output node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Dedicated ambient sub-bus
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);
      this.ambientGain.connect(this.masterGain);
    }
    return this.ctx;
  }

  async resumeContext() {
    this.initContext();
    if (!this.ctx) return false;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn("AudioContext resume failed:", err);
      }
    }
    this.unlocked = this.ctx.state === "running";
    this.notify();
    return this.unlocked;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch {
        // ignore
      }
    });
  }

  getState() {
    return {
      unlocked: this.unlocked,
      currentAmbient: this.currentAmbient,
      ambientVolume: this.ambientVolume,
      masterVolume: this.masterVolume,
      isMuted: this.isMuted,
      chimeType: this.chimeType,
    };
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    this.notify();
  }

  setAmbientVolume(val) {
    this.ambientVolume = Math.max(0, Math.min(1, val));
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(this.ambientVolume, this.ctx.currentTime);
    }
    this.notify();
  }

  setChimeType(type) {
    this.chimeType = type;
    this.notify();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
    this.notify();
    return this.isMuted;
  }

  // Generate seamless loopable pink/brown noise buffer with crossfaded boundaries
  createLoopableNoiseBuffer(duration = 6, type = "pink") {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let brown = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;

      if (type === "brown") {
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = brown * 3.5;
      } else if (type === "pink") {
        // Paul Kellet's refined 7-pole filter for true 1/f Pink Noise
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = pink * 0.12;
      } else {
        data[i] = white * 0.1;
      }
    }

    // Smoothly cross-fade first and last 2000 samples to prevent ANY loop pops
    const fadeLen = Math.min(2000, Math.floor(length / 10));
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      data[i] = data[i] * t + data[length - fadeLen + i] * (1 - t);
    }

    return buffer;
  }

  // --- AMBIENT SOUND GENERATORS ---
  async startAmbient(type = "rain") {
    await this.resumeContext();
    if (!this.ctx) return;
    this.stopAmbient();

    if (this.currentAmbient === type) {
      // Toggle off if already playing
      this.currentAmbient = null;
      this.notify();
      return;
    }

    this.currentAmbient = type;

    try {
      if (type === "rain") {
        this.buildRainSoundscape();
      } else if (type === "waves") {
        this.buildOceanWavesSoundscape();
      } else if (type === "cafe") {
        this.buildBrownNoiseSoundscape();
      } else if (type === "fire") {
        this.buildCampfireSoundscape();
      } else if (type === "clock") {
        this.buildClockTickSoundscape();
      }
    } catch (err) {
      console.warn("Error starting ambient sound:", err);
    }

    this.notify();
  }

  stopAmbient() {
    this.ambientNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch {
        // ignore
      }
    });
    this.ambientNodes = [];
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    this.currentAmbient = null;
    this.notify();
  }

  // 1. Rain Soundscape: Continuous pink rainfall + gentle droplet resonance
  buildRainSoundscape() {
    const buffer = this.createLoopableNoiseBuffer(8, "pink");
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Body of the rain
    const lowFilter = this.ctx.createBiquadFilter();
    lowFilter.type = "lowpass";
    lowFilter.frequency.value = 1100;

    // High drizzle sizzle
    const highFilter = this.ctx.createBiquadFilter();
    highFilter.type = "highpass";
    highFilter.frequency.value = 350;

    noise.connect(lowFilter);
    lowFilter.connect(highFilter);
    highFilter.connect(this.ambientGain);

    noise.start();
    this.ambientNodes.push(noise, lowFilter, highFilter);
  }

  // 2. Ocean Waves Soundscape: Brown noise modulated by an LFO to mimic surging tides
  buildOceanWavesSoundscape() {
    const buffer = this.createLoopableNoiseBuffer(10, "brown");
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Filter that sweeps with the surge
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 550;
    filter.Q.value = 2.0;

    // Wave swell gain node
    const waveGain = this.ctx.createGain();
    waveGain.gain.value = 0.6;

    // LFO Oscillator to automate wave ebb and flow (~12 seconds per wave cycle)
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.085; // ~11.7 seconds per surge

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.35; // modulation depth

    // Modulate wave gain
    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);

    // Also modulate filter frequency for realistic wave crest sound
    const filterMod = this.ctx.createGain();
    filterMod.gain.value = 350;
    lfo.connect(filterMod);
    filterMod.connect(filter.frequency);

    noise.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(this.ambientGain);

    noise.start();
    lfo.start();
    this.ambientNodes.push(noise, filter, waveGain, lfo, lfoGain, filterMod);
  }

  // 3. Brown Noise Soundscape: Deep warm hum (optimal for ADHD & deep concentration)
  buildBrownNoiseSoundscape() {
    const buffer = this.createLoopableNoiseBuffer(8, "brown");
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 450;
    filter.Q.value = 0.8;

    noise.connect(filter);
    filter.connect(this.ambientGain);

    noise.start();
    this.ambientNodes.push(noise, filter);
  }

  // 4. Campfire Soundscape: Warm gentle rumble + occasional crackle pops
  buildCampfireSoundscape() {
    const buffer = this.createLoopableNoiseBuffer(8, "brown");
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 650;

    noise.connect(filter);
    filter.connect(this.ambientGain);
    noise.start();
    this.ambientNodes.push(noise, filter);

    // Random crackle pops
    const playCrackle = () => {
      if (this.currentAmbient !== "fire" || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const crackleGain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1200 + Math.random() * 2000, this.ctx.currentTime);
        crackleGain.gain.setValueAtTime(0.08 + Math.random() * 0.08, this.ctx.currentTime);
        crackleGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.035);

        osc.connect(crackleGain);
        crackleGain.connect(this.ambientGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
      } catch {
        // ignore
      }

      // Schedule next crackle between 200ms and 1400ms
      const nextTime = 200 + Math.random() * 1200;
      this.clockInterval = setTimeout(playCrackle, nextTime);
    };

    playCrackle();
  }

  // 5. Clock Tick Soundscape: Rhythmic subtle wood tick every 1000ms
  buildClockTickSoundscape() {
    let tickTock = false;
    const playTick = () => {
      if (this.currentAmbient !== "clock" || !this.ctx) return;
      this.playTickSound(tickTock ? 720 : 640);
      tickTock = !tickTock;
    };
    playTick();
    this.clockInterval = setInterval(playTick, 1000);
  }

  playTickSound(freq = 680) {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.025);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {
      // ignore
    }
  }

  // --- CHIMES & TIMER BELLS ---
  async playChime(overrideType) {
    await this.resumeContext();
    if (!this.ctx || this.isMuted) return;

    const type = overrideType || this.chimeType;

    if (type === "tibetan") {
      this.playTibetanBowl();
    } else if (type === "crystal") {
      this.playCrystalBell();
    } else {
      this.playSoftDing();
    }
  }

  // Tibetan Singing Bowl: 432 Hz fundamental + warm natural inharmonic partials
  playTibetanBowl() {
    const now = this.ctx.currentTime;
    // Harmonic partial ratios typical of handmade bronze singing bowls
    const partials = [
      { ratio: 1.0, gain: 0.35, decay: 3.5 },
      { ratio: 2.76, gain: 0.22, decay: 2.8 },
      { ratio: 4.82, gain: 0.12, decay: 2.1 },
      { ratio: 7.15, gain: 0.06, decay: 1.4 },
    ];

    const baseFreq = 432; // Standard healing/focus concert pitch

    partials.forEach(({ ratio, gain: partGain, decay }) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq * ratio, now);

      // Subtle vibrato/beating
      const vibrato = this.ctx.createOscillator();
      const vGain = this.ctx.createGain();
      vibrato.frequency.value = 3.2; // 3.2 Hz beating
      vGain.gain.value = 1.8;
      vibrato.connect(osc.frequency);

      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(partGain, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(g);
      g.connect(this.masterGain);

      vibrato.start(now);
      osc.start(now);

      vibrato.stop(now + decay);
      osc.stop(now + decay);
    });
  }

  // Crystal Bell: Pure D5 & A5 dual chime
  playCrystalBell() {
    const now = this.ctx.currentTime;
    const notes = [587.33, 880.0]; // D5, A5

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.28, start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 2.4);

      osc.connect(g);
      g.connect(this.masterGain);

      osc.start(start);
      osc.stop(start + 2.5);
    });
  }

  // Soft Ding: Quick, gentle acoustic notification
  playSoftDing() {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, now); // E5

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.25, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(g);
    g.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 1.25);
  }

  // UI Tactile Click
  playClick() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.03);

      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      osc.connect(g);
      g.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch {
      // ignore
    }
  }
}

// Global Singleton Instance
export const audioService = new ScholarwiseAudioService();
