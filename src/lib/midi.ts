import { Midi } from '@tonejs/midi';
import { Project, Track, NoteEvent, InstrumentType } from '../types';

export function exportMidi(project: Project) {
  const midi = new Midi();
  const trackTempo = midi.header.tempos;
  trackTempo.push({ ticks: 0, bpm: project.tempo });

  project.tracks.forEach(t => {
    const track = midi.addTrack();
    track.name = t.name;
    
    // Using mapping from Tone.js steps (sixteenths) to actual time
    // 1 step = 1 sixteenth note
    // 1 beat = 4 sixteenth notes
    // Time in seconds = steps * (60 / tempo) / 4
    const secondsPerStep = (60 / project.tempo) / 4;

    t.notes.forEach(n => {
      track.addNote({
        name: n.note,
        time: n.startStep * secondsPerStep,
        duration: n.durationSteps * secondsPerStep,
        velocity: n.velocity
      });
    });
  });

  const blob = new Blob([midi.toArray()], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'retrolia-export.mid';
  a.click();
  URL.revokeObjectURL(url);
}

export function importMidi(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) throw new Error("Could not read file");
        const midi = new Midi(e.target.result as ArrayBuffer);
        
        let tempo = 120;
        if (midi.header.tempos.length > 0) {
          tempo = Math.round(midi.header.tempos[0].bpm);
        }

        const secondsPerStep = (60 / tempo) / 4;
        
        let maxStep = 64; // Default bounds
        const colors = ['#e879f9', '#38bdf8', '#fb7185', '#a3e635', '#a78bfa', '#facc15'];

        const tracks: Track[] = midi.tracks
          .filter(t => t.notes.length > 0)
          .map((t, idx) => {
            const notes = t.notes.map((n, i) => {
              const startStep = Math.round(n.time / secondsPerStep);
              const durationSteps = Math.max(1, Math.round(n.duration / secondsPerStep));
              if (startStep + durationSteps > maxStep) {
                // Expanding automatically for long midi files
                maxStep = Math.ceil((startStep + durationSteps) / 16) * 16;
              }
              return {
                id: `midi_n_${idx}_${i}`,
                note: n.name,
                startStep,
                durationSteps,
                velocity: n.velocity
              };
            });

            return {
              id: 'trk_midi_' + idx + '_' + Date.now(),
              name: t.name || `MIDI Track ${idx + 1}`,
              instrument: 'square' as InstrumentType, // Default to square
              color: colors[idx % colors.length],
              muted: false,
              solo: false,
              volume: -6,
              notes
            };
          });

        resolve({
          tempo,
          totalSteps: maxStep,
          tracks
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
