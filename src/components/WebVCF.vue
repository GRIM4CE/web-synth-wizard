<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 

// Retrieve the shared AudioContext and gain node from a composable
const { filterNode, filterSettings } = useAudioContext();

// Reactive filter parameters
const filterTypes: BiquadFilterType[] = ["lowpass", 'highpass', 'bandpass', 'notch']

const filterFrequency = ref(filterSettings.value.frequency); // Default frequency in Hz
const filterQ = ref(filterSettings.value.q); // Default Q factor
const filterType = ref(filterSettings.value.type) // Default Type

// Watchers to update filter parameters based on user input
watch(filterType, (newFilterType) => {
  if(!filterNode.value) return
  filterNode.value.type = newFilterType
});

watch(filterFrequency, (newFilterFrequency) => {
  if(!filterNode.value) return
  filterNode.value.frequency.value = newFilterFrequency;
});

watch(filterQ, (newValue) => {
  if(!filterNode.value) return
  filterNode.value.Q.value = newValue;
});
</script>


<template>
    <div class="web-vcf">
        <h2>VCF - Voltage Controlled Filter</h2>

        <!-- Filter Type Selector -->
        <label for="filter-type">Filter Type: {{ filterType }}</label>
        <select id="filter-type" v-model="filterType">
            <option v-for="filterType in filterTypes" :key="filterType" :value="filterType">
              {{ filterType }}
            </option>
        </select>

        <label for="filter-freq">Frequency:</label>
        <input type="range" id="filter-freq" min="20" max="20000" v-model="filterFrequency" step="1">
        
        <span>{{ filterFrequency }} Hz</span>
  
      <!-- Filter Q Factor (Resonance) Control -->
      <div>
        <label for="filter-q">Q Factor:</label>
        <input type="range" id="filter-q" min="0.01" max="30" v-model="filterQ" step="0.01">
        <span>{{ filterQ }}</span>
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
  </style>