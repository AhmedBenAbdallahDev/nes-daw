import { createNESPulseWaves, type PulseWaveSet, type DutyCycle } from './pulse-waves';
import type { APUMonitorSnapshot, EngineType, EnvelopeParams, TrackChannel } from '@/types/engine';

export type NotePlaybackParams = {
  dutyCycle?: DutyCycle;
  velocity: number;
  envelope?: EnvelopeParams;
  noiseMode?: 'long' | 'short';
};

interface ActiveVoice {
  sources: AudioScheduledSourceNode[];
  gain: GainNode;
  channel: TrackChannel;
}

class NESEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private channelGains: Record<TrackChannel, GainNode> | null = null;
  private channelAnalysers: Record<TrackChannel, AnalyserNode> | null = null;
  private pulseWaves: PulseWaveSet | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private dpcmBuffer: AudioBuffer | null = null;

  private activeVoices = new Map<number, ActiveVoice>();
  private nextVoiceId = 1;
  private isMuted = false;
  private masterVolume = 0.65;

  public init() {
    if (this.ctx) return;

    this.ctx = new AudioContext({ latencyHint: 'interactive' });

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 128;
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    this.channelGains = {
      pulse1: this.ctx.createGain(),
      pulse2: this.ctx.createGain(),
      triangle: this.ctx.createGain(),
      noise: this.ctx.createGain(),
      dpcm: this.ctx.createGain(),
      modern: this.ctx.createGain(),
    };

    this.channelAnalysers = {
      pulse1: this.ctx.createAnalyser(),
      pulse2: this.ctx.createAnalyser(),
      triangle: this.ctx.createAnalyser(),
      noise: this.ctx.createAnalyser(),
      dpcm: this.ctx.createAnalyser(),
      modern: this.ctx.createAnalyser(),
    };

    (Object.keys(this.channelGains) as TrackChannel[]).forEach((channel) => {
      const gain = this.channelGains![channel];
      const analyser = this.channelAnalysers![channel];
      analyser.fftSize = 64;
      gain.connect(analyser);
      analyser.connect(this.masterGain!);
    });

    this.pulseWaves = createNESPulseWaves(this.ctx);
    this.createNoiseBuffer();
    this.createDPCMBuffer();
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  // DPCM-like fallback sample: heavily stepped waveform for lo-fi one-bit style texture.
  private createDPCMBuffer() {
    if (!this.ctx) return;

    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.25);
    this.dpcmBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = this.dpcmBuffer.getChannelData(0);

    let phase = 1;
    for (let i = 0; i < length; i += 1) {
      if (i % 24 === 0) {
        phase = Math.random() > 0.5 ? 1 : -1;
      }
      const jitter = (Math.random() * 2 - 1) * 0.08;
      data[i] = phase * 0.7 + jitter;
    }
  }

  private midiToFreq(midiNote: number): number {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  private applyEnvelope(
    gainNode: GainNode,
    velocity: number,
    startTime: number,
    envelope?: EnvelopeParams
  ) {
    const attack = envelope?.attack ?? 0.004;
    const decay = envelope?.decay ?? 0.1;
    const sustain = envelope?.sustain ?? 0.6;

    const peakGain = velocity / 127;
    const sustainLevel = peakGain * sustain;

    gainNode.gain.cancelScheduledValues(startTime);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, startTime + Math.max(0.001, attack));
    gainNode.gain.linearRampToValueAtTime(sustainLevel, startTime + Math.max(0.001, attack) + decay);
  }

  private registerVoice(channel: TrackChannel, sources: AudioScheduledSourceNode[], gain: GainNode): number {
    const id = this.nextVoiceId++;
    this.activeVoices.set(id, { sources, gain, channel });

    let endedCount = 0;
    sources.forEach((source) => {
      source.onended = () => {
        endedCount += 1;
        if (endedCount >= sources.length) {
          this.activeVoices.delete(id);
        }
      };
    });

    return id;
  }

  public playPulseNote(
    channel: 'pulse1' | 'pulse2',
    midiNote: number,
    velocity: number,
    dutyCycle: DutyCycle = 0.5,
    envelope?: EnvelopeParams
  ): number {
    if (!this.ctx || !this.pulseWaves || !this.channelGains) return -1;

    const osc = this.ctx.createOscillator();
    const voiceGain = this.ctx.createGain();
    osc.setPeriodicWave(this.pulseWaves[dutyCycle]);
    osc.frequency.setValueAtTime(this.midiToFreq(midiNote), this.ctx.currentTime);

    this.applyEnvelope(voiceGain, velocity, this.ctx.currentTime, envelope);

    osc.connect(voiceGain);
    voiceGain.connect(this.channelGains[channel]);
    osc.start();

    return this.registerVoice(channel, [osc], voiceGain);
  }

  public playTriangleNote(midiNote: number, velocity: number, envelope?: EnvelopeParams): number {
    if (!this.ctx || !this.channelGains) return -1;

    const osc = this.ctx.createOscillator();
    const voiceGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(this.midiToFreq(midiNote), this.ctx.currentTime);

    this.applyEnvelope(voiceGain, Math.min(127, velocity * 0.65), this.ctx.currentTime, envelope);

    osc.connect(voiceGain);
    voiceGain.connect(this.channelGains.triangle);
    osc.start();

    return this.registerVoice('triangle', [osc], voiceGain);
  }

  public playNoise(
    mode: 'long' | 'short',
    frequency: number,
    velocity: number,
    envelope?: EnvelopeParams
  ): number {
    if (!this.ctx || !this.noiseBuffer || !this.channelGains) return -1;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    filter.Q.value = mode === 'short' ? 6 : 1.2;

    const voiceGain = this.ctx.createGain();
    this.applyEnvelope(voiceGain, velocity, this.ctx.currentTime, envelope);

    source.connect(filter);
    filter.connect(voiceGain);
    voiceGain.connect(this.channelGains.noise);

    source.start();
    return this.registerVoice('noise', [source], voiceGain);
  }

  public playDPCMNote(midiNote: number, velocity: number, envelope?: EnvelopeParams): number {
    if (!this.ctx || !this.dpcmBuffer || !this.channelGains) return -1;

    const source = this.ctx.createBufferSource();
    source.buffer = this.dpcmBuffer;
    source.loop = true;

    const frequency = this.midiToFreq(midiNote);
    const normalized = Math.max(0.5, Math.min(2.5, frequency / 440));
    source.playbackRate.setValueAtTime(normalized, this.ctx.currentTime);

    const bitcrusherGain = this.ctx.createGain();
    bitcrusherGain.gain.value = 0.85;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.max(1000, frequency * 3), this.ctx.currentTime);

    const voiceGain = this.ctx.createGain();
    this.applyEnvelope(voiceGain, Math.min(127, velocity * 0.9), this.ctx.currentTime, envelope);

    source.connect(lp);
    lp.connect(bitcrusherGain);
    bitcrusherGain.connect(voiceGain);
    voiceGain.connect(this.channelGains.dpcm);

    source.start();
    return this.registerVoice('dpcm', [source], voiceGain);
  }

  public playModernNote(
    engineType: EngineType,
    midiNote: number,
    velocity: number,
    envelope?: EnvelopeParams
  ): number {
    if (!this.ctx || !this.channelGains) return -1;

    const frequency = this.midiToFreq(midiNote);
    const voiceGain = this.ctx.createGain();
    this.applyEnvelope(voiceGain, velocity, this.ctx.currentTime, envelope);
    voiceGain.connect(this.channelGains.modern);

    if (engineType === 'saw' || engineType === 'sine') {
      const osc = this.ctx.createOscillator();
      osc.type = engineType === 'saw' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      osc.connect(voiceGain);
      osc.start();
      return this.registerVoice('modern', [osc], voiceGain);
    }

    if (engineType === 'fm-lite') {
      const carrier = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();

      carrier.type = 'sine';
      mod.type = 'sine';

      carrier.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      mod.frequency.setValueAtTime(frequency * 2, this.ctx.currentTime);
      modGain.gain.setValueAtTime(frequency * 0.3, this.ctx.currentTime);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      carrier.connect(voiceGain);

      mod.start();
      carrier.start();
      return this.registerVoice('modern', [carrier, mod], voiceGain);
    }

    if (engineType === 'modern-noise') {
      if (!this.noiseBuffer) return -1;

      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(900, this.ctx.currentTime);
      source.connect(hp);
      hp.connect(voiceGain);
      source.start();

      return this.registerVoice('modern', [source], voiceGain);
    }

    return -1;
  }

  public playByTrack(
    channel: TrackChannel,
    engineType: EngineType,
    midiNote: number,
    velocity: number,
    params: NotePlaybackParams
  ): number {
    if (engineType === 'dpcm' || channel === 'dpcm') {
      return this.playDPCMNote(midiNote, velocity, params.envelope);
    }

    if (engineType === 'nes') {
      if (channel === 'pulse1' || channel === 'pulse2') {
        return this.playPulseNote(channel, midiNote, velocity, params.dutyCycle, params.envelope);
      }
      if (channel === 'triangle') {
        return this.playTriangleNote(midiNote, velocity, params.envelope);
      }
      if (channel === 'noise') {
        const freq = this.midiToFreq(midiNote);
        return this.playNoise(params.noiseMode ?? 'long', freq, velocity, params.envelope);
      }
      return -1;
    }

    return this.playModernNote(engineType, midiNote, velocity, params.envelope);
  }

  public stopNote(voiceId: number) {
    if (!this.ctx) return;
    const voice = this.activeVoices.get(voiceId);
    if (!voice) return;

    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.01);

    voice.sources.forEach((source) => {
      try {
        source.stop(now + 0.02);
      } catch {
        // no-op
      }
    });

    this.activeVoices.delete(voiceId);
  }

  public stopChannelVoices(channel: TrackChannel) {
    const voiceIds = Array.from(this.activeVoices.entries())
      .filter(([, voice]) => voice.channel === channel)
      .map(([id]) => id);

    voiceIds.forEach((id) => this.stopNote(id));
  }

  public stopAllNotes() {
    Array.from(this.activeVoices.keys()).forEach((id) => this.stopNote(id));
  }

  public setChannelPitchBend(channel: TrackChannel, normalized: number) {
    if (!this.ctx) return;
    const bend = Math.max(-1, Math.min(1, normalized));
    const cents = bend * 200; // +/- 2 semitones
    const ratio = Math.pow(2, (bend * 2) / 12);

    this.activeVoices.forEach((voice) => {
      if (voice.channel !== channel) return;
      voice.sources.forEach((source) => {
        if (source instanceof OscillatorNode) {
          source.detune.setTargetAtTime(cents, this.ctx!.currentTime, 0.01);
          return;
        }

        if (source instanceof AudioBufferSourceNode) {
          source.playbackRate.setTargetAtTime(ratio, this.ctx!.currentTime, 0.01);
        }
      });
    });
  }

  public setChannelGain(channel: TrackChannel, value: number) {
    if (!this.ctx || !this.channelGains) return;
    const gain = this.channelGains[channel];
    if (!gain) return;
    gain.gain.setTargetAtTime(Math.max(0, Math.min(1.25, value)), this.ctx.currentTime, 0.02);
  }

  public setVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && !this.isMuted && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.01);
    }
  }

  public mute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const target = muted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.01);
    }
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public getMonitorSnapshot(transportState: APUMonitorSnapshot['transportState']): APUMonitorSnapshot | null {
    if (!this.masterAnalyser || !this.channelAnalysers) return null;

    const waveformData = new Uint8Array(this.masterAnalyser.fftSize);
    this.masterAnalyser.getByteTimeDomainData(waveformData);
    const waveform = Array.from(waveformData.slice(0, 64), (value) => (value - 128) / 128);

    const channels = (Object.keys(this.channelAnalysers) as TrackChannel[]).map((channel) => {
      const analyser = this.channelAnalysers![channel];
      const buffer = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buffer);
      const level =
        buffer.reduce((sum, value) => {
          const normalized = (value - 128) / 128;
          return sum + normalized * normalized;
        }, 0) / Math.max(1, buffer.length);
      const activeVoices = Array.from(this.activeVoices.values()).filter((voice) => voice.channel === channel).length;

      return {
        channel,
        label:
          channel === 'pulse1'
            ? 'Pulse 1'
            : channel === 'pulse2'
              ? 'Pulse 2'
              : channel === 'triangle'
                ? 'Triangle'
                : channel === 'noise'
                  ? 'Noise'
                  : channel === 'dpcm'
                    ? 'DPCM'
                    : 'Modern',
        level: Math.max(0, Math.min(1, Math.sqrt(level) * 1.8)),
        activeVoices,
      };
    });

    const masterLevel = channels.reduce((sum, channel) => Math.max(sum, channel.level), 0);

    return {
      masterLevel,
      transportState,
      waveform,
      channels,
    };
  }

  public dispose() {
    this.stopAllNotes();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterAnalyser = null;
    this.channelAnalysers = null;
  }
}

export const nesEngine = new NESEngine();
