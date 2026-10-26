import type { Ref } from 'vue';

export type AudioContextType = AudioContext | (typeof AudioContext & typeof webkitAudioContext);

export type Step = {
    active: boolean,
    note: number, 
    id: number,
}

export type MusicalKey = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

// What drives the voice: the step grid, the computer keyboard, a MIDI
// controller, or the Turing machine's shift-register loop.
export type SequencerMode = 'steps' | 'keyboard' | 'midi' | 'turing'

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
    subOscillatorNodes: Ref<(OscillatorNode | null)[]>,
    subOscillatorGainNodes: Ref<GainNode[]>,
    subOscillatorSettings: Ref<SubOscillatorSettings[]>,
    lfoModulation: (target: LfoTarget) => number,
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

// An additional oscillator (VCO 2 / VCO 3) stacked on the main voice. Subs
// follow the main oscillator's pitch, offset by their own detune, and mix
// into the VCA through their own level gain.
export type SubOscillatorSettings = {
    enabled: boolean,
    type: OscillatorType,
    detune: number, // Offset from the main oscillator in cents (-1200 to 1200)
    level: number // Mix level relative to the main oscillator (0 to 1)
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

export type ReverbSettings = {
    decay: number, // Reverb tail length in milliseconds
    mix: number, // Wet/dry balance (0 = fully dry, 1 = fully wet)
}

export type CompressorSettings = {
    threshold: number, // Level above which compression kicks in, in dB (-60 to 0)
    ratio: number, // Input/output dB ratio above the threshold (1 to 20)
    attack: number, // Time in ms to reach full gain reduction
    release: number, // Time in ms to let the gain reduction go
    makeup: number // Post-compression makeup gain in dB (0 to 24)
}

// The chainable effects, in the order the signal passes through them.
export type FxId = 'delay' | 'reverb' | 'compressor'

// Parameters an LFO can modulate. Audio-domain targets map to an AudioParam on
// a live node; the rest (Turing probability, VCA envelope times) live in JS and
// are sampled from the LFO's waveform at each gate/step.
export type LfoTarget =
    | 'pitch' | 'detune' | 'pulseWidth'
    | 'voiceDamping' | 'voiceStructure' | 'voiceBrightness' | 'voicePosition'
    | 'cutoff' | 'resonance' | 'volume'
    | 'delayTime' | 'delayMix' | 'reverbMix'
    | 'turingProbability'
    | 'vcaAttack' | 'vcaDecay' | 'vcaSustain' | 'vcaRelease'

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
    reverbEnabled?: boolean, // Optional: presets saved before the reverb existed lack this
    reverbSettings?: ReverbSettings,
    compressorEnabled?: boolean, // Optional: presets saved before the compressor existed lack this
    compressorSettings?: CompressorSettings,
    fxChainOrder?: FxId[], // Optional: presets saved before the FX chain was reorderable lack this
    subOscillators?: SubOscillatorSettings[], // Optional: presets saved before VCO 2/3 existed lack this
    lfos?: LfoSettings[], // Optional: presets saved before LFOs existed lack this
    steps: Step[],
}