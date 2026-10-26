// WAV export: record what the synth is playing and download it as a .wav.
//
// The recorder is a pass-through AudioWorklet tapped off masterOutNode — the
// point every audible path (dry, delay wet, everything) funnels through — so
// the capture is exactly what the listener hears. The worklet copies each
// 128-sample render block to the main thread, where the chunks accumulate
// until the recording is stopped and encoded as a 16-bit PCM WAV file.
//
// Like the physical voice, the processor source is inlined and loaded through
// a Blob URL so no extra build configuration is needed.

import { ref, watch } from 'vue'
import { useAudioContextManager } from './useAudioContextManager'
import { encodeWav } from '@/utils/wavEncoder'

const PROCESSOR_NAME = 'recorder-tap'

// Memory guard: chunks accumulate on the main thread (~5MB per minute of
// mono float samples at 44.1kHz), so a forgotten recording is finalized
// rather than growing without bound.
export const MAX_RECORDING_SECONDS = 600

const processorSource = `
class RecorderTapProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.stopped = false
    this.port.onmessage = (event) => {
      if (event.data === 'stop') this.stopped = true
    }
  }

  process(inputs) {
    // Returning false after stop lets the browser garbage-collect the node.
    if (this.stopped) return false
    const input = inputs[0] && inputs[0][0]
    if (input && input.length) {
      // The render quantum's buffer is reused between blocks; transfer a copy.
      const chunk = new Float32Array(input.length)
      chunk.set(input)
      this.port.postMessage(chunk, [chunk.buffer])
    }
    // The output stays silent: this node only exists to observe its input,
    // but it must connect to the destination to keep being rendered.
    return true
  }
}

registerProcessor('` + PROCESSOR_NAME + `', RecorderTapProcessor)
`

const isRecording = ref(false)
// Elapsed recording time in whole seconds, for the UI. Updated only when the
// second ticks over so the chunk stream (hundreds per second) doesn't flood
// Vue's reactivity.
const recordingSeconds = ref(0)

let recorderNode: AudioWorkletNode | null = null
let recordedChunks: Float32Array[] = []
let recordedSampleCount = 0
let recordingSampleRate = 44100
// Each AudioContext needs the worklet module registered exactly once;
// registering the same processor name twice throws.
const registeredContexts = new WeakSet<AudioContext>()

const { audioContext, masterOutNode } = useAudioContextManager()

const mergeChunks = (): Float32Array => {
  const merged = new Float32Array(recordedSampleCount)
  let offset = 0
  for (const chunk of recordedChunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

const recordingFileName = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `web-synth-wizard-${date}-${time}.wav`
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  // Firefox only honours the click while the anchor is in the document.
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke after the download has had a moment to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const startRecording = async (): Promise<boolean> => {
  if (isRecording.value) return true
  const ctx = audioContext.value
  const source = masterOutNode.value
  if (!ctx || !source) return false
  if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') {
    console.error('WAV recording requires AudioWorklet support')
    return false
  }

  try {
    if (!registeredContexts.has(ctx)) {
      const blob = new Blob([processorSource], { type: 'application/javascript' })
      const moduleUrl = URL.createObjectURL(blob)
      try {
        await ctx.audioWorklet.addModule(moduleUrl)
      } finally {
        URL.revokeObjectURL(moduleUrl)
      }
      registeredContexts.add(ctx)
    }

    // The synth voice is mono end to end, so the tap downmixes to one
    // channel explicitly and the file is written mono.
    const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit'
    })

    recordedChunks = []
    recordedSampleCount = 0
    recordingSampleRate = ctx.sampleRate
    recordingSeconds.value = 0

    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!isRecording.value || recorderNode !== node) return
      recordedChunks.push(event.data)
      recordedSampleCount += event.data.length
      const seconds = Math.floor(recordedSampleCount / recordingSampleRate)
      if (seconds !== recordingSeconds.value) recordingSeconds.value = seconds
      if (recordedSampleCount >= recordingSampleRate * MAX_RECORDING_SECONDS) stopRecording()
    }

    source.connect(node)
    // The silent output must reach the destination or the graph never pulls
    // (renders) this node and no samples arrive.
    node.connect(ctx.destination)

    recorderNode = node
    isRecording.value = true
    return true
  } catch (error) {
    console.error('Failed to start WAV recording', error)
    return false
  }
}

// Stop capturing and, if anything was recorded, download it as a WAV file.
const stopRecording = () => {
  if (!isRecording.value || !recorderNode) return
  const node = recorderNode
  recorderNode = null
  isRecording.value = false

  // The context (or its nodes) may already be gone if the synth was
  // re-initialised; teardown is best-effort.
  try {
    node.port.postMessage('stop')
  } catch {
    // Ignore: the worklet is unreachable, so it is already not recording.
  }
  try {
    node.disconnect()
  } catch {
    // Ignore: the node was already disconnected with its context.
  }

  const samples = mergeChunks()
  recordedChunks = []
  recordedSampleCount = 0

  if (!samples.length) return
  const wavBuffer = encodeWav([samples], recordingSampleRate)
  downloadBlob(new Blob([wavBuffer], { type: 'audio/wav' }), recordingFileName())
}

// Re-activating the synth rebuilds the graph on a fresh AudioContext (possibly
// at a different sample rate); finalize the take rather than silently losing it.
watch(masterOutNode, () => {
  if (isRecording.value) stopRecording()
})

export const useRecorder = () => {
  return { isRecording, recordingSeconds, startRecording, stopRecording }
}
