import { describe, expect, test } from 'bun:test';
import { createDefaultSong } from '@/lib/song-utils';
import { DEFAULT_SHORTCUT_BINDINGS } from '@/lib/shortcuts';
import type { AppSettings } from '@/types/engine';
import {
  buildProjectReport,
  formatProjectReportHtml,
  formatProjectReportMarkdown,
} from './project-report-service';

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

describe('project-report-service', () => {
  test('builds a serializable report with markers, bindings, and profiles', () => {
    const song = createDefaultSong(settings);
    song.arrangement.sectionMarkers = [
      { id: 'intro', label: 'Intro', startTick: 0, color: '#fff', role: 'intro' },
      { id: 'loop-start', label: 'Loop Start', startTick: 384, color: '#fff', role: 'loop-start' },
      { id: 'loop-end', label: 'Loop End', startTick: 1152, color: '#fff', role: 'loop-end' },
    ];
    song.midiProjectBindings.push({
      id: 'binding-1',
      label: 'Master Volume',
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
    });

    const report = buildProjectReport(song, settings, {
      previewMode: 'intro-to-loop',
      midiProfiles: [
        {
          id: 'profile-1',
          name: 'Controller A',
          deviceFingerprint: 'dev-1',
          bindings: [],
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    expect(report.previewMode).toBe('intro-to-loop');
    expect(report.markers.length).toBe(3);
    expect(report.bindings.length).toBe(1);
    expect(report.midiProfiles[0]?.name).toBe('Controller A');
    expect(JSON.parse(JSON.stringify(report)).songName).toBe(song.name);
  });

  test('formats markdown and html summaries', () => {
    const report = buildProjectReport(createDefaultSong(settings), settings);
    const markdown = formatProjectReportMarkdown(report);
    const html = formatProjectReportHtml(report);

    expect(markdown).toContain('#');
    expect(markdown).toContain('Validation Summary');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Project Report');
  });
});
