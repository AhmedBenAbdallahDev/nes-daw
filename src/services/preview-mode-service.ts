import type { PlaybackPreviewMode, SongArrangement } from '@/types/engine';

export interface PreviewModeResult {
  seekTick: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}

function markerTick(arrangement: SongArrangement, role: NonNullable<SongArrangement['sectionMarkers'][number]['role']>) {
  return arrangement.sectionMarkers.find((marker) => marker.role === role)?.startTick ?? null;
}

export function deriveLoopRegionFromMarkers(arrangement: SongArrangement): {
  loopStart: number | null;
  loopEnd: number | null;
} {
  const loopStart = markerTick(arrangement, 'loop-start');
  const loopEnd = markerTick(arrangement, 'loop-end');

  if (loopStart === null || loopEnd === null || loopEnd <= loopStart) {
    return {
      loopStart: null,
      loopEnd: null,
    };
  }

  return { loopStart, loopEnd };
}

export function applyPreviewMode(
  mode: PlaybackPreviewMode,
  arrangement: SongArrangement
): PreviewModeResult {
  const introTick = markerTick(arrangement, 'intro') ?? 0;
  const { loopStart, loopEnd } = deriveLoopRegionFromMarkers(arrangement);

  if (mode === 'loop-only' && loopStart !== null && loopEnd !== null) {
    return {
      seekTick: loopStart,
      loopEnabled: true,
      loopStart,
      loopEnd,
    };
  }

  if (mode === 'intro-to-loop' && loopStart !== null && loopEnd !== null) {
    return {
      seekTick: introTick,
      loopEnabled: true,
      loopStart,
      loopEnd,
    };
  }

  return {
    seekTick: 0,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: arrangement.lengthTicks,
  };
}
