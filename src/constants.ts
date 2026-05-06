import { Project } from './types';

export const CELL_WIDTH_PX = 24;
export const ROW_HEIGHT_PX = 20;

// All MIDI notes from C1 to C6
export const PIANO_ROLL_NOTES = [
  'C6', 'B5', 'Bb5', 'A5', 'Ab5', 'G5', 'Gb5', 'F5', 'E5', 'Eb5', 'D5', 'Db5',
  'C5', 'B4', 'Bb4', 'A4', 'Ab4', 'G4', 'Gb4', 'F4', 'E4', 'Eb4', 'D4', 'Db4',
  'C4', 'B3', 'Bb3', 'A3', 'Ab3', 'G3', 'Gb3', 'F3', 'E3', 'Eb3', 'D3', 'Db3',
  'C3', 'B2', 'Bb2', 'A2', 'Ab2', 'G2', 'Gb2', 'F2', 'E2', 'Eb2', 'D2', 'Db2',
  'C2', 'B1', 'Bb1', 'A1', 'Ab1', 'G1', 'Gb1', 'F1', 'E1', 'Eb1', 'D1', 'Db1',
  'C1'
];

export const INITIAL_PROJECT: Project = {
  tempo: 95, // Slow, melancholic
  totalSteps: 64, // 4 bars
  tracks: [
    {
      id: 'trk_lead',
      name: 'Melody (Lead)',
      instrument: 'pulse',
      color: '#e879f9', // Fuchsia
      muted: false,
      solo: false,
      volume: -6,
      notes: [
        { id: 'n1', note: 'A4', startStep: 0, durationSteps: 4, velocity: 0.8 },
        { id: 'n2', note: 'G4', startStep: 4, durationSteps: 4, velocity: 0.8 },
        { id: 'n3', note: 'A4', startStep: 8, durationSteps: 8, velocity: 0.9 },
        { id: 'n4', note: 'C5', startStep: 16, durationSteps: 6, velocity: 0.8 },
        { id: 'n5', note: 'B4', startStep: 22, durationSteps: 2, velocity: 0.7 },
        { id: 'n6', note: 'A4', startStep: 24, durationSteps: 8, velocity: 0.8 },
        { id: 'n7', note: 'E4', startStep: 32, durationSteps: 16, velocity: 0.7 },
        { id: 'n8', note: 'G4', startStep: 48, durationSteps: 4, velocity: 0.7 },
        { id: 'n9', note: 'F4', startStep: 52, durationSteps: 4, velocity: 0.7 },
        { id: 'n10', note: 'E4', startStep: 56, durationSteps: 8, velocity: 0.6 }
      ]
    },
    {
      id: 'trk_arp',
      name: 'Arpeggio',
      instrument: 'triangle',
      color: '#38bdf8', // Light Blue
      muted: false,
      solo: false,
      volume: -8,
      notes: [
        // Dm
        { id: 'a1', note: 'D3', startStep: 0, durationSteps: 2, velocity: 0.5 },
        { id: 'a2', note: 'F3', startStep: 2, durationSteps: 2, velocity: 0.5 },
        { id: 'a3', note: 'A3', startStep: 4, durationSteps: 2, velocity: 0.5 },
        { id: 'a4', note: 'F3', startStep: 6, durationSteps: 2, velocity: 0.5 },
        { id: 'a5', note: 'D3', startStep: 8, durationSteps: 2, velocity: 0.5 },
        { id: 'a6', note: 'F3', startStep: 10, durationSteps: 2, velocity: 0.5 },
        { id: 'a7', note: 'A3', startStep: 12, durationSteps: 2, velocity: 0.5 },
        { id: 'a8', note: 'F3', startStep: 14, durationSteps: 2, velocity: 0.5 },
        // Bb
        { id: 'a9', note: 'Bb2', startStep: 16, durationSteps: 2, velocity: 0.5 },
        { id: 'a10', note: 'D3', startStep: 18, durationSteps: 2, velocity: 0.5 },
        { id: 'a11', note: 'F3', startStep: 20, durationSteps: 2, velocity: 0.5 },
        { id: 'a12', note: 'D3', startStep: 22, durationSteps: 2, velocity: 0.5 },
        { id: 'a13', note: 'Bb2', startStep: 24, durationSteps: 2, velocity: 0.5 },
        { id: 'a14', note: 'D3', startStep: 26, durationSteps: 2, velocity: 0.5 },
        { id: 'a15', note: 'F3', startStep: 28, durationSteps: 2, velocity: 0.5 },
        { id: 'a16', note: 'D3', startStep: 30, durationSteps: 2, velocity: 0.5 },
        // C
        { id: 'a17', note: 'C3', startStep: 32, durationSteps: 2, velocity: 0.5 },
        { id: 'a18', note: 'E3', startStep: 34, durationSteps: 2, velocity: 0.5 },
        { id: 'a19', note: 'G3', startStep: 36, durationSteps: 2, velocity: 0.5 },
        { id: 'a20', note: 'E3', startStep: 38, durationSteps: 2, velocity: 0.5 },
        { id: 'a21', note: 'C3', startStep: 40, durationSteps: 2, velocity: 0.5 },
        { id: 'a22', note: 'E3', startStep: 42, durationSteps: 2, velocity: 0.5 },
        { id: 'a23', note: 'G3', startStep: 44, durationSteps: 2, velocity: 0.5 },
        { id: 'a24', note: 'E3', startStep: 46, durationSteps: 2, velocity: 0.5 },
        // A
        { id: 'a25', note: 'A2', startStep: 48, durationSteps: 2, velocity: 0.5 },
        { id: 'a26', note: 'Db3', startStep: 50, durationSteps: 2, velocity: 0.5 },
        { id: 'a27', note: 'E3', startStep: 52, durationSteps: 2, velocity: 0.5 },
        { id: 'a28', note: 'Db3', startStep: 54, durationSteps: 2, velocity: 0.5 },
        { id: 'a29', note: 'A2', startStep: 56, durationSteps: 2, velocity: 0.5 },
        { id: 'a30', note: 'Db3', startStep: 58, durationSteps: 2, velocity: 0.5 },
        { id: 'a31', note: 'E3', startStep: 60, durationSteps: 2, velocity: 0.5 },
        { id: 'a32', note: 'Db3', startStep: 62, durationSteps: 2, velocity: 0.5 },
      ]
    },
    {
      id: 'trk_bass',
      name: 'Bass',
      instrument: 'sawtooth',
      color: '#fb7185', // Rose
      muted: false,
      solo: false,
      volume: -10,
      notes: [
        { id: 'b1', note: 'D2', startStep: 0, durationSteps: 16, velocity: 0.7 },
        { id: 'b2', note: 'Bb1', startStep: 16, durationSteps: 16, velocity: 0.7 },
        { id: 'b3', note: 'C2', startStep: 32, durationSteps: 16, velocity: 0.7 },
        { id: 'b4', note: 'A1', startStep: 48, durationSteps: 16, velocity: 0.7 },
      ]
    }
  ]
};
