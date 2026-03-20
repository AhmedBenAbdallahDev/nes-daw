import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SHORTCUT_BINDINGS,
  detectShortcutConflicts,
  normalizeShortcutCombo,
} from './shortcuts';

describe('shortcuts', () => {
  test('normalizes modifier ordering and aliases', () => {
    expect(normalizeShortcutCombo('shift + ctrl + z')).toBe('Ctrl+Shift+KeyZ');
    expect(normalizeShortcutCombo('cmd + ,')).toBe('Meta+Comma');
    expect(normalizeShortcutCombo('spacebar')).toBe('Space');
  });

  test('detects conflicts', () => {
    const bindings = {
      ...DEFAULT_SHORTCUT_BINDINGS,
      'transport.record': 'KeyR',
      'transport.loop': 'KeyR',
    };

    const conflicts = detectShortcutConflicts(bindings);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]?.combo).toBe('KeyR');
    expect(conflicts[0]?.commands).toContain('transport.record');
    expect(conflicts[0]?.commands).toContain('transport.loop');
  });
});
