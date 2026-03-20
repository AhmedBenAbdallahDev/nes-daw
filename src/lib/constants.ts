export const APP_VERSION = '0.2.0';

export const STORAGE_KEYS = {
  shortcuts: 'nes-daw.shortcuts.v1',
  draft: 'nes-daw.draft.v1',
  ui: 'nes-daw.ui.v1',
  midiProfiles: 'nes-daw.midi-profiles.v1',
} as const;

export const UI_LIMITS = {
  minTouchTarget: 44,
  minZoomX: 0.2,
  maxZoomX: 6,
  minZoomY: 10,
  maxZoomY: 48,
} as const;

export const NOTE_OPERATION_DEFAULTS = {
  nudgeTicks: 12,
  transposeSemitone: 1,
} as const;
