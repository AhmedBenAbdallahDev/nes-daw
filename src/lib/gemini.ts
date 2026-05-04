import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Project, Track, NoteEvent, InstrumentType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const noteSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    note: { type: Type.STRING, description: "MIDI Note like 'C3', 'F#4'." },
    startStep: { type: Type.INTEGER, description: "Start position in 16th notes." },
    durationSteps: { type: Type.INTEGER, description: "Duration in 16th notes." },
    velocity: { type: Type.NUMBER, description: "0.0 to 1.0" }
  },
  required: ['note', 'startStep', 'durationSteps', 'velocity']
};

const trackSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    instrument: { type: Type.STRING, description: "'square', 'triangle', 'sawtooth', 'pulse', 'fmsquare', 'fmsawtooth', 'fmtriangle', 'fatsquare', 'fatsawtooth', 'fattriangle', 'pwm', 'amtriangle'" },
    notes: { type: Type.ARRAY, items: noteSchema }
  },
  required: ['name', 'instrument', 'notes']
};

const MUSICAL_RULES = `
CRITICAL MUSICAL RULES:
- Be incredibly creative. Generate AS MANY tracks and notes as you need (don't limit to 4 tracks; create 6-10 if needed for lush chords, arp, counter-melody, deep bass, pad, etc).
- Style: NieR Automata OST, intensely brooding melancholy, emotional modern chiptune.
- Instruments: heavily utilize modern chiptune/retro sounds ('pwm', 'fmsquare', 'fatsawtooth', 'fmsawtooth', 'amtriangle', etc) alongside standard waveforms.
- Harmony: Advanced extended chords (min9, maj7, dim7, half-diminished, alterated), suspended chords, lush inversions, secondary dominants, and deeply impactful emotional closures/cadences.
- Melody: Weaving counterpoint, expressive intervals, suspensions, and appoggiaturas.
- Structure: Create a full compelling arrangement that flows and evolves beautifully across the entire requested duration. Do not repeat a single bar, make the progression evolve and modulate!
`;

export async function generateFullSong(prompt: string, totalSteps: number, currentTempo: number): Promise<Project> {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      tempo: { type: Type.INTEGER, description: "BPM (e.g. 70-130)" },
      tracks: { type: Type.ARRAY, items: trackSchema }
    },
    required: ['tempo', 'tracks']
  };

  const fullPrompt = `You are an expert music producer. Create a full multi-track song JSON.
Total duration: ${totalSteps} sixteenth notes (approx ${totalSteps / 16} bars).
User Request: ${prompt}

${MUSICAL_RULES}

Ensure notes stay within range C2-C6 and strictly respect duration bounds (startStep < ${totalSteps}). Make sure to utilize multiple tracks for harmony (arps, bass, lead, pads).`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: fullPrompt,
    config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.85 }
  });

  const data = JSON.parse(response.text || '{}');
  
  const tracks: Track[] = (data.tracks || []).map((t: any, i: number) => {
    const uniqueNotes = new Map<string, any>();
    (t.notes || []).forEach((n: any, j: number) => {
      const s = parseInt(n.startStep, 10);
      const d = parseInt(n.durationSteps, 10);
      const v = parseFloat(n.velocity);
      
      const startStep = isNaN(s) ? 0 : Math.min(s, totalSteps - 1);
      const durationSteps = isNaN(d) ? 4 : Math.max(1, d);
      const velocity = isNaN(v) ? 0.8 : Math.max(0, Math.min(1, v));
      
      const key = `${n.note}_${startStep}`;
      if (!uniqueNotes.has(key)) {
        uniqueNotes.set(key, {
          id: 'n_' + Date.now() + '_' + i + '_' + j,
          note: n.note,
          startStep,
          durationSteps,
          velocity
        });
      }
    });

    return {
      id: 'trk_' + Date.now() + '_' + i,
      name: t.name || 'Generated',
      instrument: (t.instrument || 'square') as InstrumentType,
      color: ['#4E4A42', '#BAB5A1', '#C4C1B3', '#8B8678', '#5E5A51'][i % 5],
      muted: false, solo: false, volume: -6,
      notes: Array.from(uniqueNotes.values())
    };
  });

  return { tempo: data.tempo || currentTempo, totalSteps, tracks };
}

export async function generateSongExtension(prompt: string, context: Project, addedSteps: number): Promise<Project> {
  const startStep = context.totalSteps;
  const endStep = context.totalSteps + addedSteps;
  
  const contextStr = context.tracks.map((t, i) => 
    `Track ${i} "${t.name}" (${t.instrument}) last notes: ` +
    t.notes.filter(n => n.startStep >= startStep - 32).slice(-10).map(n => `${n.note}@${n.startStep}`).join(', ')
  ).join('\\n');

  const fullPrompt = `You are an expert producer extending a song. Context ends at step ${startStep}. Generate notes from ${startStep} to ${endStep}.

Tempo: ${context.tempo} BPM.
Existing Track context (last 2 bars notes):
${contextStr}

User Request: ${prompt}
${MUSICAL_RULES}

Output EXACTLY ${context.tracks.length} tracks in the exact same order. ONLY include NEW notes falling between step ${startStep} and ${endStep}. Continue the emotional progression strongly to build ${addedSteps / 16} more bars.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: { tracks: { type: Type.ARRAY, items: trackSchema } },
    required: ['tracks']
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: fullPrompt,
    config: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.85 }
  });

  const data = JSON.parse(response.text || '{}');
  const updatedTracks = context.tracks.map((t, i) => {
    const genTrack = data.tracks?.[i];
    const uniqueNotes = new Map<string, any>();
    (genTrack?.notes || []).forEach((n: any, j: number) => {
      const s = parseInt(n.startStep, 10);
      const d = parseInt(n.durationSteps, 10);
      const v = parseFloat(n.velocity);
      
      const noteStartStep = Math.max(startStep, Math.min(isNaN(s) ? startStep : s, endStep - 1));
      const durationSteps = isNaN(d) ? 4 : Math.max(1, d);
      const velocity = isNaN(v) ? 0.8 : Math.max(0, Math.min(1, v));
      
      const key = `${n.note}_${noteStartStep}`;
      if (!uniqueNotes.has(key)) {
        uniqueNotes.set(key, {
          id: 'n_ext_' + Date.now() + '_' + i + '_' + j,
          note: n.note,
          startStep: noteStartStep,
          durationSteps,
          velocity
        });
      }
    });
    return { ...t, notes: [...t.notes, ...Array.from(uniqueNotes.values())] };
  });

  return { ...context, totalSteps: endStep, tracks: updatedTracks };
}

export async function generateTrack(prompt: string, totalSteps: number, context: Project): Promise<Track> {
  const contextStr = context.tracks.map(t => `Track "${t.name}" (${t.instrument})`).join('\\n');

  const fullPrompt = `Add ONE new track to an existing composition.
Tempo: ${context.tempo} BPM. Duration: ${totalSteps} steps (16th notes).
Existing Tracks: ${contextStr}
User Request: ${prompt}
${MUSICAL_RULES} Make sure it harmonizes and adds emotion.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: fullPrompt,
    config: { responseMimeType: 'application/json', responseSchema: trackSchema, temperature: 0.85 }
  });

  const t = JSON.parse(response.text || '{}');
  const uniqueNotes = new Map<string, any>();
  (t.notes || []).forEach((n: any, j: number) => {
    const s = parseInt(n.startStep, 10);
    const d = parseInt(n.durationSteps, 10);
    const v = parseFloat(n.velocity);
    
    const startStep = isNaN(s) ? 0 : Math.min(s, totalSteps - 1);
    const durationSteps = isNaN(d) ? 4 : Math.max(1, d);
    const velocity = isNaN(v) ? 0.8 : Math.max(0, Math.min(1, v));
    
    const key = `${n.note}_${startStep}`;
    if (!uniqueNotes.has(key)) {
      uniqueNotes.set(key, {
        id: 'n_gen_' + Date.now() + '_' + j,
        note: n.note,
        startStep,
        durationSteps,
        velocity
      });
    }
  });

  return {
    id: 'trk_' + Date.now(),
    name: t.name || 'New Track',
    instrument: (t.instrument || 'square') as InstrumentType,
    color: '#4E4A42', 
    muted: false, solo: false, volume: -6,
    notes: Array.from(uniqueNotes.values())
  };
}
