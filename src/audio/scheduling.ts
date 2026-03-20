import type { Song, Track } from '@/types/engine';
import type { ScheduledNote } from './scheduler';

function getTrackPattern(track: Track, patternId: string) {
  return track.patterns.find((pattern) => pattern.id === patternId);
}

export function buildScheduledNotes(song: Song): { notes: ScheduledNote[]; lengthTicks: number } {
  const notes: ScheduledNote[] = [];
  let maxTick = 0;

  song.tracks.forEach((track) => {
    const lane = song.arrangement.lanes.find((item) => item.trackId === track.id);

    if (!lane || lane.instances.length === 0) {
      const pattern = track.patterns[track.activePatternIndex];
      if (!pattern) return;
      pattern.notes.forEach((note) => {
        const startTick = note.startTick;
        const endTick = note.startTick + note.durationTicks;
        maxTick = Math.max(maxTick, endTick);
        notes.push({
          trackId: track.id,
          channel: track.channel,
          engineType: track.engineType,
          instrumentId: track.instrumentId,
          midiNote: note.midiNote,
          velocity: note.velocity,
          startTick,
          durationTicks: note.durationTicks,
        });
      });
      return;
    }

    lane.instances.forEach((instance) => {
      const pattern = getTrackPattern(track, instance.patternId);
      if (!pattern) return;

      pattern.notes.forEach((note) => {
        const startTick = instance.startTick + note.startTick;
        const endTick = startTick + note.durationTicks;
        maxTick = Math.max(maxTick, endTick);

        notes.push({
          trackId: track.id,
          channel: track.channel,
          engineType: track.engineType,
          instrumentId: track.instrumentId,
          midiNote: note.midiNote,
          velocity: note.velocity,
          startTick,
          durationTicks: note.durationTicks,
        });
      });
    });
  });

  const arrangementLength = song.arrangement.lengthTicks;
  return {
    notes,
    lengthTicks: Math.max(arrangementLength, maxTick || arrangementLength || song.ppqn * 16),
  };
}
