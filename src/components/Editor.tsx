import React, { useState, useEffect } from 'react';
import { useDAWContext } from '../context/DAWContext';
import { TopBar } from './TopBar';
import { Arrangement } from './Arrangement';
import { PianoRoll } from './PianoRoll';
import * as Tone from 'tone';

export function Editor() {
  const { isGenerating } = useDAWContext();
  const [playheadStep, setPlayheadStep] = useState(-1);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      if (Tone.Transport.state === 'started') {
        const pos = Tone.Transport.position.toString().split(':');
        if (pos.length === 3) {
          const bars = parseFloat(pos[0]);
          const beats = parseFloat(pos[1]);
          const sixteenths = parseFloat(pos[2]);
          const step = bars * 16 + beats * 4 + sixteenths;
          setPlayheadStep(step);
        }
      } else {
        setPlayheadStep(-1);
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-[#D1CEC1] text-[#4E4A42] overflow-hidden font-sans uppercase">
      <TopBar />
      
      {/* Resizable split between arrangement and piano roll */}
      <div className="flex flex-col flex-1 overflow-hidden p-6 pb-0 gap-6">
        {/* Arrangement View (Top) */}
        <div className="flex-none h-1/2 min-h-64 border border-[#4E4A42] bg-[#C4C1B3] flex shadow-inner">
           <Arrangement playheadStep={playheadStep} />
        </div>
        
        {/* Piano Roll (Bottom) */}
        <div className="flex-1 bg-[#D1CEC1] relative border border-[#4E4A42] mb-6 shadow-inner flex overflow-hidden">
           <PianoRoll playheadStep={playheadStep} />
        </div>
      </div>

      {isGenerating && (
        <div className="absolute inset-0 z-50 bg-[#D1CEC1]/90 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#4E4A42] border-t-transparent animate-spin mx-auto mb-6"></div>
            <h2 className="text-xl font-bold text-[#4E4A42] tracking-widest uppercase opacity-80">
              Generating Melancholy...
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}
