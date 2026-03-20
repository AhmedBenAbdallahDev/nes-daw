'use client';

import { useCallback, useEffect, useRef } from 'react';
import { quantizeTick, ticksPerQuantize } from '@/lib/song-utils';
import { useDAWStore } from '@/store/daw-store';
import type { Quantize, Track } from '@/types/engine';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_KEYS = [1, 3, 6, 8, 10];
const KEY_WIDTH = 60;

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

function qTick(tick: number, quantize: Quantize, ppqn: number) {
  return quantizeTick(tick, ppqn, quantize);
}

const PianoRoll = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const getMousePos = (event: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const getGridPos = (x: number, y: number, state: ReturnType<typeof useDAWStore.getState>) => {
    const { scrollX, scrollY, zoomX, zoomY } = state.pianoRollView;
    const tick = (x - KEY_WIDTH) / zoomX + scrollX;
    const note = 127 - (y + scrollY - zoomY / 2) / zoomY;
    return {
      tick,
      midiNote: Math.round(note),
    };
  };

  const findNoteUnderCursor = (tick: number, midiNote: number, track: Track) => {
    const pattern = track.patterns[track.activePatternIndex];
    if (!pattern) return null;

    return (
      pattern.notes.find(
        (note) =>
          note.midiNote === midiNote && tick >= note.startTick && tick < note.startTick + note.durationTicks
      ) ?? null
    );
  };

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = useDAWStore.getState();
    const { song, currentTick, selectedTrackId, pianoRollView } = state;
    const { scrollX, scrollY, zoomX, zoomY } = pianoRollView;
    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#050611';
    ctx.fillRect(0, 0, width, height);

    const startTick = Math.floor(scrollX);
    const endTick = startTick + (width - KEY_WIDTH) / zoomX;
    const startNote = Math.floor(127 - (scrollY + height) / zoomY);
    const endNote = Math.ceil(127 - scrollY / zoomY);

    const safeStart = Math.max(0, startNote);
    const safeEnd = Math.min(127, endNote);

    const ppqn = song.ppqn;

    for (let note = safeStart; note <= safeEnd; note += 1) {
      const y = Math.floor((127 - note) * zoomY - scrollY);
      const isBlack = BLACK_KEYS.includes(note % 12);

      if (isBlack) {
        ctx.fillStyle = '#0c1020';
        ctx.fillRect(KEY_WIDTH, y, width - KEY_WIDTH, zoomY);
      }

      if (note === 60) {
        ctx.fillStyle = '#13233f';
        ctx.fillRect(KEY_WIDTH, y, width - KEY_WIDTH, zoomY);
      }

      ctx.strokeStyle = note % 12 === 0 ? '#203055' : '#111c33';
      ctx.beginPath();
      ctx.moveTo(KEY_WIDTH, y + zoomY);
      ctx.lineTo(width, y + zoomY);
      ctx.stroke();
    }

    const ticksPerGrid = ppqn / 4;
    const gridStart = Math.floor(startTick / ticksPerGrid) * ticksPerGrid;

    for (let tick = gridStart; tick <= endTick; tick += ticksPerGrid) {
      const x = KEY_WIDTH + (tick - scrollX) * zoomX;
      const isBar = tick % (ppqn * 4) === 0;
      const isBeat = tick % ppqn === 0;

      ctx.strokeStyle = isBar ? '#415d95' : isBeat ? '#223a66' : '#13233f';
      ctx.lineWidth = isBar ? 1.2 : 0.6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    song.tracks.forEach((track) => {
      const pattern = track.patterns[track.activePatternIndex];
      if (!pattern) return;

      const color = channelColor(track.channel);
      const alpha = track.id === selectedTrackId ? 0.92 : 0.24;
      const stroke = track.id === selectedTrackId ? '#ffffff70' : '#00000044';

      pattern.notes.forEach((note) => {
        const x = KEY_WIDTH + (note.startTick - scrollX) * zoomX;
        const y = (127 - note.midiNote) * zoomY - scrollY;
        const w = note.durationTicks * zoomX;
        const h = zoomY - 1;

        if (x + w < KEY_WIDTH || x > width || y + h < 0 || y > height) return;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(Math.max(KEY_WIDTH, x), y, Math.max(1, w - Math.max(0, KEY_WIDTH - x)), h);
        ctx.restore();

        if (track.id === selectedTrackId) {
          const selected = pianoRollView.selectedNoteIds.includes(note.id);
          ctx.strokeStyle = selected ? '#f8fafc' : stroke;
          ctx.lineWidth = selected ? 1.4 : 1;
          ctx.strokeRect(Math.max(KEY_WIDTH, x), y, Math.max(1, w - Math.max(0, KEY_WIDTH - x)), h);
        }
      });
    });

    const playheadX = KEY_WIDTH + (currentTick - scrollX) * zoomX;
    if (playheadX >= KEY_WIDTH && playheadX <= width) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 7);
      ctx.fill();
    }

    ctx.fillStyle = '#0b1224';
    ctx.fillRect(0, 0, KEY_WIDTH, height);
    ctx.strokeStyle = '#324870';
    ctx.beginPath();
    ctx.moveTo(KEY_WIDTH, 0);
    ctx.lineTo(KEY_WIDTH, height);
    ctx.stroke();

    for (let note = safeStart; note <= safeEnd; note += 1) {
      const y = Math.floor((127 - note) * zoomY - scrollY);
      const isBlack = BLACK_KEYS.includes(note % 12);

      ctx.fillStyle = isBlack ? '#0f172a' : '#e2e8f0';
      ctx.fillRect(0, y, KEY_WIDTH, zoomY);

      if (!isBlack || zoomY > 16) {
        ctx.fillStyle = isBlack ? '#94a3b8' : '#0f172a';
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${NOTE_NAMES[note % 12]}${Math.floor(note / 12)}`, KEY_WIDTH - 4, y + zoomY / 2);
      }
    }

  }, []);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !canvasRef.current) return;
      canvasRef.current.width = entry.contentRect.width;
      canvasRef.current.height = entry.contentRect.height;
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const tick = () => {
      renderFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const state = useDAWStore.getState();

    if (event.altKey) {
      const zoom = Math.max(0.2, Math.min(6, state.pianoRollView.zoomX - event.deltaY * 0.002));
      state.setPianoRollZoom(zoom, state.pianoRollView.zoomY);
      return;
    }

    if (event.shiftKey) {
      state.setPianoRollScroll(Math.max(0, state.pianoRollView.scrollX + event.deltaY * 0.5), state.pianoRollView.scrollY);
      return;
    }

    state.setPianoRollScroll(state.pianoRollView.scrollX, Math.max(0, state.pianoRollView.scrollY + event.deltaY));
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = useDAWStore.getState();
    const track = state.song.tracks.find((item) => item.id === state.selectedTrackId);
    if (!track) {
      canvas.style.cursor = 'crosshair';
      return;
    }

    const { x, y } = getMousePos(event);
    const { tick, midiNote } = getGridPos(x, y, state);
    const found = findNoteUnderCursor(tick, midiNote, track);

    if (!found) {
      canvas.style.cursor = 'crosshair';
      return;
    }

    const noteX = KEY_WIDTH + (found.startTick - state.pianoRollView.scrollX) * state.pianoRollView.zoomX;
    const noteW = found.durationTicks * state.pianoRollView.zoomX;
    canvas.style.cursor = x >= noteX + noteW - 8 ? 'ew-resize' : 'grab';
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    const state = useDAWStore.getState();
    const { x, y } = getMousePos(event);
    if (x < KEY_WIDTH) return;

    const track = state.song.tracks.find((item) => item.id === state.selectedTrackId);
    if (!track) return;

    const { tick, midiNote } = getGridPos(x, y, state);
    if (midiNote < 0 || midiNote > 127) return;

    const existing = findNoteUnderCursor(tick, midiNote, track);

    if (event.button === 2 && existing) {
      state.removeNote(state.selectedTrackId, existing.id);
      return;
    }

    if (event.button !== 0) return;

    if (!existing) {
      const step = ticksPerQuantize(state.song.ppqn, state.pianoRollView.quantize);
      state.addNote(state.selectedTrackId, {
        midiNote,
        startTick: qTick(tick, state.pianoRollView.quantize, state.song.ppqn),
        durationTicks: step,
        velocity: 100,
      });
      return;
    }

    state.selectNotes([existing.id]);

    const noteX = KEY_WIDTH + (existing.startTick - state.pianoRollView.scrollX) * state.pianoRollView.zoomX;
    const noteW = existing.durationTicks * state.pianoRollView.zoomX;
    const isResize = x >= noteX + noteW - 8;

    const startX = event.clientX;
    const startY = event.clientY;
    const startTick = existing.startTick;
    const startMidi = existing.midiNote;
    const startDuration = existing.durationTicks;

    const onMove = (moveEvent: MouseEvent) => {
      const current = useDAWStore.getState();
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const deltaTicks = deltaX / current.pianoRollView.zoomX;
      const deltaMidi = -deltaY / current.pianoRollView.zoomY;

      if (isResize) {
        const nextDuration = Math.max(
          1,
          qTick(startTick + startDuration + deltaTicks, current.pianoRollView.quantize, current.song.ppqn) - startTick
        );

        current.updateNote(current.selectedTrackId, existing.id, {
          durationTicks: nextDuration,
        });
      } else {
        const nextTick = qTick(startTick + deltaTicks, current.pianoRollView.quantize, current.song.ppqn);
        const nextMidi = Math.max(0, Math.min(127, Math.round(startMidi + deltaMidi)));

        current.updateNote(current.selectedTrackId, existing.id, {
          startTick: nextTick,
          midiNote: nextMidi,
        });
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = 'crosshair';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div ref={containerRef} className="piano-roll-shell">
      <canvas
        ref={canvasRef}
        className="piano-roll-canvas"
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  );
};

export default PianoRoll;
