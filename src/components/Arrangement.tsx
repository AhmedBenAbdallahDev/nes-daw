import React from 'react';
import { useDAWContext } from '../context/DAWContext';
import { InstrumentType, Track } from '../types';
import { CELL_WIDTH_PX, PIANO_ROLL_NOTES } from '../constants';
import { Volume2, VolumeX, Headphones, Trash2, Plus, Sparkles, XCircle } from 'lucide-react';

export function Arrangement({ playheadStep }: { playheadStep: number }) {
  const { project, selectedTrackId, setSelectedTrackId, deleteTrack, updateTrack, toggleMute, toggleSolo, addTrack, clearTrackNotes, handleGenerateTrack, seek, isPlaying, autoScroll } = useDAWContext();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isPlaying && autoScroll && scrollRef.current && playheadStep >= 0) {
      const container = scrollRef.current;
      const playheadX = playheadStep * CELL_WIDTH_PX;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;
      
      if (playheadX < viewLeft || playheadX > viewRight - 50) {
        container.scrollTo({ left: playheadX - 50, behavior: 'auto' });
      }
    }
  }, [playheadStep, isPlaying, autoScroll]);

  return (
    <div className="flex h-full w-full bg-[#C4C1B3] overflow-hidden relative font-sans text-[#4E4A42]">
      {/* Track Headers (Left sidebar) */}
      <div className="w-72 flex-none border-r border-[#4E4A42] bg-[#D1CEC1] flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-[#4E4A42] sticky top-0 bg-[#D1CEC1] z-10 flex justify-between items-center">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#4E4A42]">Instrument Slots</span>
          <button onClick={addTrack} className="w-5 h-5 border border-[#4E4A42] flex items-center justify-center text-lg hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors leading-none pb-0.5">
            +
          </button>
        </div>

        {project.tracks.map((track, i) => (
          <div 
            key={track.id}
            onClick={() => setSelectedTrackId(track.id)}
            className={`p-3 border-b border-[#4E4A42] cursor-pointer transition-all group flex flex-col gap-1 border-l-4 ${selectedTrackId === track.id ? 'bg-[#BAB5A1] border-l-[#4E4A42]' : 'bg-[#BAB5A1] bg-opacity-40 border-l-[#4E4A42]/30 hover:bg-opacity-60'}`}
          >
            <div className="flex justify-between items-center">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-bold tracking-widest">[{String(i+1).padStart(2, '0')}]</span>
                 <div className="relative w-4 h-4 rounded-full overflow-hidden cursor-pointer shadow-sm border border-[#4E4A42]" title="Change Track Color">
                   <div className="w-full h-full pointer-events-none" style={{ backgroundColor: track.color }} />
                   <input 
                     type="color" 
                     value={track.color || '#4E4A42'} 
                     onChange={e => updateTrack(track.id, { color: e.target.value })}
                     className="absolute -top-4 -left-4 w-12 h-12 opacity-0 cursor-pointer"
                   />
                 </div>
               </div>
               <select 
                value={track.instrument}
                onChange={e => updateTrack(track.id, { instrument: e.target.value as InstrumentType })}
                onClick={e => e.stopPropagation()}
                className="bg-transparent text-[10px] uppercase font-bold tracking-widest opacity-60 outline-none text-[#4E4A42] text-right appearance-none hover:opacity-100 cursor-pointer"
              >
                <option value="square">Square</option>
                <option value="triangle">Triangle</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="pulse">Pulse</option>
                <option value="fmsquare">FM Square</option>
                <option value="fmsawtooth">FM Sawtooth</option>
                <option value="fmtriangle">FM Triangle</option>
                <option value="fatsquare">Fat Square</option>
                <option value="fatsawtooth">Fat Saw</option>
                <option value="fattriangle">Fat Tri</option>
                <option value="pwm">PWM</option>
                <option value="amtriangle">AM Tri</option>
              </select>
            </div>
            
            <div className="flex justify-between items-center mt-1 mb-1 relative pr-12">
              <input 
                type="text" 
                value={track.name}
                onChange={e => updateTrack(track.id, { name: e.target.value })}
                className="bg-transparent text-sm font-bold uppercase text-[#4E4A42] outline-none w-full tracking-widest pl-1 border-b border-transparent hover:border-[#4E4A42]/20 focus:border-[#4E4A42]/60 transition-colors"
                onClick={e => e.stopPropagation()}
              />
              <div className={`flex items-center gap-1 transition-opacity absolute right-0 bg-transparent pl-2 z-10 ${selectedTrackId === track.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                 <button 
                  onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                  className={`w-5 h-5 flex items-center justify-center border border-[#4E4A42] text-[9px] font-bold ${track.muted ? 'bg-[#4E4A42] text-[#D1CEC1]' : 'hover:bg-[#4E4A42] hover:text-[#D1CEC1]'}`}
                  title="Mute"
                >
                  M
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
                  className={`w-5 h-5 flex items-center justify-center border border-[#4E4A42] text-[9px] font-bold ${track.solo ? 'bg-[#4E4A42] text-[#D1CEC1]' : 'hover:bg-[#4E4A42] hover:text-[#D1CEC1]'}`}
                  title="Solo"
                >
                  S
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 flex-1 mr-2" onClick={e => e.stopPropagation()}>
                  <span className="text-[9px] font-bold tracking-widest opacity-60">VOL</span>
                  <input 
                    type="range" min="-40" max="0" 
                    value={track.volume} 
                    onChange={e => updateTrack(track.id, { volume: parseInt(e.target.value) })}
                    className="flex-1 h-1 bg-[#4E4A42]/20 appearance-none rounded-none accent-[#4E4A42] outline-none"
                    title="Volume"
                  />
                  <span className="text-[9px] w-6 text-right font-mono opacity-60">{track.volume}</span>
              </div>
              
              <div className={`flex gap-1 transition-opacity relative z-20 ${selectedTrackId === track.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleGenerateTrack(`A new ${track.instrument} line for ${track.name}`); }}
                  className="p-1 text-[#4E4A42] border border-transparent hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors"
                  title="AI Generate new layer"
                >
                  <Sparkles size={12} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); clearTrackNotes(track.id); }}
                  className="p-1 text-[#4E4A42] border border-transparent hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors"
                  title="Clear Notes"
                >
                  <XCircle size={12} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }}
                  className="p-1 text-[#4E4A42] border border-transparent hover:bg-[#4E4A42] hover:text-[#D1CEC1] transition-colors"
                  title="Delete Track"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Timeline Lanes (Right) */}
      <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#C4C1B3]" ref={scrollRef}>
        <div style={{ width: project.totalSteps * CELL_WIDTH_PX }} className="min-h-full">
          {/* Tick Rulers */}
          <div 
            className="h-8 border-b border-[#4E4A42] bg-[#D1CEC1] sticky top-0 z-20 flex cursor-pointer"
            onMouseDown={(e) => {
               const rect = e.currentTarget.getBoundingClientRect();
               const step = Math.max(0, Math.floor((e.clientX - rect.left) / CELL_WIDTH_PX));
               seek(step);
            }}
          >
            {Array.from({ length: project.totalSteps }).map((_, i) => (
              <div 
                key={i} 
                className={`flex-none border-l h-full text-[10px] font-bold tracking-widest text-[#4E4A42] p-1 pointer-events-none ${i % 16 === 0 ? 'border-[#4E4A42]' : 'border-[#4E4A42]/30'} ${i % 4 === 0 ? 'bg-[#BAB5A1]/20' : ''}`}
                style={{ width: CELL_WIDTH_PX }}
              >
                {i % 16 === 0 ? '0' + (Math.floor(i/16)+1) + ':00' : ''}
              </div>
            ))}
          </div>

          <div className="relative pt-2">
            {/* Background Grid */}
            <div className="absolute inset-0 pointer-events-none flex" style={{ top: 8, height: 'calc(100% - 8px)' }}>
              {Array.from({ length: project.totalSteps }).map((_, i) => (
                 <div key={i} className={`flex-none border-l ${i % 16 === 0 ? 'border-[#4E4A42]' : i % 4 === 0 ? 'border-[#4E4A42]/40' : 'border-[#4E4A42]/10'}`} style={{ width: CELL_WIDTH_PX }} />
              ))}
            </div>

             {/* Track Blocks */}
            <div className="flex flex-col relative z-10 space-y-4 px-0">
               {project.tracks.map((track) => (
                 <div key={track.id} className="relative h-20 bg-transparent overflow-hidden mx-0 border-b border-[#4E4A42]/20">
                    {track.notes.map(note => {
                      const noteIndex = PIANO_ROLL_NOTES.indexOf(note.note);
                      const normIndex = noteIndex !== -1 ? noteIndex / (PIANO_ROLL_NOTES.length - 1) : 0.5;
                      const topPx = normIndex * 74 + 2; // Scale 0-74 to fit in 80px
                      return (
                      <div 
                        key={note.id}
                        className="absolute h-[3px] rounded-full opacity-80 overflow-hidden mix-blend-multiply"
                        style={{
                          left: note.startStep * CELL_WIDTH_PX,
                          width: Math.max(2, note.durationSteps * CELL_WIDTH_PX - 1),
                          backgroundColor: track.color || '#4E4A42',
                          top: topPx
                        }}
                      />
                    )})}
                 </div>
               ))}
            </div>

            {/* Playhead */}
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
