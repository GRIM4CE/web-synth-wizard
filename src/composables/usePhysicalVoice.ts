// The VCO's "voice" engine: a physically modeled resonator running in an
// AudioWorklet, modeled after Mutable Instruments' Rings. A noise burst
// excites one of three resonator models (selectable, like Rings' resonator
// type switch):
//
//   string      — non-linear/inharmonic string: Karplus-Strong feedback loop
//                 (a fractional delay line tuned to the note's period with a
//                 lowpass in the loop) plus allpass dispersion for
//                 inharmonicity
//   sympathetic — a plucked string coupled to a set of undamped sympathetic
//                 strings that ring along, like a sitar or piano with the
//                 sustain pedal down
//   modal       — a bank of resonant two-pole filters, one per mode of a
//                 struck bar/plate; partial spacing stretches from harmonic
//                 to bell-like
//
// The macro-parameters keep Rings' meaning, re-interpreted per model:
//   structure  — string: allpass dispersion (0 = pure string, 1 = metallic)
//                sympathetic: which chord the sympathetic strings are tuned to
//                modal: stiffness (0 = harmonic partials, 1 = bell-like)
//   brightness — a lowpass over the excitation noise burst, from a dull
//                thump to raw white noise (1 = unfiltered, the classic pluck)
//   position   — where the resonator is excited: a feedforward comb notches
//                the harmonics a strike at that point cannot excite
//                (0 = at the bridge, all harmonics)
//   damping    — how fast the resonator's energy dies (0 = long bright ring)
//
// The processor source is inlined and loaded through a Blob URL so no extra
// build configuration is needed to serve a separate worklet file.

import type { ResonatorModel } from '@/types'

const PROCESSOR_NAME = 'karplus-strong-voice'

// Resonator models in worklet-parameter order: the k-rate 'model' AudioParam
// carries the index into this list.
export const RESONATOR_MODELS: ResonatorModel[] = ['string', 'sympathetic', 'modal']

export const resonatorModelIndex = (model: ResonatorModel): number => {
  const index = RESONATOR_MODELS.indexOf(model)
  return index >= 0 ? index : 0
}

const processorSource = `
// Sympathetic-string tunings, one chord per structure zone (semitones
// relative to the played note). Low structure = plain octaves, sweeping
// through minor and major voicings to wide open fifths.
const SYMPATHETIC_CHORDS = [
  [-12, -0.05, 0.05, 12],
  [-12, 0.05, 7, 12],
  [-12, 3, 7, 12],
  [-12, 3, 10, 14],
  [-12, 4, 7, 12],
  [-12, 4, 11, 14],
  [-12, 7, 16, 19]
]
const NUM_SYMPATHETIC = 4
const NUM_MODES = 12

class KarplusStrongVoiceProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 20, maxValue: 8000, automationRate: 'a-rate' },
      // Cents, mirroring OscillatorNode.detune so pitch LFOs work unchanged.
      { name: 'detune', defaultValue: 0, minValue: -4800, maxValue: 4800, automationRate: 'a-rate' },
      // Resonator model: 0 = string, 1 = sympathetic strings, 2 = modal.
      { name: 'model', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
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
    // One delay loop per sympathetic string, sharing the main write index.
    this.sympatheticBuffers = []
    for (let s = 0; s < NUM_SYMPATHETIC; s++) {
      this.sympatheticBuffers.push(new Float32Array(this.buffer.length))
    }
    this.sympatheticLastDelayed = new Float32Array(NUM_SYMPATHETIC)
    this.sympatheticDelays = new Float32Array(NUM_SYMPATHETIC)
    // Modal filter bank: two states per resonator plus per-block coefficients.
    this.modalY1 = new Float32Array(NUM_MODES)
    this.modalY2 = new Float32Array(NUM_MODES)
    this.modalA1 = new Float32Array(NUM_MODES)
    this.modalA2 = new Float32Array(NUM_MODES)
    this.modalGain = new Float32Array(NUM_MODES)
    this.writeIndex = 0
    this.exciteRemaining = 0
    this.pluckPending = false
    this.lastDelayed = 0
    this.lastModel = 0
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

  // Silence every resonator. Called when the model switches so the previous
  // model's ringing state doesn't come back from the dead on a later switch.
  resetResonators() {
    this.buffer.fill(0)
    this.excitationBuffer.fill(0)
    for (let s = 0; s < NUM_SYMPATHETIC; s++) this.sympatheticBuffers[s].fill(0)
    this.sympatheticLastDelayed.fill(0)
    this.modalY1.fill(0)
    this.modalY2.fill(0)
    this.lastDelayed = 0
    this.excitationFiltered = 0
    this.ap1In = 0
    this.ap1Out = 0
    this.ap2In = 0
    this.ap2Out = 0
  }

  process(inputs, outputs, parameters) {
    const channel = outputs[0] && outputs[0][0]
    if (!channel) return true

    const frequency = parameters.frequency
    const detune = parameters.detune
    const model = Math.min(Math.max(Math.round(parameters.model[0]), 0), 2)
    const damping = parameters.damping[0]
    const structure = parameters.structure[0]
    const brightness = parameters.brightness[0]
    const position = parameters.position[0]

    if (model !== this.lastModel) {
      this.resetResonators()
      this.lastModel = model
    }

    // Loop gain sets how long the fundamental rings; the one-zero lowpass
    // blend sets how fast the upper harmonics die. Both follow damping:
    // 0 = bright and long ring, 1 = dark and fast decay.
    const loopGain = 0.999 - 0.019 * damping
    const filterBlend = 0.15 + 0.55 * damping
    // Structure maps onto the shared allpass coefficient — string model only;
    // the other models spend structure elsewhere. At 0 each allpass
    // degenerates to a plain one-sample delay (no dispersion). A negative
    // coefficient delays low frequencies more than high ones (group delay
    // (1-a)/(1+a) samples at DC, falling with frequency), so upper partials
    // travel the loop faster and stretch progressively sharp — the stiff
    // string / bell-like inharmonicity Rings' structure knob is known for.
    const allpassCoefficient = model === 0 ? -0.6 * structure : 0
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

    // Per-block tuning shared by the sympathetic and modal models (pitch
    // LFOs update every 128-sample block instead of every sample — ~3ms, far
    // below anything audible as stepping).
    const blockPitch = frequency[0] * Math.pow(2, detune[0] / 1200)
    const blockPeriod = sampleRate / blockPitch

    // Sympathetic model: structure picks the chord; each string is a plain
    // Karplus-Strong loop with a longer ring than the main string, fed a
    // bleed of the main string's output so it resonates sympathetically.
    const sympatheticLoopGain = 0.9996 - 0.006 * damping
    const sympatheticBlend = 0.1 + 0.4 * damping
    const sympatheticCoupling = 0.12
    if (model === 1) {
      const chordIndex = Math.min(Math.floor(structure * SYMPATHETIC_CHORDS.length), SYMPATHETIC_CHORDS.length - 1)
      const chord = SYMPATHETIC_CHORDS[chordIndex]
      for (let s = 0; s < NUM_SYMPATHETIC; s++) {
        const ratio = Math.pow(2, chord[s] / 12)
        this.sympatheticDelays[s] = Math.min(Math.max(blockPeriod / ratio, 2), this.buffer.length - 2)
      }
    }

    // Modal model: recompute the filter bank coefficients once per block.
    // Mode frequencies follow the stiff-string formula f_n = f0*n*sqrt(1+B*n^2)
    // with the inharmonicity B driven by structure; damping sets the base
    // decay time, and higher modes decay faster (as they do physically).
    if (model === 2) {
      const inharmonicity = 0.25 * structure * structure
      const baseDecay = 0.04 + 4 * (1 - damping) * (1 - damping) * (1 - damping)
      for (let m = 0; m < NUM_MODES; m++) {
        const order = m + 1
        const ratio = order * Math.sqrt(1 + inharmonicity * order * order)
        const modeFrequency = blockPitch * ratio
        if (modeFrequency > sampleRate * 0.45) {
          this.modalA1[m] = 0
          this.modalA2[m] = 0
          this.modalGain[m] = 0
          continue
        }
        const theta = 2 * Math.PI * modeFrequency / sampleRate
        const decay = baseDecay / Math.sqrt(ratio)
        const radius = Math.exp(-1 / (decay * sampleRate))
        this.modalA1[m] = 2 * radius * Math.cos(theta)
        this.modalA2[m] = -radius * radius
        // sin(theta) normalizes the resonator's impulse response to ~unit
        // amplitude; the 1/(1+0.7m) tilt gives lower modes more weight.
        this.modalGain[m] = Math.sin(theta) / (1 + 0.7 * m)
      }
    }

    for (let i = 0; i < channel.length; i++) {
      const baseFrequency = frequency.length > 1 ? frequency[i] : frequency[0]
      const cents = detune.length > 1 ? detune[i] : detune[0]
      const pitch = baseFrequency * Math.pow(2, cents / 1200)
      const period = sampleRate / pitch
      const delaySamples = Math.min(Math.max(period - allpassDelay, 2), this.buffer.length - 2)

      if (this.pluckPending) {
        // Excite the resonator with one period of noise.
        this.exciteRemaining = Math.floor(period)
        this.excitationFiltered = 0
        this.pluckPending = false
      }

      // Excitation: brightness-filtered noise, comb-filtered by strike
      // position. Shared by all three resonator models.
      let excitation = 0
      if (this.exciteRemaining > 0) {
        const noise = Math.random() * 2 - 1
        this.excitationFiltered += (noise - this.excitationFiltered) * excitationCoefficient
        excitation = this.excitationFiltered * excitationGain
        this.exciteRemaining--
      }
      // Exciting a string at fraction p of its length cannot excite the
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

      let outputSample

      if (model === 2) {
        // Modal: drive every resonator in the bank with the excitation and
        // sum. y[n] = a1*y[n-1] + a2*y[n-2] + g*x[n], a resonant two-pole.
        let modalSum = 0
        for (let m = 0; m < NUM_MODES; m++) {
          const y = this.modalA1[m] * this.modalY1[m] + this.modalA2[m] * this.modalY2[m] + this.modalGain[m] * combed
          this.modalY2[m] = this.modalY1[m]
          this.modalY1[m] = y
          modalSum += y
        }
        // The bank's modes sum coherently on the attack; scale the sum down
        // so modal plucks land at the same level as the string models.
        outputSample = modalSum * 0.045
      } else {
        // Karplus-Strong main string, shared by the string and sympathetic
        // models. Fractional-delay read (linear interpolation) so tuning
        // isn't snapped to whole samples.
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
        // With a = 0 (sympathetic model) each is a plain one-sample delay.
        const ap1 = allpassCoefficient * (sample - this.ap1Out) + this.ap1In
        this.ap1In = sample
        this.ap1Out = ap1
        const ap2 = allpassCoefficient * (ap1 - this.ap2Out) + this.ap2In
        this.ap2In = ap1
        this.ap2Out = ap2
        sample = ap2

        sample += combed
        this.buffer[this.writeIndex] = sample
        outputSample = sample

        if (model === 1) {
          // Sympathetic strings: each loop is driven only feedforward by the
          // main string (no path back), so the coupled system stays stable.
          // Strings sharing partials with the played note build up energy
          // resonantly and keep shimmering after the main string decays.
          let sympatheticSum = 0
          for (let s = 0; s < NUM_SYMPATHETIC; s++) {
            const stringBuffer = this.sympatheticBuffers[s]
            let sympatheticRead = this.writeIndex - this.sympatheticDelays[s]
            if (sympatheticRead < 0) sympatheticRead += stringBuffer.length
            const sympatheticIndex0 = Math.floor(sympatheticRead) % stringBuffer.length
            const sympatheticIndex1 = (sympatheticIndex0 + 1) % stringBuffer.length
            const sympatheticFraction = sympatheticRead - Math.floor(sympatheticRead)
            const sympatheticDelayed = stringBuffer[sympatheticIndex0] * (1 - sympatheticFraction) + stringBuffer[sympatheticIndex1] * sympatheticFraction
            const sympatheticAveraged = 0.5 * (sympatheticDelayed + this.sympatheticLastDelayed[s])
            this.sympatheticLastDelayed[s] = sympatheticDelayed
            const filtered = sympatheticDelayed + sympatheticBlend * (sympatheticAveraged - sympatheticDelayed)
            const sympatheticSample = filtered * sympatheticLoopGain + sympatheticCoupling * sample
            stringBuffer[this.writeIndex] = sympatheticSample
            sympatheticSum += sympatheticSample
          }
          outputSample = sample * 0.7 + sympatheticSum * 0.15
        }
      }

      this.writeIndex = (this.writeIndex + 1) % this.buffer.length
      channel[i] = outputSample
    }

    // Mirror the mono voice onto any additional output channels.
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(channel)
    return true
  }
}

registerProcessor('` + PROCESSOR_NAME + `', KarplusStrongVoiceProcessor)
`

// The tone-shaping controls a pluck carries; a subset of OscillatorSettings so
// the stored settings object can be passed straight through.
export type VoicePluckSettings = {
  resonatorModel: ResonatorModel
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

  // A pluck is a note-on: set the resonator's pitch, model, and tone
  // controls, then excite it.
  const pluckVoice = (node: AudioWorkletNode, frequency: number, settings: VoicePluckSettings, time: number) => {
    node.parameters.get('frequency')?.setValueAtTime(frequency, time)
    node.parameters.get('model')?.setValueAtTime(resonatorModelIndex(settings.resonatorModel), time)
    node.parameters.get('damping')?.setValueAtTime(clamp01(settings.damping), time)
    node.parameters.get('structure')?.setValueAtTime(clamp01(settings.structure), time)
    node.parameters.get('brightness')?.setValueAtTime(clamp01(settings.brightness), time)
    node.parameters.get('position')?.setValueAtTime(clamp01(settings.position), time)
    node.port.postMessage('pluck')
  }

  return { createPhysicalVoiceNode, pluckVoice }
}
