'use client';

import { useAPUMonitor } from '@/hooks/use-apu-monitor';
import { useDAWStore } from '@/store/daw-store';

function waveformPath(values: number[]): string {
  if (values.length === 0) return '';
  return values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 50 - value * 38;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export function APUMonitorDock() {
  const visible = useDAWStore((state) => state.settings.uiConfig.monitorDockVisible);
  const updateUISettings = useDAWStore((state) => state.updateUISettings);
  const snapshot = useAPUMonitor();

  if (!visible) {
    return (
      <div className="workflow-restore">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => updateUISettings({ monitorDockVisible: true })}
        >
          Show APU Monitor
        </button>
      </div>
    );
  }

  return (
    <section className="monitor-dock" aria-label="APU monitor">
      <div className="workflow-card-header">
        <div>
          <h2>APU Monitor</h2>
          <p className="muted">
            {snapshot ? `${snapshot.transportState} | master ${(snapshot.masterLevel * 100).toFixed(0)}%` : 'Waiting for audio'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => updateUISettings({ monitorDockVisible: false })}
        >
          Hide
        </button>
      </div>

      <div className="monitor-waveform">
        <svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
          <path d={waveformPath(snapshot?.waveform ?? [])} />
        </svg>
      </div>

      <div className="monitor-channels">
        {(snapshot?.channels ?? []).map((channel) => (
          <div key={channel.channel} className="monitor-channel">
            <div className="monitor-channel-meta">
              <strong>{channel.label}</strong>
              <span>{channel.activeVoices} voices</span>
            </div>
            <div className="monitor-meter">
              <div className="monitor-meter-fill" style={{ width: `${channel.level * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
