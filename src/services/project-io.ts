import { createArrangementFromTracks } from '@/lib/song-utils';
import type { AppSettings, EngineType, Song, Track } from '@/types/engine';

export const PROJECT_SCHEMA_VERSION = 4;

export interface SavedProjectFile {
  schemaVersion: number;
  exportedAt: string;
  song: Song;
  settings: AppSettings;
}

function inferEngineType(track: Track): EngineType {
  if ((track as Partial<Track>).engineType) {
    return (track as Partial<Track>).engineType as EngineType;
  }

  if (track.channel === 'dpcm') return 'dpcm';
  if (track.channel === 'modern') return 'saw';
  return 'nes';
}

function migrateSong(rawSong: Song): Song {
  const tracks = rawSong.tracks.map((track) => ({
    ...track,
    engineType: inferEngineType(track),
    patterns: track.patterns?.length ? track.patterns : [],
  }));

  const arrangement =
    rawSong.arrangement && rawSong.arrangement.lanes
      ? rawSong.arrangement
      : createArrangementFromTracks(tracks, rawSong.ppqn * 16);

  return {
    ...rawSong,
    version: PROJECT_SCHEMA_VERSION,
    tracks,
    arrangement,
    automationLanes: rawSong.automationLanes ?? [],
    midiProjectBindings: rawSong.midiProjectBindings ?? [],
    midiChannelMap: rawSong.midiChannelMap ?? {},
    constraints: rawSong.constraints ?? {
      enforcePolyphonyLimit: true,
      maxVoicesPerTrack: 1,
      clampMidiRange: true,
      enforceChannelLimits: true,
      enforceInstrumentCompatibility: true,
    },
  };
}

function migrateSettings(settings?: AppSettings): AppSettings | undefined {
  if (!settings) return undefined;
  const midiConfig = settings.midiConfig ?? {
    defaultQuantize: '1/16',
    autoMapPercussionToNoise: true,
    defaultTranspose: 0,
  };

  return {
    ...settings,
    uiConfig: {
      ...settings.uiConfig,
      showOnboardingChecklist: settings.uiConfig?.showOnboardingChecklist ?? true,
      monitorDockVisible: settings.uiConfig?.monitorDockVisible ?? true,
      validationPanelVisible: settings.uiConfig?.validationPanelVisible ?? true,
      reportFormatDefault: settings.uiConfig?.reportFormatDefault ?? 'markdown',
      onboardingChecklist: {
        completedSteps: settings.uiConfig?.onboardingChecklist?.completedSteps ?? [],
        dismissed: settings.uiConfig?.onboardingChecklist?.dismissed ?? false,
      },
    },
    midiConfig: {
      ...midiConfig,
      routingMode: midiConfig.routingMode ?? 'selected-track',
      transportRealtimeEnabled: midiConfig.transportRealtimeEnabled ?? true,
      learnTimeoutMs: midiConfig.learnTimeoutMs ?? 8000,
      writeAutomationOnRecord: midiConfig.writeAutomationOnRecord ?? true,
      profilePreference: midiConfig.profilePreference ?? 'project-first',
      selectedProfileId: midiConfig.selectedProfileId ?? null,
    },
  };
}

export function serializeProject(song: Song, settings: AppSettings): string {
  const payload: SavedProjectFile = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    song,
    settings,
  };

  return JSON.stringify(payload, null, 2);
}

export async function loadProjectFromFile(file: File): Promise<{ song: Song; settings?: AppSettings }> {
  const text = await file.text();
  let parsed: Partial<SavedProjectFile> & { song?: Song };
  try {
    parsed = JSON.parse(text) as Partial<SavedProjectFile> & { song?: Song };
  } catch {
    throw new Error('Invalid project file: malformed JSON.');
  }

  if (!parsed.song) {
    throw new Error('Invalid project file: missing song payload.');
  }

  const song = migrateSong(parsed.song);
  return {
    song,
    settings: migrateSettings(parsed.settings),
  };
}

export function downloadTextFile(text: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadBinaryFile(data: Uint8Array, filename: string, mime = 'application/octet-stream') {
  const bytes = Uint8Array.from(data);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
