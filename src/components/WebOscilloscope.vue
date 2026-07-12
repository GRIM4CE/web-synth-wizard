<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'
import DSlider from './DSlider.vue'

// The analyser is created lazily when the synth is activated, so it may be null on first render.
const { analyserNode } = useAudioContext()

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId: number | undefined

// Timing (time base): the fraction of the analyser buffer drawn across the full
// canvas width. Smaller values zoom in horizontally (fewer samples, more detail).
const minTimeScale = 0.05
const maxTimeScale = 1
const timeScale = ref(1)

// Voltage (vertical scale): multiplies the waveform's deviation from the centre
// line, so larger values make the trace taller.
const minVoltageScale = 0.25
const maxVoltageScale = 4
const voltageScale = ref(1)

// Freeze (hold): when true, the scope stops sampling new audio and keeps redrawing
// the last captured frame, so the waveform can be studied. The timing and voltage
// controls still apply, so the held frame can be zoomed and scaled.
const frozen = ref(false)
let lastFrame: Uint8Array | null = null

function toggleFreeze() {
  frozen.value = !frozen.value
}

function stopDrawing() {
  if (animationId !== undefined) {
    cancelAnimationFrame(animationId)
    animationId = undefined
  }
}

function draw() {
  const analyser = analyserNode.value
  const canvasEl = canvas.value
  const ctx = canvasEl?.getContext('2d')

  if (!analyser || !canvasEl || !ctx) {
    stopDrawing()
    return
  }

  const bufferLength = analyser.fftSize
  let dataArray: Uint8Array

  if (frozen.value && lastFrame && lastFrame.length === bufferLength) {
    // Hold: keep displaying the frame captured at the moment of freezing.
    dataArray = lastFrame
  } else {
    // Sample fresh audio and remember it so it can be held if we freeze next.
    dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)
    lastFrame = dataArray
  }

  const { width, height } = canvasEl

  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 2
  ctx.strokeStyle = '#a9f6db'
  ctx.beginPath()

  // Only draw a slice of the buffer, stretched to fill the width. This is the
  // horizontal "time base": fewer samples across the same width means a more
  // zoomed-in view of the waveform.
  const visibleSamples = Math.max(2, Math.floor(bufferLength * timeScale.value))
  const sliceWidth = width / visibleSamples

  // Trigger: start the sweep at the first rising crossing of the centre line
  // (128). Without this the drawn window starts at a random phase every frame, so
  // the wave slides around and reads as noise; anchoring to a rising edge holds a
  // periodic wave (like a square) steady on screen.
  const triggerLimit = bufferLength - visibleSamples
  let triggerOffset = 0
  for (let i = 1; i < triggerLimit; i++) {
    if (dataArray[i - 1] < 128 && dataArray[i] >= 128) {
      triggerOffset = i
      break
    }
  }

  let x = 0

  for (let i = 0; i < visibleSamples; i++) {
    // Byte data is centered on 128; convert to a -1..1 deviation, apply the
    // voltage scale, then map around the vertical middle of the canvas.
    const deviation = (dataArray[triggerOffset + i] - 128) / 128
    const y = height / 2 - deviation * voltageScale.value * (height / 2)

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    x += sliceWidth
  }

  ctx.stroke()

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

onBeforeUnmount(stopDrawing)
</script>

<template>
  <div class="oscilloscope">
    <canvas ref="canvas" class="oscilloscope-canvas" width="280" height="120" />
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
        <label for="oscilloscope-timing">Timing</label>
      </div>

      <div class="oscilloscope-control">
        <DSlider
          id="oscilloscope-voltage"
          aria-label="Oscilloscope voltage"
          :min="minVoltageScale"
          :max="maxVoltageScale"
          step="0.05"
          v-model="voltageScale"
        />
        <label for="oscilloscope-voltage">Voltage</label>
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
}

.oscilloscope-canvas {
  width: 100%;
  max-width: 280px;
  height: auto;
  background: var(--black-soft);
  border: 2px solid var(--blue);
  border-radius: 4px;
}

.oscilloscope-label {
  font-size: 12px;
  color: var(--color-heading);
}

.oscilloscope-controls {
  display: flex;
  column-gap: 1.5rem;
}

.oscilloscope-control {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;

  label {
    font-size: 12px;
    color: var(--color-heading);
  }
}

.oscilloscope-freeze {
  font-size: 12px;
  color: var(--color-heading);
  background: var(--black-soft);
  border: 2px solid var(--blue);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;

  &.is-frozen {
    background: var(--blue);
    color: var(--black-soft);
  }
}
</style>
