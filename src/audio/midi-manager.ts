import { parseMIDIMessage } from '@/services/midi-control-service';

export type MIDINoteCallback = (midiNote: number, velocity: number) => void;
export type MIDIPitchBendCallback = (value: number) => void;
export type MIDIConnectionCallback = (
  connected: boolean,
  deviceName: string | null,
  deviceId?: string | null
) => void;
export type MIDIEnvelopeCallback = (message: import('@/types/engine').MIDIMessageEnvelope) => void;

class MIDIManager {
  private midiAccess: MIDIAccess | null = null;
  private activeInput: MIDIInput | null = null;
  
  private onNoteOn: MIDINoteCallback | null = null;
  private onNoteOff: MIDINoteCallback | null = null;
  private onPitchBend: MIDIPitchBendCallback | null = null;
  private onConnectionChange: MIDIConnectionCallback | null = null;
  private onEnvelope: MIDIEnvelopeCallback | null = null;
  
  async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not available in this browser');
      return false;
    }
    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.midiAccess.onstatechange = (e) => this.handleStateChange(e);
      this.connectToFirstInput();
      return true;
    } catch (err) {
      console.warn('MIDI access denied:', err);
      return false;
    }
  }
  
  private connectToFirstInput(): void {
    if (!this.midiAccess) return;
    for (const input of this.midiAccess.inputs.values()) {
      if (input.state === 'connected') {
        this.connectToInput(input);
        break;
      }
    }
  }
  
  private connectToInput(input: MIDIInput): void {
    if (this.activeInput) {
      this.activeInput.onmidimessage = null;
    }
    this.activeInput = input;
    this.activeInput.onmidimessage = (e) => this.handleMessage(e);
    this.onConnectionChange?.(true, input.name ?? 'Unknown Device', input.id);
  }
  
  private handleStateChange(e: Event): void {
    const evt = e as MIDIConnectionEvent;
    if (evt.port?.type === 'input') {
      if (evt.port.state === 'connected' && !this.activeInput) {
        this.connectToInput(evt.port as MIDIInput);
      } else if (evt.port.state === 'disconnected' && this.activeInput?.id === evt.port.id) {
        this.activeInput = null;
        this.onConnectionChange?.(false, null, null);
        this.connectToFirstInput();
      }
    }
  }
  
  private handleMessage(event: MIDIMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 1) return;

    const envelope = parseMIDIMessage(data, {
      timestamp: event.timeStamp,
      deviceId: this.activeInput?.id ?? null,
      deviceName: this.activeInput?.name ?? null,
    });
    if (!envelope) return;
    this.onEnvelope?.(envelope);
    
    switch (envelope.messageType) {
      case 'note-on':
        if (envelope.note !== null) {
          this.onNoteOn?.(envelope.note, envelope.velocity ?? 0);
        }
        break;
      case 'note-off':
        if (envelope.note !== null) {
          this.onNoteOff?.(envelope.note, envelope.velocity ?? 0);
        }
        break;
      case 'pitch-bend':
        this.onPitchBend?.(envelope.value / 8192);
        break;
      default:
        break;
    }
  }
  
  setNoteOnCallback(cb: MIDINoteCallback): void { this.onNoteOn = cb; }
  setNoteOffCallback(cb: MIDINoteCallback): void { this.onNoteOff = cb; }
  setPitchBendCallback(cb: MIDIPitchBendCallback): void { this.onPitchBend = cb; }
  setConnectionCallback(cb: MIDIConnectionCallback): void { this.onConnectionChange = cb; }
  setEnvelopeCallback(cb: MIDIEnvelopeCallback): void { this.onEnvelope = cb; }
  
  getInputs(): MIDIInput[] {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.inputs.values());
  }
  
  connectToInputById(id: string): void {
    if (!this.midiAccess) return;
    const input = this.midiAccess.inputs.get(id);
    if (input) this.connectToInput(input);
  }
  
  isConnected(): boolean { return this.activeInput !== null; }
  getDeviceName(): string | null { return this.activeInput?.name ?? null; }
  getDeviceId(): string | null { return this.activeInput?.id ?? null; }
  
  dispose(): void {
    if (this.activeInput) {
      this.activeInput.onmidimessage = null;
      this.activeInput = null;
    }
    this.midiAccess = null;
  }
}

export const midiManager = new MIDIManager();
