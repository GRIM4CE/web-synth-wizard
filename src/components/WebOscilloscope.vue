<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'
import DSlider from './DSlider.vue'

// The analyser is created lazily when the synth is activated, so it may be null on first render.
const {
  analyserNode,
  audioContext,
  scopeSource,
  oscillatorSettings,
  filterEnabled,
  filterEnvelopeEnabled,
  filterSettings,
  filterEnvelope,
  vcaEnvelope,
  delayEnabled,
  delaySettings,
  lfoSettings,
  steps,
  clock,
  timeDivision,
  selectedMusicalKey,
  selectedOctave,
  quantize
} = useAudioContext()

// Signal-chain tap points the scope can display.
const scopeSources = [
  { value: 'vco', label: 'VCO' },
  { value: 'filter', label: 'VCO+VCF' },
  { value: 'output', label: 'Out' }
] as const

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId: number | undefined
let resizeObserver: ResizeObserver | undefined

// Timing (time base): the fraction of the analyser buffer drawn across the full
// canvas width. Smaller values zoom in horizontally (fewer samples, more detail).
const minTimeScale = 0.05
const maxTimeScale = 1
const timeScale = ref(1)

// Voltage (vertical scale): multiplies the waveform's deviation from the centre
// line. The slider position maps exponentially onto the scale so the low end
// (fine zoom) and the high end (needed for quiet signals) are equally usable.
const minVoltageScale = 0.5
const maxVoltageScale = 40
const voltagePosition = ref(0) // 0..1 slider position
const voltageScale = computed(
  () => minVoltageScale * Math.pow(maxVoltageScale / minVoltageScale, voltagePosition.value)
)

// Freeze (hold): when frozen the scope displays the "best" recently seen frame —
// the one with the largest peak-to-peak swing — rather than whatever happened to
// be in the buffer at the moment of the click, and the voltage scale is fitted
// to that frame so the full wave is visible. Timing/voltage stay adjustable.
const frozen = ref(false)
let lastFrame: Float32Array | null = null
let frozenFrame: Float32Array | null = null
// Rolling "best frame" tracker. The best peak decays a little every frame so a
// loud transient from long ago eventually gives way to the current signal.
let bestFrame: Float32Array | null = null
let bestPeak = 0
const BEST_PEAK_DECAY = 0.985

function fitVoltageToFrame(frame: Float32Array) {
  let maxDeviation = 0
  for (let i = 0; i < frame.length; i++) {
    const deviation = Math.abs(frame[i])
    if (deviation > maxDeviation) maxDeviation = deviation
  }
  if (maxDeviation < 0.0001) return
  // Scale so the wave's peaks reach ~90% of the half-height of the screen.
  const targetScale = Math.min(Math.max(0.9 / maxDeviation, minVoltageScale), maxVoltageScale)
  voltagePosition.value =
    Math.log(targetScale / minVoltageScale) / Math.log(maxVoltageScale / minVoltageScale)
}

function toggleFreeze() {
  if (!frozen.value) {
    frozenFrame = bestFrame ?? lastFrame
    if (frozenFrame) fitVoltageToFrame(frozenFrame)
  } else {
    frozenFrame = null
  }
  frozen.value = !frozen.value
}

// While frozen the scope keeps sampling in the background. When any
// sound-shaping parameter changes, the held view refreshes: the best-frame
// tracker is reset so only post-change audio competes, and after the sound has
// settled the strongest new frame replaces the frozen one (still frozen, just
// showing the new state of the signal).
let recaptureTimer: ReturnType<typeof setTimeout> | undefined

function scheduleFrozenRecapture() {
  if (!frozen.value) return
  bestFrame = null
  bestPeak = 0
  clearTimeout(recaptureTimer)
  recaptureTimer = setTimeout(() => {
    if (!frozen.value) return
    frozenFrame = bestFrame ?? lastFrame
    if (frozenFrame) fitVoltageToFrame(frozenFrame)
  }, 500)
}

watch(
  [
    scopeSource,
    oscillatorSettings,
    filterEnabled,
    filterEnvelopeEnabled,
    filterSettings,
    filterEnvelope.envelope,
    vcaEnvelope.envelope,
    delayEnabled,
    delaySettings,
    lfoSettings,
    steps,
    clock,
    timeDivision,
    selectedMusicalKey,
    selectedOctave,
    quantize
  ],
  scheduleFrozenRecapture,
  { deep: true }
)

// Readout for the timing control: how many milliseconds of signal span the screen.
const timingReadout = computed(() => {
  const sampleRate = audioContext.value?.sampleRate
  const fftSize = analyserNode.value?.fftSize
  if (!sampleRate || !fftSize) return `${Math.round(timeScale.value * 100)}%`
  const ms = (Math.floor(fftSize * timeScale.value) / sampleRate) * 1000
  return `${ms < 10 ? ms.toFixed(1) : Math.round(ms)}ms`
})

const voltageReadout = computed(() => `×${voltageScale.value < 10 ? voltageScale.value.toFixed(1) : Math.round(voltageScale.value)}`)

function stopDrawing() {
  if (animationId !== undefined) {
    cancelAnimationFrame(animationId)
    animationId = undefined
  }
}

// Keep the canvas backing store matched to its CSS size and the device pixel
// ratio, so the trace stays crisp instead of being a scaled-up 280px bitmap.
function resizeCanvas() {
  const canvasEl = canvas.value
  if (!canvasEl) return
  const dpr = window.devicePixelRatio || 1
  const rect = canvasEl.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width * dpr))
  const height = Math.max(1, Math.round(rect.height * dpr))
  if (canvasEl.width !== width || canvasEl.height !== height) {
    canvasEl.width = width
    canvasEl.height = height
  }
  // When the scope isn't animating (synth not activated yet), repaint once so
  // the grid and flat trace fill the resized canvas.
  if (animationId === undefined) render(lastFrame)
}

// Faint graticule like a hardware scope: 10 horizontal and 8 vertical divisions,
// with the centre lines slightly brighter.
function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) {
  const columns = 10
  const rows = 8
  ctx.lineWidth = dpr
  for (let i = 1; i < columns; i++) {
    const x = (width / columns) * i
    ctx.strokeStyle = i === columns / 2 ? 'rgba(169, 246, 219, 0.28)' : 'rgba(169, 246, 219, 0.1)'
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let i = 1; i < rows; i++) {
    const y = (height / rows) * i
    ctx.strokeStyle = i === rows / 2 ? 'rgba(169, 246, 219, 0.28)' : 'rgba(169, 246, 219, 0.1)'
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

// Paint one frame (or a flat centre line when no signal has been seen yet).
function render(dataArray: Float32Array | null) {
  const canvasEl = canvas.value
  const ctx = canvasEl?.getContext('2d')
  if (!canvasEl || !ctx) return

  const { width, height } = canvasEl
  const dpr = window.devicePixelRatio || 1

  ctx.clearRect(0, 0, width, height)
  drawGrid(ctx, width, height, dpr)

  ctx.lineWidth = 2 * dpr
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#a9f6db'
  ctx.beginPath()

  if (!dataArray) {
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
    return
  }

  // Only draw a slice of the buffer, stretched to fill the width. This is the
  // horizontal "time base": fewer samples across the same width means a more
  // zoomed-in view of the waveform.
  const bufferLength = dataArray.length
  const visibleSamples = Math.max(2, Math.floor(bufferLength * timeScale.value))
  const sliceWidth = width / visibleSamples

  // Trigger: start the sweep at the first rising crossing of the centre line.
  // Without this the drawn window starts at a random phase every frame, so the
  // wave slides around and reads as noise; anchoring to a rising edge holds a
  // periodic wave (like a square) steady on screen.
  const triggerLimit = bufferLength - visibleSamples
  let triggerOffset = 0
  for (let i = 1; i < triggerLimit; i++) {
    if (dataArray[i - 1] < 0 && dataArray[i] >= 0) {
      triggerOffset = i
      break
    }
  }

  let x = 0
  for (let i = 0; i < visibleSamples; i++) {
    // Float data is a -1..1 deviation from silence; apply the voltage scale and
    // map around the vertical middle of the canvas.
    const y = height / 2 - dataArray[triggerOffset + i] * voltageScale.value * (height / 2)
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    x += sliceWidth
  }

  ctx.stroke()
}

function draw() {
  const analyser = analyserNode.value
  if (!analyser || !canvas.value) {
    stopDrawing()
    return
  }

  // Always sample fresh audio, even while frozen, so a parameter change can
  // refresh the held view with the new signal. Float data keeps full
  // resolution — byte-based sampling quantised quiet signals to a handful of
  // levels, which made clean waves look noisy and stepped.
  const live = new Float32Array(analyser.fftSize)
  analyser.getFloatTimeDomainData(live)
  lastFrame = live

  // Track the strongest recent frame so Freeze shows the wave at its fullest
  // swing rather than whatever was on screen at click time.
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < live.length; i++) {
    const sample = live[i]
    if (sample < min) min = sample
    if (sample > max) max = sample
  }
  const peak = max - min
  bestPeak *= BEST_PEAK_DECAY
  if (peak >= bestPeak) {
    bestPeak = peak
    bestFrame = live.slice()
  }

  // Hold: while frozen, display the captured frame instead of the live one.
  render(frozen.value ? frozenFrame ?? live : live)
  animationId = requestAnimationFrame(draw)
}

// Start drawing once the analyser exists (i.e. after the synth is activated).
watch(
  analyserNode,
  (analyser) => {
    stopDrawing()
    if (analyser) {
      draw()
    }
  },
  { immediate: true }
)

onMounted(() => {
  resizeCanvas()
  resizeObserver = new ResizeObserver(resizeCanvas)
  if (canvas.value) resizeObserver.observe(canvas.value)
})

onBeforeUnmount(() => {
  stopDrawing()
  resizeObserver?.disconnect()
  clearTimeout(recaptureTimer)
})
</script>

<template>
  <div class="oscilloscope">
    <canvas ref="canvas" class="oscilloscope-canvas" width="280" height="120" />
    <div class="oscilloscope-sources" role="group" aria-label="Oscilloscope signal source">
      <button
        v-for="source in scopeSources"
        :key="source.value"
        type="button"
        class="oscilloscope-source"
        :class="{ 'is-active': scopeSource === source.value }"
        :aria-pressed="scopeSource === source.value"
        @click="scopeSource = source.value"
      >
        {{ source.label }}
      </button>
    </div>
    <p class="oscilloscope-label">Oscilloscope</p>
    <div class="oscilloscope-controls">
      <div class="oscilloscope-control">
        <DSlider
          id="oscilloscope-timing"
          aria-label="Oscilloscope timing"
          :min="minTimeScale"
          :max="maxTimeScale"
          step="0.01"
          v-model="timeScale"
        />
        <div class="oscilloscope-control-caption">
          <label for="oscilloscope-timing">Timing</label>
          <span class="oscilloscope-control-value">{{ timingReadout }}</span>
        </div>
      </div>

      <div class="oscilloscope-control">
        <DSlider
          id="oscilloscope-voltage"
          aria-label="Oscilloscope voltage"
          :min="0"
          :max="1"
          step="0.005"
          v-model="voltagePosition"
        />
        <div class="oscilloscope-control-caption">
          <label for="oscilloscope-voltage">Voltage</label>
          <span class="oscilloscope-control-value">{{ voltageReadout }}</span>
        </div>
      </div>

      <div class="oscilloscope-control">
        <button
          type="button"
          class="oscilloscope-freeze"
          :class="{ 'is-frozen': frozen }"
          :aria-pressed="frozen"
          @click="toggleFreeze"
        >
          {{ frozen ? 'Run' : 'Freeze' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.oscilloscope {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 30rem;

  @include md {
    width: 28rem;
  }
}

.oscilloscope-canvas {
  display: block;
  width: 100%;
  aspect-ratio: 20 / 9;
  background: var(--black-soft);
  border: 2px solid var(--blue);
  border-radius: 4px;
}

.oscilloscope-label {
  font-size: 12px;
  color: var(--color-heading);
}

.oscilloscope-sources {
  display: flex;
  gap: 0.5rem;
}

.oscilloscope-source {
  font-size: 12px;
  color: var(--color-text);
  background: var(--black-soft);
  border: 2px solid var(--grey-soft);
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;

  &.is-active {
    color: var(--color-heading);
    border-color: var(--blue);
  }
}

.oscilloscope-controls {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: end;
  gap: 0.5rem 1.25rem;
  width: 100%;
}

.oscilloscope-control {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
  gap: 0.25rem;

  // The shared slider has a fixed width; in the scope's grid it should fill its column.
  :deep(.d-slider) {
    width: 100%;
  }

  label {
    font-size: 12px;
    color: var(--color-heading);
  }
}

.oscilloscope-control-caption {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.oscilloscope-control-value {
  font-size: 11px;
  color: var(--color-text);
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

.oscilloscope-freeze {
  font-size: 12px;
  color: var(--color-heading);
  background: var(--black-soft);
  border: 2px solid var(--blue);
  border-radius: 4px;
  padding: 0.45rem 1rem;
  cursor: pointer;
  min-width: 4.5rem;

  &.is-frozen {
    background: var(--blue);
    color: var(--black-soft);
  }
}
</style>
