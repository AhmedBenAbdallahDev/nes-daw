import React, { useRef, useState, useEffect } from 'react';
import { useDAWContext } from '../context/DAWContext';
import { PIANO_ROLL_NOTES, CELL_WIDTH_PX, ROW_HEIGHT_PX } from '../constants';
import { AudioManager } from '../lib/audio';

export function PianoRoll({ playheadStep }: { playheadStep: number }) {
  const { project, selectedTrackId, setProject, isPlaying, autoScroll } = useDAWContext();
  const activeTrack = project.tracks.find(t => t.id === selectedTrackId);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [stampDuration, setStampDuration] = useState(2); 

  useEffect(() => {
    if (isPlaying && autoScroll && containerRef.current && playheadStep >= 0) {
      const container = containerRef.current;
      const playheadX = playheadStep * CELL_WIDTH_PX;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;
      
      // Keep Keyboard Sidebar in mind, it is 64px width (w-16) or similar
      if (playheadX < viewLeft || playheadX > viewRight - 100) {
        container.scrollTo({ left: Math.max(0, playheadX - 64), behavior: 'auto' });
      }
    }
  }, [playheadStep, isPlaying, autoScroll]);

  const handleCellClick = (noteStr: string, step: number) => {
    if (!activeTrack) return;
    
    const existingIndex = activeTrack.notes.findIndex(
      n => n.note === noteStr && step >= n.startStep && step < n.startStep + n.durationSteps
    );

    if (existingIndex >= 0) {
      setProject(p => {
        return {
          ...p,
          tracks: p.tracks.map(t => {
            if (t.id === activeTrack.id) {
              const newNotes = [...t.notes];
              newNotes.splice(existingIndex, 1);
              return { ...t, notes: newNotes };
            }
            return t;
          })
        };
      });
    } else {
      if (!isPlaying) {
        AudioManager.previewNote(noteStr, activeTrack.instrument);
      }

      setProject(p => ({
        ...p,
        tracks: p.tracks.map(t => {
          if (t.id === activeTrack.id) {
            return {
              ...t,
              notes: [...t.notes, {
                id: 'n_' + Date.now() + Math.random(),
                note: noteStr,
                startStep: step,
                durationSteps: stampDuration,
                velocity: 0.8
              }]
            };
          }
          return t;
        })
      }));
    }
  };

  if (!activeTrack) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#4E4A42] font-bold tracking-[0.2em] uppercase opacity-50">
        Select a track to edit
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-[#D1CEC1] flex-col relative text-[#4E4A42]">
      {/* Piano Roll Header */}
      <div className="h-10 border-b border-[#4E4A42] bg-[#BAB5A1] flex items-center px-4 justify-between uppercase tracking-widest font-bold text-[10px]">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 border border-[#4E4A42] bg-[#4E4A42] opacity-80" />
          <span className="">{activeTrack.name} <span className="opacity-60 ml-2">({activeTrack.instrument})</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="opacity-60">Draw Length:</span>
          <select 
            value={stampDuration}
            onChange={(e) => setStampDuration(parseInt(e.target.value))}
            className="bg-transparent border border-[#4E4A42] text-[#4E4A42] px-2 py-1 outline-none font-bold"
          >
            <option value={1}>1/16</option>
            <option value={2}>1/8</option>
            <option value={4}>1/4 (Beat)</option>
            <option value={16}>1 Bar</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative flex" ref={containerRef}>
        {/* Keyboard sidebar */}
        <div className="w-16 flex-none bg-[#D1CEC1] sticky left-0 z-40 border-r border-[#4E4A42]">
          {PIANO_ROLL_NOTES.map(note => {
            const isBlack = note.includes('b');
            return (
              <div 
                key={note}
                className={`flex items-center justify-end px-2 text-[10px] select-none border-b border-[#4E4A42] cursor-pointer hover:bg-[#4E4A42] hover:text-[#D1CEC1] font-bold tracking-widest ${isBlack ? 'bg-[#BAB5A1] bg-opacity-40 text-[#4E4A42]' : 'bg-[#D1CEC1] text-[#4E4A42]'}`}
                style={{ height: ROW_HEIGHT_PX }}
                onMouseDown={() => AudioManager.previewNote(note, activeTrack.instrument)}
              >
                {note}
              </div>
            );
          })}
        </div>

        {/* Grid Area */}
        <div 
          className="relative bg-transparent cursor-crosshair"
          style={{ 
            width: project.totalSteps * CELL_WIDTH_PX,
            height: PIANO_ROLL_NOTES.length * ROW_HEIGHT_PX
          }}
        >
          {/* Background SVG Grid for performance */}
          <svg className="absolute inset-0 pointer-events-none opacity-20 mix-blend-multiply" width={project.totalSteps * CELL_WIDTH_PX} height={PIANO_ROLL_NOTES.length * ROW_HEIGHT_PX}>
            <defs>
              <pattern id="gridPattern" width={CELL_WIDTH_PX * 4} height={ROW_HEIGHT_PX * 12} patternUnits="userSpaceOnUse">
                {/* Rows lines */}
                {Array.from({ length: 12 }).map((_, i) => (
                   <line key={`h${i}`} x1="0" y1={i * ROW_HEIGHT_PX} x2={CELL_WIDTH_PX * 4} y2={i * ROW_HEIGHT_PX} stroke="#4E4A42" strokeWidth="1" />
                ))}
                {/* 16th cols */}
                {Array.from({ length: 4 }).map((_, i) => (
                   <line key={`v${i}`} x1={i * CELL_WIDTH_PX} y1="0" x2={i * CELL_WIDTH_PX} y2={ROW_HEIGHT_PX * 12} stroke="#4E4A42" strokeWidth={i === 0 ? "2" : "1"} opacity={i === 0 ? "1" : "0.5"} />
                ))}
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern)" />
          </svg>

          {/* Interactive clickable overlay */}
          <div className="absolute inset-0 z-10" onMouseDown={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             const x = e.clientX - rect.left;
             const y = e.clientY - rect.top;
             const step = Math.floor(x / CELL_WIDTH_PX);
             const row = Math.floor(y / ROW_HEIGHT_PX);
             if (row >= 0 && row < PIANO_ROLL_NOTES.length) {
                handleCellClick(PIANO_ROLL_NOTES[row], step);
             }
          }}>
            {/* Render Notes */}
            {activeTrack.notes.map(note => {
              const rowIndex = PIANO_ROLL_NOTES.indexOf(note.note);
              if (rowIndex === -1) return null;
              
              return (
                <div
                  key={note.id}
                  className="absolute border border-[#4E4A42] bg-[#4E4A42] opacity-80 shadow-sm pointer-events-none flex items-center px-1 overflow-hidden"
                  style={{
                    left: note.startStep * CELL_WIDTH_PX,
                    top: rowIndex * ROW_HEIGHT_PX + 1,
                    width: note.durationSteps * CELL_WIDTH_PX - 1,
                    height: ROW_HEIGHT_PX - 2,
                  }}
                >
                  <span className="text-[9px] font-bold text-[#D1CEC1] uppercase tracking-widest truncate">
                    {note.note}
                  </span>
                </div>
              );
            })}

            {/* Playhead in Piano Roll */}
            {playheadStep >= 0 && (
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-[#C13A3A] z-30 pointer-events-none shadow-[0_0_10px_rgba(193,58,58,0.5)]"
                style={{ left: playheadStep * CELL_WIDTH_PX }}
              >
                <div className="absolute top-0 -left-1.5 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#C13A3A]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
