import { afterEach, describe, expect, test } from 'bun:test';
import { Midi } from '@tonejs/midi';
import { DEFAULT_SHORTCUT_BINDINGS } from '@/lib/shortcuts';
import type { AppSettings } from '@/types/engine';
import {
  BundledMidiAssetError,
  getBundledTestProjectTemplates,
  loadBundledTestProject,
} from './test-projects';

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

function makeMidiBytes() {
  const midi = new Midi();
  const lead = midi.addTrack();
  lead.channel = 0;
  lead.addNote({ midi: 72, ticks: 0, durationTicks: 96, velocity: 0.9 });
  lead.addNote({ midi: 76, ticks: 96, durationTicks: 96, velocity: 0.9 });

  const bass = midi.addTrack();
  bass.channel = 2;
  bass.addNote({ midi: 40, ticks: 0, durationTicks: 192, velocity: 0.85 });

  const drums = midi.addTrack();
  drums.channel = 9;
  drums.name = 'Drums';
  drums.addNote({ midi: 36, ticks: 0, durationTicks: 48, velocity: 1 });
  drums.addNote({ midi: 38, ticks: 96, durationTicks: 48, velocity: 1 });

  return midi.toArray();
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('test-projects', () => {
  test('loads bundled MIDI test project and maps tracks/channels', async () => {
    const bytes = makeMidiBytes();
    globalThis.fetch = async () =>
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'audio/midi' },
      });

    const loaded = await loadBundledTestProject('mega-man-3-main-theme', settings);
    expect(loaded.song.name).toContain('Mega Man 3');
    expect(loaded.song.tracks.length).toBeGreaterThanOrEqual(5);
    expect(loaded.song.midiProjectBindings.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(loaded.song.midiChannelMap).length).toBeGreaterThanOrEqual(1);

    const noteCount = loaded.song.tracks.reduce((sum, track) => {
      const pattern = track.patterns[track.activePatternIndex];
      return sum + (pattern?.notes.length ?? 0);
    }, 0);
    expect(noteCount).toBeGreaterThanOrEqual(4);
  });

  test('throws explicit missing-file error when bundled MIDI is absent', async () => {
    const templates = getBundledTestProjectTemplates();
    expect(templates.length).toBe(3);

    globalThis.fetch = async () => new Response('missing', { status: 404 });

    expect(loadBundledTestProject('mega-man-4-title', settings)).rejects.toBeInstanceOf(
      BundledMidiAssetError
    );
  });
});
