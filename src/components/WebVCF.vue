<script lang="ts" setup>
import { computed, watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext';
import DSlider from './DSlider.vue'
import DCheckbox from './DCheckbox.vue'

// Retrieve the shared AudioContext and gain node from a composable
const { filterNode, filterSettings, filterEnvelope, filterEnabled, filterEnvelopeEnabled } = useAudioContext();

// Reactive filter parameters
const filterTypes: BiquadFilterType[] = ["lowpass", 'highpass', 'bandpass', 'notch']

// Cutoff slider is logarithmic: audible cutoff changes are multiplicative (octaves),
// so a linear 20-20000 slider crams everything that matters into its bottom tenth.
const minFrequency = 20
const maxFrequency = 20000
const frequencyPosition = computed({
  get: () =>
    Math.log(filterEnvelope.envelope.value.frequency / minFrequency) /
    Math.log(maxFrequency / minFrequency),
  set: (position) => {
    filterEnvelope.envelope.value.frequency = Math.round(
      minFrequency * Math.pow(maxFrequency / minFrequency, position)
    )
  }
})

const frequencyReadout = computed(() => {
  const frequency = filterEnvelope.envelope.value.frequency
  return frequency >= 1000 ? `${(frequency / 1000).toFixed(1)}kHz` : `${Math.round(frequency)}Hz`
})

// Watchers to update filter parameters based on user input. These bind to the
// shared filterSettings so presets can change them and reach the live node too.
watch(() => filterSettings.value.type, (newFilterType) => {
  if(!filterNode.value) return
  filterNode.value.type = newFilterType
});

watch(() => filterSettings.value.q, (newValue) => {
  if(!filterNode.value) return
  filterNode.value.Q.value = newValue;
});

// With the envelope off nothing sweeps the cutoff, so frequency changes from the
// slider need to reach the filter node directly to be audible.
watch(() => filterEnvelope.envelope.value.frequency, (newFrequency) => {
  if (!filterNode.value || filterEnvelopeEnabled.value) return
  filterNode.value.frequency.value = newFrequency
});
</script>


<template>
  <div class="web-vcf">
      <h2>VCF - Voltage Controlled Filter</h2>
      <div class="web-vcf-power">
        <label for="filter-enabled">Filter: {{ filterEnabled ? 'On' : 'Off' }}</label>
        <DCheckbox id="filter-enabled" aria-label="Enable filter" v-model="filterEnabled" />
      </div>
      <div class="web-vcf-power">
        <label for="filter-envelope-enabled">Envelope: {{ filterEnvelopeEnabled ? 'On' : 'Off' }}</label>
        <DCheckbox id="filter-envelope-enabled" aria-label="Enable filter envelope" v-model="filterEnvelopeEnabled" />
      </div>
      <label for="filter-type">Filter Type: {{ filterSettings.type }}</label>
        <select id="filter-type" v-model="filterSettings.type">
            <option v-for="filterType in filterTypes" :key="filterType" :value="filterType">
              {{ filterType }}
            </option>
        </select>

      <div class="web-vcf-slider-wrapper">
        <div class="web-vcf-slider">
          <DSlider orient="vertical" id="vcf-frequency" aria-label="Filter cutoff frequency" type="range" :min="0" :max="1" step="0.001" v-model="frequencyPosition" />
          <label for="vcf-frequency">Freq</label>
          <span class="web-vcf-value">{{ frequencyReadout }}</span>
        </div>

        <div class="web-vcf-slider">
          <DSlider orient="vertical" id="vcf-resonance" aria-label="Filter resonance" type="range" :min="0.0001" :max="30" v-model="filterSettings.q" step="0.01"/>
          <label for="vcf-resonance">Res</label>
        </div>

        <template v-if="filterEnvelopeEnabled">
          <div class="web-vcf-slider">
            <DSlider orient="vertical" id="vcf-attack" aria-label="Filter attack" type="range" :min="0.0001" :max="5000" step="0.001" v-model="filterEnvelope.envelope.value.attack" />
            <label for="vcf-attack">A</label>
          </div>

          <div class="web-vcf-slider">
            <DSlider orient="vertical" id="vcf-decay" aria-label="Filter decay" type="range" :min="0.0001" :max="500" step="0.01" v-model="filterEnvelope.envelope.value.decay" />
            <label for="vcf-decay">D</label>
          </div>

          <div class="web-vcf-slider">
            <DSlider orient="vertical" id="vcf-sustain" aria-label="Filter sustain" type="range" :min="0.0001" :max="1" step="0.01" v-model="filterEnvelope.envelope.value.sustain" />
            <label for="vcf-sustain">S</label>
          </div>

          <div class="web-vcf-slider">
            <DSlider orient="vertical" id="vcf-release" aria-label="Filter release" type="range" :min="0.0001" :max="1000" step="0.01" v-model="filterEnvelope.envelope.value.release" />
            <label for="vcf-release">R</label>
          </div>
        </template>
      </div>
  </div>
  </template>

  <style scoped>
  .web-vcf {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }


.web-vcf-power {
  display: flex;
  align-items: center;
  justify-content: center;
  column-gap: 0.5rem;
}

.web-vcf-slider-wrapper {
  display: flex;
  column-gap: 1rem;
}

.web-vcf-slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.web-vcf-value {
  font-size: 12px;
  color: var(--color-heading);
}
  </style>