export type AppMode = 'strict' | 'modern';

export type NESChannel = 'pulse1' | 'pulse2' | 'triangle' | 'noise' | 'dpcm';
export type TrackChannel = NESChannel | 'modern';

export type EngineType =
  | 'nes'
  | 'dpcm'
  | 'saw'
  | 'sine'
  | 'fm-lite'
  | 'modern-noise';

export type DutyCycle = 0.125 | 0.25 | 0.5 | 0.75;

export interface EnvelopeParams {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface Instrument {
  id: string;
  name: string;
  channel: TrackChannel;
  engineType: EngineType;
  dutyCycle?: DutyCycle;
  envelope: EnvelopeParams;
  noiseMode?: 'long' | 'short';
  dutyCycleSequence?: DutyCycle[];
  dutyCycleSwitchFrames?: number;
  vibratoSpeed?: number;
  vibratoDepth?: number;
  arpeggioPattern?: number[];
  arpeggioSpeed?: number;
}

export interface Note {
  id: string;
  midiNote: number;
  startTick: number;
  durationTicks: number;
  velocity: number;
}

export interface Pattern {
  id: string;
  name: string;
  lengthTicks: number;
  notes: Note[];
}

export type OnboardingStep =
  | 'mode'
  | 'audio'
  | 'midi'
  | 'test-song'
  | 'controller-map'
  | 'first-loop';

export interface OnboardingChecklistState {
  completedSteps: OnboardingStep[];
  dismissed: boolean;
}

export type StarterTemplate = 'strict-nes' | 'modern' | 'test-song';

export type MIDIEnvelopeType =
  | 'note-on'
  | 'note-off'
  | 'cc'
  | 'pitch-bend'
  | 'aftertouch'
  | 'transport-start'
  | 'transport-stop'
  | 'transport-continue'
  | 'unknown';

export interface MIDIMessageEnvelope {
  messageType: MIDIEnvelopeType;
  status: number;
  channel: number | null;
  note: number | null;
  controller: number | null;
  value: number;
  normalizedValue: number;
  velocity: number | null;
  rawData: number[];
  timestamp: number;
  deviceId: string | null;
  deviceName: string | null;
}

export type MidiBindingTarget =
  | 'transport.play'
  | 'transport.stop'
  | 'transport.record'
  | 'global.masterVolume'
  | 'global.tempo'
  | 'track.volume'
  | 'track.mute'
  | 'track.solo'
  | 'selectedTrack.macro1'
  | 'selectedTrack.macro2'
  | 'selectedTrack.macro3'
  | 'selectedTrack.macro4';

export interface MidiBindingSourceMatcher {
  messageType: MIDIEnvelopeType;
  channel: number | 'any';
  controllerOrNote: number | null;
  deviceId: string | null;
}

export interface MidiBinding {
  id: string;
  label: string;
  target: MidiBindingTarget;
  trackId: string | null;
  source: MidiBindingSourceMatcher;
  min: number;
  max: number;
  inverted: boolean;
  takeover: 'jump' | 'pickup';
}

export interface MidiProfile {
  id: string;
  name: string;
  deviceFingerprint: string;
  bindings: MidiBinding[];
  updatedAt: string;
}

export type MidiLearnState = 'idle' | 'listening' | 'captured' | 'confirmed' | 'timeout' | 'error';

export interface MidiLearnSession {
  state: MidiLearnState;
  target: MidiBindingTarget | null;
  trackId: string | null;
  startedAt: number | null;
  timeoutAt: number | null;
  captured: MIDIMessageEnvelope | null;
  error: string | null;
}

export type AutomationTarget =
  | 'global.masterVolume'
  | 'global.tempo'
  | 'track.volume'
  | 'track.mute'
  | 'track.solo'
  | 'selectedTrack.macro1'
  | 'selectedTrack.macro2'
  | 'selectedTrack.macro3'
  | 'selectedTrack.macro4';

export interface AutomationPoint {
  id: string;
  tick: number;
  value: number;
}

export interface AutomationLane {
  id: string;
  target: AutomationTarget;
  trackId: string | null;
  points: AutomationPoint[];
}

export interface PatternInstance {
  id: string;
  patternId: string;
  startTick: number;
  lengthTicks: number;
}

export interface SectionMarker {
  id: string;
  label: string;
  startTick: number;
  color: string;
  role?: 'intro' | 'loop-start' | 'loop-end' | 'boss' | 'stinger' | 'custom';
}

export interface ArrangementLane {
  trackId: string;
  instances: PatternInstance[];
}

export interface SongArrangement {
  lanes: ArrangementLane[];
  sectionMarkers: SectionMarker[];
  lengthTicks: number;
}

export interface Track {
  id: string;
  name: string;
  channel: TrackChannel;
  engineType: EngineType;
  instrumentId: string;
  patterns: Pattern[];
  activePatternIndex: number;
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface SongConstraints {
  enforcePolyphonyLimit: boolean;
  maxVoicesPerTrack: number;
  clampMidiRange: boolean;
  enforceChannelLimits: boolean;
  enforceInstrumentCompatibility: boolean;
}

export interface Song {
  id: string;
  version: number;
  name: string;
  bpm: number;
  ppqn: number;
  tracks: Track[];
  arrangement: SongArrangement;
  automationLanes: AutomationLane[];
  midiProjectBindings: MidiBinding[];
  midiChannelMap: Record<number, string>;
  constraints: SongConstraints;
}

export type TransportState = 'stopped' | 'playing' | 'recording' | 'paused';
export type PlaybackPreviewMode = 'full-song' | 'intro-to-loop' | 'loop-only';

export type Quantize = '1/4' | '1/8' | '1/16' | '1/32';

export interface PianoRollViewState {
  scrollX: number;
  scrollY: number;
  zoomX: number;
  zoomY: number;
  quantize: Quantize;
  selectedNoteIds: string[];
  activeTrackId: string | null;
}

export type ShortcutCommand =
  | 'transport.playPause'
  | 'transport.stop'
  | 'transport.record'
  | 'transport.loop'
  | 'editor.quantize.cycle'
  | 'editor.note.delete'
  | 'editor.note.duplicate'
  | 'editor.note.quantize'
  | 'editor.note.nudgeLeft'
  | 'editor.note.nudgeRight'
  | 'editor.note.transposeUp'
  | 'editor.note.transposeDown'
  | 'editor.undo'
  | 'editor.redo'
  | 'ui.settings.toggle'
  | 'ui.help.toggle';

export interface ShortcutBindingMap {
  [command: string]: string;
}

export interface ShortcutConflict {
  combo: string;
  commands: ShortcutCommand[];
}

export interface ShortcutConfig {
  bindings: Record<ShortcutCommand, string>;
  conflicts: ShortcutConflict[];
}

export interface StrictModeConfig {
  enableAuthenticLimits: boolean;
  maxChannels: number;
  enableDpcm: boolean;
  maxPolyphonyPerChannel: number;
  enforceChannelUniqueness: boolean;
}

export interface ModernModeConfig {
  maxTracks: number;
  enabledEngines: EngineType[];
  allowUnlimitedChannels: boolean;
  allowPolyphony: boolean;
}

export interface AudioSettings {
  masterVolume: number;
  latencyHint: AudioContextLatencyCategory;
}

export type MIDIRoutingMode = 'selected-track' | 'omni' | 'channel-map';
export type MidiProfilePreference = 'project-first' | 'device-first';

export interface MidiSettings {
  defaultQuantize: Quantize;
  autoMapPercussionToNoise: boolean;
  defaultTranspose: number;
  routingMode: MIDIRoutingMode;
  transportRealtimeEnabled: boolean;
  learnTimeoutMs: number;
  writeAutomationOnRecord: boolean;
  profilePreference: MidiProfilePreference;
  selectedProfileId: string | null;
}

export interface UISettings {
  theme: 'retro-modern';
  motionEnabled: boolean;
  density: 'compact' | 'comfortable';
  showOnboardingChecklist: boolean;
  monitorDockVisible: boolean;
  validationPanelVisible: boolean;
  reportFormatDefault: 'markdown' | 'html';
  onboardingChecklist: OnboardingChecklistState;
}

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrastFocus: boolean;
}

export interface AppSettings {
  mode: AppMode;
  strictConfig: StrictModeConfig;
  modernConfig: ModernModeConfig;
  shortcutConfig: ShortcutConfig;
  uiConfig: UISettings;
  audioConfig: AudioSettings;
  midiConfig: MidiSettings;
  accessibilityConfig: AccessibilitySettings;
}

export interface MIDITrackPreview {
  index: number;
  name: string;
  noteCount: number;
  durationTicks: number;
  isPercussion: boolean;
}

export interface MIDIImportTrackMapping {
  sourceTrackIndex: number;
  targetTrackId: string;
}

export interface MIDIImportOptions {
  transpose: number;
  quantize: Quantize;
  clampToNesRange: boolean;
  trackMappings: MIDIImportTrackMapping[];
  velocityScale: number;
}

export interface ValidationIssue {
  id: string;
  severity: 'info' | 'warning' | 'error';
  code:
    | 'missing-loop-markers'
    | 'range-violation'
    | 'polyphony-risk'
    | 'channel-engine-mismatch'
    | 'unmapped-midi-channel'
    | 'empty-arrangement-lane'
    | 'missing-test-song'
    | 'missing-midi-mapping';
  message: string;
  trackId?: string | null;
  markerId?: string | null;
  tick?: number | null;
}

export interface ValidationSummary {
  issues: ValidationIssue[];
  infoCount: number;
  warningCount: number;
  errorCount: number;
}

export interface ProjectReport {
  generatedAt: string;
  songName: string;
  mode: AppMode;
  bpm: number;
  previewMode: PlaybackPreviewMode;
  trackCount: number;
  markers: Array<{
    label: string;
    role: SectionMarker['role'];
    startTick: number;
  }>;
  midiProfiles: Array<{
    id: string;
    name: string;
    bindingCount: number;
  }>;
  bindings: Array<{
    label: string;
    target: MidiBindingTarget;
    trackId: string | null;
  }>;
  validation: ValidationSummary;
  exportNotes: string[];
}

export interface ChannelMonitorSnapshot {
  channel: TrackChannel;
  label: string;
  level: number;
  activeVoices: number;
}

export interface APUMonitorSnapshot {
  masterLevel: number;
  transportState: TransportState;
  waveform: number[];
  channels: ChannelMonitorSnapshot[];
}

export type AppErrorCode =
  | 'midi.permission-denied'
  | 'midi.unavailable'
  | 'midi.device-disconnected'
  | 'midi.learn-timeout'
  | 'midi.unsupported-message'
  | 'project.corrupted'
  | 'project.migration-failed'
  | 'import.failed'
  | 'export.failed';
