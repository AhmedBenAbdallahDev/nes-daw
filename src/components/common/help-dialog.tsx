'use client';

import { SHORTCUT_COMMAND_LABELS } from '@/lib/shortcuts';
import { useDAWStore } from '@/store/daw-store';
import type { ShortcutCommand } from '@/types/engine';

export function HelpDialog() {
  const helpOpen = useDAWStore((state) => state.helpOpen);
  const setHelpOpen = useDAWStore((state) => state.setHelpOpen);
  const bindings = useDAWStore((state) => state.settings.shortcutConfig.bindings);

  if (!helpOpen) return null;

  const rows = (Object.keys(bindings) as ShortcutCommand[]).map((command) => ({
    command,
    label: SHORTCUT_COMMAND_LABELS[command],
    combo: bindings[command],
  }));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Help and shortcuts">
      <div className="modal">
        <header className="modal-header">
          <h3>Help & Shortcuts</h3>
          <button type="button" className="btn btn-ghost" onClick={() => setHelpOpen(false)}>
            Close
          </button>
        </header>

        <div className="modal-content settings-grid">
          <div className="help-shortcuts">
            {rows.map((row) => (
              <div key={row.command} className="help-shortcut-item">
                <span>{row.label}</span>
                <kbd>{row.combo}</kbd>
              </div>
            ))}
          </div>

          <div className="shortcut-warning">
            <strong>Start Here</strong>
            <div>1. Start with Strict NES Starter or Modern Starter from the boot screen.</div>
            <div>2. Connect MIDI, then map one knob or button in Settings &gt; MIDI.</div>
            <div>3. Add Intro, Loop Start, and Loop End markers to preview the game loop flow.</div>
            <div>4. Export a Project Report before sharing or bouncing the track.</div>
          </div>

          <div className="shortcut-warning">
            <strong>Mouse & Grid</strong>
            <div>Left click empty grid: add note</div>
            <div>Left click note: select + drag move/resize</div>
            <div>Right click note: delete note</div>
            <div>Shift + wheel: horizontal scroll</div>
            <div>Alt + wheel: timeline zoom</div>
          </div>

          <div className="shortcut-warning">
            <strong>MIDI Learn Quickstart</strong>
            <div>Settings &gt; MIDI: click Detect beside any target, then move a hardware control.</div>
            <div>Confirm Mapping to save it to project and device profile.</div>
            <div>Use routing mode Selected/Omni/Channel Map for your keyboard workflow.</div>
          </div>

          <div className="shortcut-warning">
            <strong>Test Song Notice</strong>
            <div>
              Bundled test song loader expects authorized files in `public/midi/megaman/`:
              `mega-man-2.mid`, `mega-man-3.mid`, `mega-man-4-title.mid`.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
