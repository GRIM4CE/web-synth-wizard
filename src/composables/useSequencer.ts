import { ref, watch } from 'vue';

import { useVCO } from "./useVCO"
import { getRandomFreq } from '@/utils/generator';

import type { Step, UseSequancerParams } from "../types"

export const useSequencer = ({
    clock,
    timeDivision,
    audioContext,
    filterNode,
    gainNode,
    vcaEnvelope,
    oscillatorSettings,
}: UseSequancerParams
) => {
    const steps = ref<Step[]>(Array.from({ length: 16 }, (_, i) => ({
        active: Math.random() >= 0.5,
        frequency: getRandomFreq(), 
        id: i
    })));
    
    let currentStep = 0;
    let intervalId: ReturnType<typeof setTimeout> | undefined;

    const {createOscillator} = useVCO()

    function calculateNoteInterval() {
        // Calculate the duration of one beat in milliseconds
        const beatDurationMs = 60000 / clock.value;
        // Adjust the duration based on the time division
        return beatDurationMs / timeDivision.value;
      }

    function startSequencer() {
        stopSequencer(); // Clear any existing sequence
        scheduleNextStep(); // Start the sequence
    }

    // Stop the sequencer
    function stopSequencer() {
        if (intervalId !== undefined) {
            clearTimeout(intervalId);
            intervalId = undefined;
        }
    }

    // Function to schedule the next step
    const scheduleNextStep = () => {
        const intervalDuration = calculateNoteInterval();
        intervalId = setTimeout(() => {
            playStep(currentStep);
            currentStep = (currentStep + 1) % steps.value.length;
            scheduleNextStep(); // Recursively schedule the next step
        }, intervalDuration);
    };

    function playStep(stepIndex: number) {
        if (!steps.value[stepIndex].active || !audioContext.value || !gainNode.value || !filterNode.value) return;
        const stepFrequency = steps.value[stepIndex].frequency
        const oscillator = createOscillator({audioContext: audioContext.value, oscillatorSettings: oscillatorSettings.value, stepFrequency})


        oscillator.connect(gainNode.value);
        gainNode.value.connect(filterNode.value);
        filterNode.value.connect(audioContext.value.destination);


        const gain = Number(vcaEnvelope.envelope.value.gain)
        const attack = Number(vcaEnvelope.envelope.value.attack)
        const decay = Number(vcaEnvelope.envelope.value.decay)
        const sustain = Number(vcaEnvelope.envelope.value.sustain)
        const release = Number(vcaEnvelope.envelope.value.release)


        const duration = attack + decay + release

        vcaEnvelope.applyEnvelope(gainNode.value, audioContext.value, duration, {gain, attack, decay, sustain, release });

        oscillator.start(audioContext.value.currentTime);
        setTimeout(() => oscillator.stop(), duration); // Note duration
    }


    // Automatically adjust BPM without stopping the sequencer
    watch(clock, () => {
        // Only adjust if the sequencer is already running
        if (intervalId !== undefined) {
            stopSequencer();
            startSequencer();
        }
    });

    return {
        steps,
        startSequencer,
        stopSequencer,
    };
}