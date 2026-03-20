import { Midi } from '@tonejs/midi';
import { buildScheduledNotes } from '@/audio/scheduling';
import { clampMidiByMode, ticksPerQuantize } from '@/lib/song-utils';
import type {
  MIDIImportOptions,
  MIDITrackPreview,
  Note,
  Quantize,
  Song,
  Track,
} from '@/types/engine';

export interface MIDIAnalysisResult {
  midi: Midi;
  previews: MIDITrackPreview[];
  warnings: string[];
}

export interface MIDIImportResult {
  byTrack: Record<string, Omit<Note, 'id'>[]>;
  warnings: string[];
  importedCount: number;
  suggestedLengthTicks: number;
}

function convertTick(tick: number, midiPPQ: number, songPPQ: number): number {
  if (!midiPPQ) return tick;
  return Math.round((tick / midiPPQ) * songPPQ);
}

function quantizeValue(tick: number, ppqn: number, quantize: Quantize): number {
  const step = ticksPerQuantize(ppqn, quantize);
  return Math.max(0, Math.round(tick / step) * step);
}

export async function parseMidiFile(file: File): Promise<Midi> {
  const data = await file.arrayBuffer();
  return parseMidiArrayBuffer(data);
}

export function parseMidiArrayBuffer(data: ArrayBuffer): Midi {
  return new Midi(data);
}

export function analyzeMidi(midi: Midi, targetPPQ: number): MIDIAnalysisResult {
  const previews: MIDITrackPreview[] = midi.tracks.map((track, index) => {
    const durationTicks = track.notes.reduce((max, note) => {
      const end = convertTick(note.ticks + note.durationTicks, midi.header.ppq, targetPPQ);
      return Math.max(max, end);
    }, 0);

    const isPercussion = track.channel === 9 || /drum|perc|kit/i.test(track.name || '');

    return {
      index,
      name: track.name || `Track ${index + 1}`,
      noteCount: track.notes.length,
      durationTicks,
      isPercussion,
    };
  });

  const warnings: string[] = [];
  if (previews.length === 0) {
    warnings.push('This MIDI file contains no note tracks.');
  }

  return { midi, previews, warnings };
}

function getTrackById(song: Song, trackId: string): Track | undefined {
  return song.tracks.find((track) => track.id === trackId);
}

export function importMidiToSong(
  song: Song,
  midi: Midi,
  options: MIDIImportOptions,
  mode: 'strict' | 'modern'
): MIDIImportResult {
  const byTrack: Record<string, Omit<Note, 'id'>[]> = {};
  const warnings: string[] = [];
  let importedCount = 0;
  let suggestedLengthTicks = song.arrangement.lengthTicks;

  const map = new Map(options.trackMappings.map((mapping) => [mapping.sourceTrackIndex, mapping.targetTrackId]));

  midi.tracks.forEach((sourceTrack, sourceTrackIndex) => {
    const targetTrackId = map.get(sourceTrackIndex);
    if (!targetTrackId) {
      if (sourceTrack.notes.length > 0) {
        warnings.push(`Skipped ${sourceTrack.name || `track ${sourceTrackIndex + 1}`} (no target mapping).`);
      }
      return;
    }

    const targetTrack = getTrackById(song, targetTrackId);
    if (!targetTrack) {
      warnings.push(`Mapping target not found for source track ${sourceTrackIndex + 1}.`);
      return;
    }

    sourceTrack.notes.forEach((sourceNote) => {
      let midiNote = sourceNote.midi + options.transpose;
      midiNote = clampMidiByMode(midiNote, mode, options.clampToNesRange);

      const rawStartTick = convertTick(sourceNote.ticks, midi.header.ppq, song.ppqn);
      const rawDuration = Math.max(1, convertTick(sourceNote.durationTicks, midi.header.ppq, song.ppqn));

      const startTick = quantizeValue(rawStartTick, song.ppqn, options.quantize);
      const durationTicks = Math.max(1, quantizeValue(rawDuration, song.ppqn, options.quantize));

      const velocity = Math.max(
        1,
        Math.min(127, Math.round(sourceNote.velocity * 127 * Math.max(0.05, options.velocityScale)))
      );

      const note: Omit<Note, 'id'> = {
        midiNote,
        startTick,
        durationTicks,
        velocity,
      };

      if (!byTrack[targetTrackId]) byTrack[targetTrackId] = [];
      byTrack[targetTrackId].push(note);
      importedCount += 1;

      suggestedLengthTicks = Math.max(suggestedLengthTicks, startTick + durationTicks + song.ppqn);
    });
  });

  if (importedCount === 0) {
    warnings.push('No notes were imported. Check your mappings and file content.');
  }

  return {
    byTrack,
    warnings,
    importedCount,
    suggestedLengthTicks,
  };
}

export function exportMidi(song: Song): Uint8Array {
  const midi = new Midi();
  midi.header.setTempo(song.bpm);

  const schedule = buildScheduledNotes(song);
  const byTrack = new Map<string, ReturnType<Midi['addTrack']>>();

  song.tracks.forEach((track) => {
    const midiTrack = midi.addTrack();
    midiTrack.name = track.name;
    midiTrack.channel = track.channel === 'noise' || track.channel === 'dpcm' ? 9 : 0;
    byTrack.set(track.id, midiTrack);
  });

  schedule.notes.forEach((note) => {
    const midiTrack = byTrack.get(note.trackId);
    if (!midiTrack) return;

    midiTrack.addNote({
      midi: note.midiNote,
      ticks: note.startTick,
      durationTicks: note.durationTicks,
      velocity: note.velocity / 127,
    });
  });

  return midi.toArray();
}
