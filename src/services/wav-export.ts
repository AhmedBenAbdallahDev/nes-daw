import { INSTRUMENTS } from '@/audio/instruments';
import { buildScheduledNotes } from '@/audio/scheduling';
import type { EngineType, Song } from '@/types/engine';

function tickToSeconds(tick: number, bpm: number, ppqn: number): number {
  const secondsPerBeat = 60 / bpm;
  return (tick / ppqn) * secondsPerBeat;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function writeString(view: DataView, offset: number, text: string): number {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
  return offset + text.length;
}

function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const totalLength = 44 + dataLength;

  const array = new ArrayBuffer(totalLength);
  const view = new DataView(array);

  let offset = 0;
  offset = writeString(view, offset, 'RIFF');
  view.setUint32(offset, totalLength - 8, true);
  offset += 4;
  offset = writeString(view, offset, 'WAVE');
  offset = writeString(view, offset, 'fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, format, true);
  offset += 2;
  view.setUint16(offset, channels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bitDepth, true);
  offset += 2;
  offset = writeString(view, offset, 'data');
  view.setUint32(offset, dataLength, true);
  offset += 4;

  const channelData = Array.from({ length: channels }, (_, idx) => buffer.getChannelData(idx));

  for (let i = 0; i < buffer.length; i += 1) {
    for (let ch = 0; ch < channels; ch += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Uint8Array(array);
}

function scheduleOscillatorNote(
  ctx: OfflineAudioContext,
  destination: AudioNode,
  engineType: EngineType,
  midiNote: number,
  velocity: number,
  start: number,
  end: number
) {
  const gain = ctx.createGain();
  gain.connect(destination);

  const peak = Math.max(0.02, Math.min(1, velocity / 127));
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.004);
  gain.gain.linearRampToValueAtTime(peak * 0.72, start + 0.08);
  gain.gain.setValueAtTime(peak * 0.72, Math.max(start + 0.08, end - 0.02));
  gain.gain.linearRampToValueAtTime(0, end);

  if (engineType === 'modern-noise' || engineType === 'nes') {
    const noiseLength = Math.max(1, Math.floor((end - start) * ctx.sampleRate));
    const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(Math.max(120, midiToFreq(midiNote)), start);
    filter.Q.value = 1.5;

    source.connect(filter);
    filter.connect(gain);
    source.start(start);
    source.stop(end);
    return;
  }

  if (engineType === 'dpcm') {
    const source = ctx.createBufferSource();
    const sampleLength = Math.max(1, Math.floor(ctx.sampleRate * 0.16));
    const sample = ctx.createBuffer(1, sampleLength, ctx.sampleRate);
    const data = sample.getChannelData(0);
    let state = 1;
    for (let i = 0; i < sampleLength; i += 1) {
      if (i % 18 === 0) state = Math.random() > 0.5 ? 1 : -1;
      data[i] = state * 0.65 + (Math.random() * 2 - 1) * 0.08;
    }
    source.buffer = sample;
    source.loop = true;
    source.playbackRate.setValueAtTime(Math.max(0.4, Math.min(2.4, midiToFreq(midiNote) / 380)), start);
    source.connect(gain);
    source.start(start);
    source.stop(end);
    return;
  }

  if (engineType === 'fm-lite') {
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();

    carrier.type = 'sine';
    mod.type = 'sine';

    const freq = midiToFreq(midiNote);
    carrier.frequency.setValueAtTime(freq, start);
    mod.frequency.setValueAtTime(freq * 2, start);
    modGain.gain.setValueAtTime(freq * 0.3, start);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(gain);

    mod.start(start);
    carrier.start(start);
    mod.stop(end);
    carrier.stop(end);
    return;
  }

  const osc = ctx.createOscillator();
  osc.type = engineType === 'saw' ? 'sawtooth' : 'sine';
  osc.frequency.setValueAtTime(midiToFreq(midiNote), start);
  osc.connect(gain);
  osc.start(start);
  osc.stop(end);
}

export async function exportWav(song: Song): Promise<Uint8Array> {
  const { notes, lengthTicks } = buildScheduledNotes(song);
  const durationSec = Math.max(2, tickToSeconds(lengthTicks, song.bpm, song.ppqn) + 1.2);
  const sampleRate = 48000;

  const ctx = new OfflineAudioContext(1, Math.ceil(durationSec * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.82;
  master.connect(ctx.destination);

  const trackMap = new Map(song.tracks.map((track) => [track.id, track]));

  notes.forEach((note) => {
    const track = trackMap.get(note.trackId);
    if (!track || track.muted) return;

    const instrument = INSTRUMENTS[note.instrumentId];
    if (!instrument) return;

    const start = tickToSeconds(note.startTick, song.bpm, song.ppqn);
    const end = tickToSeconds(note.startTick + note.durationTicks, song.bpm, song.ppqn);
    const velocity = Math.max(1, Math.min(127, Math.round(note.velocity * track.volume)));

    const engineType = track.engineType === 'nes'
      ? track.channel === 'noise'
        ? 'nes'
        : track.channel === 'dpcm'
          ? 'dpcm'
          : 'sine'
      : track.engineType;

    scheduleOscillatorNote(ctx, master, engineType, note.midiNote, velocity, start, end);
  });

  const rendered = await ctx.startRendering();
  return audioBufferToWav(rendered);
}
