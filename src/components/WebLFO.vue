<script lang="ts" setup>
import { watch } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'
import WebLFOStrip from './WebLFOStrip.vue'

const { lfoSettings, applyLfoSettings } = useAudioContext()

// Any edit to any strip is pushed onto the live LFO nodes (a no-op until the
// synth is activated; initSynth re-applies the stored settings itself).
watch(lfoSettings, () => applyLfoSettings(), { deep: true })
</script>

<template>
  <div class="web-lfo">
    <h2>LFO - Low Frequency Oscillators</h2>
    <div class="web-lfo-strips">
      <WebLFOStrip v-for="(lfo, index) in lfoSettings" :key="index" :index="index" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.web-lfo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.web-lfo-strips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 1rem;
  width: 100%;
}
</style>
