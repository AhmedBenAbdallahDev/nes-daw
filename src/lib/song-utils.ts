import type {
  AppMode,
  AppSettings,
  EngineType,
  NESChannel,
  Pattern,
  Quantize,
  Song,
  Track,
  TrackChannel,
} from '@/types/engine';

export const DEFAULT_PPQN = 96;
export const DEFAULT_BPM = 150;
export const DEFAULT_PATTERN_LENGTH = DEFAULT_PPQN * 4 * 4;

const STRICT_CHANNEL_ORDER: NESChannel[] = ['pulse1', 'pulse2', 'triangle', 'noise', 'dpcm'];

const DEFAULT_INSTRUMENT_BY_CHANNEL: Record<NESChannel, string> = {
  pulse1: 'mm-lead',
  pulse2: 'pulse2-50',
  triangle: 'mm-bass',
  noise: 'mm-kick',
  dpcm: 'dpcm-hit',
};

const DEFAULT_ENGINE_BY_CHANNEL: Record<NESChannel, EngineType> = {
  pulse1: 'nes',
  pulse2: 'nes',
  triangle: 'nes',
  noise: 'nes',
  dpcm: 'dpcm',
};

function channelTitle(channel: TrackChannel): string {
  if (channel === 'modern') return 'Modern';
  if (channel === 'dpcm') return 'DPCM';
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function ticksPerQuantize(ppqn: number, quantize: Quantize): number {
  switch (quantize) {
    case '1/4':
      return ppqn;
    case '1/8':
      return ppqn / 2;
    case '1/16':
      return ppqn / 4;
    case '1/32':
      return ppqn / 8;
    default:
      return ppqn / 4;
  }
}

export function quantizeTick(tick: number, ppqn: number, quantize: Quantize): number {
  const step = ticksPerQuantize(ppqn, quantize);
  return Math.max(0, Math.round(tick / step) * step);
}

export function createPattern(name: string, lengthTicks = DEFAULT_PATTERN_LENGTH): Pattern {
  return {
    id: generateId(),
    name,
    lengthTicks,
    notes: [],
  };
}

function strictTrackFromChannel(channel: NESChannel): Track {
  return {
    id: generateId(),
    name: channelTitle(channel),
    channel,
    engineType: DEFAULT_ENGINE_BY_CHANNEL[channel],
    instrumentId: DEFAULT_INSTRUMENT_BY_CHANNEL[channel],
    patterns: [createPattern('Pattern 1')],
    activePatternIndex: 0,
    volume: 1,
    muted: false,
    solo: false,
  };
}

export function createStrictTracks(enableDpcm = true): Track[] {
  const channels = enableDpcm ? STRICT_CHANNEL_ORDER : STRICT_CHANNEL_ORDER.filter((c) => c !== 'dpcm');
  return channels.map(strictTrackFromChannel);
}

export function createModernTrack(index: number): Track {
  return {
    id: generateId(),
    name: `Modern ${index}`,
    channel: 'modern',
    engineType: 'saw',
    instrumentId: 'modern-saw-lead',
    patterns: [createPattern('Pattern 1')],
    activePatternIndex: 0,
    volume: 1,
    muted: false,
    solo: false,
  };
}

export function createArrangementFromTracks(tracks: Track[], lengthTicks = DEFAULT_PATTERN_LENGTH) {
  return {
    lanes: tracks.map((track) => ({
      trackId: track.id,
      instances: [
        {
          id: generateId(),
          patternId: track.patterns[0]?.id ?? generateId(),
          startTick: 0,
          lengthTicks,
        },
      ],
    })),
    sectionMarkers: [
      {
        id: generateId(),
        label: 'Intro',
        startTick: 0,
        color: '#22c55e',
        role: 'intro' as const,
      },
    ],
    lengthTicks,
  } satisfies Song['arrangement'];
}

export function createDefaultSong(settings: AppSettings): Song {
  const strict = settings.mode === 'strict';
  const tracks = strict
    ? createStrictTracks(settings.strictConfig.enableDpcm)
    : [...createStrictTracks(settings.strictConfig.enableDpcm), createModernTrack(1)];

  return {
    id: generateId(),
    version: 4,
    name: 'New Song',
    bpm: DEFAULT_BPM,
    ppqn: DEFAULT_PPQN,
    tracks,
    arrangement: createArrangementFromTracks(tracks),
    automationLanes: [],
    midiProjectBindings: [],
    midiChannelMap: {},
    constraints: {
      enforcePolyphonyLimit: true,
      maxVoicesPerTrack: 1,
      clampMidiRange: true,
      enforceChannelLimits: true,
      enforceInstrumentCompatibility: true,
    },
  };
}

function mergeStrictTracks(existing: Track[], enableDpcm: boolean): Track[] {
  const required = enableDpcm ? STRICT_CHANNEL_ORDER : STRICT_CHANNEL_ORDER.filter((c) => c !== 'dpcm');

  const strictTracks = required.map((channel) => {
    const match = existing.find((track) => track.channel === channel);
    if (!match) return strictTrackFromChannel(channel);

    return {
      ...match,
      channel,
      engineType: DEFAULT_ENGINE_BY_CHANNEL[channel],
      instrumentId: match.instrumentId || DEFAULT_INSTRUMENT_BY_CHANNEL[channel],
      patterns: match.patterns.length > 0 ? match.patterns : [createPattern('Pattern 1')],
      activePatternIndex: Math.min(match.activePatternIndex, Math.max(0, match.patterns.length - 1)),
    };
  });

  return strictTracks;
}

function clampModernTracks(existing: Track[], settings: AppSettings): Track[] {
  const maxTracks = settings.modernConfig.maxTracks;
  const baseStrict = mergeStrictTracks(existing, settings.strictConfig.enableDpcm);
  const modernTracks = existing
    .filter((track) => track.channel === 'modern')
    .slice(0, Math.max(0, maxTracks - baseStrict.length));

  const normalizedModern = modernTracks.map((track, index) => ({
    ...track,
    name: track.name || `Modern ${index + 1}`,
    channel: 'modern' as const,
    patterns: track.patterns.length > 0 ? track.patterns : [createPattern('Pattern 1')],
    activePatternIndex: Math.min(track.activePatternIndex, Math.max(0, track.patterns.length - 1)),
  }));

  return [...baseStrict, ...normalizedModern];
}

export function normalizeSongForMode(song: Song, settings: AppSettings): Song {
  const tracks =
    settings.mode === 'strict'
      ? mergeStrictTracks(song.tracks, settings.strictConfig.enableDpcm)
      : clampModernTracks(song.tracks, settings);

  const lanes = tracks.map((track) => {
    const existingLane = song.arrangement.lanes.find((lane) => lane.trackId === track.id);
    if (existingLane) return existingLane;

    const pattern = track.patterns[track.activePatternIndex] ?? track.patterns[0];
    return {
      trackId: track.id,
      instances: pattern
        ? [
            {
              id: generateId(),
              patternId: pattern.id,
              startTick: 0,
              lengthTicks: pattern.lengthTicks,
            },
          ]
        : [],
    };
  });

  const derivedLength = Math.max(
    song.arrangement.lengthTicks,
    ...lanes.flatMap((lane) => lane.instances.map((inst) => inst.startTick + inst.lengthTicks)),
    DEFAULT_PATTERN_LENGTH
  );

  const trackSet = new Set(tracks.map((track) => track.id));
  const midiChannelMapEntries = Object.entries(song.midiChannelMap ?? {}).filter(([, trackId]) =>
    trackSet.has(trackId)
  );
  const midiChannelMap = Object.fromEntries(
    midiChannelMapEntries.map(([channel, trackId]) => [Number(channel), trackId])
  ) as Record<number, string>;

  return {
    ...song,
    tracks,
    arrangement: {
      ...song.arrangement,
      sectionMarkers: song.arrangement.sectionMarkers ?? [],
      lanes,
      lengthTicks: derivedLength,
    },
    automationLanes: song.automationLanes ?? [],
    midiProjectBindings: song.midiProjectBindings ?? [],
    midiChannelMap,
  };
}

export function clampMidiByMode(midiNote: number, mode: AppMode, shouldClamp: boolean): number {
  if (!shouldClamp) return midiNote;
  if (mode !== 'strict') return Math.max(0, Math.min(127, midiNote));
  // Practical strict range for NES composition ergonomics.
  return Math.max(24, Math.min(108, midiNote));
}
