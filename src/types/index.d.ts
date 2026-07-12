import type { Ref } from 'vue';

export type AudioContextType = AudioContext | (typeof AudioContext & typeof webkitAudioContext);

export type Step = {
    active: boolean,
    note: number, 
    id: number,
}

export type MusicalKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

export type TimeDivision = 1 | 2 | 4 | 8 | 16 | 32

export type UseSequancerParams = {
    clock: Ref<number>,
    timeDivision: Ref<TimeDivision>,
    audioContext: Ref<AudioContext | null>,
    filterNode: Ref<BiquadFilterNode | null>,
    gainNode: Ref<GainNode | null>,
    analyserNode: Ref<AnalyserNode | null>,
    filterEnabled: Ref<boolean>,
    filterEnvelope: FilterEnvelopeObject,
    vcaEnvelope: VcaEnvelopeObject,
    oscillatorSettings: Ref<OscillatorSettings>
    selectedMusicalKey: Ref<MusicalKey>
    selectedOctave: Ref<Octaves>
    quantize: Ref<Boolean>
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
    stepNote: number,
    selectedMusicalKey: Ref<MusicalKey>
    selectedOctave: Ref<Octaves>
    quantize: Ref<Boolean>
}

export interface Envelope  {
    attack: number; // Time in milliseconds
    decay: number; // Time in milliseconds
    sustain: number; // Sustain level (0 to 1)
    release: number; // Time in milliseconds
}

export interface FilterEnvelope extends Envelope {
    frequency: number,
    maxFrequency: number,
}


export interface VcaEnvelope extends Envelope {
    gain: number;
}
  
export type TriggerVCAEnvelope = (gainNode: GainNode, audioContext: AudioContext, envelope: Ref<VcaEnvelope>) => void

export type ReleaseVCAEnvelope = (gainNode: GainNode, audioContext: AudioContext, envelope: Ref<VcaEnvelope>) => number

export type TriggerFilterEnvelope = (filter: BiquadFilterNode, audioContext: AudioContext, envelope: Ref<FilterEnvelope>) => void

export type VcaEnvelopeObject = {
    envelope: Ref<VcaEnvelope>,
    triggerAttack: TriggerVCAEnvelope,
    triggerRelease: ReleaseVCAEnvelope
}

export type FilterEnvelopeObject = {
    envelope: Ref<FilterEnvelope>,
    triggerAttack: TriggerFilterEnvelope,
    triggerRelease: TriggerFilterEnvelope
}

export type Octaves = 1 | 2 | 3 | 4 | 5 | 6 | 7