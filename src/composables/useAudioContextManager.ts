import { ref } from 'vue';
import type { AudioContextType, OscillatorSettings, FilterSettings, DelaySettings, TimeDivision, VcaEnvelopeObject, FilterEnvelopeObject, MusicalKey, Octaves } from "@/types"
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
const oscillatorSettings = ref<OscillatorSettings>({ baseFrequency: 147, type: "square" });
const filterSettings = ref<FilterSettings>({ frequency: 2500, q: 1, type: 'lowpass' })
const selectedMusicalKey = ref<MusicalKey>("D")
const selectedOctave = ref<Octaves>(3)
const quantize = ref(true)

// Effects bus (delay). The voice output feeds effectsInputNode, which splits into
// a dry path and a delay/feedback loop; both meet again at the analyser. Keeping
// the bus permanently wired means toggling the effect only changes gain values —
// no graph rewiring, so no clicks.
const effectsInputNode = ref<GainNode | null>(null);
const delayNode = ref<DelayNode | null>(null);
const delayFeedbackNode = ref<GainNode | null>(null);
const delayWetNode = ref<GainNode | null>(null);
const delayDryNode = ref<GainNode | null>(null);
const delayEnabled = ref(false);
const delaySettings = ref<DelaySettings>({ time: 300, feedback: 0.35, mix: 0.35 })

// Delay feedback must stay below unity or the loop grows louder forever.
const MAX_FEEDBACK = 0.9

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
        // The analyser sits just before the destination so the oscilloscope
        // reflects the final output regardless of whether the filter is engaged.
        analyser.connect(audioContext.value.destination);
        analyserNode.value = analyser;

        // Build the effects bus: input -> dry -> analyser, and in parallel
        // input -> delay -> wet -> analyser with delay -> feedback -> delay.
        const effectsInput = audioContext.value.createGain()
        const delay = audioContext.value.createDelay(2)
        const feedback = audioContext.value.createGain()
        const wet = audioContext.value.createGain()
        const dry = audioContext.value.createGain()

        effectsInput.connect(dry)
        dry.connect(analyser)
        effectsInput.connect(delay)
        delay.connect(wet)
        wet.connect(analyser)
        delay.connect(feedback)
        feedback.connect(delay)

        effectsInputNode.value = effectsInput
        delayNode.value = delay
        delayFeedbackNode.value = feedback
        delayWetNode.value = wet
        delayDryNode.value = dry

        applyDelaySettings()
    };

    return { initSynth, clock, timeDivision, audioContext, gainNode, analyserNode, filterEnabled, filterEnvelopeEnabled, vcaEnvelope, oscillatorSettings, filterNode, filterSettings, filterEnvelope, selectedMusicalKey, selectedOctave, quantize, effectsInputNode, delayNode, delayEnabled, delaySettings, applyDelaySettings };
}
