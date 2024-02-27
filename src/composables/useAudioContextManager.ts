import { ref } from 'vue';
import type { AudioContextType, OscillatorSettings, FilterSettings, TimeDivision, VcaEnvelopeObject, FilterEnvelopeObject, MusicalKey, Octaves } from "@/types"
import { useEnvelope } from "./useEnvelope"; 

const { createEnvelope } = useEnvelope();


const clock = ref<number>(135)
const timeDivision = ref<TimeDivision>(2)
const audioContext = ref<AudioContextType | null>(null);
const filterNode = ref<BiquadFilterNode | null>(null);
const gainNode = ref<GainNode | null>(null);
const oscillatorSettings = ref<OscillatorSettings>({ baseFrequency: 147, type: "square" });
const filterSettings = ref<FilterSettings>({ frequency: 2500, q: 1, type: 'lowpass' })
const selectedMusicalKey = ref<MusicalKey>("D")
const selectedOctave = ref<Octaves>(3)
const quantize = ref(true)

const vcaEnvelope = createEnvelope({
    attack: 30,
    decay: 100,
    sustain: 0.5,
    release: 50,
    gain: .01,
}, "vca") as unknown as VcaEnvelopeObject

const filterEnvelope = createEnvelope({
    attack: 0.2, // Time in seconds for the cutoff frequency to reach its peak
    decay: 100, // Time in seconds for the frequency to fall to the sustain level
    sustain: 0.5, // Sustain level as a percentage of the peak frequency
    release: 0.2, // Time in seconds for the frequency to fall back to its initial value after note off
    frequency: filterSettings.value.frequency, // Peak cutoff frequency in Hz
    maxFrequency: 20000, // Base cutoff frequency in Hz, could be your initial value
}, "filter") as unknown as FilterEnvelopeObject

export const useAudioContextManager = () => {

    const initSynth = () => {
        audioContext.value = new AudioContext()
        gainNode.value = audioContext.value.createGain();
        filterNode.value = audioContext.value.createBiquadFilter();
    };

    return { initSynth, clock, timeDivision, audioContext, gainNode, vcaEnvelope, oscillatorSettings, filterNode, filterSettings, filterEnvelope, selectedMusicalKey, selectedOctave, quantize };
}