import type { CreateOscillatorParams, MusicalKey } from "@/types"
import { notes } from "@/utils/config"

const calculateFrequencyForNoteInKey = (keyOffsetFromC: number, octave: number, note: number) => {
    const A4_FREQUENCY = 440;
    const SEMITONE_RATIO = Math.pow(2, 1/12);
    const rootNoteDistanceFromA4 = keyOffsetFromC + notes['A'] - notes['C'] + ((octave - 4) * 12);
    const frequencyForCInOctave = A4_FREQUENCY * Math.pow(SEMITONE_RATIO, rootNoteDistanceFromA4);
    return frequencyForCInOctave * Math.pow(SEMITONE_RATIO, note);
}

export const useVCO = () => {
    const createOscillator = ({
        audioContext, 
        oscillatorSettings, 
        stepNote,          
        selectedMusicalKey, 
        selectedOctave,
        quantize
    }: CreateOscillatorParams): OscillatorNode => {
        const oscillator = audioContext.createOscillator();
        let frequency = Number(oscillatorSettings.baseFrequency) * Math.pow(2, stepNote / 12);

        if (quantize && selectedMusicalKey) {
            frequency = quantizeNote(selectedMusicalKey.value, selectedOctave.value, stepNote);
        }

        oscillator.type = oscillatorSettings.type
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        return oscillator
    };

    const quantizeNote = (key: MusicalKey, octave: number, note: number) => {
        const keyOffsetFromC = notes[key];
        const noteFrequency = calculateFrequencyForNoteInKey(keyOffsetFromC, octave, note);
        
        const majorScale = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals in semitones from the root
        const closestNoteIndex = majorScale.reduce((prevIndex, currIndex, currentIndex) => {
            const prevNoteFrequency = calculateFrequencyForNoteInKey(keyOffsetFromC, octave, majorScale[prevIndex]);
            const currNoteFrequency = calculateFrequencyForNoteInKey(keyOffsetFromC, octave, currIndex);
            return (Math.abs(noteFrequency - prevNoteFrequency) < Math.abs(noteFrequency - currNoteFrequency)) ? prevIndex : currentIndex;
        }, 0);
    
        const quantizedNote = majorScale[closestNoteIndex];
        const quantizedFrequency = calculateFrequencyForNoteInKey(keyOffsetFromC, octave, quantizedNote);
        return quantizedFrequency
    }

    return { createOscillator };
}
