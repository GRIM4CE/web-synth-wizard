import type { Ref } from 'vue';

export type AudioContextType = AudioContext | (typeof AudioContext & typeof webkitAudioContext);

export type Step = {
    active: boolean,
    note: number, 
    id: number,
}

export type MusicalKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

// What drives the voice: the step grid, live keyboard/MIDI input, or the
// Turing machine's shift-register loop.
export type SequencerMode = 'steps' | 'keyboard' | 'turing'

// One slot of the Turing machine's looping register: a raw voltage (0..1,
// spanning one octave above the base frequency) and whether its gate fires.
export type TuringStep = {
    voltage: number,
    gate: boolean
}

export type TimeDivision = 1 | 2 | 4 | 8 | 16 | 32

export type UseSequancerParams = {
    clock: Ref<number>,
    timeDivision: Ref<TimeDivision>,
    audioContext: Ref<AudioContext | null>,
    filterNode: Ref<BiquadFilterNode | null>,
    gainNode: Ref<GainNode | null>,
    analyserNode: Ref<AnalyserNode | null>,
    preFxTapNode: Ref<GainNode | null>,
    pulseInputNode: Ref<GainNode | null>,
    vcoTapNode: Ref<GainNode | null>,
    tremoloNode: Ref<GainNode | null>,
    voiceOscillator: Ref<OscillatorNode | null>,
    physicalVoiceNode: Ref<AudioWorkletNode | null>,
    filterEnabled: Ref<boolean>,
    filterEnvelopeEnabled: Ref<boolean>,
    vcaEnvelopeEnabled: Ref<boolean>,
    filterEnvelope: FilterEnvelopeObject,
    vcaEnvelope: VcaEnvelopeObject,
    oscillatorSettings: Ref<OscillatorSettings>
    selectedMusicalKey: Ref<MusicalKey>
    selectedOctave: Ref<Octaves>
    quantize: Ref<Boolean>
}

// How the VCO produces sound: a classic waveform oscillator, or a physically
// modeled plucked-string voice (Karplus-Strong, in an AudioWorklet).
export type VoiceEngine = 'oscillator' | 'voice'

// Which resonator the voice engine excites, mirroring Mutable Instruments
// Rings' three resonator types: a non-linear/inharmonic string, a plucked
// string coupled to sympathetic strings, or a modal (filter bank) resonator.
export type ResonatorModel = 'string' | 'sympathetic' | 'modal'

export type OscillatorSettings = {
    type: OscillatorType,
    baseFrequency: number,
    pulseWidth: number, // Duty cycle for square waves (0.05 to 0.95, 0.5 = symmetric)
    engine: VoiceEngine,
    resonatorModel: ResonatorModel, // Voice engine resonator type (Rings-style model selection)
    damping: number, // Voice engine string damping (0 = bright/long ring, 1 = dark/fast decay)
    structure: number, // Voice engine structure (string: inharmonicity, sympathetic: chord, modal: stiffness)
    brightness: number, // Voice engine excitation brightness (0 = dull thump, 1 = raw noise burst)
    position: number // Voice engine pluck position (0 = at the bridge, 1 = mid-string)
}

export type FilterSettings = {
    frequency: number,
    q: number,
    type: BiquadFilterType,
}

export type DelaySettings = {
    time: number, // Delay time in milliseconds
    feedback: number, // Feedback amount (0 to <1), how much of the echo is fed back in
    mix: number, // Wet/dry balance (0 = fully dry, 1 = fully wet)
}

// Parameters an LFO can modulate. Each maps to an AudioParam on a live node.
export type LfoTarget = 'pitch' | 'pulseWidth' | 'cutoff' | 'resonance' | 'volume' | 'delayTime' | 'delayMix'

// Where the oscilloscope taps the signal chain: the raw oscillator, after the
// VCA + filter (pre-effects), or the full chain at the output.
export type ScopeSource = 'vco' | 'filter' | 'output'

export type LfoSettings = {
    enabled: boolean,
    target: LfoTarget,
    waveform: OscillatorType,
    sync: boolean, // true: rate follows the sequencer clock; false: free-running in Hz
    rate: number, // Free-running LFO frequency in Hz (used when sync is off)
    syncSteps: number, // Length of one LFO cycle in sequencer steps (used when sync is on)
    depth: number, // Modulation amount (0 to 1), scaled per target
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

// A full snapshot of the synth's user-adjustable state, storable and re-appliable.
export type SynthPreset = {
    name: string,
    clock: number,
    timeDivision: TimeDivision,
    oscillatorSettings: OscillatorSettings,
    selectedMusicalKey: MusicalKey,
    selectedOctave: Octaves,
    quantize: boolean,
    filterEnabled: boolean,
    filterEnvelopeEnabled: boolean,
    filterSettings: FilterSettings,
    filterEnvelope: FilterEnvelope,
    vcaEnvelopeEnabled?: boolean, // Optional: presets saved before the VCA envelope toggle existed lack this
    vcaEnvelope: VcaEnvelope,
    delayEnabled: boolean,
    delaySettings: DelaySettings,
    lfos?: LfoSettings[], // Optional: presets saved before LFOs existed lack this
    steps: Step[],
}