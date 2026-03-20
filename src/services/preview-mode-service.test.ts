import { describe, expect, test } from 'bun:test';
import { createDefaultSong } from '@/lib/song-utils';
import { DEFAULT_SHORTCUT_BINDINGS } from '@/lib/shortcuts';
import type { AppSettings } from '@/types/engine';
import { applyPreviewMode, deriveLoopRegionFromMarkers } from './preview-mode-service';

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

describe('preview-mode-service', () => {
  test('derives loop region from marker roles', () => {
    const song = createDefaultSong(settings);
    song.arrangement.sectionMarkers.push(
      { id: 'loop-start', label: 'Loop In', startTick: 192, color: '#22c55e', role: 'loop-start' },
      { id: 'loop-end', label: 'Loop Out', startTick: 768, color: '#38bdf8', role: 'loop-end' }
    );

    expect(deriveLoopRegionFromMarkers(song.arrangement)).toEqual({
      loopStart: 192,
      loopEnd: 768,
    });
  });

  test('applies intro-to-loop preview using marker-derived looping', () => {
    const song = createDefaultSong(settings);
    song.arrangement.sectionMarkers = [
      { id: 'intro', label: 'Intro', startTick: 96, color: '#fff', role: 'intro' },
      { id: 'loop-start', label: 'Loop Start', startTick: 384, color: '#fff', role: 'loop-start' },
      { id: 'loop-end', label: 'Loop End', startTick: 1152, color: '#fff', role: 'loop-end' },
    ];

    expect(applyPreviewMode('intro-to-loop', song.arrangement)).toEqual({
      seekTick: 96,
      loopEnabled: true,
      loopStart: 384,
      loopEnd: 1152,
    });
  });

  test('falls back to full song when markers are invalid', () => {
    const song = createDefaultSong(settings);
    song.arrangement.sectionMarkers = [
      { id: 'loop-start', label: 'Loop Start', startTick: 480, color: '#fff', role: 'loop-start' },
      { id: 'loop-end', label: 'Loop End', startTick: 120, color: '#fff', role: 'loop-end' },
    ];

    expect(applyPreviewMode('loop-only', song.arrangement)).toEqual({
      seekTick: 0,
      loopEnabled: false,
      loopStart: 0,
      loopEnd: song.arrangement.lengthTicks,
    });
  });
});
