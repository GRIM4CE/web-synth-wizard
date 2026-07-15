import { describe, it, expect, vi } from 'vitest'
import { usePhysicalVoice } from '@/composables/usePhysicalVoice'

function createMockVoiceNode() {
  const frequencyParam = { setValueAtTime: vi.fn() }
  const dampingParam = { setValueAtTime: vi.fn() }
  return {
    frequencyParam,
    dampingParam,
    postMessage: vi.fn(),
    node: {
      parameters: new Map<string, unknown>([
        ['frequency', frequencyParam],
        ['damping', dampingParam]
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

  it('schedules pitch and damping and excites the string on pluck', () => {
    const { pluckVoice } = usePhysicalVoice()
    const mock = createMockVoiceNode()

    pluckVoice(mock.node as unknown as AudioWorkletNode, 220, 0.4, 1.5)

    expect(mock.frequencyParam.setValueAtTime).toHaveBeenCalledWith(220, 1.5)
    expect(mock.dampingParam.setValueAtTime).toHaveBeenCalledWith(0.4, 1.5)
    expect(mock.node.port.postMessage).toHaveBeenCalledWith('pluck')
  })

  it('clamps damping into the 0..1 range', () => {
    const { pluckVoice } = usePhysicalVoice()
    const mock = createMockVoiceNode()

    pluckVoice(mock.node as unknown as AudioWorkletNode, 220, 4, 0)

    expect(mock.dampingParam.setValueAtTime).toHaveBeenCalledWith(1, 0)
  })
})
