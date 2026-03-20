import type { EngineType, Instrument, NESChannel, Track, TrackChannel } from '@/types/engine';

export const INSTRUMENTS: Record<string, Instrument> = {
  'mm-lead': {
    id: 'mm-lead',
    name: 'MM Lead (Chirp)',
    channel: 'pulse1',
    engineType: 'nes',
    dutyCycle: 0.25,
    envelope: { attack: 0, decay: 0.3, sustain: 0.6, release: 0.01 },
    dutyCycleSequence: [0.125, 0.25],
    dutyCycleSwitchFrames: 2,
  },
  'mm-echo': {
    id: 'mm-echo',
    name: 'MM Echo',
    channel: 'pulse2',
    engineType: 'nes',
    dutyCycle: 0.25,
    envelope: { attack: 0, decay: 0.5, sustain: 0.3, release: 0.01 },
  },
  'pulse2-50': {
    id: 'pulse2-50',
    name: 'Pulse 2 Square 50%',
    channel: 'pulse2',
    engineType: 'nes',
    dutyCycle: 0.5,
    envelope: { attack: 0, decay: 0.8, sustain: 0.7, release: 0.05 },
  },
  'pulse-50': {
    id: 'pulse-50',
    name: 'Pulse 1 Square 50%',
    channel: 'pulse1',
    engineType: 'nes',
    dutyCycle: 0.5,
    envelope: { attack: 0, decay: 0.8, sustain: 0.7, release: 0.05 },
  },
  'mm-arp': {
    id: 'mm-arp',
    name: 'MM Arpeggio',
    channel: 'pulse1',
    engineType: 'nes',
    dutyCycle: 0.5,
    envelope: { attack: 0, decay: 1.0, sustain: 0.8, release: 0.02 },
    arpeggioPattern: [0, 4, 7],
    arpeggioSpeed: 3,
  },

  'mm-bass': {
    id: 'mm-bass',
    name: 'MM Bass',
    channel: 'triangle',
    engineType: 'nes',
    envelope: { attack: 0, decay: 0.2, sustain: 0, release: 0 },
  },
  'triangle-sustain': {
    id: 'triangle-sustain',
    name: 'Triangle Sustain',
    channel: 'triangle',
    engineType: 'nes',
    envelope: { attack: 0, decay: 0, sustain: 1, release: 0.05 },
  },

  'mm-kick': {
    id: 'mm-kick',
    name: 'MM Kick',
    channel: 'noise',
    engineType: 'nes',
    noiseMode: 'long',
    envelope: { attack: 0, decay: 0.08, sustain: 0, release: 0 },
  },
  'mm-snare': {
    id: 'mm-snare',
    name: 'MM Snare',
    channel: 'noise',
    engineType: 'nes',
    noiseMode: 'long',
    envelope: { attack: 0, decay: 0.15, sustain: 0, release: 0 },
  },
  'mm-hihat': {
    id: 'mm-hihat',
    name: 'MM Hi-Hat',
    channel: 'noise',
    engineType: 'nes',
    noiseMode: 'short',
    envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0 },
  },

  'dpcm-hit': {
    id: 'dpcm-hit',
    name: 'DPCM Hit',
    channel: 'dpcm',
    engineType: 'dpcm',
    envelope: { attack: 0, decay: 0.05, sustain: 0.3, release: 0.04 },
  },
  'dpcm-kick': {
    id: 'dpcm-kick',
    name: 'DPCM Kick',
    channel: 'dpcm',
    engineType: 'dpcm',
    envelope: { attack: 0, decay: 0.09, sustain: 0.2, release: 0.03 },
  },
  'dpcm-snare': {
    id: 'dpcm-snare',
    name: 'DPCM Snare',
    channel: 'dpcm',
    engineType: 'dpcm',
    envelope: { attack: 0, decay: 0.12, sustain: 0.2, release: 0.04 },
  },

  'modern-saw-lead': {
    id: 'modern-saw-lead',
    name: 'Modern Saw Lead',
    channel: 'modern',
    engineType: 'saw',
    envelope: { attack: 0.01, decay: 0.08, sustain: 0.7, release: 0.1 },
  },
  'modern-sine-bell': {
    id: 'modern-sine-bell',
    name: 'Modern Sine Bell',
    channel: 'modern',
    engineType: 'sine',
    envelope: { attack: 0.002, decay: 0.4, sustain: 0.2, release: 0.25 },
  },
  'modern-fm-pluck': {
    id: 'modern-fm-pluck',
    name: 'Modern FM Pluck',
    channel: 'modern',
    engineType: 'fm-lite',
    envelope: { attack: 0.002, decay: 0.14, sustain: 0.4, release: 0.14 },
  },
  'modern-noise-kit': {
    id: 'modern-noise-kit',
    name: 'Modern Noise Kit',
    channel: 'modern',
    engineType: 'modern-noise',
    envelope: { attack: 0.001, decay: 0.12, sustain: 0.1, release: 0.08 },
  },
};

const NES_COMPATIBLE_CHANNELS: NESChannel[] = ['pulse1', 'pulse2', 'triangle', 'noise'];

export function getInstrumentsByChannel(channel: TrackChannel): Instrument[] {
  if (channel === 'modern') {
    return Object.values(INSTRUMENTS).filter((instrument) => instrument.channel === 'modern');
  }

  return Object.values(INSTRUMENTS).filter((instrument) => instrument.channel === channel);
}

export function getInstrumentsByEngine(engineType: EngineType): Instrument[] {
  return Object.values(INSTRUMENTS).filter((instrument) => instrument.engineType === engineType);
}

export function getInstrumentsForTrack(track: Pick<Track, 'channel' | 'engineType'>): Instrument[] {
  if (track.channel === 'modern') {
    return Object.values(INSTRUMENTS).filter(
      (instrument) => instrument.channel === 'modern' && instrument.engineType === track.engineType
    );
  }

  if (track.engineType === 'dpcm') {
    return Object.values(INSTRUMENTS).filter((instrument) => instrument.channel === 'dpcm');
  }

  if (track.engineType === 'nes') {
    return Object.values(INSTRUMENTS).filter(
      (instrument) => instrument.engineType === 'nes' && instrument.channel === track.channel
    );
  }

  return Object.values(INSTRUMENTS).filter(
    (instrument) => instrument.channel === 'modern' && instrument.engineType === track.engineType
  );
}

export function getDefaultInstrumentForTrack(channel: TrackChannel, engineType: EngineType): string {
  if (channel === 'modern') {
    const map: Record<EngineType, string> = {
      nes: 'modern-saw-lead',
      dpcm: 'modern-noise-kit',
      saw: 'modern-saw-lead',
      sine: 'modern-sine-bell',
      'fm-lite': 'modern-fm-pluck',
      'modern-noise': 'modern-noise-kit',
    };
    return map[engineType] ?? 'modern-saw-lead';
  }

  if (channel === 'dpcm') return 'dpcm-hit';

  const map: Record<NESChannel, string> = {
    pulse1: 'mm-lead',
    pulse2: 'pulse2-50',
    triangle: 'mm-bass',
    noise: 'mm-kick',
    dpcm: 'dpcm-hit',
  };

  return map[channel];
}

export function isInstrumentCompatible(
  track: Pick<Track, 'channel' | 'engineType'>,
  instrumentId: string
): boolean {
  const instrument = INSTRUMENTS[instrumentId];
  if (!instrument) return false;

  if (track.channel === 'modern') {
    return instrument.channel === 'modern' && instrument.engineType === track.engineType;
  }

  if (track.engineType === 'dpcm') return instrument.channel === 'dpcm';

  if (track.engineType === 'nes') {
    return (
      instrument.engineType === 'nes' &&
      instrument.channel === track.channel &&
      NES_COMPATIBLE_CHANNELS.includes(track.channel as NESChannel)
    );
  }

  return instrument.channel === 'modern' && instrument.engineType === track.engineType;
}
