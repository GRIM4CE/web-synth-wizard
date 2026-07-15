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
