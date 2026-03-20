'use client';

import { useMemo, useState } from 'react';
import { analyzeMidi, importMidiToSong, parseMidiFile } from '@/services/midi-file-service';
import { useDAWStore } from '@/store/daw-store';
import type { MIDIImportTrackMapping, Quantize } from '@/types/engine';

interface MIDIImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const QUANTIZE_OPTIONS: Quantize[] = ['1/4', '1/8', '1/16', '1/32'];

export function MIDIImportDialog({ open, onClose }: MIDIImportDialogProps) {
  const song = useDAWStore((state) => state.song);
  const selectedTrackId = useDAWStore((state) => state.selectedTrackId);
  const settings = useDAWStore((state) => state.settings);
  const importNotesByTrack = useDAWStore((state) => state.importNotesByTrack);
  const pushToast = useDAWStore((state) => state.pushToast);

  const [fileName, setFileName] = useState('');
  const [midi, setMidi] = useState<Awaited<ReturnType<typeof parseMidiFile>> | null>(null);
  const [preview, setPreview] = useState<ReturnType<typeof analyzeMidi> | null>(null);
  const [mappings, setMappings] = useState<MIDIImportTrackMapping[]>([]);
  const [transpose, setTranspose] = useState(settings.midiConfig.defaultTranspose);
  const [quantize, setQuantize] = useState<Quantize>(settings.midiConfig.defaultQuantize);
  const [velocityScale, setVelocityScale] = useState(1);
  const [clampToNesRange, setClampToNesRange] = useState(settings.mode === 'strict');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const trackTargets = useMemo(
    () => song.tracks.map((track) => ({ id: track.id, label: `${track.name} (${track.channel})` })),
    [song.tracks]
  );

  if (!open) return null;

  const setMapping = (sourceTrackIndex: number, targetTrackId: string) => {
    setMappings((prev) => {
      const next = prev.filter((mapping) => mapping.sourceTrackIndex !== sourceTrackIndex);
      if (targetTrackId) {
        next.push({ sourceTrackIndex, targetTrackId });
      }
      return next;
    });
  };

  const handleFileChange = async (file: File) => {
    try {
      setLoading(true);
      const parsed = await parseMidiFile(file);
      const analyzed = analyzeMidi(parsed, song.ppqn);

      setMidi(parsed);
      setPreview(analyzed);
      setWarnings(analyzed.warnings);
      setFileName(file.name);

      const defaultMappings: MIDIImportTrackMapping[] = analyzed.previews
        .map((source, index) => {
          const byPercussion =
            source.isPercussion && settings.midiConfig.autoMapPercussionToNoise
              ? song.tracks.find((track) => track.channel === 'noise' || track.channel === 'dpcm')
              : null;

          const target = byPercussion ?? song.tracks[index % song.tracks.length];
          if (!target) return null;
          return {
            sourceTrackIndex: source.index,
            targetTrackId: target.id,
          };
        })
        .filter((item): item is MIDIImportTrackMapping => Boolean(item));

      setMappings(defaultMappings);
    } catch (error) {
      console.error(error);
      setWarnings(['Could not parse MIDI file. Please use a standard .mid file.']);
      setMidi(null);
      setPreview(null);
      setMappings([]);
      setFileName('');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!midi || !preview) return;

    const result = importMidiToSong(
      song,
      midi,
      {
        transpose,
        quantize,
        clampToNesRange,
        trackMappings: mappings,
        velocityScale,
      },
      settings.mode
    );

    importNotesByTrack(result.byTrack, {
      replaceExisting,
      suggestedLengthTicks: result.suggestedLengthTicks,
    });

    pushToast({
      type: 'success',
      message: `Imported ${result.importedCount} notes from ${fileName}.`,
    });

    if (result.warnings.length > 0) {
      setWarnings(result.warnings);
    } else {
      setWarnings([]);
    }

    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="MIDI Import Wizard">
      <div className="modal modal-wide">
        <header className="modal-header">
          <h3>MIDI Import Wizard</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Close
          </button>
        </header>

        <div className="modal-content settings-grid">
          <label className="field">
            <span>MIDI File</span>
            <input
              type="file"
              accept=".mid,.midi,audio/midi"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFileChange(file);
                }
              }}
            />
          </label>

          {loading && <div className="muted">Parsing MIDI file...</div>}

          {preview && (
            <>
              <div className="shortcut-warning">
                <span>
                  Loaded <strong>{fileName}</strong> with {preview.previews.length} track(s).
                </span>
              </div>

              <div className="field-inline">
                <span>Quantize</span>
                <select value={quantize} onChange={(event) => setQuantize(event.target.value as Quantize)}>
                  {QUANTIZE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <label className="field">
                <span>Transpose (semitones)</span>
                <input
                  type="number"
                  min={-24}
                  max={24}
                  value={transpose}
                  onChange={(event) => setTranspose(Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span>Velocity Scale</span>
                <input
                  type="range"
                  min={0.1}
                  max={1.5}
                  step={0.05}
                  value={velocityScale}
                  onChange={(event) => setVelocityScale(Number(event.target.value))}
                />
              </label>

              <label className="field-toggle">
                <input
                  type="checkbox"
                  checked={clampToNesRange}
                  onChange={(event) => setClampToNesRange(event.target.checked)}
                />
                <span>Clamp note range to selected mode</span>
              </label>

              <label className="field-toggle">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                />
                <span>Replace existing notes in target patterns</span>
              </label>

              <div className="mapping-table">
                <div className="mapping-row mapping-head">
                  <span>Source Track</span>
                  <span>Notes</span>
                  <span>Duration</span>
                  <span>Target</span>
                </div>
                <div className="mapping-row">
                  <span>Quick map</span>
                  <span />
                  <span />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setMappings(
                        preview.previews.map((source) => ({
                          sourceTrackIndex: source.index,
                          targetTrackId: selectedTrackId,
                        }))
                      )
                    }
                  >
                    Map all to selected track
                  </button>
                </div>
                {preview.previews.map((source) => {
                  const mapping = mappings.find((item) => item.sourceTrackIndex === source.index);
                  return (
                    <div className="mapping-row" key={source.index}>
                      <span>{source.name}</span>
                      <span>{source.noteCount}</span>
                      <span>{source.durationTicks}</span>
                      <select
                        value={mapping?.targetTrackId ?? ''}
                        onChange={(event) => setMapping(source.index, event.target.value)}
                      >
                        <option value="">Skip</option>
                        {trackTargets.map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {warnings.length > 0 && (
            <div className="warning-list">
              {warnings.map((warning) => (
                <div key={warning} className="warning-item">
                  {warning}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={!preview || !midi || loading} onClick={handleImport}>
            {loading ? 'Loading...' : 'Import MIDI'}
          </button>
        </footer>
      </div>
    </div>
  );
}
