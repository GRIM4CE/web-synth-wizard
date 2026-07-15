import { ref, watch } from 'vue';
import type { AudioContextType, OscillatorSettings, FilterSettings, DelaySettings, LfoSettings, LfoTarget, ScopeSource, TimeDivision, VcaEnvelopeObject, FilterEnvelopeObject, MusicalKey, Octaves } from "@/types"
import { useEnvelope } from "./useEnvelope";

const { createEnvelope } = useEnvelope();


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
const oscillatorSettings = ref<OscillatorSettings>({ baseFrequency: 147, type: "square", pulseWidth: 0.5 });
const filterSettings = ref<FilterSettings>({ frequency: 2500, q: 1, type: 'lowpass' })
const selectedMusicalKey = ref<MusicalKey>("D")
const selectedOctave = ref<Octaves>(3)
const quantize = ref(true)

// The live voice oscillator (owned by the sequencer). Tracked here so LFOs and
// the oscilloscope can attach to it whenever it is (re)created.
const voiceOscillator = ref<OscillatorNode | null>(null);

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

// Effects bus (delay). The voice output feeds effectsInputNode, which splits into
// a dry path and a delay/feedback loop; both meet again at the master output.
// Keeping the bus permanently wired means toggling the effect only changes gain
// values — no graph rewiring, so no clicks.
const effectsInputNode = ref<GainNode | null>(null);
const delayNode = ref<DelayNode | null>(null);
const delayFeedbackNode = ref<GainNode | null>(null);
const delayWetNode = ref<GainNode | null>(null);
const delayDryNode = ref<GainNode | null>(null);
const delayEnabled = ref(false);
const delaySettings = ref<DelaySettings>({ time: 300, feedback: 0.35, mix: 0.35 })

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
    pulseWidth: 0.8, // comparator offset around the panel's pulse width
    cutoff: 4800, // cents: full depth is ±4 octaves of cutoff sweep
    resonance: 10, // Q around the panel's resonance setting
    volume: 0.9, // gain around the tremolo stage's base of 1
    delayTime: 0.008, // seconds: full depth is ±8ms (chorus-like wobble)
    delayMix: 0.5, // wet gain around the panel's mix setting
}

const lfoSettings = ref<LfoSettings[]>([
    { enabled: false, target: 'pitch', waveform: 'sine', rate: 5, depth: 0.1 },
    { enabled: false, target: 'cutoff', waveform: 'sine', rate: 0.5, depth: 0.4 },
    { enabled: false, target: 'volume', waveform: 'sine', rate: 4, depth: 0.4 },
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

// Resolve the AudioParam an LFO target modulates right now (null until the
// relevant node exists).
const lfoTargetParam = (target: LfoTarget): AudioParam | null => {
    switch (target) {
        case 'pitch': return voiceOscillator.value ? voiceOscillator.value.detune : null
        case 'pulseWidth': return pwConstantNode ? pwConstantNode.offset : null
        case 'cutoff': return filterNode.value ? filterNode.value.detune : null
        case 'resonance': return filterNode.value ? filterNode.value.Q : null
        case 'volume': return tremoloNode.value ? tremoloNode.value.gain : null
        // The delay targets only bite while the delay is on; otherwise a mix
        // LFO would fade echoes in on a supposedly disabled effect.
        case 'delayTime': return delayEnabled.value && delayNode.value ? delayNode.value.delayTime : null
        case 'delayMix': return delayEnabled.value && delayWetNode.value ? delayWetNode.value.gain : null
        default: return null
    }
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
        nodes.oscillator.frequency.setTargetAtTime(Math.max(settings.rate, 0.01), now, 0.05)
        const depth = settings.enabled ? settings.depth * LFO_TARGET_SCALE[settings.target] : 0
        nodes.depth.gain.setTargetAtTime(depth, now, 0.05)

        // Rewire: the target param may have changed, or its node been recreated.
        nodes.depth.disconnect()
        if (settings.enabled) {
            const param = lfoTargetParam(settings.target)
            if (param) nodes.depth.connect(param)
        }
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

watch(scopeSource, () => applyScopeSource())

// Delay-targeted LFOs attach/detach when the delay is toggled.
watch(delayEnabled, () => applyLfoSettings())

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

        // Pulse-width chain: (saw + DC offset) -> comparator -> DC blocker -> VCA.
        const pulseInput = audioContext.value.createGain()
        const comparator = audioContext.value.createWaveShaper()
        // Hard step around zero; WaveShaper clamps inputs beyond the curve ends,
        // so the summed saw+offset (up to ±2) still maps to a clean ±1 pulse.
        const curve = new Float32Array(1024)
        for (let i = 0; i < curve.length; i++) {
            curve[i] = i < curve.length / 2 ? -1 : 1
        }
        comparator.curve = curve
        // Asymmetric pulses carry a DC offset proportional to the duty cycle;
        // a gentle sub-audio highpass strips it before the VCA so gating the
        // envelope never thumps the speakers.
        const dcBlocker = audioContext.value.createBiquadFilter()
        dcBlocker.type = 'highpass'
        dcBlocker.frequency.value = 10
        const pwConstant = audioContext.value.createConstantSource()
        pwConstant.offset.value = 0
        pwConstant.start()
        pwConstant.connect(pulseInput)
        pulseInput.connect(comparator)
        comparator.connect(dcBlocker)
        dcBlocker.connect(gain)
        pulseInputNode.value = pulseInput
        pwConstantNode = pwConstant

        // VCO scope tap: the pulse chain feeds it permanently; direct (non-square)
        // waves are connected to it by the sequencer's voice wiring.
        const vcoTap = audioContext.value.createGain()
        dcBlocker.connect(vcoTap)
        vcoTapNode.value = vcoTap

        // Master output: everything audible funnels through here to the
        // destination, giving the scope a stable full-chain tap point.
        const masterOut = audioContext.value.createGain()
        masterOut.connect(audioContext.value.destination)
        masterOutNode.value = masterOut

        // Pre-effects tap: the voice (post VCA/tremolo/filter) lands here on its
        // way into the effects bus.
        const preFxTap = audioContext.value.createGain()
        preFxTapNode.value = preFxTap

        // Build the effects bus: input -> dry -> masterOut, and in parallel
        // input -> delay -> wet -> masterOut with delay -> feedback -> delay.
        const effectsInput = audioContext.value.createGain()
        const delay = audioContext.value.createDelay(2)
        const feedback = audioContext.value.createGain()
        const wet = audioContext.value.createGain()
        const dry = audioContext.value.createGain()

        preFxTap.connect(effectsInput)
        effectsInput.connect(dry)
        dry.connect(masterOut)
        effectsInput.connect(delay)
        delay.connect(wet)
        wet.connect(masterOut)
        delay.connect(feedback)
        feedback.connect(delay)

        effectsInputNode.value = effectsInput
        delayNode.value = delay
        delayFeedbackNode.value = feedback
        delayWetNode.value = wet
        delayDryNode.value = dry

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
        applyPulseWidth()
        applyLfoSettings()
        scopeTapNode = null
        applyScopeSource()
    };

    return { initSynth, clock, timeDivision, audioContext, gainNode, analyserNode, filterEnabled, filterEnvelopeEnabled, vcaEnvelope, oscillatorSettings, filterNode, filterSettings, filterEnvelope, selectedMusicalKey, selectedOctave, quantize, effectsInputNode, delayNode, delayEnabled, delaySettings, applyDelaySettings, lfoSettings, applyLfoSettings, voiceOscillator, tremoloNode, preFxTapNode, masterOutNode, scopeSource, pulseInputNode, vcoTapNode, applyPulseWidth };
}
