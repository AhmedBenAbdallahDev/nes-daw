'use client';

import { buildValidationSummary } from '@/services/validation-service';
import { useDAWStore } from '@/store/daw-store';

export function ValidationPanel() {
  const song = useDAWStore((state) => state.song);
  const settings = useDAWStore((state) => state.settings);
  const visible = useDAWStore((state) => state.settings.uiConfig.validationPanelVisible);
  const updateUISettings = useDAWStore((state) => state.updateUISettings);
  const setSelectedTrack = useDAWStore((state) => state.setSelectedTrack);
  const setCurrentTick = useDAWStore((state) => state.setCurrentTick);
  const setSettingsOpen = useDAWStore((state) => state.setSettingsOpen);

  if (!visible) {
    return (
      <div className="workflow-restore">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => updateUISettings({ validationPanelVisible: true })}
        >
          Show Validation
        </button>
      </div>
    );
  }

  const summary = buildValidationSummary(song, settings);

  return (
    <aside className="workflow-card validation-card" aria-label="Constraint inspector">
      <div className="workflow-card-header">
        <div>
          <h2>Constraint Inspector</h2>
          <p className="muted">
            {summary.errorCount} errors, {summary.warningCount} warnings, {summary.infoCount} info
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => updateUISettings({ validationPanelVisible: false })}
        >
          Hide
        </button>
      </div>

      <div className="validation-list">
        {summary.issues.length === 0 && <div className="muted">No workflow issues detected.</div>}
        {summary.issues.map((issue) => (
          <button
            key={issue.id}
            type="button"
            className={`validation-item severity-${issue.severity}`}
            onClick={() => {
              if (issue.trackId) setSelectedTrack(issue.trackId);
              if (typeof issue.tick === 'number') setCurrentTick(issue.tick);
              if (!issue.trackId && !issue.tick) setSettingsOpen(true);
            }}
          >
            <span className="validation-chip">{issue.severity}</span>
            <span>{issue.message}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
