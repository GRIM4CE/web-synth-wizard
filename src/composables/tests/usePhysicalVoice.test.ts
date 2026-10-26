import { describe, it, expect, vi } from 'vitest'
import { usePhysicalVoice, resonatorModelIndex, RESONATOR_MODELS } from '@/composables/usePhysicalVoice'

function createMockVoiceNode() {
  const frequencyParam = { setValueAtTime: vi.fn() }
  const modelParam = { setValueAtTime: vi.fn() }
  const dampingParam = { setValueAtTime: vi.fn() }
  const structureParam = { setValueAtTime: vi.fn() }
  const brightnessParam = { setValueAtTime: vi.fn() }
  const positionParam = { setValueAtTime: vi.fn() }
  return {
    frequencyParam,
    modelParam,
    dampingParam,
    structureParam,
    brightnessParam,
    positionParam,
    node: {
      parameters: new Map<string, unknown>([
        ['frequency', frequencyParam],
        ['model', modelParam],
        ['damping', dampingParam],
        ['structure', structureParam],
        ['brightness', brightnessParam],
        ['position', positionParam]
      ]),
      port: { postMessage: vi.fn() }
    }
  }
}

describe('usePhysicalVoice', () => {
  it('returns null when AudioWorklet is unavailable', async () => {
    const { createPhysicalVoiceNode } = usePhysicalVoice()
    const node = await createPhysicalVoiceNode({} as unknown as AudioContext)
    expect(node).toBeNull()
  })

  it('maps each resonator model to its worklet parameter index', () => {
    expect(RESONATOR_MODELS).toEqual(['string', 'sympathetic', 'modal'])
    expect(resonatorModelIndex('string')).toBe(0)
    expect(resonatorModelIndex('sympathetic')).toBe(1)
    expect(resonatorModelIndex('modal')).toBe(2)
  })

  it('schedules pitch, model, and tone controls and excites the string on pluck', () => {
    const { pluckVoice } = usePhysicalVoice()
    const mock = createMockVoiceNode()

    pluckVoice(
      mock.node as unknown as AudioWorkletNode,
      220,
      { resonatorModel: 'string', damping: 0.4, structure: 0.25, brightness: 0.8, position: 0.3 },
      1.5
    )

    expect(mock.frequencyParam.setValueAtTime).toHaveBeenCalledWith(220, 1.5)
    expect(mock.modelParam.setValueAtTime).toHaveBeenCalledWith(0, 1.5)
    expect(mock.dampingParam.setValueAtTime).toHaveBeenCalledWith(0.4, 1.5)
    expect(mock.structureParam.setValueAtTime).toHaveBeenCalledWith(0.25, 1.5)
    expect(mock.brightnessParam.setValueAtTime).toHaveBeenCalledWith(0.8, 1.5)
    expect(mock.positionParam.setValueAtTime).toHaveBeenCalledWith(0.3, 1.5)
    expect(mock.node.port.postMessage).toHaveBeenCalledWith('pluck')
  })

  it('passes the selected resonator model index on pluck', () => {
    const { pluckVoice } = usePhysicalVoice()

    const sympathetic = createMockVoiceNode()
    pluckVoice(
      sympathetic.node as unknown as AudioWorkletNode,
      220,
      { resonatorModel: 'sympathetic', damping: 0.5, structure: 0.5, brightness: 1, position: 0 },
      0
    )
    expect(sympathetic.modelParam.setValueAtTime).toHaveBeenCalledWith(1, 0)

    const modal = createMockVoiceNode()
    pluckVoice(
      modal.node as unknown as AudioWorkletNode,
      220,
      { resonatorModel: 'modal', damping: 0.5, structure: 0.5, brightness: 1, position: 0 },
      0
    )
    expect(modal.modelParam.setValueAtTime).toHaveBeenCalledWith(2, 0)
  })

  it('clamps every tone control into the 0..1 range', () => {
    const { pluckVoice } = usePhysicalVoice()
    const mock = createMockVoiceNode()

    pluckVoice(
      mock.node as unknown as AudioWorkletNode,
      220,
      { resonatorModel: 'string', damping: 4, structure: -1, brightness: 2, position: -0.5 },
      0
    )

    expect(mock.dampingParam.setValueAtTime).toHaveBeenCalledWith(1, 0)
    expect(mock.structureParam.setValueAtTime).toHaveBeenCalledWith(0, 0)
    expect(mock.brightnessParam.setValueAtTime).toHaveBeenCalledWith(1, 0)
    expect(mock.positionParam.setValueAtTime).toHaveBeenCalledWith(0, 0)
  })
})
