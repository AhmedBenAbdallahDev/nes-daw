'use client';

import { useCallback, useEffect, useRef } from 'react';
import { scheduler } from '@/audio/scheduler';
import { transportController } from '@/audio/transport-controller';
import { NOTE_OPERATION_DEFAULTS } from '@/lib/constants';
import { isEditableTarget, resolveShortcutCommand } from '@/lib/shortcuts';
import { useDAWStore } from '@/store/daw-store';
import { useNESEngine } from './use-nes-engine';

const LOWER_ROW: Record<string, number> = {
  KeyZ: 48,
  KeyS: 49,
  KeyX: 50,
  KeyD: 51,
  KeyC: 52,
  KeyV: 53,
  KeyG: 54,
  KeyB: 55,
  KeyH: 56,
  KeyN: 57,
  KeyJ: 58,
  KeyM: 59,
};

const UPPER_ROW: Record<string, number> = {
  KeyQ: 60,
  Digit2: 61,
  KeyW: 62,
  Digit3: 63,
  KeyE: 64,
  KeyR: 65,
  Digit5: 66,
  KeyT: 67,
  Digit6: 68,
  KeyY: 69,
  Digit7: 70,
  KeyU: 71,
  KeyI: 72,
  Digit9: 73,
  KeyO: 74,
  Digit0: 75,
  KeyP: 76,
};

const KEY_MAP: Record<string, number> = { ...LOWER_ROW, ...UPPER_ROW };
const QUANTIZE_SEQUENCE = ['1/4', '1/8', '1/16', '1/32'] as const;

export function useKeyboard() {
  const { playTrackNote, stopNote, isReady, stopChannel } = useNESEngine();
  const voiceMapRef = useRef<Map<string, number>>(new Map());
  const recordStartTickRef = useRef<Map<string, { midiNote: number; tick: number }>>(new Map());

  const executeShortcutCommand = useCallback((command: string) => {
    const state = useDAWStore.getState();

    switch (command) {
      case 'transport.playPause':
        transportController.togglePlayPause();
        break;
      case 'transport.stop':
        transportController.stop();
        break;
      case 'transport.record':
        transportController.record();
        break;
      case 'transport.loop':
        state.toggleLoop();
        break;
      case 'editor.quantize.cycle': {
        const currentIndex = QUANTIZE_SEQUENCE.indexOf(state.pianoRollView.quantize);
        const next = QUANTIZE_SEQUENCE[(currentIndex + 1) % QUANTIZE_SEQUENCE.length];
        state.setQuantize(next);
        break;
      }
      case 'editor.note.delete': {
        const ids = state.pianoRollView.selectedNoteIds;
        ids.forEach((id) => state.removeNote(state.selectedTrackId, id));
        state.clearSelection();
        break;
      }
      case 'editor.note.duplicate':
        state.duplicateSelectedNotes();
        break;
      case 'editor.note.quantize':
        state.quantizeSelectedNotes();
        break;
      case 'editor.note.nudgeLeft':
        state.nudgeSelectedNotes(-NOTE_OPERATION_DEFAULTS.nudgeTicks);
        break;
      case 'editor.note.nudgeRight':
        state.nudgeSelectedNotes(NOTE_OPERATION_DEFAULTS.nudgeTicks);
        break;
      case 'editor.note.transposeUp':
        state.transposeSelectedNotes(NOTE_OPERATION_DEFAULTS.transposeSemitone);
        break;
      case 'editor.note.transposeDown':
        state.transposeSelectedNotes(-NOTE_OPERATION_DEFAULTS.transposeSemitone);
        break;
      case 'editor.undo':
        state.undo();
        break;
      case 'editor.redo':
        state.redo();
        break;
      case 'ui.settings.toggle':
        state.setSettingsOpen(!state.settingsOpen);
        break;
      case 'ui.help.toggle':
        state.setHelpOpen(!state.helpOpen);
        break;
      default:
        break;
    }
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isReady) return;
      if (event.repeat) return;

      const state = useDAWStore.getState();
      const command = resolveShortcutCommand(state.settings.shortcutConfig.bindings, event);
      const editable = isEditableTarget(event.target);

      if (command) {
        if (!editable || command.startsWith('transport.') || command.startsWith('ui.')) {
          event.preventDefault();
          executeShortcutCommand(command);
          return;
        }
      }

      if (editable) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const midiNote = KEY_MAP[event.code];
      if (midiNote === undefined) return;
      if (voiceMapRef.current.has(event.code)) return;

      const track = state.song.tracks.find((item) => item.id === state.selectedTrackId);
      if (!track) return;

      const voiceId = playTrackNote(track, midiNote, 100);
      if (voiceId !== -1) {
        voiceMapRef.current.set(event.code, voiceId);
      }

      if (state.transportState === 'recording') {
        recordStartTickRef.current.set(event.code, {
          midiNote,
          tick: scheduler.getCurrentTick(),
        });
      }
    },
    [executeShortcutCommand, isReady, playTrackNote]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      const voiceId = voiceMapRef.current.get(event.code);
      if (voiceId !== undefined) {
        stopNote(voiceId);
        voiceMapRef.current.delete(event.code);
      }

      const recordEntry = recordStartTickRef.current.get(event.code);
      if (!recordEntry) return;

      recordStartTickRef.current.delete(event.code);
      const state = useDAWStore.getState();
      if (state.transportState !== 'recording') return;

      const endTick = scheduler.getCurrentTick();
      const durationTicks = Math.max(1, endTick - recordEntry.tick);
      state.addNote(state.selectedTrackId, {
        midiNote: recordEntry.midiNote,
        startTick: recordEntry.tick,
        durationTicks,
        velocity: 100,
      });
    },
    [stopNote]
  );

  const stopAllHeldNotes = useCallback(() => {
    const state = useDAWStore.getState();
    const track = state.song.tracks.find((item) => item.id === state.selectedTrackId);
    if (track) stopChannel(track.channel);
    voiceMapRef.current.clear();
    recordStartTickRef.current.clear();
  }, [stopChannel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopAllHeldNotes);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopAllHeldNotes);
    };
  }, [handleKeyDown, handleKeyUp, stopAllHeldNotes]);
}
