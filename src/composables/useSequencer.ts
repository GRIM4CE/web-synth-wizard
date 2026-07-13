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

    // Monophonic voice state: a single oscillator is kept alive and retuned from
    // step to step (like a classic analog mono synth) instead of allocating a new
    // oscillator per step. This is what keeps overlapping long-release notes from
    // stacking up on the shared gain node and beating against each other.
    let currentOscillator: OscillatorNode | null = null;
    // Whether the amplifier gate is currently open (a note is sounding). Used to
    // hold sustain across contiguous active steps and only release on a rest.
    let voiceActive = false;

    const {createOscillator, getFrequency} = useVCO()

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
        stopVoice();
    }

    // Silence and tear down the monophonic voice.
    function stopVoice() {
        if (currentOscillator) {
            try {
                currentOscillator.stop();
            } catch {
                // Oscillator may already be stopped or its context closed.
            }
            currentOscillator.disconnect();
            currentOscillator = null;
        }
        voiceActive = false;
        if (gainNode.value && audioContext.value) {
            const now = audioContext.value.currentTime;
            gainNode.value.gain.cancelScheduledValues(now);
            gainNode.value.gain.setValueAtTime(0.0001, now);
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
        if (!audioContext.value || !gainNode.value || !filterNode.value || !analyserNode.value) return;

        // Ensure the output chain is wired up. Only routes on the first step; the
        // filterEnabled watcher handles re-routing after that.
        if (!routed) routeGraph();

        const ctx = audioContext.value;
        const step = steps.value[stepIndex];

        if (step.active) {
            const params = {
                audioContext: ctx,
                oscillatorSettings: oscillatorSettings.value,
                stepNote: step.note,
                selectedMusicalKey,
                selectedOctave,
                quantize
            };

            if (!currentOscillator) {
                // Start the single voice and keep it running for the whole sequence.
                currentOscillator = createOscillator(params);
                currentOscillator.connect(gainNode.value);
                currentOscillator.start(ctx.currentTime);
            } else {
                // Legato: retune the running voice (phase-continuous, so no click) and
                // pick up any waveform change.
                currentOscillator.type = oscillatorSettings.value.type;
                currentOscillator.frequency.setValueAtTime(getFrequency(params), ctx.currentTime);
            }

            // Only (re)trigger the envelopes when coming from silence; contiguous
            // active steps hold their sustain so the tone stays continuous.
            if (!voiceActive) {
                vcaEnvelope.triggerAttack(gainNode.value, ctx, vcaEnvelope.envelope);
                if (filterEnabled.value) {
                    filterEnvelope.triggerAttack(filterNode.value, ctx, filterEnvelope.envelope);
                }
                voiceActive = true;
            }
        } else if (voiceActive) {
            // Rest: release the gate so the tone stops until the next active step.
            vcaEnvelope.triggerRelease(gainNode.value, ctx, vcaEnvelope.envelope);
            if (filterEnabled.value) {
                filterEnvelope.triggerRelease(filterNode.value, ctx, filterEnvelope.envelope);
            }
            voiceActive = false;
        }
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