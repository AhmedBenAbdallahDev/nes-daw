'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDAWStore } from '@/store/daw-store';
import { useNESEngine } from '@/hooks/use-nes-engine';

function keyColor(channel: string): string {
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

export function VirtualKeyboard() {
  const selectedTrackId = useDAWStore((state) => state.selectedTrackId);
  const tracks = useDAWStore((state) => state.song.tracks);
  const { playTrackNote, stopNote } = useNESEngine();

  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const activeVoices = useRef<Map<number, number>>(new Map());
  const isMouseDown = useRef(false);

  const keys = useMemo(() => {
    const result: { note: number; isBlack: boolean; label?: string }[] = [];
    for (let note = 36; note <= 83; note += 1) {
      const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
      const label = note % 12 === 0 ? `C${Math.floor(note / 12) - 1}` : undefined;
      result.push({ note, isBlack, label });
    }
    return result;
  }, []);

  const whiteKeys = keys.filter((item) => !item.isBlack);
  const blackKeys = keys.filter((item) => item.isBlack);

  const play = useCallback(
    (note: number) => {
      const track = tracks.find((item) => item.id === selectedTrackId);
      if (!track) return;

      if (activeVoices.current.has(note)) {
        stopNote(activeVoices.current.get(note)!);
        activeVoices.current.delete(note);
      }

      const voiceId = playTrackNote(track, note, 100);
      if (voiceId === -1) return;

      activeVoices.current.set(note, voiceId);
      setPressedKeys((prev) => new Set(prev).add(note));
    },
    [selectedTrackId, tracks, playTrackNote, stopNote]
  );

  const stop = useCallback(
    (note: number) => {
      const voiceId = activeVoices.current.get(note);
      if (voiceId === undefined) return;

      stopNote(voiceId);
      activeVoices.current.delete(note);
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(note);
        return next;
      });
    },
    [stopNote]
  );

  useEffect(() => {
    const handleGlobalUp = () => {
      isMouseDown.current = false;
      activeVoices.current.forEach((voiceId) => stopNote(voiceId));
      activeVoices.current.clear();
      setPressedKeys(new Set());
    };

    window.addEventListener('mouseup', handleGlobalUp);
    return () => window.removeEventListener('mouseup', handleGlobalUp);
  }, [stopNote]);

  const currentTrack = tracks.find((item) => item.id === selectedTrackId);
  const accent = keyColor(currentTrack?.channel ?? 'modern');

  return (
    <div className="keyboard-shell" style={{ '--track-color': accent } as React.CSSProperties}>
      <div className="keyboard-white-row">
        {whiteKeys.map((key) => {
          const isPressed = pressedKeys.has(key.note);
          return (
            <button
              key={key.note}
              type="button"
              className={`white-key ${isPressed ? 'is-pressed' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault();
                isMouseDown.current = true;
                play(key.note);
              }}
              onMouseUp={() => {
                isMouseDown.current = false;
                stop(key.note);
              }}
              onMouseEnter={() => {
                if (isMouseDown.current) play(key.note);
              }}
              onMouseLeave={() => {
                if (isMouseDown.current) stop(key.note);
              }}
            >
              {key.label}
            </button>
          );
        })}
      </div>

      <div className="keyboard-black-row">
        {blackKeys.map((key) => {
          const prevWhite = key.note - 1;
          const idx = whiteKeys.findIndex((white) => white.note === prevWhite);
          if (idx < 0) return null;

          const left = ((idx + 1) / whiteKeys.length) * 100;
          const isPressed = pressedKeys.has(key.note);

          return (
            <button
              key={key.note}
              type="button"
              className={`black-key ${isPressed ? 'is-pressed' : ''}`}
              style={{ left: `calc(${left}% - 0.8%)` }}
              onMouseDown={(event) => {
                event.preventDefault();
                isMouseDown.current = true;
                play(key.note);
              }}
              onMouseUp={() => {
                isMouseDown.current = false;
                stop(key.note);
              }}
              onMouseEnter={() => {
                if (isMouseDown.current) play(key.note);
              }}
              onMouseLeave={() => {
                if (isMouseDown.current) stop(key.note);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
