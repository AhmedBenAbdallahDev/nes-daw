import { describe, expect, test } from 'bun:test';
import {
  clampMidiByMode,
  quantizeTick,
  ticksPerQuantize,
} from './song-utils';

describe('song utils', () => {
  test('quantize values', () => {
    expect(ticksPerQuantize(96, '1/4')).toBe(96);
    expect(ticksPerQuantize(96, '1/16')).toBe(24);
    expect(quantizeTick(35, 96, '1/16')).toBe(24);
    expect(quantizeTick(49, 96, '1/16')).toBe(48);
  });

  test('strict mode MIDI clamping', () => {
    expect(clampMidiByMode(10, 'strict', true)).toBe(24);
    expect(clampMidiByMode(120, 'strict', true)).toBe(108);
    expect(clampMidiByMode(120, 'modern', true)).toBe(120);
    expect(clampMidiByMode(-1, 'modern', true)).toBe(0);
  });
});
