'use client';

import { useEffect, useMemo } from 'react';
import { nesEngine } from '@/audio/nes-engine';
import { transportController } from '@/audio/transport-controller';
import { useDAWStore } from '@/store/daw-store';

interface UseSchedulerReturn {
  play: () => void;
  stop: () => void;
  record: () => void;
  pause: () => void;
  seekTo: (tick: number) => void;
  togglePlayPause: () => void;
  isPlaying: boolean;
  isRecording: boolean;
  isPaused: boolean;
  currentTick: number;
}

export function useScheduler(): UseSchedulerReturn {
  const transportState = useDAWStore((state) => state.transportState);
  const currentTick = useDAWStore((state) => state.currentTick);
  const bpm = useDAWStore((state) => state.bpm);
  const song = useDAWStore((state) => state.song);
  const loopEnabled = useDAWStore((state) => state.loopEnabled);
  const loopStart = useDAWStore((state) => state.loopStart);
  const loopEnd = useDAWStore((state) => state.loopEnd);
  const engineReady = useDAWStore((state) => state.engineReady);

  useEffect(() => {
    transportController.initialize();
  }, []);

  useEffect(() => {
    if (!engineReady) return;

    const attach = () => {
      if (transportController.attachAudioContextIfReady()) {
        transportController.syncSchedulerFromStore();
        return true;
      }
      return false;
    };

    if (attach()) return;

    const interval = setInterval(() => {
      if (attach()) clearInterval(interval);
    }, 80);

    const timeout = setTimeout(() => clearInterval(interval), 30_000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [engineReady]);

  useEffect(() => {
    if (!nesEngine.getContext()) return;
    transportController.syncSchedulerFromStore();
  }, [bpm, song, loopEnabled, loopStart, loopEnd]);

  return useMemo(
    () => ({
      play: () => transportController.play(),
      stop: () => transportController.stop(),
      record: () => transportController.record(),
      pause: () => transportController.pause(),
      seekTo: (tick: number) => transportController.seek(tick),
      togglePlayPause: () => transportController.togglePlayPause(),
      isPlaying: transportState === 'playing',
      isRecording: transportState === 'recording',
      isPaused: transportState === 'paused',
      currentTick,
    }),
    [transportState, currentTick]
  );
}
