import { describe, it, expect, vi } from 'vitest'
import { useEnvelope } from '@/composables/useEnvelope'
import type { VcaEnvelopeObject, FilterEnvelopeObject } from '@/types'

function createMockGainNode() {
  return {
    gain: {
      value: 0,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
  }
}

function createMockFilterNode() {
  return {
    frequency: {
      value: 0,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  }
}

function createMockAudioContext(currentTime = 0) {
  return { currentTime }
}

describe('useEnvelope', () => {
  describe('createEnvelope', () => {
    it('returns triggerAttack/triggerRelease for vca type', () => {
      const { createEnvelope } = useEnvelope()
      const result = createEnvelope({
        attack: 30, decay: 100, sustain: 0.5, release: 50, gain: 0.01,
      }, 'vca') as unknown as VcaEnvelopeObject

      expect(result).toHaveProperty('envelope')
      expect(result).toHaveProperty('triggerAttack')
      expect(result).toHaveProperty('triggerRelease')
    })

    it('returns triggerAttack/triggerRelease for filter type', () => {
      const { createEnvelope } = useEnvelope()
      const result = createEnvelope({
        attack: 10, decay: 100, sustain: 0.5, release: 20,
        frequency: 2500, maxFrequency: 20000,
      }, 'filter') as unknown as FilterEnvelopeObject

      expect(result).toHaveProperty('envelope')
      expect(result).toHaveProperty('triggerAttack')
      expect(result).toHaveProperty('triggerRelease')
    })
  })

  describe('vca triggerAttack', () => {
    it('converts ms envelope values to seconds for attack and decay scheduling', () => {
      const { createEnvelope } = useEnvelope()
      const result = createEnvelope({
        attack: 30, decay: 100, sustain: 0.5, release: 50, gain: 0.01,
      }, 'vca') as unknown as VcaEnvelopeObject

      const mockGain = createMockGainNode()
      const mockCtx = createMockAudioContext(1)

      result.triggerAttack(
        mockGain as unknown as GainNode,
        mockCtx as unknown as AudioContext,
        result.envelope,
      )

      const rampCalls = mockGain.gain.exponentialRampToValueAtTime.mock.calls

      // Attack ramp should be at now + 0.03s (30ms), not now + 30s
      expect(rampCalls[0][1]).toBeCloseTo(1.03, 2)
      // Decay ramp should be at now + 0.03 + 0.1 = 0.13s
      expect(rampCalls[1][1]).toBeCloseTo(1.13, 2)
    })

    it('holds the sustain level (no release scheduled on attack)', () => {
      const { createEnvelope } = useEnvelope()
      const result = createEnvelope({
        attack: 30, decay: 100, sustain: 0.5, release: 50, gain: 0.01,
      }, 'vca') as unknown as VcaEnvelopeObject

      const mockGain = createMockGainNode()
      const mockCtx = createMockAudioContext(0)

      result.triggerAttack(
        mockGain as unknown as GainNode,
        mockCtx as unknown as AudioContext,
        result.envelope,
      )

      // Attack schedules exactly two ramps (attack peak, decay to sustain); the
      // release only happens on triggerRelease.
      expect(mockGain.gain.exponentialRampToValueAtTime.mock.calls).toHaveLength(2)
    })
  })

  describe('vca triggerRelease', () => {
    it('ramps to silence over the release time and returns it in ms', () => {
      const { createEnvelope } = useEnvelope()
      const result = createEnvelope({
        attack: 30, decay: 100, sustain: 0.5, release: 50, gain: 0.01,
      }, 'vca') as unknown as VcaEnvelopeObject

      const mockGain = createMockGainNode()
      const mockCtx = createMockAudioContext(2)

      const releaseMs = result.triggerRelease(
        mockGain as unknown as GainNode,
        mockCtx as unknown as AudioContext,
        result.envelope,
      )

      const rampCalls = mockGain.gain.exponentialRampToValueAtTime.mock.calls
      // Release ramp ends at now + 0.05s (50ms)
      expect(rampCalls[0][1]).toBeCloseTo(2.05, 2)
      expect(releaseMs).toBeCloseTo(50, 1)
    })
  })

  describe('filter triggerAttack', () => {
    it('converts ms envelope values to seconds for scheduling', () => {
      const { createEnvelope } = useEnvelope()
      const result = createEnvelope({
        attack: 200, decay: 100, sustain: 0.5, release: 200,
        frequency: 2500, maxFrequency: 20000,
      }, 'filter') as unknown as FilterEnvelopeObject

      const mockFilter = createMockFilterNode()
      const mockCtx = createMockAudioContext(2)

      result.triggerAttack(
        mockFilter as unknown as BiquadFilterNode,
        mockCtx as unknown as AudioContext,
        result.envelope,
      )

      const rampCalls = mockFilter.frequency.exponentialRampToValueAtTime.mock.calls

      // Attack ramp at now + 0.2s (200ms)
      expect(rampCalls[0][1]).toBeCloseTo(2.2, 2)
      // Decay ramp at now + 0.2 + 0.1 = 0.3s
      expect(rampCalls[1][1]).toBeCloseTo(2.3, 2)
    })
  })
})
