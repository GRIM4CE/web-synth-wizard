// Minimal WAV (RIFF) encoder: raw Float32 sample buffers in, a complete
// 16-bit PCM file out. No compression — WAV is just a 44-byte header followed
// by interleaved little-endian samples, so building it by hand beats pulling
// in a dependency.

const HEADER_SIZE = 44
const BYTES_PER_SAMPLE = 2 // 16-bit PCM

const writeAscii = (view: DataView, offset: number, text: string) => {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

// Encode one Float32Array per channel (all the same length, values nominally
// -1..1) into a WAV file buffer. Samples outside -1..1 are hard-clipped, the
// same way the DAC would clip them on playback.
export const encodeWav = (channels: Float32Array[], sampleRate: number): ArrayBuffer => {
  const channelCount = Math.max(channels.length, 1)
  const frameCount = channels[0]?.length ?? 0
  const blockAlign = channelCount * BYTES_PER_SAMPLE
  const dataSize = frameCount * blockAlign

  const buffer = new ArrayBuffer(HEADER_SIZE + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, HEADER_SIZE - 8 + dataSize, true) // File size minus the RIFF chunk id + size fields
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // Format 1 = uncompressed PCM
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // Byte rate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true) // Bits per sample
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = HEADER_SIZE
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = Math.min(Math.max(channels[channel]?.[frame] ?? 0, -1), 1)
      // Negative full scale is -32768 but positive is +32767; scale each side
      // to its own bound so -1 and 1 both land exactly on the rails.
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += BYTES_PER_SAMPLE
    }
  }

  return buffer
}
