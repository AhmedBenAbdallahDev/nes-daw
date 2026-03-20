import type { EngineType, TrackChannel, TransportState } from '@/types/engine';

export interface ScheduledNote {
  channel: TrackChannel;
  engineType: EngineType;
  midiNote: number;
  velocity: number;
  startTick: number;
  durationTicks: number;
  instrumentId: string;
  trackId: string;
}

export type NoteScheduleCallback = (note: ScheduledNote, audioTime: number, duration: number) => void;
export type TickCallback = (tick: number) => void;
export type TransportChangeCallback = (state: TransportState) => void;

class Scheduler {
  private bpm = 150;
  private ppqn = 96;

  private state: TransportState = 'stopped';
  private currentTick = 0;

  private audioContext: AudioContext | null = null;
  private scheduleAheadTime = 0.1;
  private schedulerInterval = 20;
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private nextTickTime = 0;

  private loopEnabled = false;
  private loopStart = 0;
  private loopEnd = 1536;

  private songLength = 1536;

  private scheduledNotes: ScheduledNote[] = [];

  private onNoteSchedule: NoteScheduleCallback | null = null;
  private onTick: TickCallback | null = null;
  private onTransportChange: TransportChangeCallback | null = null;

  setAudioContext(ctx: AudioContext): void {
    this.audioContext = ctx;
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  getBpm(): number {
    return this.bpm;
  }

  setPpqn(ppqn: number): void {
    this.ppqn = ppqn;
  }

  setLoop(enabled: boolean, start?: number, end?: number): void {
    this.loopEnabled = enabled;
    if (start !== undefined) this.loopStart = start;
    if (end !== undefined) this.loopEnd = end;
  }

  setSongLength(ticks: number): void {
    this.songLength = Math.max(1, ticks);
  }

  loadNotes(notes: ScheduledNote[]): void {
    this.scheduledNotes = [...notes].sort((a, b) => a.startTick - b.startTick);
  }

  setNoteScheduleCallback(cb: NoteScheduleCallback): void {
    this.onNoteSchedule = cb;
  }

  setTickCallback(cb: TickCallback): void {
    this.onTick = cb;
  }

  setTransportChangeCallback(cb: TransportChangeCallback): void {
    this.onTransportChange = cb;
  }

  private ticksToSeconds(ticks: number): number {
    const secondsPerBeat = 60 / this.bpm;
    return (ticks / this.ppqn) * secondsPerBeat;
  }

  getPositionSeconds(): number {
    return this.ticksToSeconds(this.currentTick);
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  getState(): TransportState {
    return this.state;
  }

  play(): void {
    if (!this.audioContext || this.state === 'playing') return;

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    if (this.state === 'stopped') {
      this.nextTickTime = this.audioContext.currentTime;
    } else if (this.state === 'paused') {
      this.nextTickTime = this.audioContext.currentTime;
    }

    this.state = 'playing';
    this.onTransportChange?.(this.state);
    this.startScheduler();
  }

  record(): void {
    if (!this.audioContext || this.state === 'recording') return;

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    if (this.state === 'stopped' || this.state === 'paused') {
      this.nextTickTime = this.audioContext.currentTime;
    }

    this.state = 'recording';
    this.onTransportChange?.(this.state);
    this.startScheduler();
  }

  stop(resetTick = true): void {
    this.state = 'stopped';
    this.stopScheduler();

    if (resetTick) {
      this.currentTick = 0;
      this.onTick?.(0);
    }

    this.onTransportChange?.(this.state);
  }

  pause(): void {
    if (this.state === 'stopped' || this.state === 'paused') return;
    this.state = 'paused';
    this.stopScheduler();
    this.onTransportChange?.(this.state);
  }

  seekTo(tick: number): void {
    this.currentTick = Math.max(0, tick);
    this.onTick?.(this.currentTick);

    if ((this.state === 'playing' || this.state === 'recording') && this.audioContext) {
      this.nextTickTime = this.audioContext.currentTime;
    }
  }

  private startScheduler(): void {
    this.stopScheduler();
    this.timerHandle = setInterval(() => this.schedulerTick(), this.schedulerInterval);
  }

  private stopScheduler(): void {
    if (this.timerHandle !== null) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private schedulerTick(): void {
    if (!this.audioContext) return;
    if (this.state !== 'playing' && this.state !== 'recording') return;

    while (this.nextTickTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.processTickAtTime(this.currentTick, this.nextTickTime);
      this.advanceTick();
    }
  }

  private processTickAtTime(tick: number, audioTime: number): void {
    this.onTick?.(tick);

    for (const note of this.scheduledNotes) {
      if (note.startTick === tick) {
        const durationSecs = this.ticksToSeconds(note.durationTicks);
        this.onNoteSchedule?.(note, audioTime, durationSecs);
      }
    }
  }

  private advanceTick(): void {
    const secondsPerTick = this.ticksToSeconds(1);
    this.nextTickTime += secondsPerTick;
    this.currentTick += 1;

    if (this.loopEnabled && this.currentTick >= this.loopEnd) {
      this.currentTick = this.loopStart;
      return;
    }

    if (!this.loopEnabled && this.currentTick >= this.songLength) {
      this.stop(true);
    }
  }

  dispose(): void {
    this.stop(true);
    this.scheduledNotes = [];
    this.audioContext = null;
    this.onNoteSchedule = null;
    this.onTick = null;
    this.onTransportChange = null;
  }
}

export const scheduler = new Scheduler();
