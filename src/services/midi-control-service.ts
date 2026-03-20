import { generateId } from '@/lib/song-utils';
import type {
  MIDIEnvelopeType,
  MIDIMessageEnvelope,
  MidiBinding,
  MidiBindingSourceMatcher,
  MidiBindingTarget,
  MidiLearnSession,
} from '@/types/engine';

export interface ParsedMIDIMessageMeta {
  timestamp?: number;
  deviceId?: string | null;
  deviceName?: string | null;
}

export interface AppliedMidiBinding {
  bindingId: string;
  target: MidiBindingTarget;
  trackId: string | null;
  value: number;
  message: MIDIMessageEnvelope;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function messageTypeFromStatus(status: number): MIDIEnvelopeType {
  switch (status) {
    case 0xfa:
      return 'transport-start';
    case 0xfb:
      return 'transport-continue';
    case 0xfc:
      return 'transport-stop';
    default:
      break;
  }

  const command = status & 0xf0;
  switch (command) {
    case 0x80:
      return 'note-off';
    case 0x90:
      return 'note-on';
    case 0xb0:
      return 'cc';
    case 0xd0:
      return 'aftertouch';
    case 0xe0:
      return 'pitch-bend';
    default:
      return 'unknown';
  }
}

export function parseMIDIMessage(
  data: Uint8Array,
  meta: ParsedMIDIMessageMeta = {}
): MIDIMessageEnvelope | null {
  if (!data || data.length < 1) return null;

  const status = data[0] ?? 0;
  const messageType = messageTypeFromStatus(status);
  const channel = status >= 0xf0 ? null : (status & 0x0f) + 1;
  const data1 = data[1] ?? 0;
  const data2 = data[2] ?? 0;

  if (messageType === 'unknown') {
    return {
      messageType,
      status,
      channel,
      note: null,
      controller: null,
      value: data2,
      normalizedValue: clamp01(data2 / 127),
      velocity: null,
      rawData: Array.from(data),
      timestamp: meta.timestamp ?? performance.now(),
      deviceId: meta.deviceId ?? null,
      deviceName: meta.deviceName ?? null,
    };
  }

  if (messageType === 'transport-start' || messageType === 'transport-stop' || messageType === 'transport-continue') {
    return {
      messageType,
      status,
      channel: null,
      note: null,
      controller: null,
      value: 127,
      normalizedValue: 1,
      velocity: null,
      rawData: Array.from(data),
      timestamp: meta.timestamp ?? performance.now(),
      deviceId: meta.deviceId ?? null,
      deviceName: meta.deviceName ?? null,
    };
  }

  if (messageType === 'pitch-bend') {
    const bendValue = ((data2 << 7) | data1) - 8192;
    const normalized = clamp01((bendValue + 8192) / 16383);
    return {
      messageType,
      status,
      channel,
      note: null,
      controller: null,
      value: bendValue,
      normalizedValue: normalized,
      velocity: null,
      rawData: Array.from(data),
      timestamp: meta.timestamp ?? performance.now(),
      deviceId: meta.deviceId ?? null,
      deviceName: meta.deviceName ?? null,
    };
  }

  if (messageType === 'aftertouch') {
    return {
      messageType,
      status,
      channel,
      note: null,
      controller: null,
      value: data1,
      normalizedValue: clamp01(data1 / 127),
      velocity: data1,
      rawData: Array.from(data),
      timestamp: meta.timestamp ?? performance.now(),
      deviceId: meta.deviceId ?? null,
      deviceName: meta.deviceName ?? null,
    };
  }

  if (messageType === 'cc') {
    return {
      messageType,
      status,
      channel,
      note: null,
      controller: data1,
      value: data2,
      normalizedValue: clamp01(data2 / 127),
      velocity: null,
      rawData: Array.from(data),
      timestamp: meta.timestamp ?? performance.now(),
      deviceId: meta.deviceId ?? null,
      deviceName: meta.deviceName ?? null,
    };
  }

  const noteOn = messageType === 'note-on' && data2 > 0;
  const finalType: MIDIEnvelopeType =
    messageType === 'note-on' && data2 === 0 ? 'note-off' : messageType;

  return {
    messageType: finalType,
    status,
    channel,
    note: data1,
    controller: null,
    value: data2,
    normalizedValue: clamp01(data2 / 127),
    velocity: noteOn ? data2 : data2,
    rawData: Array.from(data),
    timestamp: meta.timestamp ?? performance.now(),
    deviceId: meta.deviceId ?? null,
    deviceName: meta.deviceName ?? null,
  };
}

export function createMidiSourceMatcher(message: MIDIMessageEnvelope): MidiBindingSourceMatcher {
  const controllerOrNote =
    message.messageType === 'cc'
      ? message.controller
      : message.messageType === 'note-on' || message.messageType === 'note-off'
        ? message.note
        : null;

  return {
    messageType: message.messageType,
    channel: message.channel ?? 'any',
    controllerOrNote,
    deviceId: message.deviceId ?? null,
  };
}

export function startMidiLearn(
  target: MidiBindingTarget,
  trackId: string | null,
  timeoutMs: number
): MidiLearnSession {
  const now = Date.now();
  return {
    state: 'listening',
    target,
    trackId,
    startedAt: now,
    timeoutAt: now + timeoutMs,
    captured: null,
    error: null,
  };
}

export function cancelMidiLearn(): MidiLearnSession {
  return {
    state: 'idle',
    target: null,
    trackId: null,
    startedAt: null,
    timeoutAt: null,
    captured: null,
    error: null,
  };
}

export function captureMidiLearnMessage(
  session: MidiLearnSession,
  message: MIDIMessageEnvelope
): MidiLearnSession {
  if (session.state !== 'listening') return session;

  if (message.messageType === 'unknown' || message.messageType === 'note-off') {
    return session;
  }

  return {
    ...session,
    state: 'captured',
    captured: message,
  };
}

export function expireMidiLearnSession(session: MidiLearnSession): MidiLearnSession {
  if (session.state !== 'listening') return session;
  return {
    ...session,
    state: 'timeout',
    error: 'MIDI learn timed out before receiving a supported message.',
  };
}

export function bindFromCapturedMessage(
  captured: MIDIMessageEnvelope,
  target: MidiBindingTarget,
  options?: { trackId?: string | null; label?: string }
): MidiBinding {
  return {
    id: generateId(),
    label:
      options?.label ??
      `${target} <= ${captured.messageType}${captured.controller !== null ? ` ${captured.controller}` : ''}`,
    target,
    trackId: options?.trackId ?? null,
    source: createMidiSourceMatcher(captured),
    min: 0,
    max: 1,
    inverted: false,
    takeover: 'jump',
  };
}

export function midiDeviceFingerprint(deviceId: string | null, deviceName: string | null): string {
  const name = deviceName?.trim().toLowerCase() ?? 'unknown-device';
  const id = deviceId?.trim().toLowerCase() ?? 'unknown-id';
  return `${name}::${id}`;
}

export function messageMatchesBinding(binding: MidiBinding, message: MIDIMessageEnvelope): boolean {
  if (binding.source.messageType !== message.messageType) return false;

  if (binding.source.deviceId && message.deviceId && binding.source.deviceId !== message.deviceId) {
    return false;
  }

  if (binding.source.channel !== 'any' && binding.source.channel !== (message.channel ?? -1)) {
    return false;
  }

  const expected = binding.source.controllerOrNote;
  if (expected === null) return true;

  if (message.messageType === 'cc') return message.controller === expected;
  if (message.messageType === 'note-on' || message.messageType === 'note-off') {
    return message.note === expected;
  }

  return true;
}

export function mapBindingValue(binding: MidiBinding, message: MIDIMessageEnvelope): number {
  const source = clamp01(message.normalizedValue);
  const scaled = binding.min + source * (binding.max - binding.min);
  return binding.inverted ? binding.max - (scaled - binding.min) : scaled;
}

function bindingMatcherKey(binding: MidiBinding): string {
  const { source } = binding;
  return [
    source.deviceId ?? '*',
    source.messageType,
    String(source.channel),
    String(source.controllerOrNote),
    binding.target,
    binding.trackId ?? '*',
  ].join(':');
}

export function upsertMidiBinding(bindings: MidiBinding[], next: MidiBinding): MidiBinding[] {
  const key = bindingMatcherKey(next);
  const filtered = bindings.filter((binding) => bindingMatcherKey(binding) !== key);
  return [...filtered, next];
}

export function applyMidiMessage(
  message: MIDIMessageEnvelope,
  bindings: MidiBinding[]
): AppliedMidiBinding[] {
  return bindings
    .filter((binding) => messageMatchesBinding(binding, message))
    .map((binding) => ({
      bindingId: binding.id,
      target: binding.target,
      trackId: binding.trackId,
      value: mapBindingValue(binding, message),
      message,
    }));
}
