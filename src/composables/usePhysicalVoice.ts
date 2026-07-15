// The VCO's "voice" engine: a physically modeled plucked string (Karplus-Strong)
// running in an AudioWorklet. A noise burst is fed into a fractional delay line
// whose length matches the note's period; a lowpass filter inside the feedback
// loop makes the harmonics decay faster than the fundamental, which is what
// turns the burst into a string-like pluck.
//
// Beyond damping, the voice exposes three controls modeled after Mutable
// Instruments' Rings resonator macro-parameters:
//   structure  — inharmonicity: allpass dispersion inside the feedback loop
//                stretches the upper partials away from pure harmonics
//                (0 = pure string, 1 = metallic/bell-like)
//   brightness — a lowpass over the excitation noise burst, from a dull
//                thump to raw white noise (1 = unfiltered, the classic pluck)
//   position   — where along the string it is plucked: a feedforward comb on
//                the excitation notches the harmonics a real pluck at that
//                point cannot excite (0 = at the bridge, all harmonics)
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
      { name: 'damping', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'structure', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'brightness', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'position', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ]
  }

  constructor() {
    super()
    // Ring buffer sized for the lowest supported pitch (20 Hz).
    this.buffer = new Float32Array(Math.ceil(sampleRate / 20) + 2)
    // Excitation history for the pluck-position comb, aligned with buffer writes.
    this.excitationBuffer = new Float32Array(this.buffer.length)
    this.writeIndex = 0
    this.exciteRemaining = 0
    this.pluckPending = false
    this.lastDelayed = 0
    // One-pole lowpass state for the excitation brightness filter.
    this.excitationFiltered = 0
    // States for the two cascaded dispersion allpasses (structure).
    this.ap1In = 0
    this.ap1Out = 0
    this.ap2In = 0
    this.ap2Out = 0
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
    const structure = parameters.structure[0]
    const brightness = parameters.brightness[0]
    const position = parameters.position[0]
    // Loop gain sets how long the fundamental rings; the one-zero lowpass
    // blend sets how fast the upper harmonics die. Both follow damping:
    // 0 = bright and long ring, 1 = dark and fast decay.
    const loopGain = 0.999 - 0.019 * damping
    const filterBlend = 0.15 + 0.55 * damping
    // Structure maps onto the shared allpass coefficient. At 0 each allpass
    // degenerates to a plain one-sample delay (no dispersion). A negative
    // coefficient delays low frequencies more than high ones (group delay
    // (1-a)/(1+a) samples at DC, falling with frequency), so upper partials
    // travel the loop faster and stretch progressively sharp — the stiff
    // string / bell-like inharmonicity Rings' structure knob is known for.
    const allpassCoefficient = -0.6 * structure
    // The allpasses sit inside the feedback loop, so their low-frequency
    // phase delay lengthens the loop; shorten the delay line to match so the
    // fundamental stays in tune.
    const allpassDelay = 2 * (1 - allpassCoefficient) / (1 + allpassCoefficient)
    // Brightness is the excitation lowpass coefficient; squared so the useful
    // dull-to-bright range spreads across the slider. 1 = raw white noise.
    const excitationCoefficient = 0.02 + 0.98 * brightness * brightness
    // Lowpassing white noise removes energy (variance factor c/(2-c)); make it
    // up so turning brightness down dulls the pluck without silencing it.
    const excitationGain = Math.sqrt((2 - excitationCoefficient) / excitationCoefficient)

    for (let i = 0; i < channel.length; i++) {
      const baseFrequency = frequency.length > 1 ? frequency[i] : frequency[0]
      const cents = detune.length > 1 ? detune[i] : detune[0]
      const pitch = baseFrequency * Math.pow(2, cents / 1200)
      const period = sampleRate / pitch
      const delaySamples = Math.min(Math.max(period - allpassDelay, 2), this.buffer.length - 2)

      if (this.pluckPending) {
        // Excite the string with one period of noise.
        this.exciteRemaining = Math.floor(period)
        this.excitationFiltered = 0
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

      // Dispersion: two cascaded first-order allpasses
      // (y[n] = a*x[n] + x[n-1] - a*y[n-1], unity gain, stable for |a| < 1).
      const ap1 = allpassCoefficient * (sample - this.ap1Out) + this.ap1In
      this.ap1In = sample
      this.ap1Out = ap1
      const ap2 = allpassCoefficient * (ap1 - this.ap2Out) + this.ap2In
      this.ap2In = ap1
      this.ap2Out = ap2
      sample = ap2

      // Excitation: brightness-filtered noise, comb-filtered by pluck position.
      let excitation = 0
      if (this.exciteRemaining > 0) {
        const noise = Math.random() * 2 - 1
        this.excitationFiltered += (noise - this.excitationFiltered) * excitationCoefficient
        excitation = this.excitationFiltered * excitationGain
        this.exciteRemaining--
      }
      // Plucking a string at fraction p of its length cannot excite the
      // harmonics with a node there; subtracting the excitation delayed by
      // p * period notches exactly those. 0 = at the bridge (no comb),
      // 1 = mid-string (odd harmonics only).
      const combDelay = Math.min(Math.floor(position * 0.5 * period), this.excitationBuffer.length - 1)
      let combed = excitation
      if (combDelay > 0) {
        let combIndex = this.writeIndex - combDelay
        if (combIndex < 0) combIndex += this.excitationBuffer.length
        combed = excitation - this.excitationBuffer[combIndex]
      }
      this.excitationBuffer[this.writeIndex] = excitation
      sample += combed

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

// The tone-shaping controls a pluck carries; a subset of OscillatorSettings so
// the stored settings object can be passed straight through.
export type VoicePluckSettings = {
  damping: number
  structure: number
  brightness: number
  position: number
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

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

  // A pluck is a note-on: set the string's pitch and tone controls, then
  // excite it.
  const pluckVoice = (node: AudioWorkletNode, frequency: number, settings: VoicePluckSettings, time: number) => {
    node.parameters.get('frequency')?.setValueAtTime(frequency, time)
    node.parameters.get('damping')?.setValueAtTime(clamp01(settings.damping), time)
    node.parameters.get('structure')?.setValueAtTime(clamp01(settings.structure), time)
    node.parameters.get('brightness')?.setValueAtTime(clamp01(settings.brightness), time)
    node.parameters.get('position')?.setValueAtTime(clamp01(settings.position), time)
    node.port.postMessage('pluck')
  }

  return { createPhysicalVoiceNode, pluckVoice }
}
