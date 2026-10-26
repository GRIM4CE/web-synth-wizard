import { describe, it, expect } from 'vitest'
import { encodeWav } from '@/utils/wavEncoder'

const ascii = (view: DataView, offset: number, length: number) => {
  let text = ''
  for (let i = 0; i < length; i++) {
    text += String.fromCharCode(view.getUint8(offset + i))
  }
  return text
}

describe('encodeWav', () => {
  it('writes a valid RIFF/WAVE header for mono 16-bit PCM', () => {
    const samples = new Float32Array(100)
    const view = new DataView(encodeWav([samples], 44100))

    expect(ascii(view, 0, 4)).toBe('RIFF')
    expect(ascii(view, 8, 4)).toBe('WAVE')
    expect(ascii(view, 12, 4)).toBe('fmt ')
    expect(ascii(view, 36, 4)).toBe('data')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // Mono
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint32(28, true)).toBe(44100 * 2) // Byte rate
    expect(view.getUint16(32, true)).toBe(2) // Block align
    expect(view.getUint16(34, true)).toBe(16) // Bits per sample
  })

  it('sizes the file and data chunk from the sample count', () => {
    const samples = new Float32Array(1000)
    const buffer = encodeWav([samples], 48000)
    const view = new DataView(buffer)

    expect(buffer.byteLength).toBe(44 + 1000 * 2)
    expect(view.getUint32(40, true)).toBe(1000 * 2) // data chunk size
    expect(view.getUint32(4, true)).toBe(36 + 1000 * 2) // RIFF chunk size
  })

  it('scales float samples to 16-bit integers', () => {
    const view = new DataView(encodeWav([new Float32Array([0, 1, -1, 0.5])], 44100))

    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(0x7fff) // +1 hits positive full scale
    expect(view.getInt16(48, true)).toBe(-0x8000) // -1 hits negative full scale
    expect(view.getInt16(50, true)).toBe(Math.floor(0.5 * 0x7fff)) // 0.5 * 32767, truncated by setInt16
  })

  it('hard-clips samples outside -1..1', () => {
    const view = new DataView(encodeWav([new Float32Array([2.5, -3])], 44100))

    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
  })

  it('interleaves multi-channel input', () => {
    const left = new Float32Array([1, -1])
    const right = new Float32Array([-1, 1])
    const view = new DataView(encodeWav([left, right], 44100))

    expect(view.getUint16(22, true)).toBe(2) // Stereo
    expect(view.getUint16(32, true)).toBe(4) // Block align: 2 channels * 2 bytes
    expect(view.getInt16(44, true)).toBe(0x7fff) // Frame 0 left
    expect(view.getInt16(46, true)).toBe(-0x8000) // Frame 0 right
    expect(view.getInt16(48, true)).toBe(-0x8000) // Frame 1 left
    expect(view.getInt16(50, true)).toBe(0x7fff) // Frame 1 right
  })

  it('produces a header-only file for empty input', () => {
    const buffer = encodeWav([new Float32Array(0)], 44100)
    expect(buffer.byteLength).toBe(44)
    expect(new DataView(buffer).getUint32(40, true)).toBe(0)
  })
})
