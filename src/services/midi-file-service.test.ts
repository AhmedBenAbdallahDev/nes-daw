import { describe, expect, test } from 'bun:test';
import { Midi } from '@tonejs/midi';
import { createDefaultSong } from '@/lib/song-utils';
import { DEFAULT_SHORTCUT_BINDINGS } from '@/lib/shortcuts';
import { importMidiToSong, analyzeMidi, exportMidi } from './midi-file-service';
import type { AppSettings, MIDIImportOptions } from '@/types/engine';

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

describe('midi-file-service', () => {
  test('analyze + import mapped notes', () => {
    const midi = new Midi();
    const track = midi.addTrack();
    track.name = 'Lead';
    track.addNote({ midi: 72, ticks: 0, durationTicks: 96, velocity: 0.8 });

    const song = createDefaultSong(settings);
    const targetTrackId = song.tracks[0]!.id;

    const analysis = analyzeMidi(midi, song.ppqn);
    expect(analysis.previews.length).toBe(1);
    expect(analysis.previews[0]?.noteCount).toBe(1);

    const options: MIDIImportOptions = {
      transpose: 0,
      quantize: '1/16',
      clampToNesRange: true,
      trackMappings: [{ sourceTrackIndex: 0, targetTrackId }],
      velocityScale: 1,
    };

    const result = importMidiToSong(song, midi, options, 'strict');
    expect(result.importedCount).toBe(1);
    expect(result.byTrack[targetTrackId]?.length).toBe(1);
    expect(result.byTrack[targetTrackId]?.[0]?.midiNote).toBe(72);
  });

  test('exports song to midi bytes', () => {
    const song = createDefaultSong(settings);
    const track = song.tracks[0]!;
    const pattern = track.patterns[track.activePatternIndex]!;
    pattern.notes.push({
      id: 'n1',
      midiNote: 60,
      startTick: 0,
      durationTicks: 96,
      velocity: 100,
    });

    const bytes = exportMidi(song);
    expect(bytes.length).toBeGreaterThan(50);
  });
});
