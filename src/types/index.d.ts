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
    filterEnvelope: FilterEnvelopeObject,
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

export interface FilterEnvelope extends Envelope {
    frequency: number,
    maxFrequency: number,
}


export interface VcaEnvelope extends Envelope {
    gain: number;
}
  
export type ApplyVCAEnvelope = (gainNode: GainNode, audioContext: AudioContext, envelope: Ref<VcaEnvelope>) => number

export type ApplyFilterEnvelope = (filter: BiquadFilterNode, audioContext: AudioContext, envelope: Ref<FilterEnvelope>) => void

export type VcaEnvelopeObject = {
    envelope: Ref<VcaEnvelope>,
    applyVCAEnvelope: ApplyVCAEnvelope
}

export type FilterEnvelopeObject = {
    envelope: Ref<FilterEnvelope>,
    applyFilterEnvelope: ApplyFilterEnvelope
}