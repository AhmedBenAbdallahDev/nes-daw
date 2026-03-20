import { describe, expect, test } from 'bun:test';
import { DEFAULT_SHORTCUT_BINDINGS } from '@/lib/shortcuts';
import { createDefaultSong } from '@/lib/song-utils';
import type { AppSettings } from '@/types/engine';
import { loadProjectFromFile, serializeProject } from './project-io';

const settings: AppSettings = {
  mode: 'strict',
  strictConfig: {
    enableAuthenticLimits: true,
    maxChannels: 5,
    enableDpcm: true,
    maxPolyphonyPerChannel: 1,
    enforceChannelUniqueness: true,
  },
  modernConfig: {
    maxTracks: 16,
    enabledEngines: ['saw', 'sine', 'fm-lite', 'modern-noise'],
    allowUnlimitedChannels: true,
    allowPolyphony: true,
  },
  shortcutConfig: { bindings: DEFAULT_SHORTCUT_BINDINGS, conflicts: [] },
  uiConfig: {
    theme: 'retro-modern',
    motionEnabled: true,
    density: 'comfortable',
    showOnboardingChecklist: true,
    monitorDockVisible: true,
    validationPanelVisible: true,
    reportFormatDefault: 'markdown',
    onboardingChecklist: {
      completedSteps: [],
      dismissed: false,
    },
  },
  audioConfig: { masterVolume: 0.65, latencyHint: 'interactive' },
  midiConfig: {
    defaultQuantize: '1/16',
    autoMapPercussionToNoise: true,
    defaultTranspose: 0,
    routingMode: 'selected-track',
    transportRealtimeEnabled: true,
    learnTimeoutMs: 8000,
    writeAutomationOnRecord: true,
    profilePreference: 'project-first',
    selectedProfileId: null,
  },
  accessibilityConfig: { reducedMotion: false, highContrastFocus: true },
};

describe('project-io', () => {
  test('serializes and loads project', async () => {
    const song = createDefaultSong(settings);
    const json = serializeProject(song, settings);
    expect(json.includes('schemaVersion')).toBeTrue();

    const file = new File([json], 'project.nes-daw.json', { type: 'application/json' });
    const loaded = await loadProjectFromFile(file);

    expect(loaded.song.name).toBe(song.name);
    expect(loaded.song.version).toBeGreaterThanOrEqual(4);
    expect(loaded.settings?.mode).toBe('strict');
    expect(Array.isArray(loaded.song.automationLanes)).toBeTrue();
    expect(Array.isArray(loaded.song.midiProjectBindings)).toBeTrue();
    expect(typeof loaded.song.midiChannelMap).toBe('object');
  });

  test('migrates legacy project payload with missing fields', async () => {
    const song = createDefaultSong(settings);
    const legacy = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      song: {
        ...song,
        version: 1,
        arrangement: undefined,
        constraints: undefined,
        automationLanes: undefined,
        midiProjectBindings: undefined,
        midiChannelMap: undefined,
      },
      settings: {
        ...settings,
        midiConfig: {
          defaultQuantize: '1/16',
          autoMapPercussionToNoise: true,
          defaultTranspose: 0,
        },
      },
    };

    const file = new File([JSON.stringify(legacy)], 'legacy.nes-daw.json', { type: 'application/json' });
    const loaded = await loadProjectFromFile(file);
    expect(loaded.song.version).toBeGreaterThanOrEqual(4);
    expect(loaded.song.arrangement.lanes.length).toBeGreaterThan(0);
    expect(Array.isArray(loaded.song.automationLanes)).toBeTrue();
    expect(Array.isArray(loaded.song.midiProjectBindings)).toBeTrue();
    expect(typeof loaded.song.midiChannelMap).toBe('object');
    expect(loaded.settings?.midiConfig.routingMode).toBe('selected-track');
    expect(loaded.settings?.midiConfig.learnTimeoutMs).toBeGreaterThanOrEqual(1500);
  });
});
