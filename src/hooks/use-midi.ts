'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { midiManager } from '@/audio/midi-manager';
import { scheduler } from '@/audio/scheduler';
import { transportController } from '@/audio/transport-controller';
import { applyMidiMessage } from '@/services/midi-control-service';
import { useDAWStore } from '@/store/daw-store';
import type { MIDIMessageEnvelope, Track } from '@/types/engine';
import { useNESEngine } from './use-nes-engine';

interface UseMIDIReturn {
  isConnected: boolean;
  deviceName: string | null;
  activeNotes: Set<number>;
}

interface ActiveInputVoice {
  voiceId: number;
  trackId: string;
  channel: Track['channel'];
  midiNote: number;
  startTick: number | null;
}

function inputKey(channel: number | null, midiNote: number): string {
  return `${channel ?? 0}:${midiNote}`;
}

export function useMIDI(): UseMIDIReturn {
  const setMidiConnected = useDAWStore((state) => state.setMidiConnected);
  const midiConnected = useDAWStore((state) => state.midiConnected);
  const midiDeviceName = useDAWStore((state) => state.midiDeviceName);

  const { playTrackNote, stopNote, stopChannel, setChannelPitchBend, setChannelGain, isReady } =
    useNESEngine();
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const inputVoiceMapRef = useRef<Map<string, ActiveInputVoice[]>>(new Map());
  const initAttemptedRef = useRef(false);
  const boolGateRef = useRef<Map<string, boolean>>(new Map());

  const resolveTargetTracks = useCallback(
    (message: MIDIMessageEnvelope) => {
      const state = useDAWStore.getState();
      const selectedTrack =
        state.song.tracks.find((track) => track.id === state.selectedTrackId) ?? state.song.tracks[0] ?? null;
      if (!selectedTrack) return [];

      if (state.settings.midiConfig.routingMode === 'selected-track') {
        return [selectedTrack];
      }

      if (state.settings.midiConfig.routingMode === 'channel-map' && message.channel) {
        const mappedTrackId = state.song.midiChannelMap[message.channel];
        const mappedTrack = state.song.tracks.find((track) => track.id === mappedTrackId);
        if (mappedTrack) return [mappedTrack];
        return [selectedTrack];
      }

      if (message.channel) {
        const mappedTrackId = state.song.midiChannelMap[message.channel];
        const mappedTrack = state.song.tracks.find((track) => track.id === mappedTrackId);
        if (mappedTrack) return [mappedTrack];
      }

      return [selectedTrack];
    },
    []
  );

  const pushAutomationPoint = useCallback(
    (
      target:
        | 'global.masterVolume'
        | 'global.tempo'
        | 'track.volume'
        | 'track.mute'
        | 'track.solo'
        | 'selectedTrack.macro1'
        | 'selectedTrack.macro2'
        | 'selectedTrack.macro3'
        | 'selectedTrack.macro4',
      value: number,
      trackId: string | null
    ) => {
      const state = useDAWStore.getState();
      if (state.transportState !== 'recording') return;
      if (!state.settings.midiConfig.writeAutomationOnRecord) return;
      state.addAutomationPoint(target, scheduler.getCurrentTick(), value, trackId);
    },
    []
  );

  const applyMappedTarget = useCallback(
    (
      target:
        | 'transport.play'
        | 'transport.stop'
        | 'transport.record'
        | 'global.masterVolume'
        | 'global.tempo'
        | 'track.volume'
        | 'track.mute'
        | 'track.solo'
        | 'selectedTrack.macro1'
        | 'selectedTrack.macro2'
        | 'selectedTrack.macro3'
        | 'selectedTrack.macro4',
      trackId: string | null,
      value: number
    ) => {
      const state = useDAWStore.getState();
      const clamped = Math.max(0, Math.min(1, value));
      switch (target) {
        case 'transport.play':
          if (clamped >= 0.5) transportController.play();
          break;
        case 'transport.stop':
          if (clamped >= 0.5) transportController.stop();
          break;
        case 'transport.record':
          if (clamped >= 0.5) transportController.record();
          break;
        case 'global.masterVolume':
          state.updateAudioConfig({ masterVolume: clamped });
          pushAutomationPoint('global.masterVolume', clamped, null);
          break;
        case 'global.tempo': {
          const bpm = Math.round(30 + clamped * 270);
          state.setBpm(bpm);
          pushAutomationPoint('global.tempo', clamped, null);
          break;
        }
        case 'track.volume': {
          const resolvedTrackId = trackId ?? state.selectedTrackId;
          state.setTrackVolume(resolvedTrackId, clamped);
          pushAutomationPoint('track.volume', clamped, resolvedTrackId);
          break;
        }
        case 'track.mute':
        case 'track.solo': {
          const resolvedTrackId = trackId ?? state.selectedTrackId;
          const track = state.song.tracks.find((item) => item.id === resolvedTrackId);
          if (!track) return;

          const nextBool = clamped >= 0.5;
          const key = `${target}:${resolvedTrackId}`;
          const prevBool = boolGateRef.current.get(key);
          if (prevBool === nextBool) return;
          boolGateRef.current.set(key, nextBool);

          if (target === 'track.mute' && track.muted !== nextBool) {
            state.toggleTrackMute(resolvedTrackId);
          } else if (target === 'track.solo' && track.solo !== nextBool) {
            state.toggleTrackSolo(resolvedTrackId);
          }
          pushAutomationPoint(target, nextBool ? 1 : 0, resolvedTrackId);
          break;
        }
        case 'selectedTrack.macro1':
        case 'selectedTrack.macro2':
        case 'selectedTrack.macro3':
        case 'selectedTrack.macro4':
          pushAutomationPoint(target, clamped, state.selectedTrackId);
          break;
        default:
          break;
      }
    },
    [pushAutomationPoint]
  );

  const updateActiveNotesFromMap = useCallback(() => {
    const next = new Set<number>();
    inputVoiceMapRef.current.forEach((voices) => {
      voices.forEach((voice) => next.add(voice.midiNote));
    });
    setActiveNotes(next);
  }, []);

  const handleNoteOn = useCallback(
    (message: MIDIMessageEnvelope) => {
      if (!isReady || message.note === null) return;
      const key = inputKey(message.channel, message.note);

      const targetTracks = resolveTargetTracks(message);
      if (targetTracks.length === 0) return;

      const state = useDAWStore.getState();
      const currentVoices = inputVoiceMapRef.current.get(key) ?? [];
      currentVoices.forEach((voice) => stopNote(voice.voiceId));
      const createdVoices: ActiveInputVoice[] = [];
      targetTracks.forEach((track) => {
        const voiceId = playTrackNote(track, message.note!, message.velocity ?? 100);
        if (voiceId === -1) return;
        createdVoices.push({
          voiceId,
          trackId: track.id,
          channel: track.channel,
          midiNote: message.note!,
          startTick: state.transportState === 'recording' ? scheduler.getCurrentTick() : null,
        });
      });
      if (createdVoices.length === 0) return;

      inputVoiceMapRef.current.set(key, createdVoices);
      updateActiveNotesFromMap();
    },
    [isReady, playTrackNote, resolveTargetTracks, stopNote, updateActiveNotesFromMap]
  );

  const handleNoteOff = useCallback(
    (message: MIDIMessageEnvelope) => {
      if (message.note === null) return;
      const key = inputKey(message.channel, message.note);
      const voices = inputVoiceMapRef.current.get(key);
      if (!voices || voices.length === 0) return;

      inputVoiceMapRef.current.delete(key);
      const state = useDAWStore.getState();
      const endTick = scheduler.getCurrentTick();

      voices.forEach((voice) => {
        stopNote(voice.voiceId);
        if (state.transportState === 'recording' && voice.startTick !== null) {
          state.addNote(voice.trackId, {
            midiNote: voice.midiNote,
            startTick: voice.startTick,
            durationTicks: Math.max(1, endTick - voice.startTick),
            velocity: Math.max(1, Math.min(127, message.velocity ?? 100)),
          });
        }
      });
      updateActiveNotesFromMap();
    },
    [stopNote, updateActiveNotesFromMap]
  );

  const handleEnvelope = useCallback(
    (message: MIDIMessageEnvelope) => {
      const state = useDAWStore.getState();
      state.setMidiLastMessage(message);

      if (state.midiLearnSession.state === 'listening') {
        state.captureMidiLearn(message);
      }

      if (state.settings.midiConfig.transportRealtimeEnabled) {
        if (message.messageType === 'transport-start' || message.messageType === 'transport-continue') {
          transportController.play();
        } else if (message.messageType === 'transport-stop') {
          transportController.stop();
        }
      }

      const appliedBindings = applyMidiMessage(message, state.getEffectiveMidiBindings());
      appliedBindings.forEach((binding) => {
        applyMappedTarget(binding.target, binding.trackId, binding.value);
      });

      if (message.messageType === 'pitch-bend') {
        const bend = Math.max(-1, Math.min(1, message.value / 8192));
        resolveTargetTracks(message).forEach((track) => {
          setChannelPitchBend(track.channel, bend);
        });
      }

      if (message.messageType === 'cc' && (message.controller === 1 || message.controller === 11)) {
        resolveTargetTracks(message).forEach((track) => {
          setChannelGain(track.channel, 0.25 + message.normalizedValue);
        });
      }

      const mappedTransportMessage =
        (message.messageType === 'note-on' || message.messageType === 'cc') &&
        appliedBindings.some((binding) => binding.target.startsWith('transport.'));

      if (mappedTransportMessage) return;

      if (message.messageType === 'note-on') {
        handleNoteOn(message);
      } else if (message.messageType === 'note-off') {
        handleNoteOff(message);
      }
    },
    [
      applyMappedTarget,
      handleNoteOff,
      handleNoteOn,
      resolveTargetTracks,
      setChannelGain,
      setChannelPitchBend,
    ]
  );

  const handleConnectionChange = useCallback(
    (connected: boolean, deviceName: string | null, deviceId?: string | null) => {
      setMidiConnected(connected, deviceName ?? undefined, deviceId ?? null);
      if (!connected) {
        const state = useDAWStore.getState();
        state.pushToast({
          type: 'warning',
          message: 'Active MIDI device disconnected.',
        });
        state.song.tracks.forEach((track) => stopChannel(track.channel));
        inputVoiceMapRef.current.clear();
        setActiveNotes(new Set());
      } else {
        const state = useDAWStore.getState();
        state.pushToast({
          type: 'success',
          message: `Connected MIDI device: ${deviceName ?? 'Unknown Device'}.`,
        });
      }
    },
    [setMidiConnected, stopChannel]
  );

  useEffect(() => {
    if (initAttemptedRef.current) return;
    initAttemptedRef.current = true;

    const initMIDI = async () => {
      try {
        await midiManager.init();
      } catch (error) {
        console.warn('MIDI init failed:', error);
      }
    };

    void initMIDI();

    return () => {
      midiManager.dispose();
    };
  }, []);

  useEffect(() => {
    midiManager.setConnectionCallback(handleConnectionChange);
    midiManager.setEnvelopeCallback(handleEnvelope);
  }, [handleConnectionChange, handleEnvelope]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = useDAWStore.getState();
      if (state.midiLearnSession.state !== 'listening') return;
      if (!state.midiLearnSession.timeoutAt) return;
      if (Date.now() <= state.midiLearnSession.timeoutAt) return;
      state.expireMidiLearn();
      state.pushToast({
        type: 'warning',
        message: 'MIDI learn timed out. Click Detect and move a control again.',
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  return {
    isConnected: midiConnected,
    deviceName: midiDeviceName,
    activeNotes,
  };
}
