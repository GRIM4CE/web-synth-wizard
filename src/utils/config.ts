export const notes = {
    'C': 0,
    'C#': 1,
    'D': 2,
    'D#': 3,
    'E': 4,
    'F': 5,
    'F#': 6,
    'G': 7,
    'G#': 8,
    'A': 9,
    'A#': 10,
    'B': 11
  };

const noteNames = Object.keys(notes)

// Nearest note name (with octave) for a frequency, e.g. 261.6 -> 'C4'.
export const frequencyToNoteName = (frequency: number) => {
    if (!Number.isFinite(frequency) || frequency <= 0) return '—'
    const midiNote = Math.round(69 + 12 * Math.log2(frequency / 440))
    const name = noteNames[((midiNote % 12) + 12) % 12]
    return `${name}${Math.floor(midiNote / 12) - 1}`
}
