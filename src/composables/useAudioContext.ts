import { ref, onMounted } from 'vue';

// Shared AudioContext
const audioContext = ref<AudioContext | null>(null);
const gainNode = ref<GainNode | null>(null);
const activeSynth = ref<boolean>(false)
const frequency = ref<number>(440)
const waveform = ref<OscillatorType>("sawtooth")
const oscillator = ref<OscillatorNode | null>(null)

export const useAudioContext = () => {
    const initSynth = () => {
        // Initialize AudioContext when the component is mounted
        audioContext.value = new AudioContext();
        gainNode.value = audioContext.value.createGain();

        oscillator.value = audioContext.value.createOscillator();
        oscillator.value.type = waveform.value;
        oscillator.value.frequency.setValueAtTime(frequency.value, audioContext.value.currentTime);

        // Connect the oscillator to the shared GainNode instead of directly to the destination
        oscillator.value.connect(gainNode.value);
        oscillator.value.start();

        gainNode.value.connect(audioContext.value.destination);
        gainNode.value.gain.value = .01
        // You can set initial properties for gainNode here, if necessary
        // For example: gainNode.value.gain.value = 1;
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
    
    return { activeSynth, audioContext, gainNode, updateOscillatorFreq, updateOscillatorWave, waveform, frequency, startAudioContext, suspendAudioContext };
}
