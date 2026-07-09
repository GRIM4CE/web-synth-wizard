<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'

// The analyser is created lazily when the synth is activated, so it may be null on first render.
const { analyserNode } = useAudioContext()

const canvas = ref<HTMLCanvasElement | null>(null)
let animationId: number | undefined

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
  const dataArray = new Uint8Array(bufferLength)
  analyser.getByteTimeDomainData(dataArray)

  const { width, height } = canvasEl

  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 2
  ctx.strokeStyle = '#a9f6db'
  ctx.beginPath()

  const sliceWidth = width / bufferLength
  let x = 0

  for (let i = 0; i < bufferLength; i++) {
    // Byte data is centered on 128; normalise to a 0..2 range around the vertical middle.
    const v = dataArray[i] / 128
    const y = (v * height) / 2

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    x += sliceWidth
  }

  ctx.lineTo(width, height / 2)
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
</style>
