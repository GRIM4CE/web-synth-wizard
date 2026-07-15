import { useAudioContextManager } from './useAudioContextManager';
import { useSequencer  } from './useSequencer';
import type { Step } from "@/types"
import type { MusicalKey, Octaves } from "@/types"

import { notes } from "@/utils/config"

const { initSynth, clock, timeDivision, audioContext, gainNode, analyserNode, filterEnabled, filterEnvelopeEnabled, vcaEnvelopeEnabled, filterNode, oscillatorSettings, filterSettings, filterEnvelope, vcaEnvelope, selectedMusicalKey, selectedOctave, quantize, effectsInputNode, delayNode, delayEnabled, delaySettings, applyDelaySettings, lfoSettings, applyLfoSettings, voiceOscillator, physicalVoiceNode, tremoloNode, preFxTapNode, masterOutNode, scopeSource, pulseInputNode, vcoTapNode, applyPulseWidth, applyVoiceSettings } = useAudioContextManager()
const { steps, startSequencer, stopSequencer, sequencerMode, turingProbability, turingSteps, setTuringLength, noteOn, noteOff, liveNoteFrequency, stepFrequency, setStepCount, randomizeNotes, randomizeGates, randomizeSteps } = useSequencer({clock, timeDivision, audioContext, gainNode, analyserNode, preFxTapNode, pulseInputNode, vcoTapNode, tremoloNode, voiceOscillator, physicalVoiceNode, filterEnabled, filterEnvelopeEnabled, vcaEnvelopeEnabled, filterNode, filterEnvelope, vcaEnvelope, oscillatorSettings, selectedMusicalKey, selectedOctave, quantize })


export const useAudioContext = () => {
    const updateStepValue = (updatedSteps: Step[]) => {
        steps.value = updatedSteps
    }

    function calculateFrequency(note: MusicalKey, octave: Octaves) {
        const A4_FREQUENCY = 440; // Frequency of A4
        const n = notes[note] - 9; // Number of half steps away from A4, A is the 10th note in the 12 note scale starting from C.
        let frequency = A4_FREQUENCY * Math.pow(2, n / 12);
      
        // Adjust for octave
        const octaveDifference = octave - 4;
        frequency *= Math.pow(2, octaveDifference);

        oscillatorSettings.value.baseFrequency = frequency

        return frequency
    }
    
    const startAudioContext = async () => {
        await initSynth()
        startSequencer()
    };

    const suspendAudioContext = () => {
        audioContext?.value?.suspend()
        stopSequencer()
    };
    
    return { clock, timeDivision, audioContext, gainNode, analyserNode, filterEnabled, filterEnvelopeEnabled, vcaEnvelopeEnabled, filterNode, oscillatorSettings, filterSettings, vcaEnvelope, filterEnvelope, steps, updateStepValue, startAudioContext, suspendAudioContext, calculateFrequency, selectedMusicalKey, selectedOctave, quantize, delayNode, delayEnabled, delaySettings, applyDelaySettings, lfoSettings, applyLfoSettings, scopeSource, effectsInputNode, masterOutNode, applyPulseWidth, applyVoiceSettings, sequencerMode, turingProbability, turingSteps, setTuringLength, noteOn, noteOff, liveNoteFrequency, stepFrequency, setStepCount, randomizeNotes, randomizeGates, randomizeSteps};
}
