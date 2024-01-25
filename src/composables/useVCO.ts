import type { CreateOscillatorParams } from "@/types"

export const useVCO = () => {
    const createOscillator = ({audioContext, oscillatorSettings, stepFrequency}: CreateOscillatorParams): OscillatorNode => {
        const oscillator = audioContext.createOscillator();
        const frequency = Number(stepFrequency) + Number(oscillatorSettings.baseFrequency) - 440
        oscillator.type = oscillatorSettings.type
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        return oscillator
    };

    return { createOscillator };
}
