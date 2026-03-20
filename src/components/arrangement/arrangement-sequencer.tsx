'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDAWStore } from '@/store/daw-store';

const PX_PER_TICK = 0.12;

function channelColor(channel: string): string {
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

export function ArrangementSequencer() {
  const [markerLabel, setMarkerLabel] = useState('Section');
  const [markerRole, setMarkerRole] = useState<'intro' | 'loop-start' | 'loop-end' | 'boss' | 'stinger' | 'custom'>(
    'custom'
  );
  const song = useDAWStore((state) => state.song);
  const addPatternInstance = useDAWStore((state) => state.addPatternInstance);
  const movePatternInstance = useDAWStore((state) => state.movePatternInstance);
  const removePatternInstance = useDAWStore((state) => state.removePatternInstance);
  const addSectionMarker = useDAWStore((state) => state.addSectionMarker);
  const setSectionMarkerRole = useDAWStore((state) => state.setSectionMarkerRole);
  const removeSectionMarker = useDAWStore((state) => state.removeSectionMarker);
  const jumpToMarker = useDAWStore((state) => state.jumpToMarker);
  const setArrangementLength = useDAWStore((state) => state.setArrangementLength);
  const setCurrentTick = useDAWStore((state) => state.setCurrentTick);
  const currentTick = useDAWStore((state) => state.currentTick);

  const draggingRef = useRef<{
    trackId: string;
    instanceId: string;
    startX: number;
    originalStartTick: number;
  } | null>(null);

  const barTicks = useMemo(() => song.ppqn * 4, [song.ppqn]);
  const width = useMemo(
    () => Math.max(960, Math.round(song.arrangement.lengthTicks * PX_PER_TICK) + 160),
    [song.arrangement.lengthTicks]
  );

  const bars = useMemo(() => Math.ceil(song.arrangement.lengthTicks / barTicks), [song.arrangement.lengthTicks, barTicks]);

  const handleLaneDoubleClick = useCallback(
    (event: React.MouseEvent, trackId: string) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const rawTick = x / PX_PER_TICK;
      const snapped = Math.max(0, Math.floor(rawTick / barTicks) * barTicks);
      addPatternInstance(trackId, snapped);

      const nextLength = Math.max(song.arrangement.lengthTicks, snapped + barTicks * 2);
      setArrangementLength(nextLength);
    },
    [addPatternInstance, barTicks, setArrangementLength, song.arrangement.lengthTicks]
  );

  const handleBlockMouseDown = useCallback(
    (event: React.MouseEvent, trackId: string, instanceId: string, startTick: number) => {
      event.preventDefault();
      draggingRef.current = {
        trackId,
        instanceId,
        startX: event.clientX,
        originalStartTick: startTick,
      };
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      const dragging = draggingRef.current;
      if (!dragging) return;

      const deltaX = event.clientX - dragging.startX;
      const deltaTicks = Math.round(deltaX / PX_PER_TICK);
      const snapped = Math.max(0, Math.round((dragging.originalStartTick + deltaTicks) / barTicks) * barTicks);

      movePatternInstance(dragging.trackId, dragging.instanceId, snapped);
    },
    [barTicks, movePatternInstance]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <section className="arrangement-shell" aria-label="Arrangement Sequencer">
      <header className="arrangement-header">
        <div className="arrangement-title">Arrangement</div>
        <div className="arrangement-header-actions">
          <div className="arrangement-help">
            Double-click lane to insert pattern. Drag blocks to move. Right-click block to remove.
          </div>
          <input
            className="input arrangement-marker-input"
            value={markerLabel}
            onChange={(event) => setMarkerLabel(event.target.value)}
            aria-label="Marker label"
          />
          <select
            className="input arrangement-marker-input"
            value={markerRole}
            onChange={(event) =>
              setMarkerRole(
                event.target.value as 'intro' | 'loop-start' | 'loop-end' | 'boss' | 'stinger' | 'custom'
              )
            }
            aria-label="Marker role"
          >
            <option value="custom">Custom</option>
            <option value="intro">Intro</option>
            <option value="loop-start">Loop Start</option>
            <option value="loop-end">Loop End</option>
            <option value="boss">Boss</option>
            <option value="stinger">Stinger</option>
          </select>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => addSectionMarker(markerLabel.trim() || 'Section', currentTick, markerRole)}
          >
            Add Marker
          </button>
        </div>
      </header>

      {song.arrangement.sectionMarkers.length > 0 && (
        <div className="arrangement-marker-manager">
          {song.arrangement.sectionMarkers.map((marker) => (
            <div key={marker.id} className="arrangement-marker-row">
              <button type="button" className="btn btn-ghost" onClick={() => jumpToMarker(marker.id)}>
                {marker.label}
              </button>
              <select
                className="input"
                value={marker.role ?? 'custom'}
                onChange={(event) =>
                  setSectionMarkerRole(
                    marker.id,
                    event.target.value as 'intro' | 'loop-start' | 'loop-end' | 'boss' | 'stinger' | 'custom'
                  )
                }
              >
                <option value="custom">Custom</option>
                <option value="intro">Intro</option>
                <option value="loop-start">Loop Start</option>
                <option value="loop-end">Loop End</option>
                <option value="boss">Boss</option>
                <option value="stinger">Stinger</option>
              </select>
              <span className="muted">Tick {marker.startTick}</span>
              <button type="button" className="btn btn-ghost danger" onClick={() => removeSectionMarker(marker.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="arrangement-scroll">
        <div className="arrangement-grid" style={{ width }}>
          <div className="arrangement-bars" style={{ width }}>
            {Array.from({ length: bars + 1 }).map((_, idx) => {
              const left = idx * barTicks * PX_PER_TICK;
              return (
                <div key={idx} className="arrangement-bar-line" style={{ left }}>
                  <span>{idx + 1}</span>
                </div>
              );
            })}
          </div>

          {song.arrangement.sectionMarkers.map((marker) => (
            <div
              key={marker.id}
              className="arrangement-marker"
              style={{
                left: marker.startTick * PX_PER_TICK,
                borderColor: marker.color,
              }}
            >
              <span style={{ color: marker.color }}>{marker.label}</span>
            </div>
          ))}

          {song.tracks.map((track) => {
            const lane = song.arrangement.lanes.find((item) => item.trackId === track.id);

            return (
              <div key={track.id} className="arrangement-lane-row">
                <div className="arrangement-lane-label">{track.name}</div>
                <div
                  className="arrangement-lane"
                  onDoubleClick={(event) => handleLaneDoubleClick(event, track.id)}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const x = event.clientX - rect.left;
                    const tick = Math.max(0, Math.round(x / PX_PER_TICK));
                    setCurrentTick(tick);
                  }}
                >
                  {(lane?.instances ?? []).map((instance) => (
                    <button
                      key={instance.id}
                      type="button"
                      className="arrangement-block"
                      onMouseDown={(event) =>
                        handleBlockMouseDown(event, track.id, instance.id, instance.startTick)
                      }
                      onContextMenu={(event) => {
                        event.preventDefault();
                        removePatternInstance(track.id, instance.id);
                      }}
                      style={{
                        left: instance.startTick * PX_PER_TICK,
                        width: Math.max(24, instance.lengthTicks * PX_PER_TICK),
                        borderColor: channelColor(track.channel),
                        background: `${channelColor(track.channel)}33`,
                      }}
                      title={`${track.name} @ tick ${instance.startTick}`}
                    >
                      <span>{track.patterns.find((pattern) => pattern.id === instance.patternId)?.name ?? 'Pattern'}</span>
                    </button>
                  ))}
                  {(!lane || lane.instances.length === 0) && (
                    <div className="arrangement-empty-lane">Double-click to add a pattern clip</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
