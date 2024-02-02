import type { CreateOscillatorParams } from "@/types"
import { notes } from "@/utils/config"

export const useVCO = () => {
    const createOscillator = ({
        audioContext, 
        oscillatorSettings, 
        stepFrequency,          
        selectedMusicalKey, 
        selectedOctave,
        quantize
    }: CreateOscillatorParams): OscillatorNode => {
        const oscillator = audioContext.createOscillator();
        let frequency = Number(stepFrequency) + Number(oscillatorSettings.baseFrequency) - 440

        if (quantize && selectedMusicalKey) {
            const noteOffsetFromC = notes[selectedMusicalKey.value];
            // Calculate the frequency for the note in the selected key and octave
            frequency = calculateFrequencyForNoteInKey(noteOffsetFromC, selectedOctave.value, frequency);
        }

        oscillator.type = oscillatorSettings.type
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        return oscillator
    };

    // Helper function to calculate the frequency for a note in the given key and octave
    function calculateFrequencyForNoteInKey(noteOffsetFromC: number, octave: number, targetFrequency:number ) {
        const A4_FREQUENCY = 440;
        const SEMITONE_RATIO = Math.pow(2, 1/12);
        const noteDistanceFromA4 = noteOffsetFromC + notes['A'] - notes['C'] + (octave - 4) * 12;
        
        // Calculate the frequency for C in the selected octave
        const frequencyForCInOctave = A4_FREQUENCY * Math.pow(SEMITONE_RATIO, noteDistanceFromA4);
        
        // Find the nearest note to the target frequency within the key's scale
        const majorScale = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals in semitones from the root
        const closestNoteDistance = majorScale.reduce((prev, curr) => {
            const prevDistance = Math.abs(targetFrequency - frequencyForCInOctave * Math.pow(SEMITONE_RATIO, prev));
            const currDistance = Math.abs(targetFrequency - frequencyForCInOctave * Math.pow(SEMITONE_RATIO, curr));
            return (prevDistance < currDistance) ? prev : curr;
        });

        // Calculate the frequency for the closest note in the major scale
        return frequencyForCInOctave * Math.pow(SEMITONE_RATIO, closestNoteDistance);
    }

    return { createOscillator };
}
