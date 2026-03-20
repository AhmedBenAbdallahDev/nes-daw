import { describe, expect, test } from 'bun:test';
import {
  applyMidiMessage,
  bindFromCapturedMessage,
  parseMIDIMessage,
  startMidiLearn,
  upsertMidiBinding,
} from './midi-control-service';

describe('midi-control-service', () => {
  test('parses CC and realtime transport messages', () => {
    const cc = parseMIDIMessage(new Uint8Array([0xb0, 74, 100]), {
      deviceId: 'dev-1',
      deviceName: 'Controller',
    });
    expect(cc?.messageType).toBe('cc');
    expect(cc?.channel).toBe(1);
    expect(cc?.controller).toBe(74);
    expect(Math.round((cc?.normalizedValue ?? 0) * 100)).toBe(79);

    const start = parseMIDIMessage(new Uint8Array([0xfa]), {
      deviceId: 'dev-1',
      deviceName: 'Controller',
    });
    expect(start?.messageType).toBe('transport-start');
    expect(start?.normalizedValue).toBe(1);
  });

  test('captures MIDI learn and binds to target', () => {
    const learn = startMidiLearn('track.volume', 'track-1', 5000);
    expect(learn.state).toBe('listening');

    const captured = parseMIDIMessage(new Uint8Array([0xb1, 7, 90]), {
      deviceId: 'dev-2',
      deviceName: 'Fader Box',
    });
    if (!captured) throw new Error('missing capture');

    const binding = bindFromCapturedMessage(captured, 'track.volume', { trackId: 'track-1' });
    expect(binding.target).toBe('track.volume');
    expect(binding.trackId).toBe('track-1');
    expect(binding.source.channel).toBe(2);
    expect(binding.source.controllerOrNote).toBe(7);
  });

  test('applies matched bindings and resolves upsert conflicts', () => {
    const captured = parseMIDIMessage(new Uint8Array([0xb0, 7, 127]), {
      deviceId: 'dev-3',
      deviceName: 'Mix Knobs',
    });
    if (!captured) throw new Error('missing capture');

    const first = bindFromCapturedMessage(captured, 'global.masterVolume');
    const second = { ...first, id: 'override', label: 'Override' };
    const merged = upsertMidiBinding([first], second);
    expect(merged.length).toBe(1);
    expect(merged[0]?.id).toBe('override');

    const applied = applyMidiMessage(captured, merged);
    expect(applied.length).toBe(1);
    expect(applied[0]?.target).toBe('global.masterVolume');
    expect(applied[0]?.value).toBe(1);
  });
});
