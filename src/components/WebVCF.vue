<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 
import DSlider from './DSlider.vue'

// Retrieve the shared AudioContext and gain node from a composable
const { filterNode, filterSettings, filterEnvelope } = useAudioContext();

// Reactive filter parameters
const filterTypes: BiquadFilterType[] = ["lowpass", 'highpass', 'bandpass', 'notch']

const filterQ = ref(filterSettings.value.q); // Default Q factor
const filterType = ref(filterSettings.value.type) // Default Type

// Watchers to update filter parameters based on user input
watch(filterType, (newFilterType) => {
  if(!filterNode.value) return
  filterNode.value.type = newFilterType
});

watch(filterEnvelope.envelope, (newEnvelope) => {
  if(filterEnvelope.envelope.value) {
    filterEnvelope.envelope.value = newEnvelope
  }
});

watch(filterQ, (newValue) => {
  if(!filterNode.value) return
  filterNode.value.Q.value = newValue;
});
</script>


<template>
  <div class="web-vcf">
      <h2>VCF - Voltage Controlled Filter</h2>
      <label for="filter-type">Filter Type: {{ filterType }}</label>
        <select id="filter-type" v-model="filterType">
            <option v-for="filterType in filterTypes" :key="filterType" :value="filterType">
              {{ filterType }}
            </option>
        </select>
        
      <div class="web-vcf-slider-wrapper">
        <div class="web-vcf-slider">
          <DSlider orient="vertical" id="frequency" type="range" :min="20" :max="20000" v-model="filterEnvelope.envelope.value.frequency" step="1" />
          <label for="frequency">Freq</label>
        </div>

        <div class="web-vcf-slider">
          <DSlider orient="vertical" id="resonance" type="range" :min="0.01" :max="30" v-model="filterQ" step="0.01"/>
          <label for="resonance">Res</label>
        </div>
        
        <div class="web-vcf-slider">
          <DSlider orient="vertical" id="attack" type="range" :min="0.0001" :max="5" step="0.001" v-model="filterEnvelope.envelope.value.attack" />
          <label for="attack">A</label>
        </div>
        
        <div class="web-vcf-slider">
          <DSlider orient="vertical" id="decay" type="range" :min="0" :max="500" step="0.01" v-model="filterEnvelope.envelope.value.decay" />
          <label for="decay">D</label>
        </div>
        
        <div class="web-vcf-slider">
          <DSlider orient="vertical" id="sustain" type="range" :min="0" :max="1" step="0.01" v-model="filterEnvelope.envelope.value.sustain" />
          <label for="sustain">S</label>
        </div>
        
        <div class="web-vcf-slider">
          <DSlider orient="vertical" id="release" type="range" :min="0" :max="1000" step="0.01" v-model="filterEnvelope.envelope.value.release" />
          <label for="release">R</label>
        </div>
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


.web-vcf-slider-wrapper {
  display: flex;
  column-gap: 1rem;
}

.web-vcf-slider {
  text-align: center;
}
  </style>