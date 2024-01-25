import type { Ref } from 'vue';

export type Step = {
    active: boolean,
    frequency: number, 
    id: number,
}

export type TimeDivision = 1 | 2 | 4 | 8 | 16 | 32

export type UseSequancerParams = {
    clock: Ref<number>,
    timeDivision: Ref<TimeDivision>,
    audioContext: Ref<AudioContext | null>,
    filterNode: Ref<BiquadFilterNode | null>,
    gainNode: Ref<GainNode | null>,
    vcaEnvelope: VcaEnvelopeObject,
    oscillatorSettings: Ref<OscillatorSettings>
}

export type OscillatorSettings = {
    type: OscillatorType,
    baseFrequency: number
}

export type FilterSettings = {
    frequency: number,
    q: number,
    type: BiquadFilterType,
}

export type CreateOscillatorParams ={
    audioContext: AudioContext, 
    oscillatorSettings: OscillatorSettings,
    stepFrequency?: number
}

export interface Envelope  {
    attack: number; // Time in seconds
    decay: number; // Time in seconds
    sustain: number; // Sustain level (0 to 1)
    release: number; // Time in seconds
  }


export interface VcaEnvelope extends Envelope {
    gain: number;
}
  
export type ApplyEnvelope = (gainNode: GainNode, audioContext: AudioContext, duration: number, envelope: Envelope | VcaEnvelope) => void

export type VcaEnvelopeObject = {
    envelope: Ref<VcaEnvelope>,
    applyEnvelope: ApplyEnvelope
}