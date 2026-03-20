'use client';

import { NOTE_OPERATION_DEFAULTS } from '@/lib/constants';
import { useDAWStore } from '@/store/daw-store';

export function EditorToolbar() {
  const selectedCount = useDAWStore((state) => state.pianoRollView.selectedNoteIds.length);
  const duplicateSelectedNotes = useDAWStore((state) => state.duplicateSelectedNotes);
  const quantizeSelectedNotes = useDAWStore((state) => state.quantizeSelectedNotes);
  const nudgeSelectedNotes = useDAWStore((state) => state.nudgeSelectedNotes);
  const transposeSelectedNotes = useDAWStore((state) => state.transposeSelectedNotes);
  const undo = useDAWStore((state) => state.undo);
  const redo = useDAWStore((state) => state.redo);
  const setHelpOpen = useDAWStore((state) => state.setHelpOpen);

  const disabled = selectedCount === 0;

  return (
    <div className="editor-toolbar" aria-label="Editor quick actions">
      <span className="editor-toolbar-count">Selected: {selectedCount}</span>

      <button type="button" className="btn btn-ghost" onClick={undo}>
        Undo
      </button>
      <button type="button" className="btn btn-ghost" onClick={redo}>
        Redo
      </button>

      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled}
        onClick={duplicateSelectedNotes}
        title="Duplicate selected notes (Ctrl+D)"
      >
        Duplicate
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled}
        onClick={quantizeSelectedNotes}
        title="Quantize selected notes"
      >
        Quantize
      </button>

      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled}
        onClick={() => nudgeSelectedNotes(-NOTE_OPERATION_DEFAULTS.nudgeTicks)}
        title="Nudge left (Alt+Left)"
      >
        Nudge -
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled}
        onClick={() => nudgeSelectedNotes(NOTE_OPERATION_DEFAULTS.nudgeTicks)}
        title="Nudge right (Alt+Right)"
      >
        Nudge +
      </button>

      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled}
        onClick={() => transposeSelectedNotes(-NOTE_OPERATION_DEFAULTS.transposeSemitone)}
        title="Transpose down (Alt+Down)"
      >
        Transpose -
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={disabled}
        onClick={() => transposeSelectedNotes(NOTE_OPERATION_DEFAULTS.transposeSemitone)}
        title="Transpose up (Alt+Up)"
      >
        Transpose +
      </button>

      <button type="button" className="btn" onClick={() => setHelpOpen(true)}>
        Help
      </button>
    </div>
  );
}
