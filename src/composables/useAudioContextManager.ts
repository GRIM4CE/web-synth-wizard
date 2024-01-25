import { ref } from 'vue';
import type { OscillatorSettings, FilterSettings, TimeDivision, VcaEnvelopeObject } from "@/types"
import { useEnvelope } from "./useEnvelope"; 

const { createEnvelope } = useEnvelope();


const clock = ref<number>(135)
const timeDivision = ref<TimeDivision>(1)
const audioContext = ref<AudioContext | null>(null);
const filterNode = ref<BiquadFilterNode | null>(null);
const gainNode = ref<GainNode | null>(null);
const oscillatorSettings = ref<OscillatorSettings>({ baseFrequency: 440, type: "square" });
const filterSettings = ref<FilterSettings>({ frequency: 200, q: 4, type: 'lowpass' })
const vcaEnvelope = createEnvelope({
    attack: 800,
    decay: 20,
    sustain: 0.3,
    release: 20,
    gain: .05,
}) as unknown as VcaEnvelopeObject

export const useAudioContextManager = () => {

    const initSynth = () => {
        audioContext.value = new AudioContext();
        gainNode.value = audioContext.value.createGain();
        filterNode.value = audioContext.value.createBiquadFilter();
    };

    return { initSynth, clock, timeDivision, audioContext, gainNode, filterNode, oscillatorSettings, filterSettings, vcaEnvelope};
}