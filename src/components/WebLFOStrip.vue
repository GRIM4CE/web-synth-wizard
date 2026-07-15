<script lang="ts" setup>
import { computed } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'
import DSlider from './DSlider.vue'
import DCheckbox from './DCheckbox.vue'
import type { LfoTarget } from '@/types'

const props = defineProps<{ index: number }>()

// The strip edits the shared settings directly (the prop only carries the
// index), so presets and the audio layer see the same objects.
const { lfoSettings } = useAudioContext()
const lfo = computed(() => lfoSettings.value[props.index])

const targets: { value: LfoTarget; label: string }[] = [
  { value: 'pitch', label: 'Pitch' },
  { value: 'cutoff', label: 'Filter cutoff' },
  { value: 'volume', label: 'Volume' },
  { value: 'delayTime', label: 'Delay time' }
]
const waveforms: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth']

// Rate slider is logarithmic: slow sweeps (0.1Hz) and vibrato (5-7Hz) both need
// usable travel.
const minRate = 0.05
const maxRate = 20
const ratePosition = computed({
  get: () => Math.log(lfo.value.rate / minRate) / Math.log(maxRate / minRate),
  set: (position) => {
    lfo.value.rate = Number((minRate * Math.pow(maxRate / minRate, position)).toFixed(2))
  }
})

const rateReadout = computed(() =>
  lfo.value.rate < 1 ? `${lfo.value.rate.toFixed(2)}Hz` : `${lfo.value.rate.toFixed(1)}Hz`
)
</script>

<template>
  <div class="web-lfo-strip">
    <div class="web-lfo-strip-power">
      <label :for="`lfo-${index}-enabled`">LFO {{ index + 1 }}: {{ lfo.enabled ? 'On' : 'Off' }}</label>
      <DCheckbox :id="`lfo-${index}-enabled`" :aria-label="`Enable LFO ${index + 1}`" v-model="lfo.enabled" />
    </div>

    <template v-if="lfo.enabled">
      <div class="web-lfo-strip-row">
        <label :for="`lfo-${index}-target`">Target</label>
        <select :id="`lfo-${index}-target`" v-model="lfo.target">
          <option v-for="target in targets" :key="target.value" :value="target.value">
            {{ target.label }}
          </option>
        </select>
      </div>

      <div class="web-lfo-strip-row">
        <label :for="`lfo-${index}-waveform`">Wave</label>
        <select :id="`lfo-${index}-waveform`" v-model="lfo.waveform">
          <option v-for="waveform in waveforms" :key="waveform" :value="waveform">
            {{ waveform }}
          </option>
        </select>
      </div>

      <div class="web-lfo-strip-slider">
        <DSlider
          :id="`lfo-${index}-rate`"
          :aria-label="`LFO ${index + 1} rate`"
          :min="0"
          :max="1"
          step="0.005"
          v-model="ratePosition"
        />
        <div class="web-lfo-strip-caption">
          <label :for="`lfo-${index}-rate`">Rate</label>
          <span class="web-lfo-strip-value">{{ rateReadout }}</span>
        </div>
      </div>

      <div class="web-lfo-strip-slider">
        <DSlider
          :id="`lfo-${index}-depth`"
          :aria-label="`LFO ${index + 1} depth`"
          :min="0"
          :max="1"
          step="0.01"
          v-model="lfo.depth"
        />
        <div class="web-lfo-strip-caption">
          <label :for="`lfo-${index}-depth`">Depth</label>
          <span class="web-lfo-strip-value">{{ Math.round(lfo.depth * 100) }}%</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.web-lfo-strip {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-background-mute);
  border-radius: 8px;
  width: 100%;
  max-width: 14rem;
}

.web-lfo-strip-power {
  display: flex;
  align-items: center;
  justify-content: center;
  column-gap: 0.5rem;
}

.web-lfo-strip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  column-gap: 0.5rem;

  select {
    min-width: 0;
  }
}

.web-lfo-strip-slider {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  :deep(.d-slider) {
    width: 100%;
  }
}

.web-lfo-strip-caption {
  display: flex;
  justify-content: space-between;
  align-items: baseline;

  label {
    font-size: 12px;
    color: var(--color-heading);
  }
}

.web-lfo-strip-value {
  font-size: 11px;
  color: var(--color-text);
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
</style>
