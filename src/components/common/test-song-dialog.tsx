'use client';

import {
  getBundledTestProjectTemplates,
  type BundledTestProjectTemplate,
  type TestProjectTemplateId,
} from '@/services/test-projects';

interface TestSongDialogProps {
  open: boolean;
  loadingTemplateId: TestProjectTemplateId | null;
  onClose: () => void;
  onLoadTemplate: (templateId: TestProjectTemplateId) => void;
}

export function TestSongDialog({
  open,
  loadingTemplateId,
  onClose,
  onLoadTemplate,
}: TestSongDialogProps) {
  if (!open) return null;

  const templates: BundledTestProjectTemplate[] = getBundledTestProjectTemplates();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Bundled test songs">
      <div className="modal">
        <header className="modal-header">
          <h3>Bundled Test Songs</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="modal-content settings-grid">
          <div className="shortcut-warning">
            <strong>MIDI Asset Paths</strong>
            <div>Place authorized MIDI files in `public/midi/megaman/` with the exact names below.</div>
          </div>

          {templates.map((template) => (
            <article key={template.id} className="midi-learn-row">
              <div>
                <strong>{template.name}</strong>
                <p className="muted">{template.description}</p>
                <p className="muted">Path: {template.path}</p>
              </div>
              <div className="midi-learn-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => onLoadTemplate(template.id)}
                  disabled={loadingTemplateId !== null}
                >
                  {loadingTemplateId === template.id ? 'Loading...' : 'Load'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
