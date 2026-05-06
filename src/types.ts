export type InstrumentType = 'square' | 'triangle' | 'pulse' | 'sawtooth' | 'fmsquare' | 'fmsawtooth' | 'fmtriangle' | 'fatsquare' | 'fatsawtooth' | 'fattriangle' | 'pwm' | 'amtriangle';

// 1 step = 1 16th note
export interface NoteEvent {
  id: string; 
  note: string; // e.g., 'C4'
  startStep: number; 
  durationSteps: number; 
  velocity: number; 
}

export interface Track {
  id: string;
  name: string;
  instrument: InstrumentType;
  notes: NoteEvent[];
  color: string;
  muted: boolean;
  solo: boolean;
  volume: number; // in dB
}

export interface Project {
  id?: string;
  name?: string;
  tempo: number;
  totalSteps: number; // For example: 64 steps = 4 bars of 4/4
  tracks: Track[];
}
