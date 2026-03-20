'use client';

import { useCallback, useEffect, useRef } from 'react';
import { INSTRUMENTS } from '@/audio/instruments';
import { nesEngine } from '@/audio/nes-engine';
import { clampMidiByMode } from '@/lib/song-utils';
import { useDAWStore } from '@/store/daw-store';
import type { Track } from '@/types/engine';

interface UseNESEngineReturn {
  init: () => void;
  playTrackNote: (track: Track, midiNote: number, velocity: number) => number;
  stopNote: (voiceId: number) => void;
  stopChannel: (channel: Track['channel']) => void;
  setChannelPitchBend: (channel: Track['channel'], normalized: number) => void;
  setChannelGain: (channel: Track['channel'], value: number) => void;
  setVolume: (volume: number) => void;
  mute: (muted: boolean) => void;
  isReady: boolean;
}

export function useNESEngine(): UseNESEngineReturn {
  const setEngineReady = useDAWStore((state) => state.setEngineReady);
  const isReady = useDAWStore((state) => state.engineReady);
  const settings = useDAWStore((state) => state.settings);
  const songConstraints = useDAWStore((state) => state.song.constraints);
  const initAttemptedRef = useRef(false);

  const init = useCallback(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    try {
      nesEngine.init();
      nesEngine.setVolume(settings.audioConfig.masterVolume);
      setEngineReady(true);
    } catch (error) {
      console.error('Failed to initialize NES engine:', error);
      setEngineReady(false);
    }
  }, [settings.audioConfig.masterVolume, setEngineReady]);

  const playTrackNote = useCallback(
    (track: Track, midiNote: number, velocity: number): number => {
      if (!isReady) return -1;

      const instrument = INSTRUMENTS[track.instrumentId];
      if (!instrument) return -1;

      const clampedMidi = clampMidiByMode(
        midiNote,
        settings.mode,
        songConstraints.clampMidiRange || settings.strictConfig.enableAuthenticLimits
      );

      if (
        settings.mode === 'strict' &&
        (songConstraints.enforcePolyphonyLimit || settings.strictConfig.enableAuthenticLimits)
      ) {
        nesEngine.stopChannelVoices(track.channel);
      }

      return nesEngine.playByTrack(track.channel, track.engineType, clampedMidi, velocity, {
        velocity,
        dutyCycle: instrument.dutyCycle,
        envelope: instrument.envelope,
        noiseMode: instrument.noiseMode,
      });
    },
    [isReady, settings.mode, settings.strictConfig.enableAuthenticLimits, songConstraints]
  );

  const stopNote = useCallback((voiceId: number) => {
    nesEngine.stopNote(voiceId);
  }, []);

  const stopChannel = useCallback((channel: Track['channel']) => {
    nesEngine.stopChannelVoices(channel);
  }, []);

  const setVolume = useCallback((volume: number) => {
    nesEngine.setVolume(volume);
  }, []);

  const setChannelPitchBend = useCallback((channel: Track['channel'], normalized: number) => {
    nesEngine.setChannelPitchBend(channel, normalized);
  }, []);

  const setChannelGain = useCallback((channel: Track['channel'], value: number) => {
    nesEngine.setChannelGain(channel, value);
  }, []);

  const mute = useCallback((muted: boolean) => {
    nesEngine.mute(muted);
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    nesEngine.setVolume(settings.audioConfig.masterVolume);
  }, [settings.audioConfig.masterVolume]);

  return {
    init,
    playTrackNote,
    stopNote,
    stopChannel,
    setChannelPitchBend,
    setChannelGain,
    setVolume,
    mute,
    isReady,
  };
}
