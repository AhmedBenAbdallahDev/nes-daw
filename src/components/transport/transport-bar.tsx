'use client';

import { useRef } from 'react';
import { APP_VERSION } from '@/lib/constants';
import { useDAWStore } from '@/store/daw-store';
import type { PlaybackPreviewMode, Quantize } from '@/types/engine';

const QUANTIZE_OPTIONS: Quantize[] = ['1/4', '1/8', '1/16', '1/32'];
const PREVIEW_OPTIONS: PlaybackPreviewMode[] = ['full-song', 'intro-to-loop', 'loop-only'];

interface TransportBarProps {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onNewProject: () => void;
  onOpenMidiImport: () => void;
  onLoadTestSong: () => void;
  onSaveProject: () => void;
  onLoadProject: (file: File) => void;
  onExportMidi: () => void;
  onExportWav: () => void;
  onExportReport: () => void;
  onToggleSettings: () => void;
  onOpenHelp: () => void;
  exportingWav?: boolean;
}

export function TransportBar({
  onPlay,
  onPause,
  onStop,
  onRecord,
  onNewProject,
  onOpenMidiImport,
  onLoadTestSong,
  onSaveProject,
  onLoadProject,
  onExportMidi,
  onExportWav,
  onExportReport,
  onToggleSettings,
  onOpenHelp,
  exportingWav = false,
}: TransportBarProps) {
  const song = useDAWStore((state) => state.song);
  const transportState = useDAWStore((state) => state.transportState);
  const currentTick = useDAWStore((state) => state.currentTick);
  const bpm = useDAWStore((state) => state.bpm);
  const loopEnabled = useDAWStore((state) => state.loopEnabled);
  const midiConnected = useDAWStore((state) => state.midiConnected);
  const midiDeviceName = useDAWStore((state) => state.midiDeviceName);
  const quantize = useDAWStore((state) => state.pianoRollView.quantize);
  const playbackPreviewMode = useDAWStore((state) => state.playbackPreviewMode);
  const settings = useDAWStore((state) => state.settings);

  const setBpm = useDAWStore((state) => state.setBpm);
  const setQuantize = useDAWStore((state) => state.setQuantize);
  const setSongName = useDAWStore((state) => state.setSongName);
  const toggleLoop = useDAWStore((state) => state.toggleLoop);
  const setPlaybackPreviewMode = useDAWStore((state) => state.setPlaybackPreviewMode);
  const applyLoopRegionFromMarkers = useDAWStore((state) => state.applyLoopRegionFromMarkers);
  const jumpToMarker = useDAWStore((state) => state.jumpToMarker);
  const updateUISettings = useDAWStore((state) => state.updateUISettings);

  const loadInputRef = useRef<HTMLInputElement>(null);

  const ppqn = song.ppqn;
  const bar = Math.floor(currentTick / (ppqn * 4)) + 1;
  const beat = Math.floor((currentTick % (ppqn * 4)) / ppqn) + 1;
  const tick = currentTick % ppqn;

  const isPlaying = transportState === 'playing';
  const isRecording = transportState === 'recording';
  const isPaused = transportState === 'paused';

  return (
    <header className="transport-shell">
      <div className="transport-row">
        <input
          className="input title-input"
          value={song.name}
          onChange={(event) => setSongName(event.target.value)}
          aria-label="Song name"
        />

        <div className="badge-row">
          <span className={`badge badge-mode ${settings.mode === 'strict' ? 'strict' : 'modern'}`}>
            {settings.mode.toUpperCase()}
          </span>
          <span className={`badge ${midiConnected ? 'online' : 'offline'}`}>
            {midiConnected ? midiDeviceName ?? 'MIDI Connected' : 'No MIDI'}
          </span>
          <span className="badge">{isPaused ? 'Paused' : transportState}</span>
        </div>

        <div className="transport-controls">
          <button
            type="button"
            className="btn-icon"
            onClick={onStop}
            title="Stop (Shift+Space)"
            aria-label="Stop playback"
          >
            []
          </button>
          <button
            type="button"
            className={`btn-icon ${isPlaying ? 'is-active' : ''}`}
            onClick={isPlaying ? onPause : onPlay}
            title="Play / Pause (Space)"
            aria-label="Play or pause playback"
          >
            {isPlaying ? '||' : '>'}
          </button>
          <button
            type="button"
            className={`btn-icon ${isRecording ? 'is-active rec' : ''}`}
            onClick={onRecord}
            title="Record (Shift+R)"
            aria-label="Toggle record mode"
          >
            O
          </button>
        </div>

        <div className="clock" aria-label="Transport position">
          {bar}:{String(beat).padStart(2, '0')}:{String(tick).padStart(2, '0')}
        </div>

        <label className="field-inline transport-small">
          <span>BPM</span>
          <input
            className="input"
            type="number"
            min={30}
            max={300}
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
          />
        </label>

        <label className="field-inline transport-small">
          <span>Q</span>
          <select className="input" value={quantize} onChange={(event) => setQuantize(event.target.value as Quantize)}>
            {QUANTIZE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`btn btn-loop ${loopEnabled ? 'is-active' : ''}`}
          onClick={toggleLoop}
          title="Toggle loop"
        >
          LOOP
        </button>

        <div className="transport-hints" aria-label="Quick shortcut hints">
          <span>Space: Play/Pause</span>
          <span>Shift+Space: Stop</span>
          <span>Shift+R: Record</span>
          <span>/: Help</span>
        </div>
      </div>

      <div className="transport-row secondary">
        <button type="button" className="btn" onClick={onNewProject}>
          New Project
        </button>
        <button type="button" className="btn" onClick={onOpenMidiImport}>
          Import MIDI
        </button>
        <button type="button" className="btn" onClick={onLoadTestSong}>
          Test Songs
        </button>
        <button type="button" className="btn" onClick={onSaveProject}>
          Save Project
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            loadInputRef.current?.click();
          }}
        >
          Load Project
        </button>
        <button type="button" className="btn" onClick={onExportMidi} disabled={exportingWav}>
          Export MIDI
        </button>
        <button type="button" className="btn" onClick={onExportWav} disabled={exportingWav}>
          {exportingWav ? 'Rendering WAV...' : 'Export WAV'}
        </button>
        <button type="button" className="btn" onClick={onExportReport}>
          Export Report
        </button>
        <label className="field-inline transport-small">
          <span>Preview</span>
          <select
            className="input"
            value={playbackPreviewMode}
            onChange={(event) => setPlaybackPreviewMode(event.target.value as PlaybackPreviewMode)}
          >
            {PREVIEW_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            applyLoopRegionFromMarkers();
          }}
        >
          Loop From Markers
        </button>
        {song.arrangement.sectionMarkers.length > 0 && (
          <select
            className="input transport-marker-select"
            defaultValue=""
            onChange={(event) => {
              if (!event.target.value) return;
              jumpToMarker(event.target.value);
              event.currentTarget.value = '';
            }}
          >
            <option value="">Jump to Marker</option>
            {song.arrangement.sectionMarkers.map((marker) => (
              <option key={marker.id} value={marker.id}>
                {marker.label} ({marker.role ?? 'custom'})
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            updateUISettings({
              validationPanelVisible: !settings.uiConfig.validationPanelVisible,
            })
          }
        >
          {settings.uiConfig.validationPanelVisible ? 'Hide Validation' : 'Show Validation'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() =>
            updateUISettings({
              monitorDockVisible: !settings.uiConfig.monitorDockVisible,
            })
          }
        >
          {settings.uiConfig.monitorDockVisible ? 'Hide Monitor' : 'Show Monitor'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onToggleSettings}>
          Settings
        </button>
        <button type="button" className="btn btn-ghost" onClick={onOpenHelp}>
          Help
        </button>
        <span className="transport-version">v{APP_VERSION}</span>

        <input
          ref={loadInputRef}
          className="hidden-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onLoadProject(file);
            event.currentTarget.value = '';
          }}
        />
      </div>
    </header>
  );
}
