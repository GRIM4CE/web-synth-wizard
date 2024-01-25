import { ref } from 'vue';

// Shared AudioContext
const audioContext = ref<AudioContext | null>(null);
const filterNode = ref<BiquadFilterNode | null>(null);
const gainNode = ref<GainNode | null>(null);
const activeSynth = ref<boolean>(false)
const frequency = ref<number>(440)
const waveform = ref<OscillatorType>("sawtooth")
const oscillator = ref<OscillatorNode | null>(null)

export const useAudioContext = () => {
    const initSynth = () => {
        audioContext.value = new AudioContext();
        gainNode.value = audioContext.value.createGain();
        filterNode.value = audioContext.value.createBiquadFilter();

        oscillator.value = audioContext.value.createOscillator();
        oscillator.value.type = waveform.value;
        oscillator.value.frequency.setValueAtTime(frequency.value, audioContext.value.currentTime);

        oscillator.value.connect(gainNode.value);
        gainNode.value.connect(filterNode.value);

        filterNode.value.connect(audioContext.value.destination);

        oscillator.value.start();

        gainNode.value.gain.value = .01
    };

    const updateOscillatorFreq = (freq: number) => {
        if(oscillator.value && audioContext.value) {
            frequency.value = freq
            oscillator.value?.frequency.setValueAtTime(frequency.value, audioContext?.value?.currentTime);
        }
    };

    const updateOscillatorWave = (wave: OscillatorType) => {
        if(oscillator.value && audioContext.value) {
            waveform.value = wave
            oscillator.value.type = wave
        }
    };
    
    const startAudioContext = () => {
        if (audioContext.value && audioContext.value.state === 'suspended') {
            audioContext.value.resume();
        } else {
            initSynth()
            activeSynth.value = true
        }
    };

    const suspendAudioContext = () => {
        audioContext?.value?.suspend()
    };
    
    return { activeSynth, audioContext, gainNode, filterNode, updateOscillatorFreq, updateOscillatorWave, waveform, frequency, startAudioContext, suspendAudioContext };
}
