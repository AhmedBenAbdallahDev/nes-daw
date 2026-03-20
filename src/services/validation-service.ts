import type { AppSettings, Song, Track, ValidationIssue, ValidationSummary } from '@/types/engine';

function maxPolyphony(track: Track, song: Song, settings: AppSettings): number {
  if (settings.mode === 'strict' || settings.strictConfig.enableAuthenticLimits) {
    return Math.max(1, settings.strictConfig.maxPolyphonyPerChannel);
  }
  return Math.max(1, song.constraints.maxVoicesPerTrack);
}

function computeMaxOverlap(track: Track): number {
  const pattern = track.patterns[track.activePatternIndex];
  if (!pattern || pattern.notes.length === 0) return 0;

  const events = pattern.notes.flatMap((note) => [
    { tick: note.startTick, delta: 1 },
    { tick: note.startTick + note.durationTicks, delta: -1 },
  ]);
  events.sort((a, b) => (a.tick === b.tick ? a.delta - b.delta : a.tick - b.tick));

  let current = 0;
  let max = 0;
  events.forEach((event) => {
    current += event.delta;
    max = Math.max(max, current);
  });

  return max;
}

function laneHasContent(song: Song, trackId: string): boolean {
  const lane = song.arrangement.lanes.find((item) => item.trackId === trackId);
  if (!lane || lane.instances.length === 0) return false;

  const track = song.tracks.find((item) => item.id === trackId);
  if (!track) return false;

  return lane.instances.some((instance) => {
    const pattern = track.patterns.find((item) => item.id === instance.patternId);
    return Boolean(pattern && pattern.notes.length > 0);
  });
}

export function buildValidationSummary(song: Song, settings: AppSettings): ValidationSummary {
  const issues: ValidationIssue[] = [];

  const loopStart = song.arrangement.sectionMarkers.find((marker) => marker.role === 'loop-start');
  const loopEnd = song.arrangement.sectionMarkers.find((marker) => marker.role === 'loop-end');
  if (!loopStart || !loopEnd || loopEnd.startTick <= loopStart.startTick) {
    issues.push({
      id: 'missing-loop-markers',
      severity: 'warning',
      code: 'missing-loop-markers',
      message: 'Loop preview markers are missing or invalid. Add Loop Start and Loop End markers.',
    });
  }

  if (settings.midiConfig.routingMode === 'channel-map') {
    const expectedChannels = settings.mode === 'strict'
      ? [1, 2, 3, 10, settings.strictConfig.enableDpcm ? 5 : null].filter(
          (value): value is number => value !== null
        )
      : [];

    expectedChannels.forEach((channel) => {
      if (!song.midiChannelMap[channel]) {
        issues.push({
          id: `unmapped-midi-channel-${channel}`,
          severity: 'warning',
          code: 'unmapped-midi-channel',
          message: `MIDI channel ${channel} is not mapped in Channel Map mode.`,
        });
      }
    });
  }

  song.tracks.forEach((track) => {
    const pattern = track.patterns[track.activePatternIndex];
    if (!pattern) return;

    if (!laneHasContent(song, track.id)) {
      issues.push({
        id: `empty-arrangement-lane-${track.id}`,
        severity: 'info',
        code: 'empty-arrangement-lane',
        message: `${track.name} has no active arrangement content.`,
        trackId: track.id,
      });
    }

    const overlap = computeMaxOverlap(track);
    const allowed = maxPolyphony(track, song, settings);
    if (overlap > allowed) {
      issues.push({
        id: `polyphony-risk-${track.id}`,
        severity: settings.mode === 'strict' ? 'error' : 'warning',
        code: 'polyphony-risk',
        message: `${track.name} reaches ${overlap} overlapping notes, exceeding the limit of ${allowed}.`,
        trackId: track.id,
      });
    }

    if (settings.mode === 'strict') {
      const outOfRange = pattern.notes.find((note) => note.midiNote < 24 || note.midiNote > 108);
      if (outOfRange) {
        issues.push({
          id: `range-violation-${track.id}`,
          severity: 'warning',
          code: 'range-violation',
          message: `${track.name} contains notes outside the practical NES range.`,
          trackId: track.id,
          tick: outOfRange.startTick,
        });
      }
    }

    const engineMismatch =
      (track.channel === 'noise' && track.engineType !== 'nes') ||
      (track.channel === 'dpcm' && track.engineType !== 'dpcm') ||
      (track.channel === 'modern' && settings.mode === 'strict');
    if (engineMismatch) {
      issues.push({
        id: `channel-engine-mismatch-${track.id}`,
        severity: 'error',
        code: 'channel-engine-mismatch',
        message: `${track.name} has an engine/channel assignment that does not match the current mode.`,
        trackId: track.id,
      });
    }
  });

  return {
    issues,
    infoCount: issues.filter((issue) => issue.severity === 'info').length,
    warningCount: issues.filter((issue) => issue.severity === 'warning').length,
    errorCount: issues.filter((issue) => issue.severity === 'error').length,
  };
}
