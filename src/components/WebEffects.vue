<script lang="ts" setup>
import { watch } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'
import DSlider from './DSlider.vue'
import DCheckbox from './DCheckbox.vue'

const { delayEnabled, delaySettings, applyDelaySettings } = useAudioContext()

// Settings live in the shared manager so they survive synth restarts; every
// change is pushed onto the live nodes (a no-op until the synth is activated,
// after which initSynth re-applies the stored settings itself).
watch([delayEnabled, delaySettings], () => applyDelaySettings(), { deep: true })
</script>

<template>
  <div class="web-effects">
    <h2>FX - Effects</h2>
    <div class="web-effects-power">
      <label for="delay-enabled">Delay: {{ delayEnabled ? 'On' : 'Off' }}</label>
      <DCheckbox id="delay-enabled" aria-label="Enable delay" v-model="delayEnabled" />
    </div>

    <div class="web-effects-slider-wrapper" v-if="delayEnabled">
      <div class="web-effects-slider">
        <DSlider
          orient="vertical"
          id="delay-time"
          aria-label="Delay time"
          :min="20"
          :max="1500"
          step="1"
          v-model="delaySettings.time"
        />
        <label for="delay-time">Time</label>
        <span class="web-effects-value">{{ Math.round(delaySettings.time) }}ms</span>
      </div>

      <div class="web-effects-slider">
        <DSlider
          orient="vertical"
          id="delay-feedback"
          aria-label="Delay feedback"
          :min="0"
          :max="0.9"
          step="0.01"
          v-model="delaySettings.feedback"
        />
        <label for="delay-feedback">FB</label>
        <span class="web-effects-value">{{ Math.round(delaySettings.feedback * 100) }}%</span>
      </div>

      <div class="web-effects-slider">
        <DSlider
          orient="vertical"
          id="delay-mix"
          aria-label="Delay mix"
          :min="0"
          :max="1"
          step="0.01"
          v-model="delaySettings.mix"
        />
        <label for="delay-mix">Mix</label>
        <span class="web-effects-value">{{ Math.round(delaySettings.mix * 100) }}%</span>
      </div>
    </div>
    <p class="web-effects-hint" v-else>Turn the delay on to add echoes to the voice.</p>
  </div>
</template>

<style scoped>
.web-effects {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.web-effects-power {
  display: flex;
  align-items: center;
  justify-content: center;
  column-gap: 0.5rem;
}

.web-effects-slider-wrapper {
  display: flex;
  column-gap: 1.5rem;
}

.web-effects-slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.web-effects-value {
  font-size: 12px;
  color: var(--color-heading);
}

.web-effects-hint {
  font-size: 14px;
}
</style>
