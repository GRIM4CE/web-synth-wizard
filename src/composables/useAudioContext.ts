import { useAudioContextManager } from './useAudioContextManager';
import { useSequencer  } from './useSequencer';
import type { Step } from "@/types"

const { initSynth, clock, timeDivision, audioContext, gainNode, filterNode, oscillatorSettings, filterSettings, gain } = useAudioContextManager()
const { steps, startSequencer, stopSequencer } = useSequencer({clock, timeDivision, audioContext, gainNode, filterNode, oscillatorSettings })


export const useAudioContext = () => {
    const updateStepValue = (updatedSteps: Step[]) => {
        steps.value = updatedSteps
    }
    
    const startAudioContext = () => {
        initSynth()
        startSequencer()
    };

    const suspendAudioContext = () => {
        audioContext?.value?.close().then(() => {
            audioContext.value = null
        })
        stopSequencer()
    };
    
    return { clock, timeDivision, audioContext, gainNode, filterNode, oscillatorSettings, filterSettings, steps, gain, updateStepValue, startAudioContext, suspendAudioContext};
}
