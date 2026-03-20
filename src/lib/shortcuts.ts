import type { ShortcutBindingMap, ShortcutCommand, ShortcutConflict } from '@/types/engine';

export const SHORTCUT_COMMAND_LABELS: Record<ShortcutCommand, string> = {
  'transport.playPause': 'Play / Pause',
  'transport.stop': 'Stop',
  'transport.record': 'Record',
  'transport.loop': 'Toggle Loop',
  'editor.quantize.cycle': 'Cycle Quantize',
  'editor.note.delete': 'Delete Selected Notes',
  'editor.note.duplicate': 'Duplicate Selected Notes',
  'editor.note.quantize': 'Quantize Selected Notes',
  'editor.note.nudgeLeft': 'Nudge Selected Notes Left',
  'editor.note.nudgeRight': 'Nudge Selected Notes Right',
  'editor.note.transposeUp': 'Transpose Selected Notes Up',
  'editor.note.transposeDown': 'Transpose Selected Notes Down',
  'editor.undo': 'Undo',
  'editor.redo': 'Redo',
  'ui.settings.toggle': 'Toggle Settings',
  'ui.help.toggle': 'Toggle Help',
};

export const DEFAULT_SHORTCUT_BINDINGS: Record<ShortcutCommand, string> = {
  'transport.playPause': 'Space',
  'transport.stop': 'Shift+Space',
  'transport.record': 'Shift+KeyR',
  'transport.loop': 'Shift+KeyL',
  'editor.quantize.cycle': 'Shift+KeyQ',
  'editor.note.delete': 'Delete',
  'editor.note.duplicate': 'Ctrl+KeyD',
  'editor.note.quantize': 'Ctrl+Alt+KeyQ',
  'editor.note.nudgeLeft': 'Alt+ArrowLeft',
  'editor.note.nudgeRight': 'Alt+ArrowRight',
  'editor.note.transposeUp': 'Alt+ArrowUp',
  'editor.note.transposeDown': 'Alt+ArrowDown',
  'editor.undo': 'Ctrl+KeyZ',
  'editor.redo': 'Ctrl+Shift+KeyZ',
  'ui.settings.toggle': 'Comma',
  'ui.help.toggle': 'Slash',
};

const ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];

function normalizeKeyPart(key: string): string {
  const value = key.trim();
  if (!value) return '';

  const punctuationMap: Record<string, string> = {
    ' ': 'Space',
    ',': 'Comma',
    '.': 'Period',
    ';': 'Semicolon',
    "'": 'Quote',
    '/': 'Slash',
    '\\': 'Backslash',
    '-': 'Minus',
    '=': 'Equal',
  };

  if (punctuationMap[value]) return punctuationMap[value];

  if (value.length === 1) {
    return `Key${value.toUpperCase()}`;
  }

  if (/^Key[A-Z]$/.test(value)) return value;
  if (/^Digit[0-9]$/.test(value)) return value;

  const aliases: Record<string, string> = {
    ' ': 'Space',
    spacebar: 'Space',
    esc: 'Escape',
    del: 'Delete',
    ',': 'Comma',
    '.': 'Period',
    ';': 'Semicolon',
    "'": 'Quote',
  };

  return aliases[value.toLowerCase()] ?? value;
}

export function normalizeShortcutCombo(combo: string): string {
  const rawParts = combo
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  const mods = new Set<string>();
  let key = '';

  rawParts.forEach((part) => {
    const upper = part.toLowerCase();
    if (upper === 'ctrl' || upper === 'control') {
      mods.add('Ctrl');
      return;
    }
    if (upper === 'alt' || upper === 'option') {
      mods.add('Alt');
      return;
    }
    if (upper === 'shift') {
      mods.add('Shift');
      return;
    }
    if (upper === 'meta' || upper === 'cmd' || upper === 'command') {
      mods.add('Meta');
      return;
    }

    key = normalizeKeyPart(part);
  });

  const ordered = ORDER.filter((mod) => mods.has(mod));
  if (key) ordered.push(key);
  return ordered.join('+');
}

export function eventToShortcutCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');

  const key = event.code === 'Space' ? 'Space' : normalizeKeyPart(event.code || event.key);
  if (key) parts.push(key);

  return parts.join('+');
}

export function detectShortcutConflicts(
  bindings: ShortcutBindingMap
): ShortcutConflict[] {
  const byCombo = new Map<string, ShortcutCommand[]>();

  Object.entries(bindings).forEach(([command, combo]) => {
    const normalized = normalizeShortcutCombo(combo);
    if (!normalized) return;
    const list = byCombo.get(normalized) ?? [];
    list.push(command as ShortcutCommand);
    byCombo.set(normalized, list);
  });

  return Array.from(byCombo.entries())
    .filter(([, commands]) => commands.length > 1)
    .map(([combo, commands]) => ({ combo, commands }));
}

export function resolveShortcutCommand(
  bindings: Record<ShortcutCommand, string>,
  event: KeyboardEvent
): ShortcutCommand | null {
  const input = normalizeShortcutCombo(eventToShortcutCombo(event));
  const entry = (Object.entries(bindings) as [ShortcutCommand, string][]).find(
    ([, combo]) => normalizeShortcutCombo(combo) === input
  );

  return entry?.[0] ?? null;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.isContentEditable) return true;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
