import { create } from 'zustand';
import {
  DEFAULT_SHORTCUT_BINDINGS,
  detectShortcutConflicts,
  normalizeShortcutCombo,
} from '@/lib/shortcuts';
import {
  clampMidiByMode,
  createDefaultSong,
  createModernTrack,
  generateId,
  normalizeSongForMode,
  ticksPerQuantize,
} from '@/lib/song-utils';
import {
  getDefaultInstrumentForTrack,
  getInstrumentsForTrack,
  isInstrumentCompatible,
} from '@/audio/instruments';
import { STORAGE_KEYS, UI_LIMITS } from '@/lib/constants';
import {
  bindFromCapturedMessage,
  cancelMidiLearn as createIdleMidiLearnSession,
  captureMidiLearnMessage,
  midiDeviceFingerprint,
  startMidiLearn as createMidiLearnSession,
  upsertMidiBinding,
} from '@/services/midi-control-service';
import type {
  AccessibilitySettings,
  AppMode,
  AppSettings,
  EngineType,
  MIDIMessageEnvelope,
  MIDIImportTrackMapping,
  MidiSettings,
  MidiBinding,
  MidiBindingTarget,
  MidiLearnSession,
  MidiProfile,
  Note,
  OnboardingStep,
  PlaybackPreviewMode,
  Quantize,
  ShortcutCommand,
  Song,
  SongArrangement,
  StrictModeConfig,
  Track,
  TransportState,
  UISettings,
} from '@/types/engine';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface DAWState {
  song: Song;
  settings: AppSettings;

  transportState: TransportState;
  playbackPreviewMode: PlaybackPreviewMode;
  bpm: number;
  currentTick: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;

  selectedTrackId: string;
  pianoRollView: {
    scrollX: number;
    scrollY: number;
    zoomX: number;
    zoomY: number;
    quantize: Quantize;
    selectedNoteIds: string[];
    activeTrackId: string | null;
  };

  midiConnected: boolean;
  midiDeviceName: string | null;
  midiDeviceId: string | null;
  midiLastMessage: MIDIMessageEnvelope | null;
  midiLearnSession: MidiLearnSession;
  midiProfiles: MidiProfile[];

  engineReady: boolean;
  settingsOpen: boolean;
  helpOpen: boolean;
  midiImportMappings: MIDIImportTrackMapping[];

  toasts: ToastMessage[];

  history: Song[];
  future: Song[];
}

interface DAWActions {
  setTransportState: (state: TransportState) => void;
  setPlaybackPreviewMode: (mode: PlaybackPreviewMode) => void;
  setCurrentTick: (tick: number) => void;
  setBpm: (bpm: number) => void;
  toggleLoop: () => void;
  setLoopRegion: (start: number, end: number) => void;

  setSelectedTrack: (trackId: string) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  setTrackInstrument: (trackId: string, instrumentId: string) => void;
  setTrackEngineType: (trackId: string, engineType: EngineType) => void;
  setTrackName: (trackId: string, name: string) => void;
  clearTrackNotes: (trackId: string) => void;
  addModernTrack: () => void;
  removeTrack: (trackId: string) => void;

  addNote: (trackId: string, note: Omit<Note, 'id'>) => void;
  removeNote: (trackId: string, noteId: string) => void;
  updateNote: (trackId: string, noteId: string, updates: Partial<Note>) => void;
  duplicateSelectedNotes: () => void;
  quantizeSelectedNotes: () => void;
  nudgeSelectedNotes: (deltaTicks: number) => void;
  transposeSelectedNotes: (semitones: number) => void;
  importNotesByTrack: (
    notesByTrack: Record<string, Omit<Note, 'id'>[]>,
    options?: { replaceExisting?: boolean; suggestedLengthTicks?: number }
  ) => void;
  selectNotes: (noteIds: string[]) => void;
  clearSelection: () => void;

  setPianoRollScroll: (x: number, y: number) => void;
  setPianoRollZoom: (zoomX: number, zoomY: number) => void;
  setQuantize: (q: Quantize) => void;

  setSongName: (name: string) => void;
  setArrangement: (arrangement: SongArrangement) => void;
  setArrangementLength: (lengthTicks: number) => void;
  addPatternInstance: (trackId: string, startTick: number) => void;
  movePatternInstance: (trackId: string, instanceId: string, startTick: number) => void;
  removePatternInstance: (trackId: string, instanceId: string) => void;
  addSectionMarker: (
    label: string,
    startTick: number,
    role?: Song['arrangement']['sectionMarkers'][number]['role']
  ) => void;
  setSectionMarkerRole: (
    markerId: string,
    role: Song['arrangement']['sectionMarkers'][number]['role']
  ) => void;
  removeSectionMarker: (markerId: string) => void;
  jumpToMarker: (markerId: string) => void;
  applyLoopRegionFromMarkers: () => boolean;

  setMidiConnected: (connected: boolean, deviceName?: string, deviceId?: string | null) => void;
  setMidiLastMessage: (message: MIDIMessageEnvelope) => void;
  startMidiLearn: (target: MidiBindingTarget, trackId?: string | null) => void;
  cancelMidiLearn: () => void;
  expireMidiLearn: () => void;
  captureMidiLearn: (message: MIDIMessageEnvelope) => void;
  confirmMidiLearnBinding: () => void;
  removeMidiBinding: (bindingId: string) => void;
  setMidiChannelMap: (channel: number, trackId: string | null) => void;
  addAutomationPoint: (
    target: Song['automationLanes'][number]['target'],
    tick: number,
    value: number,
    trackId?: string | null
  ) => void;
  getEffectiveMidiBindings: () => MidiBinding[];
  updateMidiProfileName: (profileId: string, name: string) => void;
  setEngineReady: (ready: boolean) => void;

  setSettingsOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setMode: (mode: AppMode) => void;
  completeOnboardingStep: (step: OnboardingStep) => void;
  resetOnboardingChecklist: () => void;
  updateStrictConfig: (updates: Partial<StrictModeConfig>) => void;
  updateModernConfig: (updates: Partial<AppSettings['modernConfig']>) => void;
  updateMidiSettings: (updates: Partial<MidiSettings>) => void;
  updateUISettings: (updates: Partial<UISettings>) => void;
  updateAudioConfig: (updates: Partial<AppSettings['audioConfig']>) => void;
  updateAccessibilitySettings: (updates: Partial<AccessibilitySettings>) => void;
  updateShortcutBinding: (command: ShortcutCommand, combo: string) => void;
  resetShortcutBindings: () => void;

  setMidiImportMappings: (mappings: MIDIImportTrackMapping[]) => void;

  replaceSong: (song: Song) => void;
  replaceSettings: (settings: AppSettings) => void;
  resetProject: () => void;
  applyDraftState: (draft: { song?: Song; settings?: AppSettings } | null) => void;

  undo: () => void;
  redo: () => void;

  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const SHORTCUT_STORAGE_KEY = STORAGE_KEYS.shortcuts;
const SETTINGS_STORAGE_KEY = STORAGE_KEYS.ui;
const MIDI_PROFILES_STORAGE_KEY = STORAGE_KEYS.midiProfiles;

function loadShortcutBindings(): Record<ShortcutCommand, string> {
  if (typeof window === 'undefined') return DEFAULT_SHORTCUT_BINDINGS;

  try {
    const raw = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return DEFAULT_SHORTCUT_BINDINGS;
    const parsed = JSON.parse(raw) as Record<string, string>;

    const bindings = { ...DEFAULT_SHORTCUT_BINDINGS };
    (Object.keys(DEFAULT_SHORTCUT_BINDINGS) as ShortcutCommand[]).forEach((command) => {
      const value = parsed[command];
      if (typeof value === 'string' && value.trim()) {
        bindings[command] = normalizeShortcutCombo(value);
      }
    });

    return bindings;
  } catch {
    return DEFAULT_SHORTCUT_BINDINGS;
  }
}

function persistShortcutBindings(bindings: Record<ShortcutCommand, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(bindings));
}

function loadSettingsOverrides():
  | Partial<Pick<AppSettings, 'mode' | 'strictConfig' | 'modernConfig' | 'audioConfig' | 'midiConfig' | 'uiConfig' | 'accessibilityConfig'>>
  | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<AppSettings>;
  } catch {
    return null;
  }
}

function persistSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;

  const snapshot = {
    mode: settings.mode,
    strictConfig: settings.strictConfig,
    modernConfig: settings.modernConfig,
    audioConfig: settings.audioConfig,
    midiConfig: settings.midiConfig,
    uiConfig: settings.uiConfig,
    accessibilityConfig: settings.accessibilityConfig,
  };

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(snapshot));
}

function loadMidiProfiles(): MidiProfile[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(MIDI_PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MidiProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((profile) => Boolean(profile?.id && profile?.deviceFingerprint));
  } catch {
    return [];
  }
}

function persistMidiProfiles(profiles: MidiProfile[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MIDI_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

function createDefaultSettings(): AppSettings {
  const bindings = loadShortcutBindings();
  const overrides = loadSettingsOverrides();

  const defaults: AppSettings = {
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
    shortcutConfig: {
      bindings,
      conflicts: detectShortcutConflicts(bindings),
    },
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
    audioConfig: {
      masterVolume: 0.65,
      latencyHint: 'interactive',
    },
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
    accessibilityConfig: {
      reducedMotion: false,
      highContrastFocus: true,
    },
  };

  if (!overrides) return defaults;

  return {
    ...defaults,
    ...overrides,
    strictConfig: {
      ...defaults.strictConfig,
      ...overrides.strictConfig,
    },
    modernConfig: {
      ...defaults.modernConfig,
      ...overrides.modernConfig,
    },
    audioConfig: {
      ...defaults.audioConfig,
      ...overrides.audioConfig,
    },
    midiConfig: {
      ...defaults.midiConfig,
      ...overrides.midiConfig,
      learnTimeoutMs: Math.max(1500, overrides.midiConfig?.learnTimeoutMs ?? defaults.midiConfig.learnTimeoutMs),
    },
    uiConfig: {
      ...defaults.uiConfig,
      ...overrides.uiConfig,
      onboardingChecklist: {
        ...defaults.uiConfig.onboardingChecklist,
        ...overrides.uiConfig?.onboardingChecklist,
      },
    },
    accessibilityConfig: {
      ...defaults.accessibilityConfig,
      ...overrides.accessibilityConfig,
    },
    shortcutConfig: {
      bindings,
      conflicts: detectShortcutConflicts(bindings),
    },
  };
}

const defaultSettings = createDefaultSettings();
const defaultSong = createDefaultSong(defaultSettings);
const defaultMidiLearnSession = createIdleMidiLearnSession();

const initialState: DAWState = {
  song: defaultSong,
  settings: defaultSettings,

  transportState: 'stopped',
  playbackPreviewMode: 'full-song',
  bpm: defaultSong.bpm,
  currentTick: 0,
  loopEnabled: false,
  loopStart: 0,
  loopEnd: defaultSong.arrangement.lengthTicks,

  selectedTrackId: defaultSong.tracks[0]?.id ?? '',
  pianoRollView: {
    scrollX: 0,
    scrollY: 60 * 20,
    zoomX: 1,
    zoomY: 20,
    quantize: defaultSettings.midiConfig.defaultQuantize,
    selectedNoteIds: [],
    activeTrackId: defaultSong.tracks[0]?.id ?? null,
  },

  midiConnected: false,
  midiDeviceName: null,
  midiDeviceId: null,
  midiLastMessage: null,
  midiLearnSession: defaultMidiLearnSession,
  midiProfiles: loadMidiProfiles(),

  engineReady: false,
  settingsOpen: false,
  helpOpen: false,
  midiImportMappings: [],

  toasts: [],

  history: [],
  future: [],
};

function pushHistory(history: Song[], song: Song): Song[] {
  return [song, ...history].slice(0, 75);
}

function clampTrackNote(note: Omit<Note, 'id'>, state: DAWState): Omit<Note, 'id'> {
  const qTicks = ticksPerQuantize(state.song.ppqn, state.pianoRollView.quantize);
  const startTick = Math.max(0, Math.round(note.startTick / qTicks) * qTicks);
  const durationTicks = Math.max(1, Math.round(note.durationTicks / qTicks) * qTicks);
  const midiNote = clampMidiByMode(note.midiNote, state.settings.mode, state.song.constraints.clampMidiRange);

  return {
    ...note,
    midiNote,
    startTick,
    durationTicks,
    velocity: Math.max(1, Math.min(127, note.velocity)),
  };
}

function mutateSong(
  state: DAWState,
  updater: (song: Song) => Song,
  settingsOverride?: AppSettings
): Pick<DAWState, 'song' | 'history' | 'future' | 'selectedTrackId' | 'pianoRollView' | 'loopEnd' | 'bpm'> {
  const nextRaw = updater(state.song);
  const normalized = normalizeSongForMode(nextRaw, settingsOverride ?? state.settings);

  const selectedTrackExists = normalized.tracks.some((track) => track.id === state.selectedTrackId);
  const selectedTrackId = selectedTrackExists
    ? state.selectedTrackId
    : normalized.tracks[0]?.id ?? '';

  return {
    song: normalized,
    history: pushHistory(state.history, state.song),
    future: [],
    selectedTrackId,
    pianoRollView: {
      ...state.pianoRollView,
      activeTrackId: selectedTrackId,
    },
    loopEnd: Math.max(state.loopEnd, normalized.arrangement.lengthTicks),
    bpm: normalized.bpm,
  };
}

export const useDAWStore = create<DAWState & DAWActions>((set, get) => ({
  ...initialState,

  setTransportState: (transportState) => set({ transportState }),
  setPlaybackPreviewMode: (playbackPreviewMode) => set({ playbackPreviewMode }),
  setCurrentTick: (currentTick) => set({ currentTick }),
  setBpm: (bpm) =>
    set((state) => {
      const nextBpm = Math.max(30, Math.min(300, bpm));
      return {
        ...mutateSong(state, (song) => ({ ...song, bpm: nextBpm })),
        bpm: nextBpm,
      };
    }),
  toggleLoop: () => set((state) => ({ loopEnabled: !state.loopEnabled })),
  setLoopRegion: (start, end) =>
    set({
      loopStart: Math.max(0, start),
      loopEnd: Math.max(start + 1, end),
    }),

  setSelectedTrack: (trackId) =>
    set((state) => ({
      selectedTrackId: trackId,
      pianoRollView: { ...state.pianoRollView, activeTrackId: trackId },
    })),

  setTrackVolume: (trackId, volume) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) =>
          track.id === trackId
            ? { ...track, volume: Math.max(0, Math.min(1, volume)) }
            : track
        ),
      }))
    ),

  toggleTrackMute: (trackId) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) =>
          track.id === trackId ? { ...track, muted: !track.muted } : track
        ),
      }))
    ),

  toggleTrackSolo: (trackId) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) =>
          track.id === trackId ? { ...track, solo: !track.solo } : track
        ),
      }))
    ),

  setTrackInstrument: (trackId, instrumentId) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== trackId) return track;
          if (
            state.song.constraints.enforceInstrumentCompatibility &&
            !isInstrumentCompatible(track, instrumentId)
          ) {
            const fallback = getDefaultInstrumentForTrack(track.channel, track.engineType);
            return { ...track, instrumentId: fallback };
          }

          return { ...track, instrumentId };
        }),
      }))
    ),

  setTrackEngineType: (trackId, engineType) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== trackId) return track;

          const nextTrack: Track = {
            ...track,
            engineType,
            channel: track.channel === 'modern' ? 'modern' : track.channel,
          };

          const compatible = getInstrumentsForTrack(nextTrack);
          return {
            ...nextTrack,
            instrumentId:
              compatible.find((instrument) => instrument.id === nextTrack.instrumentId)?.id ??
              compatible[0]?.id ??
              getDefaultInstrumentForTrack(nextTrack.channel, nextTrack.engineType),
          };
        }),
      }))
    ),

  setTrackName: (trackId, name) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) =>
          track.id === trackId ? { ...track, name: name.trim() || track.name } : track
        ),
      }))
    ),

  clearTrackNotes: (trackId) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== trackId) return track;

          return {
            ...track,
            patterns: track.patterns.map((pattern, index) =>
              index === track.activePatternIndex ? { ...pattern, notes: [] } : pattern
            ),
          };
        }),
      }))
    ),

  addModernTrack: () =>
    set((state) => {
      if (state.settings.mode !== 'modern') return {};
      if (state.song.tracks.length >= state.settings.modernConfig.maxTracks) {
        return {
          toasts: [
            {
              id: generateId(),
              type: 'warning' as const,
              message: `Track limit reached (${state.settings.modernConfig.maxTracks}).`,
            },
            ...state.toasts,
          ].slice(0, 6),
        };
      }

      return mutateSong(state, (song) => {
        const modernCount = song.tracks.filter((track) => track.channel === 'modern').length;
        const track = createModernTrack(modernCount + 1);

        return {
          ...song,
          tracks: [...song.tracks, track],
          arrangement: {
            ...song.arrangement,
            lanes: [
              ...song.arrangement.lanes,
              {
                trackId: track.id,
                instances: [
                  {
                    id: generateId(),
                    patternId: track.patterns[0].id,
                    startTick: 0,
                    lengthTicks: track.patterns[0].lengthTicks,
                  },
                ],
              },
            ],
          },
        };
      });
    }),

  removeTrack: (trackId) =>
    set((state) => {
      if (state.settings.mode === 'strict') {
        return {
          toasts: [
            {
              id: generateId(),
              type: 'warning' as const,
              message: 'Strict mode keeps canonical NES channels locked.',
            },
            ...state.toasts,
          ].slice(0, 6),
        };
      }

      return mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.filter((track) => track.id !== trackId),
        arrangement: {
          ...song.arrangement,
          lanes: song.arrangement.lanes.filter((lane) => lane.trackId !== trackId),
        },
      }));
    }),

  addNote: (trackId, noteData) =>
    set((state) => {
      const clamped = clampTrackNote(noteData, state);

      return mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== trackId) return track;

          return {
            ...track,
            patterns: track.patterns.map((pattern, index) =>
              index === track.activePatternIndex
                ? {
                    ...pattern,
                    notes: [
                      ...pattern.notes,
                      {
                        ...clamped,
                        id: generateId(),
                      },
                    ],
                  }
                : pattern
            ),
          };
        }),
      }));
    }),

  removeNote: (trackId, noteId) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== trackId) return track;

          return {
            ...track,
            patterns: track.patterns.map((pattern, index) =>
              index === track.activePatternIndex
                ? { ...pattern, notes: pattern.notes.filter((note) => note.id !== noteId) }
                : pattern
            ),
          };
        }),
      }))
    ),

  updateNote: (trackId, noteId, updates) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== trackId) return track;

          return {
            ...track,
            patterns: track.patterns.map((pattern, index) => {
              if (index !== track.activePatternIndex) return pattern;

              return {
                ...pattern,
                notes: pattern.notes.map((note) => {
                  if (note.id !== noteId) return note;

                  const merged = {
                    ...note,
                    ...updates,
                  };

                  const quantizedStart = Math.max(
                    0,
                    Math.round(merged.startTick / ticksPerQuantize(song.ppqn, state.pianoRollView.quantize)) *
                      ticksPerQuantize(song.ppqn, state.pianoRollView.quantize)
                  );

                  return {
                    ...merged,
                    midiNote: clampMidiByMode(
                      merged.midiNote,
                      state.settings.mode,
                      state.song.constraints.clampMidiRange
                    ),
                    startTick: quantizedStart,
                    durationTicks: Math.max(1, merged.durationTicks),
                    velocity: Math.max(1, Math.min(127, merged.velocity)),
                  };
                }),
              };
            }),
          };
        }),
      }))
    ),

  duplicateSelectedNotes: () =>
    set((state) =>
      mutateSong(state, (song) => {
        const track = song.tracks.find((item) => item.id === state.selectedTrackId);
        if (!track) return song;

        const pattern = track.patterns[track.activePatternIndex];
        if (!pattern) return song;

        const selected = pattern.notes.filter((note) =>
          state.pianoRollView.selectedNoteIds.includes(note.id)
        );
        if (selected.length === 0) return song;

        const offset = ticksPerQuantize(song.ppqn, state.pianoRollView.quantize);
        const duplicates = selected.map((note) => ({
          ...note,
          id: generateId(),
          startTick: note.startTick + offset,
        }));

        return {
          ...song,
          tracks: song.tracks.map((item) =>
            item.id !== track.id
              ? item
              : {
                  ...item,
                  patterns: item.patterns.map((p, idx) =>
                    idx === item.activePatternIndex
                      ? {
                          ...p,
                          notes: [...p.notes, ...duplicates],
                        }
                      : p
                  ),
                }
          ),
        };
      })
    ),

  quantizeSelectedNotes: () =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== state.selectedTrackId) return track;
          return {
            ...track,
            patterns: track.patterns.map((pattern, index) => {
              if (index !== track.activePatternIndex) return pattern;
              return {
                ...pattern,
                notes: pattern.notes.map((note) =>
                  state.pianoRollView.selectedNoteIds.includes(note.id)
                    ? {
                        ...note,
                        startTick: Math.max(
                          0,
                          Math.round(
                            note.startTick / ticksPerQuantize(song.ppqn, state.pianoRollView.quantize)
                          ) * ticksPerQuantize(song.ppqn, state.pianoRollView.quantize)
                        ),
                      }
                    : note
                ),
              };
            }),
          };
        }),
      }))
    ),

  nudgeSelectedNotes: (deltaTicks) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== state.selectedTrackId) return track;
          return {
            ...track,
            patterns: track.patterns.map((pattern, index) => {
              if (index !== track.activePatternIndex) return pattern;
              return {
                ...pattern,
                notes: pattern.notes.map((note) =>
                  state.pianoRollView.selectedNoteIds.includes(note.id)
                    ? { ...note, startTick: Math.max(0, note.startTick + deltaTicks) }
                    : note
                ),
              };
            }),
          };
        }),
      }))
    ),

  transposeSelectedNotes: (semitones) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        tracks: song.tracks.map((track) => {
          if (track.id !== state.selectedTrackId) return track;
          return {
            ...track,
            patterns: track.patterns.map((pattern, index) => {
              if (index !== track.activePatternIndex) return pattern;
              return {
                ...pattern,
                notes: pattern.notes.map((note) =>
                  state.pianoRollView.selectedNoteIds.includes(note.id)
                    ? {
                        ...note,
                        midiNote: clampMidiByMode(
                          note.midiNote + semitones,
                          state.settings.mode,
                          state.song.constraints.clampMidiRange
                        ),
                      }
                    : note
                ),
              };
            }),
          };
        }),
      }))
    ),

  importNotesByTrack: (notesByTrack, options) =>
    set((state) =>
      mutateSong(state, (song) => {
        const nextTracks = song.tracks.map((track) => {
          const imported = notesByTrack[track.id];
          if (!imported || imported.length === 0) return track;

          return {
            ...track,
            patterns: track.patterns.map((pattern, index) => {
              if (index !== track.activePatternIndex) return pattern;
              const incoming = imported.map((note) => ({
                ...note,
                id: generateId(),
              }));

              return {
                ...pattern,
                notes: options?.replaceExisting ? incoming : [...pattern.notes, ...incoming],
              };
            }),
          };
        });

        return {
          ...song,
          tracks: nextTracks,
          arrangement: {
            ...song.arrangement,
            lengthTicks: Math.max(
              song.arrangement.lengthTicks,
              options?.suggestedLengthTicks ?? song.arrangement.lengthTicks
            ),
          },
        };
      })
    ),

  selectNotes: (noteIds) =>
    set((state) => ({
      pianoRollView: { ...state.pianoRollView, selectedNoteIds: noteIds },
    })),
  clearSelection: () =>
    set((state) => ({
      pianoRollView: { ...state.pianoRollView, selectedNoteIds: [] },
    })),

  setPianoRollScroll: (x, y) =>
    set((state) => ({
      pianoRollView: { ...state.pianoRollView, scrollX: Math.max(0, x), scrollY: Math.max(0, y) },
    })),
  setPianoRollZoom: (zoomX, zoomY) =>
    set((state) => ({
      pianoRollView: {
        ...state.pianoRollView,
        zoomX: Math.max(UI_LIMITS.minZoomX, Math.min(UI_LIMITS.maxZoomX, zoomX)),
        zoomY: Math.max(UI_LIMITS.minZoomY, Math.min(UI_LIMITS.maxZoomY, zoomY)),
      },
    })),
  setQuantize: (quantize) =>
    set((state) => ({
      pianoRollView: { ...state.pianoRollView, quantize },
    })),

  setSongName: (name) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        name,
      }))
    ),

  setArrangement: (arrangement) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        arrangement,
      }))
    ),

  setArrangementLength: (lengthTicks) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        arrangement: {
          ...song.arrangement,
          lengthTicks: Math.max(song.ppqn, lengthTicks),
        },
      }))
    ),

  addPatternInstance: (trackId, startTick) =>
    set((state) =>
      mutateSong(state, (song) => {
        const track = song.tracks.find((item) => item.id === trackId);
        const lane = song.arrangement.lanes.find((item) => item.trackId === trackId);
        if (!track || !lane) return song;

        const pattern = track.patterns[track.activePatternIndex] ?? track.patterns[0];
        if (!pattern) return song;

        return {
          ...song,
          arrangement: {
            ...song.arrangement,
            lanes: song.arrangement.lanes.map((item) => {
              if (item.trackId !== trackId) return item;
              return {
                ...item,
                instances: [
                  ...item.instances,
                  {
                    id: generateId(),
                    patternId: pattern.id,
                    startTick,
                    lengthTicks: pattern.lengthTicks,
                  },
                ].sort((a, b) => a.startTick - b.startTick),
              };
            }),
          },
        };
      })
    ),

  movePatternInstance: (trackId, instanceId, startTick) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        arrangement: {
          ...song.arrangement,
          lanes: song.arrangement.lanes.map((lane) => {
            if (lane.trackId !== trackId) return lane;
            return {
              ...lane,
              instances: lane.instances
                .map((instance) =>
                  instance.id === instanceId
                    ? { ...instance, startTick: Math.max(0, startTick) }
                    : instance
                )
                .sort((a, b) => a.startTick - b.startTick),
            };
          }),
        },
      }))
    ),

  removePatternInstance: (trackId, instanceId) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        arrangement: {
          ...song.arrangement,
          lanes: song.arrangement.lanes.map((lane) => {
            if (lane.trackId !== trackId) return lane;
            return {
              ...lane,
              instances: lane.instances.filter((instance) => instance.id !== instanceId),
            };
          }),
        },
      }))
    ),

  addSectionMarker: (label, startTick, role = 'custom') =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        arrangement: {
          ...song.arrangement,
          sectionMarkers: [
            ...song.arrangement.sectionMarkers,
            {
              id: generateId(),
              label,
              startTick,
              color: '#22c55e',
              role,
            },
          ].sort((a, b) => a.startTick - b.startTick),
        },
      }))
    ),

  setSectionMarkerRole: (markerId, role) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        arrangement: {
          ...song.arrangement,
          sectionMarkers: song.arrangement.sectionMarkers.map((marker) =>
            marker.id === markerId ? { ...marker, role } : marker
          ),
        },
      }))
    ),

  removeSectionMarker: (markerId) =>
    set((state) =>
      mutateSong(state, (song) => ({
        ...song,
        arrangement: {
          ...song.arrangement,
          sectionMarkers: song.arrangement.sectionMarkers.filter((marker) => marker.id !== markerId),
        },
      }))
    ),

  jumpToMarker: (markerId) =>
    set((state) => {
      const marker = state.song.arrangement.sectionMarkers.find((item) => item.id === markerId);
      if (!marker) return {};
      return {
        currentTick: marker.startTick,
      };
    }),

  applyLoopRegionFromMarkers: () => {
    const state = get();
    const loopStart = state.song.arrangement.sectionMarkers.find((marker) => marker.role === 'loop-start');
    const loopEnd = state.song.arrangement.sectionMarkers.find((marker) => marker.role === 'loop-end');
    if (!loopStart || !loopEnd || loopEnd.startTick <= loopStart.startTick) return false;
    set({
      loopEnabled: true,
      loopStart: loopStart.startTick,
      loopEnd: loopEnd.startTick,
    });
    return true;
  },

  setMidiConnected: (connected, deviceName, deviceId) =>
    set({
      midiConnected: connected,
      midiDeviceName: deviceName ?? null,
      midiDeviceId: deviceId ?? null,
      midiLearnSession: connected ? defaultMidiLearnSession : createIdleMidiLearnSession(),
    }),

  setMidiLastMessage: (message) =>
    set({
      midiLastMessage: message,
    }),

  startMidiLearn: (target, trackId = null) =>
    set((state) => ({
      midiLearnSession: createMidiLearnSession(
        target,
        trackId,
        state.settings.midiConfig.learnTimeoutMs
      ),
    })),

  cancelMidiLearn: () =>
    set({
      midiLearnSession: createIdleMidiLearnSession(),
    }),

  expireMidiLearn: () =>
    set((state) => {
      const current = state.midiLearnSession;
      if (current.state !== 'listening') return {};
      return {
        midiLearnSession: {
          ...current,
          state: 'timeout',
          error: 'MIDI learn timed out before a valid control was moved.',
        },
      };
    }),

  captureMidiLearn: (message) =>
    set((state) => {
      const current = state.midiLearnSession;
      if (current.state !== 'listening') return {};

      const now = Date.now();
      if (current.timeoutAt && now > current.timeoutAt) {
        return {
          midiLearnSession: {
            ...current,
            state: 'timeout',
            error: 'MIDI learn timed out before a valid control was moved.',
          },
        };
      }

      const next = captureMidiLearnMessage(current, message);
      return {
        midiLearnSession: next,
      };
    }),

  confirmMidiLearnBinding: () =>
    set((state) => {
      const session = state.midiLearnSession;
      if (session.state !== 'captured' || !session.captured || !session.target) return {};

      const nextBinding = bindFromCapturedMessage(session.captured, session.target, {
        trackId: session.trackId,
      });

      const nextSong = {
        ...state.song,
        midiProjectBindings: upsertMidiBinding(state.song.midiProjectBindings, nextBinding),
      };

      let midiProfiles = state.midiProfiles;
      const fingerprint = midiDeviceFingerprint(state.midiDeviceId, state.midiDeviceName);
      const existingProfile = midiProfiles.find((profile) => profile.deviceFingerprint === fingerprint);
      if (existingProfile) {
        midiProfiles = midiProfiles.map((profile) =>
          profile.id !== existingProfile.id
            ? profile
            : {
                ...profile,
                bindings: upsertMidiBinding(profile.bindings, nextBinding),
                updatedAt: new Date().toISOString(),
              }
        );
      } else {
        const profile: MidiProfile = {
          id: generateId(),
          name: state.midiDeviceName ? `${state.midiDeviceName} Profile` : 'MIDI Device Profile',
          deviceFingerprint: fingerprint,
          bindings: [nextBinding],
          updatedAt: new Date().toISOString(),
        };
        midiProfiles = [...midiProfiles, profile];
      }
      persistMidiProfiles(midiProfiles);

      const nextSettings = {
        ...state.settings,
        midiConfig: {
          ...state.settings.midiConfig,
          selectedProfileId:
            state.settings.midiConfig.selectedProfileId ??
            midiProfiles.find((profile) => profile.deviceFingerprint === fingerprint)?.id ??
            null,
        },
      };
      persistSettings(nextSettings);

      return {
        song: nextSong,
        settings: nextSettings,
        midiProfiles,
        midiLearnSession: createIdleMidiLearnSession(),
        toasts: [
          {
            id: generateId(),
            type: 'success' as const,
            message: `Mapped ${session.target} from ${session.captured.messageType.toUpperCase()}.`,
          },
          ...state.toasts,
        ].slice(0, 6),
      };
    }),

  removeMidiBinding: (bindingId) =>
    set((state) => {
      const song = {
        ...state.song,
        midiProjectBindings: state.song.midiProjectBindings.filter((binding) => binding.id !== bindingId),
      };

      const midiProfiles = state.midiProfiles.map((profile) => ({
        ...profile,
        bindings: profile.bindings.filter((binding) => binding.id !== bindingId),
      }));
      persistMidiProfiles(midiProfiles);

      return {
        song,
        midiProfiles,
      };
    }),

  setMidiChannelMap: (channel, trackId) =>
    set((state) =>
      mutateSong(state, (song) => {
        const map = { ...(song.midiChannelMap ?? {}) };
        const key = Math.max(1, Math.min(16, Math.floor(channel)));
        if (!trackId) {
          delete map[key];
        } else {
          map[key] = trackId;
        }
        return {
          ...song,
          midiChannelMap: map,
        };
      })
    ),

  addAutomationPoint: (target, tick, value, trackId = null) =>
    set((state) =>
      mutateSong(state, (song) => {
        const lane = song.automationLanes.find(
          (item) => item.target === target && (item.trackId ?? null) === (trackId ?? null)
        );

        if (!lane) {
          return {
            ...song,
            automationLanes: [
              ...song.automationLanes,
              {
                id: generateId(),
                target,
                trackId: trackId ?? null,
                points: [
                  {
                    id: generateId(),
                    tick: Math.max(0, Math.floor(tick)),
                    value: Math.max(0, Math.min(1, value)),
                  },
                ],
              },
            ],
          };
        }

        const nextPoints = [
          ...lane.points.filter((point) => point.tick !== Math.max(0, Math.floor(tick))),
          {
            id: generateId(),
            tick: Math.max(0, Math.floor(tick)),
            value: Math.max(0, Math.min(1, value)),
          },
        ].sort((a, b) => a.tick - b.tick);

        return {
          ...song,
          automationLanes: song.automationLanes.map((item) =>
            item.id === lane.id
              ? {
                  ...item,
                  points: nextPoints,
                }
              : item
          ),
        };
      })
    ),

  getEffectiveMidiBindings: () => {
    const state = get();
    const deviceFingerprint = midiDeviceFingerprint(state.midiDeviceId, state.midiDeviceName);
    const deviceProfile = state.midiProfiles.find(
      (profile) =>
        profile.id === state.settings.midiConfig.selectedProfileId ||
        profile.deviceFingerprint === deviceFingerprint
    );

    const projectBindings = state.song.midiProjectBindings;
    if (!deviceProfile) return projectBindings;

    const ordered =
      state.settings.midiConfig.profilePreference === 'device-first'
        ? [...projectBindings, ...deviceProfile.bindings]
        : [...deviceProfile.bindings, ...projectBindings];

    const byKey = new Map<string, MidiBinding>();
    ordered.forEach((binding) => {
      const key = [
        binding.target,
        binding.trackId ?? '*',
        binding.source.deviceId ?? '*',
        binding.source.messageType,
        binding.source.channel,
        binding.source.controllerOrNote,
      ].join(':');
      byKey.set(key, binding);
    });

    return Array.from(byKey.values());
  },

  updateMidiProfileName: (profileId, name) =>
    set((state) => {
      const midiProfiles = state.midiProfiles.map((profile) =>
        profile.id === profileId ? { ...profile, name: name.trim() || profile.name } : profile
      );
      persistMidiProfiles(midiProfiles);
      return { midiProfiles };
    }),

  setEngineReady: (engineReady) => set({ engineReady }),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),

  setMode: (mode) =>
    set((state) => {
      const settings = {
        ...state.settings,
        mode,
      };
      persistSettings(settings);
      const song = normalizeSongForMode(state.song, settings);
      return {
        settings,
        song,
        selectedTrackId: song.tracks[0]?.id ?? state.selectedTrackId,
        pianoRollView: {
          ...state.pianoRollView,
          activeTrackId: song.tracks[0]?.id ?? state.pianoRollView.activeTrackId,
        },
        history: pushHistory(state.history, state.song),
        future: [],
      };
    }),

  completeOnboardingStep: (step) =>
    set((state) => {
      if (state.settings.uiConfig.onboardingChecklist.completedSteps.includes(step)) return {};
      const settings = {
        ...state.settings,
        uiConfig: {
          ...state.settings.uiConfig,
          onboardingChecklist: {
            ...state.settings.uiConfig.onboardingChecklist,
            dismissed: false,
            completedSteps: [...state.settings.uiConfig.onboardingChecklist.completedSteps, step],
          },
        },
      };
      persistSettings(settings);
      return { settings };
    }),

  resetOnboardingChecklist: () =>
    set((state) => {
      const settings = {
        ...state.settings,
        uiConfig: {
          ...state.settings.uiConfig,
          onboardingChecklist: {
            completedSteps: [],
            dismissed: false,
          },
        },
      };
      persistSettings(settings);
      return { settings };
    }),

  updateStrictConfig: (updates) =>
    set((state) => {
      const settings: AppSettings = {
        ...state.settings,
        strictConfig: {
          ...state.settings.strictConfig,
          ...updates,
        },
      };
      persistSettings(settings);
      const song = normalizeSongForMode(state.song, settings);
      return {
        settings,
        song,
      };
    }),

  updateModernConfig: (updates) =>
    set((state) => {
      const settings: AppSettings = {
        ...state.settings,
        modernConfig: {
          ...state.settings.modernConfig,
          ...updates,
        },
      };

      persistSettings(settings);
      const song = normalizeSongForMode(state.song, settings);
      return {
        settings,
        song,
      };
    }),

  updateMidiSettings: (updates) =>
    set((state) => {
      const settings = {
        ...state.settings,
        midiConfig: {
          ...state.settings.midiConfig,
          ...updates,
          learnTimeoutMs: Math.max(
            1500,
            updates.learnTimeoutMs ?? state.settings.midiConfig.learnTimeoutMs
          ),
        },
      };
      persistSettings(settings);
      return { settings };
    }),

  updateUISettings: (updates) =>
    set((state) => {
      const settings = {
        ...state.settings,
        uiConfig: {
          ...state.settings.uiConfig,
          ...updates,
          onboardingChecklist: {
            ...state.settings.uiConfig.onboardingChecklist,
            ...updates.onboardingChecklist,
          },
        },
      };
      persistSettings(settings);
      return { settings };
    }),

  updateAudioConfig: (updates) =>
    set((state) => {
      const settings = {
        ...state.settings,
        audioConfig: {
          ...state.settings.audioConfig,
          ...updates,
        },
      };
      persistSettings(settings);
      return { settings };
    }),

  updateAccessibilitySettings: (updates) =>
    set((state) => {
      const settings = {
        ...state.settings,
        accessibilityConfig: {
          ...state.settings.accessibilityConfig,
          ...updates,
        },
      };
      persistSettings(settings);
      return { settings };
    }),

  updateShortcutBinding: (command, combo) =>
    set((state) => {
      const bindings = {
        ...state.settings.shortcutConfig.bindings,
        [command]: normalizeShortcutCombo(combo),
      };
      const conflicts = detectShortcutConflicts(bindings);
      persistShortcutBindings(bindings);
      const settings = {
        ...state.settings,
        shortcutConfig: {
          bindings,
          conflicts,
        },
      };
      persistSettings(settings);
      return {
        settings,
      };
    }),

  resetShortcutBindings: () =>
    set((state) => {
      persistShortcutBindings(DEFAULT_SHORTCUT_BINDINGS);
      const settings = {
        ...state.settings,
        shortcutConfig: {
          bindings: DEFAULT_SHORTCUT_BINDINGS,
          conflicts: [],
        },
      };
      persistSettings(settings);
      return {
        settings,
      };
    }),

  setMidiImportMappings: (midiImportMappings) => set({ midiImportMappings }),

  replaceSong: (song) =>
    set((state) => {
      const normalized = normalizeSongForMode(song, state.settings);
      return {
        song: normalized,
        bpm: normalized.bpm,
        selectedTrackId: normalized.tracks[0]?.id ?? '',
        pianoRollView: {
          ...state.pianoRollView,
          activeTrackId: normalized.tracks[0]?.id ?? null,
          selectedNoteIds: [],
        },
        loopEnd: normalized.arrangement.lengthTicks,
        history: pushHistory(state.history, state.song),
        future: [],
      };
    }),

  replaceSettings: (settings) =>
    set((state) => {
      persistSettings(settings);
      const normalizedSong = normalizeSongForMode(state.song, settings);
      return {
        settings,
        song: normalizedSong,
      };
    }),

  applyDraftState: (draft) =>
    set((state) => {
      if (!draft) return {};

      const nextSettings = draft.settings ?? state.settings;
      persistSettings(nextSettings);
      const baseSong = draft.song ?? state.song;
      const normalizedSong = normalizeSongForMode(baseSong, nextSettings);

      return {
        song: normalizedSong,
        settings: nextSettings,
        bpm: normalizedSong.bpm,
        selectedTrackId: normalizedSong.tracks[0]?.id ?? state.selectedTrackId,
        pianoRollView: {
          ...state.pianoRollView,
          activeTrackId: normalizedSong.tracks[0]?.id ?? state.pianoRollView.activeTrackId,
          selectedNoteIds: [],
        },
        loopEnd: Math.max(state.loopEnd, normalizedSong.arrangement.lengthTicks),
      };
    }),

  resetProject: () =>
    set(() => {
      const settings = createDefaultSettings();
      persistSettings(settings);
      const song = createDefaultSong(settings);
      return {
        ...initialState,
        song,
        settings,
        bpm: song.bpm,
        loopEnd: song.arrangement.lengthTicks,
        selectedTrackId: song.tracks[0]?.id ?? '',
        pianoRollView: {
          ...initialState.pianoRollView,
          activeTrackId: song.tracks[0]?.id ?? null,
        },
      };
    }),

  undo: () =>
    set((state) => {
      const previous = state.history[0];
      if (!previous) return {};

      const normalized = normalizeSongForMode(previous, state.settings);
      return {
        song: normalized,
        history: state.history.slice(1),
        future: [state.song, ...state.future].slice(0, 75),
        bpm: normalized.bpm,
      };
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};

      const normalized = normalizeSongForMode(next, state.settings);
      return {
        song: normalized,
        future: state.future.slice(1),
        history: [state.song, ...state.history].slice(0, 75),
        bpm: normalized.bpm,
      };
    }),

  pushToast: (toast) =>
    set((state) => ({
      toasts: [{ ...toast, id: generateId() }, ...state.toasts].slice(0, 6),
    })),

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
