import * as Tone from 'tone';
import { Project, Track } from '../types';

export class AudioManager {
  private static synths: Record<string, Tone.PolySynth> = {};
  private static parts: Record<string, Tone.Part> = {};
  private static masterReverb: Tone.Reverb;
  private static masterDelay: Tone.PingPongDelay;
  private static initialized = false;

  static async init(project: Project) {
    if (!this.initialized) {
      await Tone.start();
      this.masterReverb = new Tone.Reverb({ decay: 5, wet: 0.4 }).toDestination();
      this.masterDelay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.3, wet: 0.2 }).connect(this.masterReverb);
      this.initialized = true;
    }
    this.syncProject(project);
  }

  static togglePlayback() {
    if (Tone.Transport.state === 'started') {
      Tone.Transport.pause();
    } else {
      Tone.Transport.start();
    }
    return Tone.Transport.state;
  }

  static stopPlayback() {
    Tone.Transport.stop();
    return Tone.Transport.state;
  }

  static getState() {
    return Tone.Transport.state;
  }

  static setTempo(tempo: number) {
    Tone.Transport.bpm.value = tempo;
  }

  static seek(step: number) {
    Tone.Transport.position = `0:0:${step}`;
  }

  static syncProject(project: Project) {
    if (!this.initialized) return;

    Tone.Transport.bpm.value = project.tempo;
    
    // 1 step = 1 sixteenth note. totalSteps / 16 gives the number of whole notes. 
    // In notation "4n" is quarter note, "1m" is a measure (4 quarters).
    // Let's set a loop bound in ticks based on steps. 1 step is "16n".
    const loopDuration = `0:0:${project.totalSteps}`; // Bars:Beats:Sixteenths
    Tone.Transport.setLoopPoints(0, loopDuration);
    Tone.Transport.loop = true;

    // Track solo logic
    const anySolo = project.tracks.some(t => t.solo);

    const activeTrackIds = new Set(project.tracks.map(t => t.id));

    // Cleanup removed tracks
    for (const id in this.synths) {
      if (!activeTrackIds.has(id)) {
        this.synths[id].dispose();
        delete this.synths[id];
        if (this.parts[id]) {
          this.parts[id].dispose();
          delete this.parts[id];
        }
      }
    }

    // Sync active tracks
    project.tracks.forEach(track => {
      if (!this.synths[track.id]) {
        // Create new synth with higher polyphony to prevent voice stealing
        this.synths[track.id] = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 64 } as any);
        this.synths[track.id].connect(Tone.Destination);
        this.synths[track.id].connect(this.masterDelay);
      }
      
      const synth = this.synths[track.id];
      
      const isPluck = track.instrument.includes('square') || track.instrument.includes('pulse') || track.instrument === 'pwm';
      const isBassLead = track.instrument.includes('sawtooth');
      
      const env = isPluck
          ? { attack: 0.005, decay: 0.25, sustain: 0.3, release: 0.5 } // Plucky
          : isBassLead
          ? { attack: 0.01, decay: 0.1, sustain: 0.8, release: 1.5 } // Bright/Bass
          : { attack: 0.15, decay: 0.3, sustain: 0.8, release: 2 }; // Pads/Triangle
          
      // Update synth settings
      synth.set({
        oscillator: { type: track.instrument as any },
        envelope: env,
        portamento: 0.02
      });
      
      // Handle muting and volume
      const isAudible = anySolo ? track.solo : !track.muted;
      synth.volume.value = isAudible ? track.volume : -Infinity;

      // Update Part
      if (this.parts[track.id]) {
        this.parts[track.id].dispose();
      }

      const events = track.notes.map(n => ({
        time: `0:0:${n.startStep}`, 
        note: n.note, 
        duration: `0:0:${n.durationSteps}`, 
        velocity: n.velocity 
      }));

      this.parts[track.id] = new Tone.Part((time, value) => {
        synth.triggerAttackRelease(value.note, value.duration, time, value.velocity);
      }, events).start(0);
    });
  }

  // Preview an individual note (for piano roll clicking)
  static previewNote(note: string, instrument: string, duration = '8n') {
    if (!this.initialized) return;
    const synth = new Tone.Synth({ oscillator: { type: instrument as any } });
    synth.connect(Tone.Destination);
    synth.connect(this.masterReverb);
    synth.triggerAttackRelease(note, duration);
    // Cleanup afterwards
    setTimeout(() => synth.dispose(), 4000);
  }
}
