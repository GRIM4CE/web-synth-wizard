import { ref, watch } from 'vue';

import { useVCO } from "./useVCO"
import { getRandomNote } from '@/utils/generator';

import type { Step, UseSequancerParams } from "../types"

export const useSequencer = ({
    clock,
    timeDivision,
    audioContext,
    filterNode,
    gainNode,
    analyserNode,
    filterEnabled,
    filterEnvelope,
    vcaEnvelope,
    oscillatorSettings,
    selectedMusicalKey, 
    selectedOctave,
    quantize
}: UseSequancerParams
) => {
    const steps = ref<Step[]>(Array.from({ length: 16 }, (_, i) => ({
        active: Math.random() >= 0.5,
        note: getRandomNote(), 
        id: i
    })));
    
    let currentStep = 0;
    let intervalId: ReturnType<typeof setTimeout> | undefined;
    let routed = false;

    const {createOscillator} = useVCO()

    // Wire the gain node into the output chain. Done once (and again whenever the
    // filter is toggled) rather than every step, so we don't tear down and rebuild
    // the graph while audio is flowing — that rewiring is itself a source of clicks.
    function routeGraph() {
        if (!gainNode.value || !filterNode.value || !analyserNode.value) return;
        gainNode.value.disconnect();
        filterNode.value.disconnect();
        if (filterEnabled.value) {
            gainNode.value.connect(filterNode.value);
            filterNode.value.connect(analyserNode.value);
        } else {
            gainNode.value.connect(analyserNode.value);
        }
        routed = true;
    }

    // Re-route immediately when the filter is toggled so the change is audible
    // without waiting for the next step.
    watch(filterEnabled, () => {
        if (routed) routeGraph();
    });

    // If the synth is (re)initialised the gain node is replaced, so the fresh node
    // needs wiring up again on the next step.
    watch(gainNode, () => {
        routed = false;
    });

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
        if (!steps.value[stepIndex].active || !audioContext.value || !gainNode.value || !filterNode.value || !analyserNode.value) return;
        const stepNote = steps.value[stepIndex].note

        const oscillator = createOscillator({ 
            audioContext: audioContext.value, 
            oscillatorSettings: oscillatorSettings.value, 
            stepNote,
            selectedMusicalKey, 
            selectedOctave,
            quantize
        })


        oscillator.connect(gainNode.value);

        // Ensure the output chain is wired up. Only routes on the first step; the
        // filterEnabled watcher handles re-routing after that.
        if (!routed) routeGraph();

        const duration = vcaEnvelope.applyVCAEnvelope(gainNode.value, audioContext.value, vcaEnvelope.envelope);

        if (filterEnabled.value) {
            filterEnvelope.applyFilterEnvelope(filterNode.value, audioContext.value, filterEnvelope.envelope);
        }

        const now = audioContext.value.currentTime;
        oscillator.start(now);
        // Stop on the audio clock (not setTimeout) so the oscillator ends exactly
        // when the gain envelope has ramped to its floor. A drifting timer would cut
        // the still-audible square wave mid-cycle, producing a click on every note.
        oscillator.stop(now + duration / 1000);
        // Release the finished oscillator so stopped nodes don't accumulate on the gain node.
        oscillator.onended = () => oscillator.disconnect();
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