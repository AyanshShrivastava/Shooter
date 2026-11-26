import { WeaponId } from '../shared/types';

class TacticalAudio {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const length = this.ctx.sampleRate * 0.5;
      const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  public playFire(weaponId: WeaponId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const pitchJitter = 0.94 + Math.random() * 0.12;

    // Noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    const nGain = ctx.createGain();

    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();

    if (weaponId === 'pulse-carbine') {
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600 * pitchJitter, now);
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.08);
      oGain.gain.setValueAtTime(0.14, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    } else if (weaponId === 'rail-rifle') {
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(900 * pitchJitter, now);
      nGain.gain.setValueAtTime(0.24, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(980 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.24);
      oGain.gain.setValueAtTime(0.26, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    } else if (weaponId === 'scatter-gun') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100 * pitchJitter, now);
      nGain.gain.setValueAtTime(0.32, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.type = 'square';
      osc.frequency.setValueAtTime(150 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.16);
      oGain.gain.setValueAtTime(0.22, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    } else {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650 * pitchJitter, now);
      nGain.gain.setValueAtTime(0.22, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(180 * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.18);
      oGain.gain.setValueAtTime(0.24, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    }

    noise.connect(filter).connect(nGain).connect(ctx.destination);
    osc.connect(oGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.25);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playHitmarker(kind: 'hit' | 'crit' | 'kill'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'crit' ? 'triangle' : 'sine';
    const startFreq = kind === 'kill' ? 1480 : kind === 'crit' ? 1680 : 1120;
    const endFreq = kind === 'kill' ? 1960 : kind === 'crit' ? 2280 : 880;
    const dur = kind === 'kill' ? 0.14 : kind === 'crit' ? 0.1 : 0.06;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    gain.gain.setValueAtTime(kind === 'hit' ? 0.14 : 0.21, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  public playFootstep(sprint: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(sprint ? 360 : 280, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(sprint ? 0.08 : 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.07);
  }

  public playJump(isPad = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isPad ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isPad ? 220 : 140, now);
    osc.frequency.exponentialRampToValueAtTime(isPad ? 760 : 320, now + (isPad ? 0.24 : 0.11));
    gain.gain.setValueAtTime(isPad ? 0.18 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isPad ? 0.25 : 0.12));
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playLand(impact: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.1);
    const vol = Math.min(0.22, 0.05 + impact * 0.012);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playDash(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.2);
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.5);
  }

  public playReload(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.setValueAtTime(640, now + 0.08);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playHurt(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.16);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }
}

export const tacticalAudio = new TacticalAudio();
