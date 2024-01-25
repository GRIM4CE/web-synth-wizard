import { ref } from 'vue';
import type { OscillatorSettings, FilterSettings, TimeDivision, VcaEnvelopeObject, FilterEnvelopeObject } from "@/types"
import { useEnvelope } from "./useEnvelope"; 

const { createEnvelope } = useEnvelope();


const clock = ref<number>(135)
const timeDivision = ref<TimeDivision>(4)
const audioContext = ref<AudioContext | null>(null);
const filterNode = ref<BiquadFilterNode | null>(null);
const gainNode = ref<GainNode | null>(null);
const oscillatorSettings = ref<OscillatorSettings>({ baseFrequency: 440, type: "square" });
const filterSettings = ref<FilterSettings>({ frequency: 200, q: 4, type: 'lowpass' })

const vcaEnvelope = createEnvelope({
    attack: 200,
    decay: 300,
    sustain: 0.3,
    release: 200,
    gain: .01,
}, "vca") as unknown as VcaEnvelopeObject

const filterEnvelope = createEnvelope({
    attack: 0.1, // Time in seconds for the cutoff frequency to reach its peak
    decay: 0.2, // Time in seconds for the frequency to fall to the sustain level
    sustain: 0.7, // Sustain level as a percentage of the peak frequency
    release: 0.5, // Time in seconds for the frequency to fall back to its initial value after note off
    peakFrequency: 2000, // Peak cutoff frequency in Hz
    baseFrequency: 0, // Base cutoff frequency in Hz, could be your initial value
}, "filter") as unknown as FilterEnvelopeObject

export const useAudioContextManager = () => {

    const initSynth = () => {
        audioContext.value = new AudioContext();
        gainNode.value = audioContext.value.createGain();
        filterNode.value = audioContext.value.createBiquadFilter();
    };

    return { initSynth, clock, timeDivision, audioContext, gainNode, vcaEnvelope, oscillatorSettings, filterNode, filterSettings, filterEnvelope };
}