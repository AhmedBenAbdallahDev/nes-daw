import type { AppErrorCode } from '@/types/engine';

const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  'midi.permission-denied': 'MIDI permission denied. Enable WebMIDI access and reconnect your device.',
  'midi.unavailable': 'Web MIDI API is unavailable in this browser.',
  'midi.device-disconnected': 'The active MIDI device was disconnected.',
  'midi.learn-timeout': 'MIDI learn timed out before a supported message was captured.',
  'midi.unsupported-message': 'Unsupported MIDI message type was received.',
  'project.corrupted': 'Project file is corrupted or malformed.',
  'project.migration-failed': 'Project migration failed due to unsupported schema data.',
  'import.failed': 'Import failed. The file format may be invalid.',
  'export.failed': 'Export failed. Please try again.',
};

export function errorMessageFromCode(code: AppErrorCode): string {
  return ERROR_MESSAGES[code];
}
