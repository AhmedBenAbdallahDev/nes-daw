import { DEFAULT_SHORTCUT_BINDINGS } from '@/lib/shortcuts';
import { createDefaultSong, generateId } from '@/lib/song-utils';
import { importMidiToSong, parseMidiArrayBuffer } from '@/services/midi-file-service';
import type { AppSettings, MIDIImportTrackMapping, Note, Song, Track } from '@/types/engine';

export type TestProjectTemplateId = 'mega-man-2-main-theme' | 'mega-man-3-main-theme' | 'mega-man-4-title';

export interface BundledTestProjectTemplate {
  id: TestProjectTemplateId;
  name: string;
  path: string;
  defaultBpm: number;
  description: string;
}

export interface LoadedTestProject {
  song: Song;
  settings: AppSettings;
  attribution: string;
}

export class BundledMidiAssetError extends Error {
  templateId: TestProjectTemplateId;
  path: string;
  reason: 'missing' | 'network' | 'invalid';

  constructor(
    templateId: TestProjectTemplateId,
    path: string,
    reason: 'missing' | 'network' | 'invalid',
    message: string
  ) {
    super(message);
    this.templateId = templateId;
    this.path = path;
    this.reason = reason;
  }
}

export const BUNDLED_TEST_PROJECT_TEMPLATES: BundledTestProjectTemplate[] = [
  {
    id: 'mega-man-2-main-theme',
    name: 'Mega Man 2 - Main Theme',
    path: '/midi/megaman/mega-man-2.mid',
    defaultBpm: 148,
    description: 'Loads the bundled Mega Man 2 test MIDI with NES channel mapping.',
  },
  {
    id: 'mega-man-3-main-theme',
    name: 'Mega Man 3 - Main Theme',
    path: '/midi/megaman/mega-man-3.mid',
    defaultBpm: 152,
    description: 'Loads the bundled Mega Man 3 test MIDI with NES channel mapping.',
  },
  {
    id: 'mega-man-4-title',
    name: 'Mega Man 4 - Title/Home Screen',
    path: '/midi/megaman/mega-man-4-title.mid',
    defaultBpm: 142,
    description: 'Loads the bundled Mega Man 4 title screen MIDI with NES channel mapping.',
  },
];

function pushPatternNotes(track: Track, notes: Omit<Note, 'id'>[]): Track {
  const nextPatterns = track.patterns.map((pattern, index) => {
    if (index !== track.activePatternIndex) return pattern;
    return {
      ...pattern,
      notes: notes.map((note) => ({ ...note, id: generateId() })),
    };
  });

  return {
    ...track,
    patterns: nextPatterns,
  };
}

function buildStrictSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    mode: 'strict',
    strictConfig: {
      ...settings.strictConfig,
      enableDpcm: true,
      enableAuthenticLimits: true,
    },
    midiConfig: {
      ...settings.midiConfig,
      routingMode: 'channel-map',
      transportRealtimeEnabled: true,
      writeAutomationOnRecord: true,
      profilePreference: settings.midiConfig.profilePreference ?? 'project-first',
      selectedProfileId: settings.midiConfig.selectedProfileId ?? null,
    },
    shortcutConfig: {
      bindings: settings.shortcutConfig.bindings ?? DEFAULT_SHORTCUT_BINDINGS,
      conflicts: settings.shortcutConfig.conflicts ?? [],
    },
  };
}

function preferredTracks(song: Song): {
  pulse1?: Track;
  pulse2?: Track;
  triangle?: Track;
  noise?: Track;
  dpcm?: Track;
} {
  return {
    pulse1: song.tracks.find((track) => track.channel === 'pulse1'),
    pulse2: song.tracks.find((track) => track.channel === 'pulse2'),
    triangle: song.tracks.find((track) => track.channel === 'triangle'),
    noise: song.tracks.find((track) => track.channel === 'noise'),
    dpcm: song.tracks.find((track) => track.channel === 'dpcm'),
  };
}

function buildTrackMappings(song: Song, midi: ReturnType<typeof parseMidiArrayBuffer>): MIDIImportTrackMapping[] {
  const order = preferredTracks(song);
  const melodicTargets = [order.pulse1, order.pulse2, order.triangle, order.dpcm].filter(
    Boolean
  ) as Track[];
  const drumTarget = order.noise ?? order.dpcm ?? song.tracks[0];
  let melodicIndex = 0;

  return midi.tracks
    .map((source, sourceTrackIndex) => {
      if (source.notes.length === 0) return null;

      const isPercussion = source.channel === 9 || /drum|perc|kit|noise/i.test(source.name || '');
      if (isPercussion && drumTarget) {
        return {
          sourceTrackIndex,
          targetTrackId: drumTarget.id,
        };
      }

      const target = melodicTargets[melodicIndex % Math.max(1, melodicTargets.length)] ?? song.tracks[0];
      melodicIndex += 1;
      return {
        sourceTrackIndex,
        targetTrackId: target.id,
      };
    })
    .filter((item): item is MIDIImportTrackMapping => Boolean(item));
}

function applyImportedNotesToSong(
  song: Song,
  notesByTrack: Record<string, Omit<Note, 'id'>[]>,
  suggestedLengthTicks: number
): Song {
  const tracks = song.tracks.map((track) => {
    const imported = notesByTrack[track.id];
    if (!imported || imported.length === 0) return track;
    return pushPatternNotes(track, imported);
  });

  return {
    ...song,
    tracks,
    arrangement: {
      ...song.arrangement,
      lengthTicks: Math.max(song.arrangement.lengthTicks, suggestedLengthTicks),
    },
  };
}

function applyChannelMapFromMidi(
  song: Song,
  midi: ReturnType<typeof parseMidiArrayBuffer>,
  mappings: MIDIImportTrackMapping[]
): Song {
  const midiChannelMap = { ...song.midiChannelMap };
  mappings.forEach((mapping) => {
    const source = midi.tracks[mapping.sourceTrackIndex];
    if (!source || typeof source.channel !== 'number') return;
    const channel = source.channel + 1;
    if (channel < 1 || channel > 16) return;
    midiChannelMap[channel] = mapping.targetTrackId;
  });

  return {
    ...song,
    midiChannelMap,
  };
}

async function fetchBundledMidi(template: BundledTestProjectTemplate) {
  let response: Response;
  try {
    response = await fetch(template.path, { cache: 'no-store' });
  } catch {
    throw new BundledMidiAssetError(
      template.id,
      template.path,
      'network',
      `Failed to fetch bundled MIDI asset at ${template.path}.`
    );
  }

  if (!response.ok) {
    throw new BundledMidiAssetError(
      template.id,
      template.path,
      'missing',
      `Bundled MIDI asset not found at ${template.path}.`
    );
  }

  const bytes = await response.arrayBuffer();
  try {
    return parseMidiArrayBuffer(bytes);
  } catch {
    throw new BundledMidiAssetError(
      template.id,
      template.path,
      'invalid',
      `Bundled MIDI asset is invalid or unreadable: ${template.path}.`
    );
  }
}

function buildFallbackStarter(settings: AppSettings, template: BundledTestProjectTemplate): LoadedTestProject {
  const strictSettings = buildStrictSettings(settings);
  const song = createDefaultSong(strictSettings);
  song.version = Math.max(song.version, 4);
  song.name = `${template.name} (Fallback Starter)`;
  song.bpm = template.defaultBpm;

  const pulse1 = song.tracks.find((track) => track.channel === 'pulse1');
  const pulse2 = song.tracks.find((track) => track.channel === 'pulse2');
  const triangle = song.tracks.find((track) => track.channel === 'triangle');
  const noise = song.tracks.find((track) => track.channel === 'noise');
  const ppqn = song.ppqn;

  if (pulse1) {
    Object.assign(
      pulse1,
      pushPatternNotes(pulse1, [
        { midiNote: 72, startTick: 0, durationTicks: ppqn / 2, velocity: 114 },
        { midiNote: 76, startTick: ppqn / 2, durationTicks: ppqn / 2, velocity: 114 },
        { midiNote: 79, startTick: ppqn, durationTicks: ppqn / 2, velocity: 114 },
        { midiNote: 76, startTick: ppqn * 1.5, durationTicks: ppqn / 2, velocity: 114 },
      ])
    );
  }

  if (pulse2) {
    Object.assign(
      pulse2,
      pushPatternNotes(pulse2, [
        { midiNote: 60, startTick: 0, durationTicks: ppqn / 2, velocity: 88 },
        { midiNote: 64, startTick: ppqn / 2, durationTicks: ppqn / 2, velocity: 88 },
        { midiNote: 67, startTick: ppqn, durationTicks: ppqn / 2, velocity: 88 },
        { midiNote: 64, startTick: ppqn * 1.5, durationTicks: ppqn / 2, velocity: 88 },
      ])
    );
  }

  if (triangle) {
    Object.assign(
      triangle,
      pushPatternNotes(triangle, [
        { midiNote: 36, startTick: 0, durationTicks: ppqn, velocity: 108 },
        { midiNote: 38, startTick: ppqn, durationTicks: ppqn, velocity: 108 },
      ])
    );
  }

  if (noise) {
    Object.assign(
      noise,
      pushPatternNotes(noise, [
        { midiNote: 40, startTick: 0, durationTicks: ppqn / 4, velocity: 122 },
        { midiNote: 46, startTick: ppqn / 2, durationTicks: ppqn / 4, velocity: 96 },
        { midiNote: 40, startTick: ppqn, durationTicks: ppqn / 4, velocity: 122 },
        { midiNote: 46, startTick: ppqn * 1.5, durationTicks: ppqn / 4, velocity: 96 },
      ])
    );
  }

  return {
    song,
    settings: strictSettings,
    attribution:
      'Bundled MIDI file not found. Loaded fallback demo starter. Add authorized MIDI files to public/midi/megaman/.',
  };
}

function defaultBindings(): Song['midiProjectBindings'] {
  return [
    {
      id: generateId(),
      label: 'Master Volume (CC7)',
      target: 'global.masterVolume',
      trackId: null,
      source: {
        messageType: 'cc',
        channel: 'any',
        controllerOrNote: 7,
        deviceId: null,
      },
      min: 0,
      max: 1,
      inverted: false,
      takeover: 'jump',
    },
    {
      id: generateId(),
      label: 'Tempo (CC74)',
      target: 'global.tempo',
      trackId: null,
      source: {
        messageType: 'cc',
        channel: 'any',
        controllerOrNote: 74,
        deviceId: null,
      },
      min: 0,
      max: 1,
      inverted: false,
      takeover: 'jump',
    },
  ];
}

export function getBundledTestProjectTemplates(): BundledTestProjectTemplate[] {
  return BUNDLED_TEST_PROJECT_TEMPLATES;
}

export async function loadBundledTestProject(
  templateId: TestProjectTemplateId,
  settings: AppSettings,
  options?: { allowFallback?: boolean }
): Promise<LoadedTestProject> {
  const template = BUNDLED_TEST_PROJECT_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    throw new Error(`Unknown test template: ${templateId}`);
  }

  try {
    const strictSettings = buildStrictSettings(settings);
    const midi = await fetchBundledMidi(template);
    const songBase = createDefaultSong(strictSettings);
    const mappings = buildTrackMappings(songBase, midi);
    const imported = importMidiToSong(
      songBase,
      midi,
      {
        transpose: 0,
        quantize: strictSettings.midiConfig.defaultQuantize,
        clampToNesRange: true,
        trackMappings: mappings,
        velocityScale: 1,
      },
      strictSettings.mode
    );

    let song = applyImportedNotesToSong(songBase, imported.byTrack, imported.suggestedLengthTicks);
    song = applyChannelMapFromMidi(song, midi, mappings);
    song = {
      ...song,
      version: Math.max(song.version, 4),
      name: template.name,
      bpm: template.defaultBpm,
      midiProjectBindings: defaultBindings(),
    };

    return {
      song,
      settings: strictSettings,
      attribution: `Loaded bundled authorized MIDI from ${template.path}.`,
    };
  } catch (error) {
    if (options?.allowFallback) {
      return buildFallbackStarter(settings, template);
    }
    if (error instanceof BundledMidiAssetError) {
      throw error;
    }
    throw new BundledMidiAssetError(
      template.id,
      template.path,
      'invalid',
      `Failed to load bundled MIDI for ${template.name}.`
    );
  }
}
