import { ref } from 'vue';
import type { OscillatorSettings, FilterSettings, TimeDivision } from "@/types"

const clock = ref<number>(135)
const timeDivision = ref<TimeDivision>(4)
const audioContext = ref<AudioContext | null>(null);
const filterNode = ref<BiquadFilterNode | null>(null);
const gainNode = ref<GainNode | null>(null);
const oscillatorSettings = ref<OscillatorSettings>({ baseFrequency: 440, type: "square" });
const filterSettings = ref<FilterSettings>({ frequency: 200, q: 4, type: 'lowpass' })
const gain = ref<number>(0.01);

export const useAudioContextManager = () => {

    const initSynth = () => {
        audioContext.value = new AudioContext();
        gainNode.value = audioContext.value.createGain();
        gainNode.value.gain.value = gain.value
        filterNode.value = audioContext.value.createBiquadFilter();
    };

    return { initSynth, clock, timeDivision, audioContext, gainNode, filterNode, oscillatorSettings, filterSettings, gain};
}