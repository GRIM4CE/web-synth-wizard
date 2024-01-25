// import { ref, watch } from 'vue';

// type step = {
//     active: boolean,
//     frequency: number, 
//     id: number
// }

// const midCFreqs = [261.63, 293.66974569918125, 329.63314428399565, 349.2341510465061, 392.0020805232462, 440.00745824565865, 493.8916728538229, 523.26]

// const getRandomFreq = () => {
//     return midCFreqs[Math.floor(Math.random() * (7 + 1))]
// }

// // Shared AudioContext
// const audioContext = ref<AudioContext | null>(null);
// const clock = ref<number>(135)
// const filterNode = ref<BiquadFilterNode | null>(null);
// const gainNode = ref<GainNode | null>(null);
// const gain = ref<number>(0.1);
// const activeSynth = ref<boolean>(false)

// const baseFrequency = ref<number>(440)
// const waveform = ref<OscillatorType>("sawtooth")
// const oscillator = ref<OscillatorNode | null>(null)

// const steps = ref<step[]>(Array.from({ length: 16 }, (_, i) => ({
//     active: Math.random() >= 0.5,
//     frequency: getRandomFreq(), 
//     id: i,
// })));

// let intervalId: number | undefined;

// export const useAudioContext = () => {
//     const initSynth = () => {
//         audioContext.value = new AudioContext();
//         gainNode.value = audioContext.value.createGain();
//         filterNode.value = audioContext.value.createBiquadFilter();
//     };

//     const updateOscillatorBaseFreq = (baseFreq: number) => {
//         if(oscillator.value && audioContext.value) {
//             baseFrequency.value = baseFreq
//         }
//     };

//     const updateOscillatorWave = (wave: OscillatorType) => {
//         if(oscillator.value && audioContext.value) {
//             waveform.value = wave
//             oscillator.value.type = wave
//         }
//     };

//     const updateStepValue = (updatedSteps: step[]) => {
//         steps.value = updatedSteps
//     }
    
//     const startAudioContext = () => {
//         if (audioContext.value) {
//             startSequencer()
//         } else {
//             initSynth()
//             activeSynth.value = true
//             startSequencer()
//         }
//     };
    
//     function playStep(stepIndex: number) {
//         if (!steps.value[stepIndex].active || !audioContext.value || !gainNode.value || !filterNode.value) return;

//         const frequency = Number(steps.value[stepIndex].frequency) + Number(baseFrequency.value) - 440

//         oscillator.value = audioContext.value.createOscillator();
//         oscillator.value.type = waveform.value;
//         oscillator.value.frequency.setValueAtTime(frequency, audioContext.value.currentTime);

//         oscillator.value.connect(gainNode.value);
        
//         gainNode.value.connect(filterNode.value);

//         filterNode.value.connect(audioContext.value.destination);

//         gainNode.value.gain.value = gain.value


//         setTimeout(() => oscillator?.value?.stop(), 50); // Note duration
//     }
    
//     function startSequencer() {
//         let currentStep = 0;
//         const bpm = 60000 / clock.value
//         intervalId = window.setInterval(() => {
//             playStep(currentStep);
//             currentStep = (currentStep + 1) % steps.value.length;
//         }, bpm);
//     }


//     const suspendAudioContext = () => {
//         audioContext?.value?.close().then(() => {
//             audioContext.value = null
//         })
//         if (intervalId) clearInterval(intervalId)
//     };
    
//     return { activeSynth, audioContext, clock, steps, gain, filterNode, updateOscillatorBaseFreq, updateOscillatorWave, waveform, baseFrequency, updateStepValue, startAudioContext, suspendAudioContext};
// }
