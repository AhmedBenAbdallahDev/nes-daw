'use client';

import { getInstrumentsForTrack } from '@/audio/instruments';
import { useDAWStore } from '@/store/daw-store';
import type { Track } from '@/types/engine';

function channelColor(channel: Track['channel']) {
  switch (channel) {
    case 'pulse1':
      return '#3b82f6';
    case 'pulse2':
      return '#22c55e';
    case 'triangle':
      return '#f97316';
    case 'noise':
      return '#a855f7';
    case 'dpcm':
      return '#facc15';
    default:
      return '#06b6d4';
  }
}

export function TrackPanel() {
  const song = useDAWStore((state) => state.song);
  const mode = useDAWStore((state) => state.settings.mode);
  const selectedTrackId = useDAWStore((state) => state.selectedTrackId);

  const setSelectedTrack = useDAWStore((state) => state.setSelectedTrack);
  const toggleTrackMute = useDAWStore((state) => state.toggleTrackMute);
  const toggleTrackSolo = useDAWStore((state) => state.toggleTrackSolo);
  const setTrackVolume = useDAWStore((state) => state.setTrackVolume);
  const setTrackInstrument = useDAWStore((state) => state.setTrackInstrument);
  const setTrackEngineType = useDAWStore((state) => state.setTrackEngineType);
  const setTrackName = useDAWStore((state) => state.setTrackName);
  const clearTrackNotes = useDAWStore((state) => state.clearTrackNotes);
  const addModernTrack = useDAWStore((state) => state.addModernTrack);
  const removeTrack = useDAWStore((state) => state.removeTrack);

  return (
    <aside className="track-panel" aria-label="Track and channel controls">
      <div className="track-header">
        <h2>Channels</h2>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={addModernTrack}
          disabled={mode !== 'modern'}
          title={mode === 'modern' ? 'Add modern track' : 'Switch to Modern mode to add tracks'}
        >
          + Track
        </button>
      </div>

      <div className="track-list">
        {song.tracks.map((track) => {
          const isSelected = selectedTrackId === track.id;
          const instruments = getInstrumentsForTrack(track);
          const color = channelColor(track.channel);

          return (
            <article
              key={track.id}
              className={`track-card ${isSelected ? 'is-selected' : ''}`}
              style={{ '--track-color': color } as React.CSSProperties}
              onClick={() => setSelectedTrack(track.id)}
            >
              <div className="track-top">
                <input
                  className="input track-name-input"
                  value={track.name}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setTrackName(track.id, event.target.value)}
                  aria-label={`${track.channel} track name`}
                />
                <div className="track-chip">{track.channel}</div>
              </div>

              <div className="track-controls">
                <button
                  type="button"
                  className={`btn-icon tiny ${track.muted ? 'is-active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTrackMute(track.id);
                  }}
                  title="Mute"
                >
                  M
                </button>
                <button
                  type="button"
                  className={`btn-icon tiny ${track.solo ? 'is-active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTrackSolo(track.id);
                  }}
                  title="Solo"
                >
                  S
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    setTrackVolume(track.id, parseFloat(event.target.value));
                  }}
                />
              </div>

              <div className="track-controls column">
                <label className="field-inline">
                  <span>Engine</span>
                  <select
                    value={track.engineType}
                    disabled={track.channel !== 'modern'}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setTrackEngineType(track.id, event.target.value as Track['engineType'])}
                  >
                    {track.channel === 'modern' ? (
                      <>
                        <option value="saw">Saw</option>
                        <option value="sine">Sine</option>
                        <option value="fm-lite">FM-lite</option>
                        <option value="modern-noise">Modern Noise</option>
                      </>
                    ) : (
                      <>
                        <option value={track.channel === 'dpcm' ? 'dpcm' : 'nes'}>
                          {track.channel === 'dpcm' ? 'DPCM' : 'NES'}
                        </option>
                      </>
                    )}
                  </select>
                </label>

                <label className="field-inline">
                  <span>Instrument</span>
                  <select
                    value={track.instrumentId}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setTrackInstrument(track.id, event.target.value)}
                  >
                    {instruments.map((instrument) => (
                      <option key={instrument.id} value={instrument.id}>
                        {instrument.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="track-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearTrackNotes(track.id);
                  }}
                >
                  Clear Notes
                </button>
              </div>

              {mode === 'modern' && track.channel === 'modern' && (
                <button
                  type="button"
                  className="btn btn-ghost danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTrack(track.id);
                  }}
                >
                  Remove
                </button>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
