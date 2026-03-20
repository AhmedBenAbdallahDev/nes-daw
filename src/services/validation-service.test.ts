import { describe, expect, test } from 'bun:test';
import { createDefaultSong } from '@/lib/song-utils';
import { DEFAULT_SHORTCUT_BINDINGS } from '@/lib/shortcuts';
import type { AppSettings } from '@/types/engine';
import { buildValidationSummary } from './validation-service';

const baseSettings: AppSettings = {
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

describe('validation-service', () => {
  test('warns when loop markers are missing', () => {
    const song = createDefaultSong(baseSettings);
    const summary = buildValidationSummary(song, baseSettings);

    expect(summary.issues.some((issue) => issue.code === 'missing-loop-markers')).toBeTrue();
    expect(summary.warningCount).toBeGreaterThan(0);
  });

  test('reports strict-mode overlap and range violations', () => {
    const song = createDefaultSong(baseSettings);
    const lead = song.tracks[0]!;
    const pattern = lead.patterns[lead.activePatternIndex]!;
    pattern.notes.push(
      { id: 'n1', midiNote: 120, startTick: 0, durationTicks: 192, velocity: 100 },
      { id: 'n2', midiNote: 84, startTick: 0, durationTicks: 192, velocity: 100 }
    );

    const lane = song.arrangement.lanes.find((item) => item.trackId === lead.id)!;
    lane.instances = [
      { id: 'clip-1', patternId: pattern.id, startTick: 0, lengthTicks: pattern.lengthTicks },
    ];

    const summary = buildValidationSummary(song, baseSettings);

    expect(summary.issues.some((issue) => issue.code === 'range-violation')).toBeTrue();
    expect(summary.issues.some((issue) => issue.code === 'polyphony-risk')).toBeTrue();
    expect(summary.errorCount).toBeGreaterThan(0);
  });

  test('reports unmapped MIDI channels in channel-map mode', () => {
    const settings: AppSettings = {
      ...baseSettings,
      midiConfig: {
        ...baseSettings.midiConfig,
        routingMode: 'channel-map',
      },
    };
    const song = createDefaultSong(settings);

    const summary = buildValidationSummary(song, settings);

    expect(summary.issues.some((issue) => issue.code === 'unmapped-midi-channel')).toBeTrue();
  });
});
