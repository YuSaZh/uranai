"use client";

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastHoverTickMs = 0;
  private lastFlipMs = 0;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      if (!this.ctx) {
        const win = window as WebkitWindow;
        const AudioCtx = window.AudioContext ?? win.webkitAudioContext;
        if (!AudioCtx) {
          return null;
        }
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        void this.ctx.resume().catch(() => undefined);
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    // 1.2s soft pink-tinted white noise buffer reused across tactile bursts
    const length = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      const pink = (b0 + b1 + b2 + white * 0.1848) * 0.14;
      data[i] = Math.max(-1, Math.min(1, pink * 0.65 + white * 0.35));
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private scheduleNoiseBurst(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    freqStart: number,
    freqEnd: number,
    q: number,
    peakGain: number,
    filterType: BiquadFilterType = "bandpass"
  ): void {
    const source = ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer(ctx);
    const maxOffset = Math.max(0.01, source.buffer.duration - duration - 0.05);
    const offset = Math.random() * maxOffset;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, startTime);
    filter.frequency.setValueAtTime(freqStart, startTime);
    if (freqEnd !== freqStart) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(40, freqEnd),
        startTime + duration
      );
    }

    const gain = ctx.createGain();
    const attack = Math.min(0.008, duration * 0.25);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(startTime, offset, duration + 0.02);
    source.stop(startTime + duration + 0.03);
  }

  private scheduleTone(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    freqStart: number,
    freqEnd: number,
    peakGain: number,
    type: OscillatorType = "sine"
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, startTime);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        startTime + duration
      );
    }

    const gain = ctx.createGain();
    const attack = Math.min(0.022, duration * 0.18);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  /**
   * Realistic multi-burst filtered noise paper riffling sound for deck shuffling.
   */
  public playShuffle(enabled = true): void {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + 0.01;
      const bursts = 15;
      let cursor = now;

      for (let i = 0; i < bursts; i++) {
        const progress = i / (bursts - 1);
        // Slightly accelerating middle, decelerating settle
        const step = 0.022 + Math.sin(progress * Math.PI) * -0.006 + Math.random() * 0.008;
        const baseFreq = 1450 + progress * 950 + (Math.random() - 0.5) * 320;
        const gain = 0.055 + Math.sin(progress * Math.PI) * 0.05;
        this.scheduleNoiseBurst(
          ctx,
          cursor,
          0.028 + Math.random() * 0.012,
          baseFreq,
          baseFreq * 1.25,
          2.1,
          gain
        );
        cursor += step;
      }

      // Soft linen square-up tap as the cards settle back into one stack
      this.scheduleTone(ctx, cursor + 0.03, 0.085, 138, 62, 0.075, "triangle");
      this.scheduleNoiseBurst(ctx, cursor + 0.025, 0.055, 760, 420, 1.4, 0.045);
    } catch {
      // Fail silently on audio restrictions
    }
  }

  /**
   * Warm low-mid velvet thud + crisp card stack slide for cutting the deck.
   */
  public playCut(enabled = true): void {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + 0.005;
      // Crisp linen card slide separating halves
      this.scheduleNoiseBurst(ctx, now, 0.14, 980, 2350, 1.8, 0.085);
      // Warm velvet table thud for first stack placement
      this.scheduleTone(ctx, now + 0.06, 0.11, 132, 54, 0.11, "triangle");
      this.scheduleNoiseBurst(ctx, now + 0.06, 0.05, 520, 240, 1.1, 0.05, "lowpass");
      // Second stack reuniting cleanly
      this.scheduleNoiseBurst(ctx, now + 0.16, 0.1, 1650, 1100, 2.0, 0.06);
      this.scheduleTone(ctx, now + 0.21, 0.11, 118, 48, 0.095, "sine");
    } catch {
      // Fail silently
    }
  }

  /**
   * Ultra-subtle tactile papery tick (rate-limited ~50ms) when gliding over fanned cards.
   */
  public playHoverTick(enabled = true): void {
    if (!enabled) return;
    const perfNow = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (perfNow - this.lastHoverTickMs < 50) {
      return;
    }
    this.lastHoverTickMs = perfNow;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + 0.002;
      const pitchJitter = 2200 + Math.random() * 550;
      this.scheduleNoiseBurst(ctx, now, 0.017, pitchJitter, pitchJitter * 1.18, 3.0, 0.042);
      this.scheduleTone(ctx, now, 0.016, 920 + Math.random() * 140, 560, 0.016, "triangle");
    } catch {
      // Fail silently
    }
  }

  /**
   * Smooth ascending card slide whoosh + soft velvet placement tap.
   */
  public playCardDraw(enabled = true): void {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + 0.005;
      // Ascending linen whoosh
      this.scheduleNoiseBurst(ctx, now, 0.21, 640, 2850, 1.9, 0.085);
      // Soft velvet tap landing in spread slot
      this.scheduleTone(ctx, now + 0.165, 0.095, 185, 78, 0.08, "triangle");
      // Delicate golden glint partial
      this.scheduleTone(ctx, now + 0.14, 0.28, 1046.5, 1046.5, 0.018, "sine");
    } catch {
      // Fail silently
    }
  }

  /**
   * Crisp paper snap + airy harmonic golden chord shimmer on 3D card reveal.
   */
  public playCardFlip(enabled = true): void {
    if (!enabled) return;
    const perfNow = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (perfNow - this.lastFlipMs < 110) {
      return;
    }
    this.lastFlipMs = perfNow;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + 0.005;
      // Tactile heavy cardstock snap
      this.scheduleNoiseBurst(ctx, now, 0.032, 1850, 3100, 2.2, 0.1);
      this.scheduleTone(ctx, now, 0.065, 240, 105, 0.07, "triangle");
      // Airy turn swoosh
      this.scheduleNoiseBurst(ctx, now + 0.02, 0.16, 900, 2400, 1.6, 0.045);

      // Luminous golden Lydian shimmer chord (D5, A5, C#6, E6)
      const partials = [
        { freq: 587.33, delay: 0.045, gain: 0.036, dur: 0.78 },
        { freq: 880.0, delay: 0.08, gain: 0.028, dur: 0.85 },
        { freq: 1108.73, delay: 0.115, gain: 0.022, dur: 0.92 },
        { freq: 1318.51, delay: 0.15, gain: 0.016, dur: 0.98 },
      ];
      for (const p of partials) {
        this.scheduleTone(ctx, now + p.delay, p.dur, p.freq, p.freq * 1.002, p.gain, "sine");
      }
    } catch {
      // Fail silently
    }
  }

  /**
   * Gentle celestial resonance chord when a spread ritual completes.
   */
  public playChime(enabled = true): void {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + 0.01;
      // Celestial Cmaj9 resonance arpeggio with gentle shimmer overtones
      const notes = [
        { freq: 523.25, delay: 0.0, gain: 0.045, dur: 1.75 },
        { freq: 783.99, delay: 0.075, gain: 0.036, dur: 1.7 },
        { freq: 987.77, delay: 0.15, gain: 0.03, dur: 1.65 },
        { freq: 1174.66, delay: 0.225, gain: 0.024, dur: 1.6 },
        { freq: 1318.51, delay: 0.3, gain: 0.02, dur: 1.65 },
      ];

      for (const n of notes) {
        this.scheduleTone(ctx, now + n.delay, n.dur, n.freq, n.freq, n.gain, "sine");
        // Subtle detuned shimmer harmonic for crystalline singing-bowl warmth
        this.scheduleTone(
          ctx,
          now + n.delay + 0.01,
          n.dur * 0.72,
          n.freq * 2.003,
          n.freq * 1.999,
          n.gain * 0.22,
          "triangle"
        );
      }
    } catch {
      // Fail silently
    }
  }
}

export const soundEngine = new SoundEngine();
