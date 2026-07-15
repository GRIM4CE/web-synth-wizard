// The VCO's "voice" engine: a physically modeled plucked string (Karplus-Strong)
// running in an AudioWorklet. A noise burst is fed into a fractional delay line
// whose length matches the note's period; a lowpass filter inside the feedback
// loop makes the harmonics decay faster than the fundamental, which is what
// turns the burst into a string-like pluck.
//
// The processor source is inlined and loaded through a Blob URL so no extra
// build configuration is needed to serve a separate worklet file.

const PROCESSOR_NAME = 'karplus-strong-voice'

const processorSource = `
class KarplusStrongVoiceProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 20, maxValue: 8000, automationRate: 'a-rate' },
      // Cents, mirroring OscillatorNode.detune so pitch LFOs work unchanged.
      { name: 'detune', defaultValue: 0, minValue: -4800, maxValue: 4800, automationRate: 'a-rate' },
      { name: 'damping', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ]
  }

  constructor() {
    super()
    // Ring buffer sized for the lowest supported pitch (20 Hz).
    this.buffer = new Float32Array(Math.ceil(sampleRate / 20) + 2)
    this.writeIndex = 0
    this.exciteRemaining = 0
    this.pluckPending = false
    this.lastDelayed = 0
    this.port.onmessage = (event) => {
      if (event.data === 'pluck') this.pluckPending = true
    }
  }

  process(inputs, outputs, parameters) {
    const channel = outputs[0] && outputs[0][0]
    if (!channel) return true

    const frequency = parameters.frequency
    const detune = parameters.detune
    const damping = parameters.damping[0]
    // Loop gain sets how long the fundamental rings; the one-zero lowpass
    // blend sets how fast the upper harmonics die. Both follow damping:
    // 0 = bright and long ring, 1 = dark and fast decay.
    const loopGain = 0.999 - 0.019 * damping
    const filterBlend = 0.15 + 0.55 * damping

    for (let i = 0; i < channel.length; i++) {
      const baseFrequency = frequency.length > 1 ? frequency[i] : frequency[0]
      const cents = detune.length > 1 ? detune[i] : detune[0]
      const pitch = baseFrequency * Math.pow(2, cents / 1200)
      const delaySamples = Math.min(Math.max(sampleRate / pitch, 2), this.buffer.length - 2)

      if (this.pluckPending) {
        // Excite the string with one period of noise.
        this.exciteRemaining = Math.floor(delaySamples)
        this.pluckPending = false
      }

      // Fractional-delay read (linear interpolation) so tuning isn't snapped
      // to whole samples.
      let readPos = this.writeIndex - delaySamples
      if (readPos < 0) readPos += this.buffer.length
      const index0 = Math.floor(readPos) % this.buffer.length
      const index1 = (index0 + 1) % this.buffer.length
      const fraction = readPos - Math.floor(readPos)
      const delayed = this.buffer[index0] * (1 - fraction) + this.buffer[index1] * fraction

      const averaged = 0.5 * (delayed + this.lastDelayed)
      this.lastDelayed = delayed
      let sample = (delayed + filterBlend * (averaged - delayed)) * loopGain

      if (this.exciteRemaining > 0) {
        sample += Math.random() * 2 - 1
        this.exciteRemaining--
      }

      this.buffer[this.writeIndex] = sample
      this.writeIndex = (this.writeIndex + 1) % this.buffer.length
      channel[i] = sample
    }

    // Mirror the mono string onto any additional output channels.
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(channel)
    return true
  }
}

registerProcessor('` + PROCESSOR_NAME + `', KarplusStrongVoiceProcessor)
`

export const usePhysicalVoice = () => {
  // Build the voice node for a (fresh) AudioContext. Returns null when
  // AudioWorklet is unavailable, in which case the VCO simply stays on the
  // oscillator engine.
  const createPhysicalVoiceNode = async (audioContext: AudioContext): Promise<AudioWorkletNode | null> => {
    if (!audioContext.audioWorklet || typeof AudioWorkletNode === 'undefined') return null
    try {
      const blob = new Blob([processorSource], { type: 'application/javascript' })
      const moduleUrl = URL.createObjectURL(blob)
      try {
        await audioContext.audioWorklet.addModule(moduleUrl)
      } finally {
        URL.revokeObjectURL(moduleUrl)
      }
      return new AudioWorkletNode(audioContext, PROCESSOR_NAME, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1]
      })
    } catch (error) {
      console.error('Failed to create the physical modeling voice', error)
      return null
    }
  }

  // A pluck is a note-on: set the string's pitch and damping, then excite it.
  const pluckVoice = (node: AudioWorkletNode, frequency: number, damping: number, time: number) => {
    node.parameters.get('frequency')?.setValueAtTime(frequency, time)
    node.parameters.get('damping')?.setValueAtTime(Math.min(Math.max(damping, 0), 1), time)
    node.port.postMessage('pluck')
  }

  return { createPhysicalVoiceNode, pluckVoice }
}
