import { ref, watch } from 'vue';
import type { AudioContextType, OscillatorSettings, SubOscillatorSettings, FilterSettings, DelaySettings, ReverbSettings, CompressorSettings, FxId, LfoSettings, LfoTarget, ScopeSource, TimeDivision, VcaEnvelopeObject, FilterEnvelopeObject, MusicalKey, Octaves } from "@/types"
import { useEnvelope } from "./useEnvelope";
import { usePhysicalVoice, resonatorModelIndex } from "./usePhysicalVoice";
import { lfoSyncRate, lfoWaveValue } from "@/utils/config";

const { createEnvelope } = useEnvelope();
const { createPhysicalVoiceNode } = usePhysicalVoice();


const clock = ref<number>(135)
const timeDivision = ref<TimeDivision>(2)
const audioContext = ref<AudioContextType | null>(null);
const filterNode = ref<BiquadFilterNode | null>(null);
const gainNode = ref<GainNode | null>(null);
const analyserNode = ref<AnalyserNode | null>(null);
const filterEnabled = ref(true);
// The filter envelope (ADSR sweep of the cutoff) is optional. When off, the
// cutoff simply sits at the frequency set on the VCF panel.
const filterEnvelopeEnabled = ref(true);
// The VCA envelope is optional too. When off, the amp sits open at the panel
// gain and audio flows straight through: the oscillator engine drones, and
// the physical voice sounds whenever its exciter is struck.
const vcaEnvelopeEnabled = ref(true);
const oscillatorSettings = ref<OscillatorSettings>({ baseFrequency: 147, type: "square", pulseWidth: 0.5, engine: 'oscillator', resonatorModel: 'string', damping: 0.5, structure: 0, brightness: 1, position: 0 });
const filterSettings = ref<FilterSettings>({ frequency: 2500, q: 1, type: 'lowpass' })
const selectedMusicalKey = ref<MusicalKey>("D")
const selectedOctave = ref<Octaves>(3)
const quantize = ref(true)

// The live voice oscillator (owned by the sequencer). Tracked here so LFOs and
// the oscilloscope can attach to it whenever it is (re)created.
const voiceOscillator = ref<OscillatorNode | null>(null);

// Stacked sub-oscillators (VCO 2 / VCO 3): each follows the main oscillator's
// pitch offset by its own detune, and mixes into the VCA through a dedicated
// level gain. The gains are built once per synth init and stay wired, so
// enabling/disabling a sub is just a gain change — no rewiring, no clicks.
// The oscillator nodes themselves are owned by the sequencer (created and torn
// down with the main voice) and tracked here so LFOs can attach to them.
const subOscillatorSettings = ref<SubOscillatorSettings[]>([
    { enabled: false, type: 'sawtooth', detune: 7, level: 0.5 },
    { enabled: false, type: 'sawtooth', detune: -7, level: 0.5 }
])
const subOscillatorNodes = ref<(OscillatorNode | null)[]>([null, null])
const subOscillatorGainNodes = ref<GainNode[]>([])

// The physical modeling voice (Karplus-Strong plucked string), the VCO's
// alternative engine. Built once per synth init and permanently wired into the
// VCA like the pulse chain: it is silent until plucked, so leaving it
// connected costs nothing and avoids click-prone rewiring. Null when
// AudioWorklet is unavailable, in which case the oscillator engine is used.
const physicalVoiceNode = ref<AudioWorkletNode | null>(null);

// Tremolo stage: sits after the VCA so a volume LFO multiplies the enveloped
// signal (base gain 1). Modulating the VCA's own gain would instead ADD to the
// envelope and leak sound during rests.
const tremoloNode = ref<GainNode | null>(null);

// Pulse-width chain for square waves. OscillatorNode has no PW control, so a
// square with adjustable duty cycle is built the classic way: a sawtooth plus a
// DC offset run through a hard comparator (WaveShaper). Where the offset sits
// decides how much of each cycle lands above the threshold — i.e. the pulse
// width — and because the offset is an AudioParam, an LFO can modulate it (PWM).
// Chain: voice saw -> pulseInput <- pwConstant; pulseInput -> shaper -> DC
// blocker -> VCA. Non-square waves bypass it entirely.
const pulseInputNode = ref<GainNode | null>(null);
let pwConstantNode: ConstantSourceNode | null = null;

// The scope's "VCO" view taps here: the voice waveform as selected — the
// shaped pulse for squares, the raw oscillator for everything else — before
// the VCA touches it.
const vcoTapNode = ref<GainNode | null>(null);

// Effects chain. The voice output feeds effectsInputNode, which runs through
// the FX stages (delay, reverb, compressor) in series, in the order the user
// arranged them, and lands at the master output. Each stage has its own
// input/output gain pair with the effect's wet/dry paths wired in between, so
// toggling an effect only changes gain values — no graph rewiring, no clicks.
// Only reordering the chain itself rewires the stage connections.
const effectsInputNode = ref<GainNode | null>(null);
const fxChainOrder = ref<FxId[]>(['delay', 'reverb', 'compressor'])
// One { input, output } gain pair per effect, rebuilt on each synth init.
let fxStages: Partial<Record<FxId, { input: GainNode, output: GainNode }>> = {}

const delayNode = ref<DelayNode | null>(null);
const delayFeedbackNode = ref<GainNode | null>(null);
const delayWetNode = ref<GainNode | null>(null);
const delayDryNode = ref<GainNode | null>(null);
const delayEnabled = ref(false);
const delaySettings = ref<DelaySettings>({ time: 300, feedback: 0.35, mix: 0.35 })

// Reverb: a ConvolverNode fed a generated impulse response (exponentially
// decaying noise), with wet/dry gains like the delay.
const reverbNode = ref<ConvolverNode | null>(null);
const reverbWetNode = ref<GainNode | null>(null);
const reverbDryNode = ref<GainNode | null>(null);
const reverbEnabled = ref(false);
const reverbSettings = ref<ReverbSettings>({ decay: 2000, mix: 0.3 })
// The decay the current impulse response was built for, so the (relatively
// costly) buffer is only regenerated when the decay actually changes.
let builtReverbDecay = 0

// Compressor: a DynamicsCompressorNode plus makeup gain, bypassed through a
// parallel dry gain when disabled.
const compressorNode = ref<DynamicsCompressorNode | null>(null);
const compressorMakeupNode = ref<GainNode | null>(null);
const compressorBypassNode = ref<GainNode | null>(null);
const compressorEnabled = ref(false);
const compressorSettings = ref<CompressorSettings>({ threshold: -24, ratio: 4, attack: 5, release: 250, makeup: 0 })

// Scope tap points. The analyser is a side-tap (it has no output connection), so
// pointing the oscilloscope at a different stage never alters the audible path:
//   'vco'    -> the raw voice oscillator
//   'filter' -> preFxTapNode, after VCA/tremolo/filter but before effects
//   'output' -> masterOutNode, the full chain as heard
const preFxTapNode = ref<GainNode | null>(null);
const masterOutNode = ref<GainNode | null>(null);
const scopeSource = ref<ScopeSource>('output');
let scopeTapNode: AudioNode | null = null;

// Delay feedback must stay below unity or the loop grows louder forever.
const MAX_FEEDBACK = 0.9

// How a 0..1 LFO depth scales per target. Pitch and cutoff use the detune
// AudioParams (cents), so the modulation is musical (multiplicative) and never
// fights the Hz-based envelope scheduling on the same node.
const LFO_TARGET_SCALE: Record<LfoTarget, number> = {
    pitch: 1200, // cents: full depth is ±1 octave of vibrato
    detune: 100, // cents around the sub-oscillators' own detune (chorus territory)
    pulseWidth: 0.8, // comparator offset around the panel's pulse width
    voiceDamping: 0.5, // voice params span 0..1; full depth swings ±0.5 around the panel
    voiceStructure: 0.5,
    voiceBrightness: 0.5,
    voicePosition: 0.5,
    cutoff: 4800, // cents: full depth is ±4 octaves of cutoff sweep
    resonance: 10, // Q around the panel's resonance setting
    volume: 0.9, // gain around the tremolo stage's base of 1
    delayTime: 0.008, // seconds: full depth is ±8ms (chorus-like wobble)
    delayMix: 0.5, // wet gain around the panel's mix setting
    reverbMix: 0.5, // wet gain around the panel's mix setting
    turingProbability: 0.5, // probability around the panel dial, clamped to 0..1
    vcaAttack: 2, // exponent: full depth swings the time from 1/4x to 4x
    vcaDecay: 2,
    vcaSustain: 0.5, // sustain fraction around the panel level, clamped to 0..1
    vcaRelease: 2,
}

const lfoSettings = ref<LfoSettings[]>([
    { enabled: false, target: 'pitch', waveform: 'sine', sync: false, rate: 5, syncSteps: 1, depth: 0.1 },
    { enabled: false, target: 'cutoff', waveform: 'sine', sync: false, rate: 0.5, syncSteps: 4, depth: 0.4 },
    { enabled: false, target: 'volume', waveform: 'sine', sync: false, rate: 4, syncSteps: 1, depth: 0.4 },
    { enabled: false, target: 'detune', waveform: 'sine', sync: false, rate: 0.8, syncSteps: 4, depth: 0.2 },
])
// One oscillator + depth gain per LFO, rebuilt on each synth init.
let lfoNodes: { oscillator: OscillatorNode, depth: GainNode }[] = []

const vcaEnvelope = createEnvelope({
    attack: 30,
    decay: 100,
    sustain: 0.5,
    release: 50,
    gain: .05,
}, "vca") as unknown as VcaEnvelopeObject

const filterEnvelope = createEnvelope({
    attack: 0.2, // Time in ms for the cutoff frequency to reach its peak
    decay: 100, // Time in ms for the frequency to fall to the sustain level
    sustain: 0.5, // Sustain level as a percentage of the peak frequency
    release: 0.2, // Time in ms for the frequency to fall back to its initial value after note off
    frequency: filterSettings.value.frequency, // Peak cutoff frequency in Hz
    maxFrequency: 20000, // Max cutoff frequency in Hz
}, "filter") as unknown as FilterEnvelopeObject

// Push the current delay settings onto the live nodes. Safe to call any time;
// does nothing until the synth has been initialised.
const applyDelaySettings = () => {
    const ctx = audioContext.value
    if (!ctx || !delayNode.value || !delayFeedbackNode.value || !delayWetNode.value || !delayDryNode.value) return

    const now = ctx.currentTime
    const timeSeconds = Math.max(delaySettings.value.time, 1) / 1000
    const feedback = Math.min(Math.max(delaySettings.value.feedback, 0), MAX_FEEDBACK)
    const mix = Math.min(Math.max(delaySettings.value.mix, 0), 1)

    // setTargetAtTime glides parameters to their new value, which avoids the
    // clicks and pitch chirps an instant jump in delay time would cause.
    delayNode.value.delayTime.setTargetAtTime(timeSeconds, now, 0.05)
    delayFeedbackNode.value.gain.setTargetAtTime(delayEnabled.value ? feedback : 0, now, 0.05)
    delayWetNode.value.gain.setTargetAtTime(delayEnabled.value ? mix : 0, now, 0.05)
    // Equal-style crossfade: turning the mix up trades dry level for wet level.
    delayDryNode.value.gain.setTargetAtTime(delayEnabled.value ? 1 - mix * 0.5 : 1, now, 0.05)
}

// Generate the reverb's impulse response: stereo exponentially decaying noise,
// fading to -60dB over the decay time (the classic RT60 definition).
const buildReverbImpulse = (ctx: AudioContextType, decayMs: number): AudioBuffer => {
    const decaySeconds = Math.min(Math.max(decayMs, 100), 10000) / 1000
    const length = Math.max(1, Math.floor(ctx.sampleRate * decaySeconds))
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
        const data = impulse.getChannelData(channel)
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(10, -3 * i / length)
        }
    }
    return impulse
}

// Push the current reverb settings onto the live nodes. Safe to call any time;
// does nothing until the synth has been initialised.
const applyReverbSettings = () => {
    const ctx = audioContext.value
    if (!ctx || !reverbNode.value || !reverbWetNode.value || !reverbDryNode.value) return

    // Regenerating the impulse is the only reverb change that isn't a gain
    // glide; only do it when the decay actually moved.
    if (reverbSettings.value.decay !== builtReverbDecay) {
        reverbNode.value.buffer = buildReverbImpulse(ctx, reverbSettings.value.decay)
        builtReverbDecay = reverbSettings.value.decay
    }

    const now = ctx.currentTime
    const mix = Math.min(Math.max(reverbSettings.value.mix, 0), 1)
    reverbWetNode.value.gain.setTargetAtTime(reverbEnabled.value ? mix : 0, now, 0.05)
    // Equal-style crossfade, matching the delay's dry handling.
    reverbDryNode.value.gain.setTargetAtTime(reverbEnabled.value ? 1 - mix * 0.5 : 1, now, 0.05)
}

// Push the current compressor settings onto the live nodes. Safe to call any
// time; does nothing until the synth has been initialised.
const applyCompressorSettings = () => {
    const ctx = audioContext.value
    const compressor = compressorNode.value
    if (!ctx || !compressor || !compressorMakeupNode.value || !compressorBypassNode.value) return

    const now = ctx.currentTime
    const settings = compressorSettings.value
    compressor.threshold.setTargetAtTime(Math.min(Math.max(settings.threshold, -60), 0), now, 0.05)
    compressor.ratio.setTargetAtTime(Math.min(Math.max(settings.ratio, 1), 20), now, 0.05)
    compressor.attack.setTargetAtTime(Math.min(Math.max(settings.attack, 0), 1000) / 1000, now, 0.05)
    compressor.release.setTargetAtTime(Math.min(Math.max(settings.release, 0), 1000) / 1000, now, 0.05)
    // Bypass is a crossfade between the compressed path (through the makeup
    // gain) and a parallel dry path — the compressor node itself stays wired.
    const makeupLinear = Math.pow(10, Math.min(Math.max(settings.makeup, 0), 24) / 20)
    compressorMakeupNode.value.gain.setTargetAtTime(compressorEnabled.value ? makeupLinear : 0, now, 0.05)
    compressorBypassNode.value.gain.setTargetAtTime(compressorEnabled.value ? 0 : 1, now, 0.05)
}

// (Re)wire the FX stages in the user's chosen order:
// effectsInput -> stage -> stage -> ... -> masterOut. Called on init and when
// the chain is reordered — the one FX change that genuinely rewires the graph.
const applyFxChainOrder = () => {
    const input = effectsInputNode.value
    const output = masterOutNode.value
    if (!input || !output) return

    input.disconnect()
    const stages = fxChainOrder.value
        .map((id) => fxStages[id])
        .filter((stage): stage is { input: GainNode, output: GainNode } => !!stage)
    stages.forEach((stage) => stage.output.disconnect())

    let previous: AudioNode = input
    stages.forEach((stage) => {
        previous.connect(stage.input)
        previous = stage.output
    })
    previous.connect(output)
}

// Resolve the AudioParams an LFO target modulates right now (empty until the
// relevant nodes exist, and always empty for the JS-domain targets).
const lfoTargetParams = (target: LfoTarget): AudioParam[] => {
    const compact = (params: (AudioParam | null | undefined)[]) =>
        params.filter((param): param is AudioParam => !!param)

    switch (target) {
        // Pitch follows the selected engine: the physical voice exposes its own
        // detune AudioParam (cents), mirroring OscillatorNode's. On the
        // oscillator engine, vibrato reaches the sub-oscillators too so the
        // stack moves together (the LFO signal sums with each sub's own detune).
        case 'pitch': {
            if (oscillatorSettings.value.engine === 'voice' && physicalVoiceNode.value) {
                return compact([physicalVoiceNode.value.parameters.get('detune')])
            }
            return compact([
                voiceOscillator.value?.detune,
                ...subOscillatorNodes.value.map((node, index) =>
                    subOscillatorSettings.value[index]?.enabled ? node?.detune : null)
            ])
        }
        // Detune spread: wobbles only the sub-oscillators around their own
        // detune, leaving the main oscillator anchored (classic chorus/unison).
        case 'detune': return compact(subOscillatorNodes.value.map((node, index) =>
            subOscillatorSettings.value[index]?.enabled ? node?.detune : null))
        case 'pulseWidth': return compact([pwConstantNode?.offset])
        case 'voiceDamping': return compact([physicalVoiceNode.value?.parameters.get('damping')])
        case 'voiceStructure': return compact([physicalVoiceNode.value?.parameters.get('structure')])
        case 'voiceBrightness': return compact([physicalVoiceNode.value?.parameters.get('brightness')])
        case 'voicePosition': return compact([physicalVoiceNode.value?.parameters.get('position')])
        case 'cutoff': return compact([filterNode.value?.detune])
        case 'resonance': return compact([filterNode.value?.Q])
        case 'volume': return compact([tremoloNode.value?.gain])
        // The delay/reverb targets only bite while the effect is on; otherwise
        // a mix LFO would fade echoes in on a supposedly disabled effect.
        case 'delayTime': return compact([delayEnabled.value ? delayNode.value?.delayTime : null])
        case 'delayMix': return compact([delayEnabled.value ? delayWetNode.value?.gain : null])
        case 'reverbMix': return compact([reverbEnabled.value ? reverbWetNode.value?.gain : null])
        default: return []
    }
}

// The rate an LFO runs at right now, honouring clock sync.
const lfoEffectiveRate = (settings: LfoSettings) => settings.sync
    ? lfoSyncRate(clock.value, timeDivision.value, settings.syncSteps)
    : settings.rate

// Summed modulation for a JS-domain target, sampled from each LFO's waveform
// at the audio clock's "now". Phase is derived from the context time, so the
// value moves like the audible LFOs do; the sequencer samples it once per
// gate/step (Turing probability, VCA envelope times aren't AudioParams).
const lfoModulation = (target: LfoTarget): number => {
    const ctx = audioContext.value
    if (!ctx) return 0
    return lfoSettings.value.reduce((sum, settings) => {
        if (!settings.enabled || settings.target !== target) return sum
        const phase = ctx.currentTime * lfoEffectiveRate(settings)
        return sum + lfoWaveValue(settings.waveform, phase) * settings.depth * LFO_TARGET_SCALE[target]
    }, 0)
}

// Push the current LFO settings onto the live nodes and (re)wire each depth
// gain to its target parameter. Safe to call any time.
const applyLfoSettings = () => {
    const ctx = audioContext.value
    if (!ctx || !lfoNodes.length) return
    const now = ctx.currentTime

    lfoSettings.value.forEach((settings, index) => {
        const nodes = lfoNodes[index]
        if (!nodes) return
        nodes.oscillator.type = settings.waveform
        // Clock-synced LFOs derive their frequency from the sequencer tempo so a
        // cycle spans a musical number of steps; free LFOs use the Hz slider.
        const rate = lfoEffectiveRate(settings)
        nodes.oscillator.frequency.setTargetAtTime(Math.min(Math.max(rate, 0.01), 20000), now, 0.05)
        const depth = settings.enabled ? settings.depth * LFO_TARGET_SCALE[settings.target] : 0
        nodes.depth.gain.setTargetAtTime(depth, now, 0.05)

        // Rewire: the target params may have changed, or their nodes been
        // recreated. JS-domain targets resolve to no params — they're sampled
        // via lfoModulation instead of wired into the graph.
        nodes.depth.disconnect()
        if (settings.enabled) {
            lfoTargetParams(settings.target).forEach((param) => nodes.depth.connect(param))
        }
    })
}

// Push the stored sub-oscillator settings onto the live nodes. The level gains
// exist from init; the oscillators only while the sequencer voice is running.
const applySubOscillatorSettings = () => {
    const ctx = audioContext.value
    if (!ctx) return
    const now = ctx.currentTime
    subOscillatorSettings.value.forEach((settings, index) => {
        const gain = subOscillatorGainNodes.value[index]
        if (gain) {
            // A sub is silenced by its gain (and by the engine: the physical
            // voice tears the oscillator stack down entirely).
            const level = settings.enabled ? Math.min(Math.max(settings.level, 0), 1) : 0
            gain.gain.setTargetAtTime(level, now, 0.02)
        }
        const oscillator = subOscillatorNodes.value[index]
        if (oscillator) {
            oscillator.type = settings.type
            oscillator.detune.setTargetAtTime(settings.detune, now, 0.02)
        }
    })
}

// Push the stored voice tone controls onto the live physical voice. Safe to
// call any time; does nothing until the synth has been initialised.
const applyVoiceSettings = () => {
    const ctx = audioContext.value
    const node = physicalVoiceNode.value
    if (!ctx || !node) return
    // The resonator model is a discrete switch, not a glide.
    node.parameters.get('model')?.setValueAtTime(
        resonatorModelIndex(oscillatorSettings.value.resonatorModel), ctx.currentTime
    )
    const voiceParams = ['damping', 'structure', 'brightness', 'position'] as const
    voiceParams.forEach((name) => {
        const value = Math.min(Math.max(oscillatorSettings.value[name], 0), 1)
        node.parameters.get(name)?.setTargetAtTime(value, ctx.currentTime, 0.05)
    })
}

// Set the comparator threshold from the stored pulse width. With a sawtooth
// spanning -1..1, an offset of 2*pw-1 leaves exactly the fraction pw of each
// cycle above zero — the duty cycle.
const applyPulseWidth = () => {
    const ctx = audioContext.value
    if (!ctx || !pwConstantNode) return
    const pulseWidth = Math.min(Math.max(oscillatorSettings.value.pulseWidth, 0.05), 0.95)
    pwConstantNode.offset.setTargetAtTime(2 * pulseWidth - 1, ctx.currentTime, 0.02)
}

// Connect the selected tap point to the analyser (and detach the previous one).
const applyScopeSource = () => {
    const analyser = analyserNode.value
    if (!analyser) return

    if (scopeTapNode) {
        try {
            scopeTapNode.disconnect(analyser)
        } catch {
            // The previous tap (or its context) may already be gone.
        }
        scopeTapNode = null
    }

    const source =
        scopeSource.value === 'vco' ? vcoTapNode.value :
        scopeSource.value === 'filter' ? preFxTapNode.value :
        masterOutNode.value
    if (source) {
        source.connect(analyser)
        scopeTapNode = source
    }
}

// The voice oscillator is recreated by the sequencer; pitch LFOs and a 'vco'
// scope tap must follow it onto the new node.
watch(voiceOscillator, () => {
    applyLfoSettings()
    applyScopeSource()
})

// The sub-oscillators are torn down and recreated with the main voice; pitch
// and detune LFOs must follow them onto the new nodes.
watch(subOscillatorNodes, () => applyLfoSettings())

// Any sub-oscillator edit lands on the live nodes, and enabling/disabling a
// sub changes which detune params the pitch/detune LFOs attach to.
watch(subOscillatorSettings, () => {
    applySubOscillatorSettings()
    applyLfoSettings()
}, { deep: true })

watch(scopeSource, () => applyScopeSource())

// Delay/reverb-targeted LFOs attach/detach when the effect is toggled.
watch(delayEnabled, () => applyLfoSettings())
watch(reverbEnabled, () => applyLfoSettings())

// A pitch LFO must jump between the oscillator's detune and the physical
// voice's when the engine changes.
watch(() => oscillatorSettings.value.engine, () => applyLfoSettings())

// Clock-synced LFOs track tempo and time-division changes as they happen.
watch([clock, timeDivision], () => applyLfoSettings())

export const useAudioContextManager = () => {

    const initSynth = async () => {
        if (audioContext.value) {
            const existingAudioContext = audioContext.value
            try {
                await existingAudioContext.close()
            } catch (error) {
                console.error('Failed to close existing AudioContext', error)
            }
        }
        audioContext.value = new AudioContext()
        await audioContext.value.resume()
        const gain = audioContext.value.createGain();
        // A fresh GainNode defaults to a gain of 1. Start it at silence so the first
        // note ramps up from the floor instead of blasting at full volume for the
        // duration of its attack.
        gain.gain.setValueAtTime(0.0001, audioContext.value.currentTime);
        gainNode.value = gain;
        const filter = audioContext.value.createBiquadFilter();
        // A fresh BiquadFilterNode starts at Web Audio defaults (lowpass, 350Hz,
        // Q 1); apply the stored settings so the panel and the sound agree.
        filter.type = filterSettings.value.type
        filter.Q.value = filterSettings.value.q
        filter.frequency.value = filterEnvelope.envelope.value.frequency
        filterNode.value = filter;
        const analyser = audioContext.value.createAnalyser();
        analyser.fftSize = 2048;
        analyserNode.value = analyser;

        tremoloNode.value = audioContext.value.createGain()

        // Pulse-width chain: (saw + DC offset) -> comparator -> VCA.
        const pulseInput = audioContext.value.createGain()
        const comparator = audioContext.value.createWaveShaper()
        // Hard step around zero; WaveShaper clamps inputs beyond the curve ends,
        // so the summed saw+offset (up to ±2) still maps to a clean ±1 pulse.
        const curve = new Float32Array(1024)
        for (let i = 0; i < curve.length; i++) {
            curve[i] = i < curve.length / 2 ? -1 : 1
        }
        comparator.curve = curve
        // The pulse stays DC-coupled on purpose: plateaus pin at ±1 so PWM only
        // moves the edges (like a hardware scope shows it). AC-coupling this
        // with a highpass made the plateaus droop and the whole wave re-center
        // whenever the duty cycle moved. The DC an asymmetric pulse carries is
        // scaled down by the VCA (≤ ~0.05) before it reaches anything physical.
        const pwConstant = audioContext.value.createConstantSource()
        pwConstant.offset.value = 0
        pwConstant.start()
        pwConstant.connect(pulseInput)
        pulseInput.connect(comparator)
        comparator.connect(gain)
        pulseInputNode.value = pulseInput
        pwConstantNode = pwConstant

        // VCO scope tap: the pulse chain feeds it permanently; direct (non-square)
        // waves are connected to it by the sequencer's voice wiring.
        const vcoTap = audioContext.value.createGain()
        comparator.connect(vcoTap)
        vcoTapNode.value = vcoTap

        // Sub-oscillator level gains: permanently wired into the VCA and the
        // scope tap; the sequencer connects the live sub oscillators to them.
        subOscillatorGainNodes.value = subOscillatorSettings.value.map(() => {
            const subGain = audioContext.value!.createGain()
            subGain.gain.value = 0
            subGain.connect(gain)
            subGain.connect(vcoTap)
            return subGain
        })
        subOscillatorNodes.value = subOscillatorSettings.value.map(() => null)

        // Physical modeling voice: silent until plucked, so it stays wired to
        // both the VCA and the scope tap regardless of the selected engine.
        physicalVoiceNode.value = await createPhysicalVoiceNode(audioContext.value)
        if (physicalVoiceNode.value) {
            physicalVoiceNode.value.connect(gain)
            physicalVoiceNode.value.connect(vcoTap)
        }

        // Master output: everything audible funnels through here to the
        // destination, giving the scope a stable full-chain tap point.
        const masterOut = audioContext.value.createGain()
        masterOut.connect(audioContext.value.destination)
        masterOutNode.value = masterOut

        // Pre-effects tap: the voice (post VCA/tremolo/filter) lands here on its
        // way into the effects bus.
        const preFxTap = audioContext.value.createGain()
        preFxTapNode.value = preFxTap

        // Build the FX stages. Each is a self-contained input/output pair with
        // the effect's wet/dry paths inside; applyFxChainOrder strings the
        // stages together between effectsInput and masterOut.
        const effectsInput = audioContext.value.createGain()
        preFxTap.connect(effectsInput)
        effectsInputNode.value = effectsInput

        // Delay stage: input -> dry -> output, and in parallel
        // input -> delay -> wet -> output with delay -> feedback -> delay.
        const delayInput = audioContext.value.createGain()
        const delayOutput = audioContext.value.createGain()
        const delay = audioContext.value.createDelay(2)
        const feedback = audioContext.value.createGain()
        const wet = audioContext.value.createGain()
        const dry = audioContext.value.createGain()
        delayInput.connect(dry)
        dry.connect(delayOutput)
        delayInput.connect(delay)
        delay.connect(wet)
        wet.connect(delayOutput)
        delay.connect(feedback)
        feedback.connect(delay)
        delayNode.value = delay
        delayFeedbackNode.value = feedback
        delayWetNode.value = wet
        delayDryNode.value = dry

        // Reverb stage: input -> dry -> output, input -> convolver -> wet -> output.
        const reverbInput = audioContext.value.createGain()
        const reverbOutput = audioContext.value.createGain()
        const convolver = audioContext.value.createConvolver()
        const reverbWet = audioContext.value.createGain()
        const reverbDry = audioContext.value.createGain()
        reverbInput.connect(reverbDry)
        reverbDry.connect(reverbOutput)
        reverbInput.connect(convolver)
        convolver.connect(reverbWet)
        reverbWet.connect(reverbOutput)
        reverbNode.value = convolver
        reverbWetNode.value = reverbWet
        reverbDryNode.value = reverbDry
        // Force applyReverbSettings to build an impulse for the fresh context.
        builtReverbDecay = 0

        // Compressor stage: input -> compressor -> makeup -> output, with a
        // parallel input -> bypass -> output path for when it's disabled.
        const compressorInput = audioContext.value.createGain()
        const compressorOutput = audioContext.value.createGain()
        const compressor = audioContext.value.createDynamicsCompressor()
        const makeup = audioContext.value.createGain()
        const bypass = audioContext.value.createGain()
        compressorInput.connect(compressor)
        compressor.connect(makeup)
        makeup.connect(compressorOutput)
        compressorInput.connect(bypass)
        bypass.connect(compressorOutput)
        compressorNode.value = compressor
        compressorMakeupNode.value = makeup
        compressorBypassNode.value = bypass

        fxStages = {
            delay: { input: delayInput, output: delayOutput },
            reverb: { input: reverbInput, output: reverbOutput },
            compressor: { input: compressorInput, output: compressorOutput }
        }
        applyFxChainOrder()

        // One always-running oscillator + depth gain per LFO slot.
        lfoNodes = lfoSettings.value.map(() => {
            const oscillator = audioContext.value!.createOscillator()
            const depth = audioContext.value!.createGain()
            depth.gain.value = 0
            oscillator.connect(depth)
            oscillator.start()
            return { oscillator, depth }
        })

        applyDelaySettings()
        applyReverbSettings()
        applyCompressorSettings()
        applyPulseWidth()
        applyVoiceSettings()
        applySubOscillatorSettings()
        applyLfoSettings()
        scopeTapNode = null
        applyScopeSource()
    };

    return { initSynth, clock, timeDivision, audioContext, gainNode, analyserNode, filterEnabled, filterEnvelopeEnabled, vcaEnvelopeEnabled, vcaEnvelope, oscillatorSettings, subOscillatorSettings, subOscillatorNodes, subOscillatorGainNodes, applySubOscillatorSettings, filterNode, filterSettings, filterEnvelope, selectedMusicalKey, selectedOctave, quantize, effectsInputNode, delayNode, delayEnabled, delaySettings, applyDelaySettings, reverbEnabled, reverbSettings, applyReverbSettings, compressorEnabled, compressorSettings, applyCompressorSettings, fxChainOrder, applyFxChainOrder, lfoSettings, applyLfoSettings, lfoModulation, voiceOscillator, physicalVoiceNode, tremoloNode, preFxTapNode, masterOutNode, scopeSource, pulseInputNode, vcoTapNode, applyPulseWidth, applyVoiceSettings };
}
