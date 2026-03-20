import { INSTRUMENTS } from './instruments';
import { nesEngine } from './nes-engine';
import { scheduler } from './scheduler';
import { buildScheduledNotes } from './scheduling';
import { applyPreviewMode } from '@/services/preview-mode-service';
import { useDAWStore } from '@/store/daw-store';
import type { AutomationLane, Song } from '@/types/engine';

export type TransportCommand = 'play' | 'pause' | 'stop' | 'record' | 'seek';

class TransportController {
  private initialized = false;

  private getAutomationValue(
    lanes: AutomationLane[],
    target: AutomationLane['target'],
    tick: number,
    trackId: string | null,
    fallback: number
  ): number {
    const lane = lanes.find((item) => item.target === target && (item.trackId ?? null) === (trackId ?? null));
    if (!lane || lane.points.length === 0) return fallback;

    const point = lane.points
      .filter((item) => item.tick <= tick)
      .sort((a, b) => b.tick - a.tick)[0];

    return point ? Math.max(0, Math.min(1, point.value)) : fallback;
  }

  private applyRuntimeAutomation(song: Song, tick: number, fallbackMasterVolume: number): void {
    const master = this.getAutomationValue(
      song.automationLanes,
      'global.masterVolume',
      tick,
      null,
      fallbackMasterVolume
    );
    nesEngine.setVolume(master);

    const tempoNormalized = this.getAutomationValue(song.automationLanes, 'global.tempo', tick, null, -1);
    if (tempoNormalized >= 0) {
      scheduler.setBpm(Math.round(30 + tempoNormalized * 270));
    }
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;

    scheduler.setNoteScheduleCallback((note, _audioTime, duration) => {
      const state = useDAWStore.getState();
      if (!state.engineReady) return;

      const track = state.song.tracks.find((item) => item.id === note.trackId);
      if (!track) return;

      const hasSolo = state.song.tracks.some((item) => item.solo);
      if (track.muted) return;
      if (hasSolo && !track.solo) return;

      const instrument = INSTRUMENTS[note.instrumentId];
      if (!instrument) return;

      const settings = state.settings;
      if (
        settings.mode === 'strict' &&
        (state.song.constraints.enforcePolyphonyLimit || settings.strictConfig.enableAuthenticLimits)
      ) {
        nesEngine.stopChannelVoices(note.channel);
      }

      const laneVolume = this.getAutomationValue(
        state.song.automationLanes,
        'track.volume',
        note.startTick,
        track.id,
        track.volume
      );
      const laneMute =
        this.getAutomationValue(
          state.song.automationLanes,
          'track.mute',
          note.startTick,
          track.id,
          track.muted ? 1 : 0
        ) >= 0.5;
      const laneSolo =
        this.getAutomationValue(
          state.song.automationLanes,
          'track.solo',
          note.startTick,
          track.id,
          track.solo ? 1 : 0
        ) >= 0.5;

      if (laneMute) return;
      if (hasSolo && !laneSolo && !track.solo) return;

      const velocity = Math.max(1, Math.min(127, Math.round(note.velocity * laneVolume)));
      const voiceId = nesEngine.playByTrack(note.channel, note.engineType, note.midiNote, velocity, {
        dutyCycle: instrument.dutyCycle,
        envelope: instrument.envelope,
        noiseMode: instrument.noiseMode,
        velocity,
      });

      if (voiceId !== -1) {
        setTimeout(() => {
          nesEngine.stopNote(voiceId);
        }, duration * 1000);
      }
    });

    scheduler.setTickCallback((tick) => {
      const state = useDAWStore.getState();
      state.setCurrentTick(tick);
      this.applyRuntimeAutomation(state.song, tick, state.settings.audioConfig.masterVolume);
    });

    scheduler.setTransportChangeCallback((nextState) => {
      useDAWStore.getState().setTransportState(nextState);
    });
  }

  attachAudioContextIfReady() {
    const ctx = nesEngine.getContext();
    if (!ctx) return false;

    scheduler.setAudioContext(ctx);
    return true;
  }

  syncSchedulerFromStore() {
    const state = useDAWStore.getState();
    scheduler.setBpm(state.bpm);
    scheduler.setPpqn(state.song.ppqn);
    scheduler.setLoop(state.loopEnabled, state.loopStart, state.loopEnd);

    const { notes, lengthTicks } = buildScheduledNotes(state.song);
    scheduler.loadNotes(notes);
    scheduler.setSongLength(lengthTicks);
  }

  private ensureReady(): boolean {
    const state = useDAWStore.getState();
    if (!state.engineReady) return false;

    if (!this.attachAudioContextIfReady()) return false;
    this.syncSchedulerFromStore();
    return true;
  }

  play() {
    if (!this.ensureReady()) return;

    const state = useDAWStore.getState();
    if (state.playbackPreviewMode !== 'full-song') {
      const preview = applyPreviewMode(state.playbackPreviewMode, state.song.arrangement);
      scheduler.setLoop(preview.loopEnabled, preview.loopStart, preview.loopEnd);
      scheduler.seekTo(preview.seekTick);
      state.setCurrentTick(preview.seekTick);
    }

    if (scheduler.getState() === 'recording') {
      scheduler.pause();
    }

    scheduler.play();
  }

  pause() {
    scheduler.pause();
    nesEngine.stopAllNotes();
  }

  stop() {
    scheduler.stop(true);
    nesEngine.stopAllNotes();
  }

  record() {
    if (!this.ensureReady()) return;
    scheduler.record();
  }

  seek(tick: number) {
    scheduler.seekTo(tick);
  }

  togglePlayPause() {
    const current = scheduler.getState();
    if (current === 'playing' || current === 'recording') {
      this.pause();
    } else {
      this.play();
    }
  }

  execute(command: TransportCommand, payload?: { tick?: number }) {
    switch (command) {
      case 'play':
        this.play();
        break;
      case 'pause':
        this.pause();
        break;
      case 'stop':
        this.stop();
        break;
      case 'record':
        this.record();
        break;
      case 'seek':
        this.seek(payload?.tick ?? 0);
        break;
      default:
        break;
    }
  }
}

export const transportController = new TransportController();
