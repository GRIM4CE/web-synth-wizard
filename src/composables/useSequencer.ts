import { ref, watch } from 'vue';

import { useVCO } from "./useVCO"
import { usePhysicalVoice } from "./usePhysicalVoice"
import { getRandomNote } from '@/utils/generator';

import type { SequencerMode, Step, TuringStep, UseSequancerParams } from "../types"

// Bounds for the step grid's resizable length.
export const MIN_STEPS = 1
export const MAX_STEPS = 64

const randomStep = (id: number): Step => ({
    active: Math.random() >= 0.5,
    note: getRandomNote(),
    id
})

// The Turing machine keeps its gates fairly busy; a re-rolled slot fires
// three times out of four so high randomness stays melodic, not silent.
const randomTuringStep = (): TuringStep => ({
    voltage: Math.random(),
    gate: Math.random() < 0.75
})

export const useSequencer = ({
    clock,
    timeDivision,
    audioContext,
    filterNode,
    gainNode,
    analyserNode,
    preFxTapNode,
    pulseInputNode,
    vcoTapNode,
    tremoloNode,
    voiceOscillator,
    physicalVoiceNode,
    filterEnabled,
    filterEnvelopeEnabled,
    filterEnvelope,
    vcaEnvelope,
    oscillatorSettings,
    selectedMusicalKey,
    selectedOctave,
    quantize
}: UseSequancerParams
) => {
    const steps = ref<Step[]>(Array.from({ length: 16 }, (_, i) => randomStep(i)));

    // What drives the voice: the step grid, live keyboard/MIDI notes, or the
    // Turing machine. The clock keeps ticking in every mode so switching back
    // mid-performance stays in time; keyboard mode just ignores the ticks.
    const sequencerMode = ref<SequencerMode>('steps')

    // Turing machine (a simplified Music Thing style shift register): a loop
    // of random voltages/gates. The probability dial sets the chance each slot
    // is re-rolled as it comes around — 0 locks the loop, 1 is pure noise.
    const turingProbability = ref(0.3)
    const turingSteps = ref<TuringStep[]>(Array.from({ length: 16 }, () => randomTuringStep()))

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

    // Notes currently held in keyboard/MIDI mode, oldest first. The voice is
    // monophonic with last-note priority: releasing the newest key falls back
    // to the most recent one still held.
    const heldNotes: { id: number, frequency: number }[] = []

    const { getFrequency } = useVCO()
    const { pluckVoice } = usePhysicalVoice()

    const voiceParams = (stepNote: number) => ({
        audioContext: audioContext.value as AudioContext,
        oscillatorSettings: oscillatorSettings.value,
        stepNote,
        selectedMusicalKey,
        selectedOctave,
        quantize
    })

    // Resolve the frequency a step slider position plays right now, so the UI
    // can label each step with the same pitch the voice will use.
    const stepFrequency = (stepNote: number) => getFrequency(voiceParams(stepNote))

    // Keyboard/MIDI notes play chromatically from the VCO's base frequency —
    // a keyboard already picks concrete notes, so the quantizer stays out of it.
    const liveNoteFrequency = (semitoneOffset: number) =>
        Number(oscillatorSettings.value.baseFrequency) * Math.pow(2, semitoneOffset / 12)

    // Wire the voice oscillator to the VCA, honouring the selected waveform.
    // A square is produced by the pulse-width chain (sawtooth into a comparator,
    // so its duty cycle is adjustable); every other wave connects directly.
    // Reconnecting mid-note can click, so the graph is only touched when the
    // wave actually moves into or out of the pulse chain.
    let voiceWiring: 'pulse' | 'direct' | null = null;
    function wireOscillator(oscillator: OscillatorNode) {
        if (!gainNode.value) return;
        const usePulse = oscillatorSettings.value.type === 'square' && !!pulseInputNode.value;
        oscillator.type = usePulse ? 'sawtooth' : oscillatorSettings.value.type;
        const wiring = usePulse ? 'pulse' : 'direct';
        if (wiring === voiceWiring) return;
        oscillator.disconnect();
        if (usePulse) {
            // The pulse chain feeds the VCO scope tap itself (post-comparator).
            oscillator.connect(pulseInputNode.value!);
        } else {
            oscillator.connect(gainNode.value);
            // Mirror the raw wave onto the VCO scope tap.
            if (vcoTapNode.value) oscillator.connect(vcoTapNode.value);
        }
        voiceWiring = wiring;
    }

    // Wire the gain node into the output chain. Done once (and again whenever the
    // filter is toggled) rather than every step, so we don't tear down and rebuild
    // the graph while audio is flowing — that rewiring is itself a source of clicks.
    function routeGraph() {
        if (!gainNode.value || !filterNode.value || !preFxTapNode.value) return;
        // Voice chain: VCA -> tremolo -> (filter) -> pre-effects tap. The tap
        // feeds the effects bus, whose dry/wet paths end at the master output.
        const output = preFxTapNode.value;
        const tremolo = tremoloNode.value;
        gainNode.value.disconnect();
        filterNode.value.disconnect();
        let source: AudioNode = gainNode.value;
        if (tremolo) {
            tremolo.disconnect();
            gainNode.value.connect(tremolo);
            source = tremolo;
        }
        if (filterEnabled.value) {
            source.connect(filterNode.value);
            filterNode.value.connect(output);
        } else {
            source.connect(output);
        }
        routed = true;
    }

    // Re-route immediately when the filter is toggled so the change is audible
    // without waiting for the next step.
    watch(filterEnabled, () => {
        if (routed) routeGraph();
    });

    // When the filter envelope is switched off mid-note, cancel any in-flight
    // cutoff sweep and pin the cutoff at the panel frequency.
    watch(filterEnvelopeEnabled, (enabled) => {
        if (enabled || !filterNode.value || !audioContext.value) return;
        const now = audioContext.value.currentTime;
        filterNode.value.frequency.cancelScheduledValues(now);
        filterNode.value.frequency.setValueAtTime(filterEnvelope.envelope.value.frequency, now);
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

    // Tear down just the oscillator (used when stopping, and when the physical
    // voice engine takes over mid-sequence).
    function teardownOscillator() {
        if (!currentOscillator) return;
        try {
            currentOscillator.stop();
        } catch {
            // Oscillator may already be stopped or its context closed.
        }
        currentOscillator.disconnect();
        currentOscillator = null;
        voiceOscillator.value = null;
        voiceWiring = null;
    }

    // Silence and tear down the monophonic voice.
    function stopVoice() {
        teardownOscillator();
        voiceActive = false;
        heldNotes.length = 0;
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
            const loopLength = sequencerMode.value === 'turing'
                ? turingSteps.value.length
                : steps.value.length;
            currentStep = (currentStep + 1) % loopLength;
            scheduleNextStep(); // Recursively schedule the next step
        }, intervalDuration);
    };

    // Open the amplifier gate at a frequency: (re)tune the persistent voice and
    // trigger the envelopes when coming from silence. Contiguous notes hold
    // their sustain (legato) so the tone stays continuous. Shared by all modes.
    function openGate(frequency: number) {
        if (!audioContext.value || !gainNode.value || !filterNode.value) return;

        // Ensure the output chain is wired up. Only routes on the first note; the
        // filterEnabled watcher handles re-routing after that.
        if (!routed) routeGraph();

        const ctx = audioContext.value;

        const usePhysical = oscillatorSettings.value.engine === 'voice' && !!physicalVoiceNode.value;

        if (usePhysical) {
            // The physical voice replaces the oscillator entirely; silence the
            // oscillator in case the engine was switched mid-performance.
            teardownOscillator();
            // A pluck is a note-on, not a retune — a string has no
            // phase-continuous legato — so every gate re-excites it.
            pluckVoice(physicalVoiceNode.value!, frequency, oscillatorSettings.value.damping, ctx.currentTime);
        } else if (!currentOscillator) {
            // Start the single voice and keep it running for the whole sequence.
            currentOscillator = ctx.createOscillator();
            wireOscillator(currentOscillator);
            currentOscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
            currentOscillator.start(ctx.currentTime);
            // Publish the live voice so LFOs and the scope can attach to it.
            voiceOscillator.value = currentOscillator;
        } else {
            // Legato: retune the running voice (phase-continuous, so no click) and
            // pick up any waveform change (including into/out of the pulse chain).
            wireOscillator(currentOscillator);
            currentOscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
        }

        if (!voiceActive) {
            vcaEnvelope.triggerAttack(gainNode.value, ctx, vcaEnvelope.envelope);
            if (filterEnabled.value) {
                if (filterEnvelopeEnabled.value) {
                    filterEnvelope.triggerAttack(filterNode.value, ctx, filterEnvelope.envelope);
                } else {
                    // No envelope: the cutoff just sits at the panel frequency.
                    filterNode.value.frequency.setValueAtTime(filterEnvelope.envelope.value.frequency, ctx.currentTime);
                }
            }
            voiceActive = true;
        }
    }

    // Release the gate so the tone stops until the next note.
    function closeGate() {
        if (!voiceActive || !audioContext.value || !gainNode.value || !filterNode.value) return;
        vcaEnvelope.triggerRelease(gainNode.value, audioContext.value, vcaEnvelope.envelope);
        if (filterEnabled.value && filterEnvelopeEnabled.value) {
            filterEnvelope.triggerRelease(filterNode.value, audioContext.value, filterEnvelope.envelope);
        }
        voiceActive = false;
    }

    function playStep(stepIndex: number) {
        if (!audioContext.value || !gainNode.value || !filterNode.value || !analyserNode.value) return;

        // Keyboard/MIDI mode: the clock keeps time but notes are gated by hand.
        if (sequencerMode.value === 'keyboard') return;

        if (sequencerMode.value === 'turing') {
            playTuringStep(stepIndex);
            return;
        }

        const step = steps.value[stepIndex];
        // The grid may have been shrunk mid-cycle; the modulo catches up next tick.
        if (!step) return;

        if (step.active) {
            openGate(getFrequency(voiceParams(step.note)));
        } else {
            closeGate();
        }
    }

    function playTuringStep(stepIndex: number) {
        const slot = turingSteps.value[stepIndex % turingSteps.value.length];
        if (!slot) return;

        // The dial is the chance this slot mutates as it comes around.
        if (Math.random() < turingProbability.value) {
            const fresh = randomTuringStep();
            slot.voltage = fresh.voltage;
            slot.gate = fresh.gate;
        }

        if (slot.gate) {
            // A voltage spans one octave (0..12 semitones). getFrequency snaps it
            // to the selected scale while the quantizer is on; otherwise the raw
            // (fractional, unquantised) voltage plays as-is.
            openGate(getFrequency(voiceParams(slot.voltage * 12)));
        } else {
            closeGate();
        }
    }

    // --- Live play (keyboard / MIDI) ---

    function noteOn(id: number, frequency: number) {
        const existing = heldNotes.findIndex((note) => note.id === id);
        if (existing >= 0) heldNotes.splice(existing, 1);
        heldNotes.push({ id, frequency });
        openGate(frequency);
    }

    function noteOff(id: number) {
        const index = heldNotes.findIndex((note) => note.id === id);
        if (index >= 0) heldNotes.splice(index, 1);
        if (heldNotes.length) {
            // Fall back to the most recent key still held (last-note priority).
            openGate(heldNotes[heldNotes.length - 1].frequency);
        } else {
            closeGate();
        }
    }

    // --- Step grid editing ---

    // Resize the grid, keeping existing steps and filling growth with fresh
    // random ones.
    function setStepCount(count: number) {
        const clamped = Math.min(Math.max(Math.round(count), MIN_STEPS), MAX_STEPS);
        const current = steps.value;
        if (clamped < current.length) {
            steps.value = current.slice(0, clamped);
        } else if (clamped > current.length) {
            steps.value = [
                ...current,
                ...Array.from({ length: clamped - current.length }, (_, i) => randomStep(current.length + i))
            ];
        }
    }

    function randomizeNotes() {
        steps.value.forEach((step) => {
            step.note = getRandomNote();
        });
    }

    function randomizeGates() {
        steps.value.forEach((step) => {
            step.active = Math.random() >= 0.5;
        });
    }

    function randomizeSteps() {
        randomizeNotes();
        randomizeGates();
    }

    // Resize the Turing register the same way, filling growth with fresh slots.
    function setTuringLength(count: number) {
        const clamped = Math.min(Math.max(Math.round(count), MIN_STEPS), MAX_STEPS);
        const current = turingSteps.value;
        if (clamped < current.length) {
            turingSteps.value = current.slice(0, clamped);
        } else if (clamped > current.length) {
            turingSteps.value = [
                ...current,
                ...Array.from({ length: clamped - current.length }, () => randomTuringStep())
            ];
        }
    }

    // Release whatever the previous mode left sounding and drop stale held notes.
    watch(sequencerMode, () => {
        heldNotes.length = 0;
        closeGate();
    });

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
        sequencerMode,
        turingProbability,
        turingSteps,
        setTuringLength,
        noteOn,
        noteOff,
        liveNoteFrequency,
        stepFrequency,
        setStepCount,
        randomizeNotes,
        randomizeGates,
        randomizeSteps,
    };
}