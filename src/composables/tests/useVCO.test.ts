import { describe, it, expect, vi } from 'vitest'
import { useVCO } from '@/composables/useVCO'
import { ref } from 'vue'
import type { MusicalKey } from '@/types'

function createMockAudioContext() {
  const setValueAtTime = vi.fn()
  const oscillator = {
    type: 'sine' as OscillatorType,
    frequency: { value: 0, setValueAtTime },
  }
  return {
    currentTime: 0,
    createOscillator: vi.fn(() => oscillator),
    oscillator,
    setValueAtTime,
  }
}

describe('useVCO', () => {
  it('creates an oscillator with the correct type', () => {
    const mock = createMockAudioContext()
    const { createOscillator } = useVCO()

    const result = createOscillator({
      audioContext: mock as unknown as AudioContext,
      oscillatorSettings: { type: 'sawtooth', baseFrequency: 440 },
      stepNote: 0,
      selectedMusicalKey: ref<MusicalKey>('C'),
      selectedOctave: ref<1 | 2 | 3 | 4 | 5 | 6 | 7>(4),
      quantize: ref(false),
    })

    expect(mock.createOscillator).toHaveBeenCalled()
    expect(result.type).toBe('sawtooth')
  })

  it('sets a positive frequency on the oscillator', () => {
    const mock = createMockAudioContext()
    const { createOscillator } = useVCO()

    createOscillator({
      audioContext: mock as unknown as AudioContext,
      oscillatorSettings: { type: 'sine', baseFrequency: 440 },
      stepNote: 0,
      selectedMusicalKey: ref<MusicalKey>('C'),
      selectedOctave: ref<1 | 2 | 3 | 4 | 5 | 6 | 7>(4),
      quantize: ref(false),
    })

    expect(mock.setValueAtTime).toHaveBeenCalledOnce()
    const frequency = mock.setValueAtTime.mock.calls[0][0]
    expect(frequency).toBeGreaterThan(0)
  })

  it('produces higher frequency for higher stepNote', () => {
    const mock1 = createMockAudioContext()
    const mock2 = createMockAudioContext()
    const { createOscillator } = useVCO()

    const baseParams = {
      oscillatorSettings: { type: 'sine' as OscillatorType, baseFrequency: 440 },
      selectedMusicalKey: ref<MusicalKey>('C'),
      selectedOctave: ref<1 | 2 | 3 | 4 | 5 | 6 | 7>(4),
      quantize: ref(false),
    }

    createOscillator({ audioContext: mock1 as unknown as AudioContext, ...baseParams, stepNote: 0 })
    createOscillator({ audioContext: mock2 as unknown as AudioContext, ...baseParams, stepNote: 7 })

    const freqLow = mock1.setValueAtTime.mock.calls[0][0]
    const freqHigh = mock2.setValueAtTime.mock.calls[0][0]
    expect(freqHigh).toBeGreaterThan(freqLow)
  })

  it('produces different frequencies for different octaves', () => {
    const mock1 = createMockAudioContext()
    const mock2 = createMockAudioContext()
    const { createOscillator } = useVCO()

    const baseParams = {
      oscillatorSettings: { type: 'sine' as OscillatorType, baseFrequency: 440 },
      selectedMusicalKey: ref<MusicalKey>('C'),
      stepNote: 0,
      quantize: ref(true),
    }

    createOscillator({
      audioContext: mock1 as unknown as AudioContext,
      ...baseParams,
      selectedOctave: ref<1 | 2 | 3 | 4 | 5 | 6 | 7>(3),
    })
    createOscillator({
      audioContext: mock2 as unknown as AudioContext,
      ...baseParams,
      selectedOctave: ref<1 | 2 | 3 | 4 | 5 | 6 | 7>(5),
    })

    const freqLow = mock1.setValueAtTime.mock.calls[0][0]
    const freqHigh = mock2.setValueAtTime.mock.calls[0][0]
    expect(freqHigh).toBeGreaterThan(freqLow)
  })
})
