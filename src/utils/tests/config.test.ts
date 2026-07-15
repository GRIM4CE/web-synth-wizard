import { describe, it, expect } from 'vitest'
import { lfoSyncRate, lfoSyncStepOptions } from '@/utils/config'

describe('lfoSyncRate', () => {
  it('matches the step rate when the cycle is one step', () => {
    // 120 BPM at quarter notes = 8 steps per second, so a 1-step cycle is 8Hz.
    expect(lfoSyncRate(120, 4, 1)).toBeCloseTo(8)
  })

  it('slows down as the cycle spans more steps', () => {
    // 16 steps at 120 BPM quarter notes take 2 seconds: 0.5Hz.
    expect(lfoSyncRate(120, 4, 16)).toBeCloseTo(0.5)
  })

  it('speeds up for fractional step cycles', () => {
    // A 1/8-step cycle runs 8 times per step.
    expect(lfoSyncRate(120, 4, 1 / 8)).toBeCloseTo(64)
  })

  it('scales with tempo and time division', () => {
    expect(lfoSyncRate(240, 4, 1)).toBeCloseTo(lfoSyncRate(120, 4, 1) * 2)
    expect(lfoSyncRate(120, 8, 1)).toBeCloseTo(lfoSyncRate(120, 4, 1) * 2)
  })
})

describe('lfoSyncStepOptions', () => {
  it('spans 1/128 of a step through 256 steps', () => {
    const values = lfoSyncStepOptions.map((option) => option.value)
    expect(values[0]).toBe(1 / 128)
    expect(values[values.length - 1]).toBe(256)
    expect(values.length).toBe(16)
  })

  it('is ordered from shortest to longest cycle', () => {
    const values = lfoSyncStepOptions.map((option) => option.value)
    const sorted = [...values].sort((a, b) => a - b)
    expect(values).toEqual(sorted)
  })
})
