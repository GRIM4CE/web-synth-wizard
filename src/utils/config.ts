// Cycle lengths a clock-synced LFO can span, in sequencer steps. Fractions are
// powers of two, so the stored numbers stay exact in floating point.
export const lfoSyncStepOptions: { value: number; label: string }[] = [
  ...[128, 64, 32, 16, 8, 4, 2].map((divisor) => ({ value: 1 / divisor, label: `1/${divisor}` })),
  ...[1, 2, 4, 8, 16, 32, 64, 128, 256].map((steps) => ({ value: steps, label: `${steps}` }))
]

// Frequency of an LFO whose cycle spans `syncSteps` sequencer steps: the
// sequencer emits (bpm / 60) * timeDivision steps per second, and one cycle
// covers syncSteps of them.
export const lfoSyncRate = (bpm: number, timeDivision: number, syncSteps: number) =>
  (bpm / 60) * timeDivision / syncSteps

// Instantaneous value (-1..1) of an LFO waveform at a phase (0..1). Used for
// the JS-domain LFO targets (Turing probability, VCA envelope times), which
// sample the waveform at gate time instead of wiring into an AudioParam.
export const lfoWaveValue = (waveform: OscillatorType, phase: number): number => {
  const wrapped = phase - Math.floor(phase)
  switch (waveform) {
    case 'square': return wrapped < 0.5 ? 1 : -1
    case 'sawtooth': return 2 * wrapped - 1
    case 'triangle': return 1 - 4 * Math.abs(wrapped - 0.5)
    default: return Math.sin(2 * Math.PI * wrapped)
  }
}

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
