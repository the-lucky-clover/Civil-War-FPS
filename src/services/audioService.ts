import { BAND_TUNES } from '../game/bandMelodies';

class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private isMuted: boolean = false;
  private drumInterval: number | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  private masterVolVal: number = 0.9;
  private sfxVolVal: number = 0.85;
  private musicVolVal: number = 0.55;

  constructor() {
    // Lazy initialized on first user interaction
  }

  public init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.sfxGain = this.ctx.createGain();
          this.musicGain = this.ctx.createGain();

          this.masterGain.gain.setValueAtTime(this.masterVolVal, this.ctx.currentTime);
          this.sfxGain.gain.setValueAtTime(this.sfxVolVal, this.ctx.currentTime);
          this.musicGain.gain.setValueAtTime(this.musicVolVal, this.ctx.currentTime);

          this.sfxGain.connect(this.masterGain);
          this.musicGain.connect(this.masterGain);
          this.masterGain.connect(this.ctx.destination);
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }

  public setMasterVolume(vol: number) {
    this.masterVolVal = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterVolVal, this.ctx.currentTime);
    }
  }

  public setSfxVolume(vol: number) {
    this.sfxVolVal = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolVal, this.ctx.currentTime);
    }
  }

  public setMusicVolume(vol: number) {
    this.musicVolVal = Math.max(0, Math.min(1, vol));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(this.musicVolVal, this.ctx.currentTime);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolVal;
  }

  public getSfxVolume(): number {
    return this.sfxVolVal;
  }

  public getMusicVolume(): number {
    return this.musicVolVal;
  }

  public playMusketFire() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    // 1. Initial sharp crack (White noise burst)
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.35);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.2, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    whiteNoise.start(t);

    // 2. Heavy black-powder sub-bass boom
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.4);

    oscGain.gain.setValueAtTime(1.0, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  public playRevolverFire() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);

    oscGain.gain.setValueAtTime(0.9, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  public playCannonBlast(volume: number = 1) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Massive sub-bass impact
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 1.2);

    oscGain.gain.setValueAtTime(1.8 * volume, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

    // Rumble noise
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.4));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 1.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.4 * volume, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 1.4);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 1.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
  }

  public playBayonetSwing() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.18);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  public playHitMarker(isHeadshot: boolean = false) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isHeadshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isHeadshot ? 1650 : 920, t);
    osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 2400 : 1350, t + 0.05);

    gain.gain.setValueAtTime(isHeadshot ? 0.75 : 0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + (isHeadshot ? 0.14 : 0.08));

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + (isHeadshot ? 0.14 : 0.08));

    if (isHeadshot) {
      // Extra crisp metallic ping for critical headshot
      const ping = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      ping.type = 'triangle';
      ping.frequency.setValueAtTime(3200, t);
      ping.frequency.exponentialRampToValueAtTime(1900, t + 0.12);
      pingGain.gain.setValueAtTime(0.5, t);
      pingGain.gain.exponentialRampToValueAtTime(0.005, t + 0.12);
      ping.connect(pingGain);
      pingGain.connect(this.sfxGain);
      ping.start(t);
      ping.stop(t + 0.12);
    }
  }

  public playFootstep(surface: 'grass' | 'dirt' | 'stone' | 'wood', isSprinting: boolean = false) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const volMult = isSprinting ? 0.35 : 0.22;
    const pitchJitter = 0.9 + Math.random() * 0.2;

    if (surface === 'grass') {
      // Soft cushioned rustle with gentle muffled impact
      const bufSize = Math.floor(this.ctx.sampleRate * 0.07);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.02));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750 * pitchJitter, t);
      filter.Q.value = 1.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volMult * 0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(t);

      // Low soft thud
      const thud = this.ctx.createOscillator();
      const thudGain = this.ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(90 * pitchJitter, t);
      thud.frequency.exponentialRampToValueAtTime(45, t + 0.06);
      thudGain.gain.setValueAtTime(volMult * 0.7, t);
      thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
      thud.connect(thudGain);
      thudGain.connect(this.sfxGain);
      thud.start(t);
      thud.stop(t + 0.06);
    } else if (surface === 'dirt') {
      // Earthy gravelly thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 * pitchJitter, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

      gain.gain.setValueAtTime(volMult * 1.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

      // Light gravel crunch noise
      const bufSize = Math.floor(this.ctx.sampleRate * 0.06);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.015));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450 * pitchJitter, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(volMult * 0.6, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.08);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);
      noise.start(t);
    } else if (surface === 'stone') {
      // Crisp solid heel click on granite/stone wall
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950 * pitchJitter, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.05);

      gain.gain.setValueAtTime(volMult * 1.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

      // Sharp transient click
      const bufSize = Math.floor(this.ctx.sampleRate * 0.03);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.008));
      }
      const click = this.ctx.createBufferSource();
      click.buffer = buffer;
      const clickFilter = this.ctx.createBiquadFilter();
      clickFilter.type = 'highpass';
      clickFilter.frequency.setValueAtTime(1400, t);
      const clickGain = this.ctx.createGain();
      clickGain.gain.setValueAtTime(volMult * 0.9, t);
      clickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.03);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.06);

      click.connect(clickFilter);
      clickFilter.connect(clickGain);
      clickGain.connect(this.sfxGain);
      click.start(t);
    } else if (surface === 'wood') {
      // Hollow resonant wooden fence / plank knock
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320 * pitchJitter, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.09);

      gain.gain.setValueAtTime(volMult * 1.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

      // Overtones
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(640 * pitchJitter, t);
      osc2.frequency.exponentialRampToValueAtTime(180, t + 0.06);
      gain2.gain.setValueAtTime(volMult * 0.6, t);
      gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.09);

      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(t);
      osc2.stop(t + 0.06);
    }
  }

  public playReloadStage(stage: 'POWDER' | 'TEAR' | 'BALL' | 'RAMROD' | 'CAP' | 'PRIMER' | 'SUCCESS') {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (stage === 'POWDER') {
      // Hissing powder pour
      const bufferSize = this.ctx.sampleRate * 0.12;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      noise.connect(filter);
      filter.connect(this.sfxGain);
      noise.start(t);
      return;
    } else if (stage === 'TEAR') {
      // Paper cartridge torn open at the teeth — short papery rip
      const bufferSize = this.ctx.sampleRate * 0.09;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = 1 - i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * 0.5 * env * env;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 2800;
      noise.connect(filter);
      filter.connect(this.sfxGain);
      noise.start(t);
      return;
    } else if (stage === 'BALL') {
      // Minié ball thumbed into the muzzle — soft low thud
      osc.type = 'sine';
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.1);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
    } else if (stage === 'RAMROD') {
      // Metallic slide & tap
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.15);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    } else if (stage === 'CAP') {
      // Percussion cap pressed onto the nipple — tiny metallic tick
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2500, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
    } else if (stage === 'PRIMER') {
      // Hammer drawn to full cock — heavy lock click
      osc.type = 'square';
      osc.frequency.setValueAtTime(700, t);
      osc.frequency.setValueAtTime(420, t + 0.04);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    } else if (stage === 'SUCCESS') {
      // Arcade golden ready chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t); // E5
      osc.frequency.setValueAtTime(880, t + 0.07); // A5
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  public playBulletWhiz() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(400 + Math.random() * 100, t + 0.15);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playBugleCharge() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    // Authentic bugle notes: G3, C4, E4, G4, C5
    const notes = [
      { freq: 392.00, dur: 0.12 }, // G4
      { freq: 523.25, dur: 0.12 }, // C5
      { freq: 659.25, dur: 0.12 }, // E5
      { freq: 783.99, dur: 0.28 }, // G5 (Hold)
      { freq: 659.25, dur: 0.10 }, // E5
      { freq: 783.99, dur: 0.40 }, // G5 (Climax)
    ];

    let startTime = this.ctx.currentTime;
    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.freq, startTime);

      // Horn brass filter
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1800;

      gain.gain.setValueAtTime(0.4, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + n.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(startTime);
      osc.stop(startTime + n.dur);

      startTime += n.dur;
    });
  }

  public playHuzzahCheer(faction: 'NORTH' | 'SOUTH') {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Harmonized chorus rally sting
    const baseFreqs = faction === 'NORTH' ? [330, 440, 554] : [293, 370, 440];
    baseFreqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.linearRampToValueAtTime(freq * 1.15, t + 0.35);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + idx * 0.03);
      osc.stop(t + 0.65);
    });
  }

  public playCanteenDrink() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(660, t + 0.15);
    osc.frequency.linearRampToValueAtTime(880, t + 0.3);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  public startBattlefieldDrums() {
    this.init();
    if (!this.ctx || this.drumInterval) return;

    // Military snare cadence loop
    let step = 0;
    this.drumInterval = window.setInterval(() => {
      if (!this.ctx || !this.sfxGain) return;
      const t = this.ctx.currentTime;
      // Snare hit on steps
      const isAccent = step % 4 === 0;
      const bufferSize = this.ctx.sampleRate * (isAccent ? 0.08 : 0.04);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.02));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = isAccent ? 0.25 : 0.12;

      noise.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(t);

      step = (step + 1) % 16;
    }, 180);
  }

  public stopBattlefieldDrums() {
    if (this.drumInterval) {
      clearInterval(this.drumInterval);
      this.drumInterval = null;
    }
  }

  public playAbilityActivate() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.15);
    osc.frequency.linearRampToValueAtTime(1320, t + 0.35);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.45);
  }

  public playSlowMotionSound() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.5);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.55);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.55);
  }

  public playHealSound() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);

      gain.gain.setValueAtTime(0.3, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.005, t + i * 0.06 + 0.3);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.3);
    });
  }

  public playStreakFanfare(combo: number) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const base = combo >= 5 ? 880 : combo >= 3 ? 659.25 : 523.25;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.setValueAtTime(base * 1.25, t + 0.08);
    osc.frequency.setValueAtTime(base * 1.5, t + 0.16);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  public playObjectiveComplete() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    let start = this.ctx.currentTime;
    notes.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(start);
      osc.stop(start + 0.25);
      start += idx === 3 ? 0.2 : 0.1;
    });
  }

  public startRainAmbience() {
    this.init();
    if (!this.ctx || !this.sfxGain || this.rainSource) return;

    try {
      // 3-second seamless loop of gentle rain falling on leaves and wool
      const bufferSize = this.ctx.sampleRate * 3;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        // Pinkish softened noise for rain
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      }

      this.rainSource = this.ctx.createBufferSource();
      this.rainSource.buffer = buffer;
      this.rainSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, this.ctx.currentTime);

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      this.rainGain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 1.5);

      this.rainSource.connect(filter);
      filter.connect(this.rainGain);
      this.rainGain.connect(this.sfxGain);

      this.rainSource.start();
    } catch (e) {
      console.warn('Error starting rain ambience:', e);
    }
  }

  public stopRainAmbience() {
    if (this.rainSource && this.rainGain && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        this.rainGain.gain.linearRampToValueAtTime(0.001, t + 0.8);
        setTimeout(() => {
          if (this.rainSource) {
            try {
              this.rainSource.stop();
              this.rainSource.disconnect();
            } catch (e) {}
            this.rainSource = null;
          }
          this.rainGain = null;
        }, 850);
      } catch (e) {
        this.rainSource = null;
        this.rainGain = null;
      }
    }
  }

  public playThunderRumble() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Distant rolling thunder rumble
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(65, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 2.4);

    oscGain.gain.setValueAtTime(0.01, t);
    oscGain.gain.linearRampToValueAtTime(0.4, t + 0.3);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 2.5);

    // Rumble texture
    const bufSize = this.ctx.sampleRate * 2.2;
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.8));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + 2.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.01, t);
    noiseGain.gain.linearRampToValueAtTime(0.35, t + 0.25);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 2.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(t);
  }

  public playHeartbeat(fast: boolean = false) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Sub-bass thump 1 (lub)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(fast ? 75 : 55, t);
    osc1.frequency.exponentialRampToValueAtTime(30, t + 0.14);
    gain1.gain.setValueAtTime(0.7, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.16);

    // Sub-bass thump 2 (dub)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    const delay = fast ? 0.16 : 0.22;
    osc2.frequency.setValueAtTime(fast ? 65 : 48, t + delay);
    osc2.frequency.exponentialRampToValueAtTime(25, t + delay + 0.14);
    gain2.gain.setValueAtTime(0.55, t + delay);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.16);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(t + delay);
    osc2.stop(t + delay + 0.16);
  }

  public playLastStandActivation() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Low dramatic drone & riser
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.6);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.6);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.7, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.9);

    // Immediate heartbeat
    this.playHeartbeat(true);
  }

  public playLastStandRevive() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Heroic brass chord (C4, E4, G4, C5)
    const freqs = [261.63, 329.63, 392.0, 523.25];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.04);
      gain.gain.setValueAtTime(0.3, t + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + idx * 0.04);
      osc.stop(t + 1.2);
    });
  }

  public playDoorToggle() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Wood friction creak
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(160, t + 0.18);
    osc.frequency.linearRampToValueAtTime(190, t + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, t);
    filter.Q.value = 4.0;

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.4);

    // Heavy iron latch thud
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(120, t + 0.25);
    osc2.frequency.exponentialRampToValueAtTime(40, t + 0.42);
    gain2.gain.setValueAtTime(0.5, t + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(t + 0.25);
    osc2.stop(t + 0.42);
  }

  public playBayonetAffix() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // First slide scrape (metal on steel)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(1600, t);
    osc1.frequency.exponentialRampToValueAtTime(900, t + 0.18);

    gain1.gain.setValueAtTime(0.25, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc1.connect(gain1);
    gain1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.2);

    // Socket lock ring click & snap
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, t + 0.22);
    osc2.frequency.exponentialRampToValueAtTime(1200, t + 0.32);
    gain2.gain.setValueAtTime(0.5, t + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc2.connect(gain2);
    gain2.connect(this.sfxGain);
    osc2.start(t + 0.22);
    osc2.stop(t + 0.35);
  }

  public playCannonAim() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    // Heavy iron elevation ratchet clicks
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(320 + i * 40, t + i * 0.06);
      gain.gain.setValueAtTime(0.2, t + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.04);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.04);
    }
  }

  /** Wet sponge rammed home — steam hisses off the hot bronze bore. */
  public playSpongeHiss() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 1.6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // sharp attack, slow steam decay
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.55));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + 1.4);
    filter.Q.setValueAtTime(0.8, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
  }

  /** Rammer driving the charge home — two heavy wooden thuds. */
  public playRamThud() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    for (let stroke = 0; stroke < 2; stroke++) {
      const st = t + stroke * 0.55;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, st);
      osc.frequency.exponentialRampToValueAtTime(38, st + 0.22);
      gain.gain.setValueAtTime(0.9, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(st);
      osc.stop(st + 0.3);
    }
  }

  /** Priming wire prick + friction primer seating — small metallic clicks. */
  public playPrimerClick() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [0, 0.28].forEach((dt, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 0 ? 1900 : 2600, t + dt);
      gain.gain.setValueAtTime(0.16, t + dt);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.05);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + dt);
      osc.stop(t + dt + 0.05);
    });
  }

  /** Lanyard pull — sharp snap just before the blast. */
  public playLanyardSnap() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  /** Premature discharge in the bore — a flat, ugly crump instead of a roar. */
  public playCookoff() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.12));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
  }

  public playBugleCall(type: 'charge' | 'rally' | 'assembly' | 'retreat' = 'charge') {
    this.init();
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // Authentic bugle notes (harmonic overtone series: G3, C4, E4, G4, C5)
    let notes: { f: number; d: number }[] = [];
    if (type === 'charge') {
      notes = [
        { f: 261.63, d: 0.12 },
        { f: 329.63, d: 0.12 },
        { f: 392.0, d: 0.14 },
        { f: 523.25, d: 0.45 },
      ];
    } else if (type === 'rally') {
      notes = [
        { f: 392.0, d: 0.15 },
        { f: 329.63, d: 0.15 },
        { f: 392.0, d: 0.2 },
        { f: 523.25, d: 0.5 },
      ];
    } else {
      notes = [
        { f: 261.63, d: 0.16 },
        { f: 329.63, d: 0.16 },
        { f: 261.63, d: 0.35 },
      ];
    }

    let curT = t;
    notes.forEach((n) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, curT);

      // Brass formant filter
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(n.f * 1.5, curT);
      filter.Q.value = 3.0;

      gain.gain.setValueAtTime(0.01, curT);
      gain.gain.linearRampToValueAtTime(0.35, curT + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, curT + n.d);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain!);
      osc.start(curT);
      osc.stop(curT + n.d);

      curT += n.d + 0.03;
    });
  }

  public playFlagCapture() {
    this.init();
    if (!this.ctx || !this.sfxGain) return;
    this.playBugleCall('rally');
  }

  // ------------------------------------------------------------------
  // Regimental Band — period brass-band engine.
  // Cornet lead (+ octave-doubled tenor horn), tuba oom-pah on the
  // tune's chord changes, snare + bass drum. Melodies live in
  // ../game/bandMelodies.ts, verified against period sources.
  // ------------------------------------------------------------------
  private bandBuses: GainNode[] = [];
  private bandTimers: number[] = [];
  private bandPlaying = false;
  private noiseBuf: AudioBuffer | null = null;

  public get isBandPlaying(): boolean {
    return this.bandPlaying;
  }

  private noteToFreq(name: string): number {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 440;
    const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const semi = base[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const midi = (parseInt(m[3], 10) + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private chordRootMidi(chord: string): number {
    const base: Record<string, number> = { C: 36, D: 38, E: 40, F: 41, G: 43, A: 45, B: 47 };
    const m = /^([A-G])([#b]?)/.exec(chord);
    if (!m) return 36;
    return base[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** Cornet: sawtooth through a lowpass with delayed vibrato. */
  private scheduleCornet(freq: number, t: number, dur: number, pan: number, vol: number, bright: number, bus: GainNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 5.2;
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(freq * 0.007, t + Math.min(0.3, dur * 0.5));
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = bright;
    filt.Q.value = 0.7;
    const g = ctx.createGain();
    const atk = Math.min(0.035, dur * 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + Math.max(atk, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(filt);
    filt.connect(g);
    g.connect(p);
    p.connect(bus);
    osc.start(t);
    lfo.start(t);
    const end = t + dur + 0.08;
    osc.stop(end);
    lfo.stop(end);
  }

  /** Tuba: soft triangle, lowpassed. */
  private scheduleTuba(midi: number, t: number, dur: number, pan: number, vol: number, bus: GainNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.midiToFreq(midi), t);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 420;
    const g = ctx.createGain();
    const atk = Math.min(0.03, dur * 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + Math.max(atk, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(filt);
    filt.connect(g);
    g.connect(p);
    p.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.08);
  }

  private getNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  private scheduleSnare(t: number, pan: number, vol: number, bus: GainNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(bp);
    bp.connect(g);
    g.connect(p);
    p.connect(bus);
    src.start(t);
    src.stop(t + 0.2);
  }

  private scheduleBassDrum(t: number, pan: number, vol: number, bus: GainNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(43, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(g);
    g.connect(p);
    p.connect(bus);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  /** Solo bugle voice (Taps) with a touch of across-the-valley echo. */
  private scheduleBugle(freq: number, t: number, dur: number, pan: number, vol: number, bus: GainNode, echo: DelayNode | null): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq, t);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1600;
    filt.Q.value = 1.2;
    const g = ctx.createGain();
    const atk = Math.min(0.06, dur * 0.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + Math.max(atk, dur - 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    osc.connect(filt);
    osc2.connect(filt);
    filt.connect(g);
    g.connect(p);
    p.connect(bus);
    if (echo) {
      const eg = ctx.createGain();
      eg.gain.value = 0.35;
      p.connect(eg);
      eg.connect(echo);
    }
    osc.start(t);
    osc2.start(t);
    osc.stop(t + dur + 0.4);
    osc2.stop(t + dur + 0.4);
  }

  /**
   * Render a tune through the band. Returns the end time on the audio clock.
   * `at` is an absolute audio-clock time for sequencing (duels).
   */
  private renderBandTune(
    tuneId: string,
    opts: { pan?: number; volume?: number; maxBars?: number; at?: number; soloBugle?: boolean }
  ): number {
    const ctx = this.ctx!;
    const tune = BAND_TUNES[tuneId];
    if (!tune) return ctx.currentTime;
    const pan = opts.pan ?? 0;
    const vol = opts.volume ?? 1;
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(this.musicGain!);
    this.bandBuses.push(bus);
    const spb = 60 / tune.tempo;
    const t0 = opts.at != null ? opts.at : ctx.currentTime + 0.08;
    const maxBeats = opts.maxBars != null ? opts.maxBars * tune.meter : Infinity;

    let echo: DelayNode | null = null;
    if (opts.soloBugle) {
      echo = ctx.createDelay(1.0);
      echo.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      echo.connect(fb);
      fb.connect(echo);
      echo.connect(wet);
      wet.connect(bus);
    }

    let t = t0;
    let beatCursor = 0;
    for (const note of tune.melody) {
      if (beatCursor >= maxBeats) break;
      const b = Math.min(note.b, maxBeats - beatCursor);
      if (b <= 0) break;
      const dur = b * spb;
      const f = this.noteToFreq(note.n);
      if (opts.soloBugle) {
        this.scheduleBugle(f, t, dur * 0.96, pan, 0.34 * vol, bus, echo);
      } else {
        this.scheduleCornet(f, t, dur * 0.92, pan, 0.3 * vol, 2500, bus);
        this.scheduleCornet(f / 2, t, dur * 0.92, pan, 0.13 * vol, 1500, bus);
      }
      t += dur;
      beatCursor += b;
    }
    const endTime = t + 0.5;

    if (!opts.soloBugle && tune.chords.length > 0) {
      const totalBars = Math.max(1, Math.ceil(Math.min(beatCursor, maxBeats) / tune.meter));
      const gentle = tune.meter === 3;
      for (let bar = 0; bar < totalBars; bar++) {
        const barT = t0 + bar * tune.meter * spb;
        const chord = tune.chords[bar % tune.chords.length];
        const root = this.chordRootMidi(chord);
        if (tune.meter === 2) {
          this.scheduleTuba(root, barT, spb * 0.85, pan, 0.2 * vol, bus);
          this.scheduleTuba(root + 7, barT + spb, spb * 0.85, pan, 0.16 * vol, bus);
          this.scheduleBassDrum(barT, pan, 0.5 * vol, bus);
          this.scheduleSnare(barT + spb, pan, 0.32 * vol, bus);
        } else if (tune.meter === 4) {
          this.scheduleTuba(root, barT, spb * 0.85, pan, 0.2 * vol, bus);
          this.scheduleTuba(root + 7, barT + spb, spb * 0.85, pan, 0.15 * vol, bus);
          this.scheduleTuba(root, barT + 2 * spb, spb * 0.85, pan, 0.18 * vol, bus);
          this.scheduleTuba(root + 7, barT + 3 * spb, spb * 0.85, pan, 0.15 * vol, bus);
          this.scheduleBassDrum(barT, pan, 0.5 * vol, bus);
          this.scheduleSnare(barT + spb, pan, 0.34 * vol, bus);
          this.scheduleBassDrum(barT + 2 * spb, pan, 0.42 * vol, bus);
          this.scheduleSnare(barT + 3 * spb, pan, 0.34 * vol, bus);
        } else {
          this.scheduleTuba(root, barT, spb * 2.0, pan, 0.18 * vol, bus);
          this.scheduleTuba(root + 7, barT + spb, spb * 0.85, pan, 0.13 * vol, bus);
          this.scheduleBassDrum(barT, pan, gentle ? 0.3 * vol : 0.45 * vol, bus);
          if (!gentle) this.scheduleSnare(barT + spb, pan, 0.25 * vol, bus);
          else this.scheduleSnare(barT + 2 * spb, pan, 0.12 * vol, bus);
        }
      }
    }
    return endTime;
  }

  /** Play a full band tune, stopping anything currently playing. */
  public playBandTune(tuneId: string, opts?: { pan?: number; volume?: number; maxBars?: number }): void {
    this.init();
    if (!this.ctx || !this.musicGain) return;
    this.stopBandMusic();
    this.bandPlaying = true;
    const end = this.renderBandTune(tuneId, { ...(opts ?? {}) });
    const ms = Math.max(0, (end - this.ctx.currentTime) * 1000);
    this.bandTimers.push(window.setTimeout(() => {
      this.bandPlaying = false;
    }, ms + 400));
  }

  /** Taps — solo bugle for the fallen. */
  public playTaps(): void {
    this.init();
    if (!this.ctx || !this.musicGain) return;
    this.stopBandMusic();
    this.bandPlaying = true;
    const end = this.renderBandTune('taps', { pan: 0, volume: 1, soloBugle: true });
    const ms = Math.max(0, (end - this.ctx.currentTime) * 1000);
    this.bandTimers.push(window.setTimeout(() => {
      this.bandPlaying = false;
    }, ms + 400));
  }

  /**
   * The battle of the bands — Union and Confederate bands alternate tunes
   * across the lines, each trying to drown the other out, until both join
   * on "Home, Sweet Home." (Stones River, Dec 30 1862; Fredericksburg;
   * the Rappahannock, spring 1863.)
   * Panning follows the Gettysburg field: Union holds Cemetery Ridge
   * (east/right), Confederates hold Seminary Ridge (west/left).
   */
  public startBandDuel(): void {
    this.init();
    if (!this.ctx || !this.musicGain || this.bandPlaying) return;
    this.stopBandMusic();
    this.bandPlaying = true;
    const USA_PAN = 0.55;
    const CSA_PAN = -0.55;
    let at = this.ctx.currentTime + 0.4;
    const phraseBars = 4;
    for (let round = 0; round < 3; round++) {
      const vol = 0.75 + round * 0.18;
      at = this.renderBandTune('battleCry', { pan: USA_PAN, volume: vol, maxBars: phraseBars, at });
      at = this.renderBandTune('dixie', { pan: CSA_PAN, volume: vol, maxBars: phraseBars, at });
      at += 0.5;
    }
    this.renderBandTune('homeSweetHome', { pan: USA_PAN, volume: 0.85, at });
    const end = this.renderBandTune('homeSweetHome', { pan: CSA_PAN, volume: 0.85, at });
    const ms = Math.max(0, (end - this.ctx.currentTime) * 1000);
    this.bandTimers.push(window.setTimeout(() => {
      this.bandPlaying = false;
    }, ms + 600));
  }

  public stopBandMusic(): void {
    this.bandPlaying = false;
    for (const t of this.bandTimers) clearTimeout(t);
    this.bandTimers = [];
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const bus of this.bandBuses) {
      try {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setTargetAtTime(0.0001, now, 0.12);
        const b = bus;
        window.setTimeout(() => {
          try {
            b.disconnect();
          } catch {
            /* already gone */
          }
        }, 800);
      } catch {
        /* already gone */
      }
    }
    this.bandBuses = [];
  }
}

export const audio = new AudioService();

