<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue';

const audioContext = new AudioContext();
const filterNode = ref(audioContext.createBiquadFilter());

// Reactive filter parameters
const filterTypes: BiquadFilterType[] = ["lowpass", 'highpass', 'bandpass', 'notch']
const filterType = ref<BiquadFilterType>('lowpass');
const filterFrequency = ref(440); // Default frequency in Hz
const filterQ = ref(1); // Default Q factor

const updateFilterType = () => {

}

// Watchers to update filter parameters based on user input
watch(filterType, (newValue) => {
  filterNode.value.type = newValue;
});

watch(filterFrequency, (newValue) => {
  filterNode.value.frequency.value = newValue;
});

watch(filterQ, (newValue) => {
  filterNode.value.Q.value = newValue;
});

onMounted(() => {
  // Example setup for the filter node
  // Connect your source to filterNode.value and then to the destination or next node in your audio processing graph
  // source.connect(filterNode.value).connect(audioContext.destination);
});
</script>


<template>
    <div class="web-vcf">
      <h2>VCF - Voltage Controlled Filter</h2>
      
      <!-- Filter Type Selector -->
      <label for="filter-type">Filter Type: {{ filterType }}</label>
      <select id="filter-type" @input="updateFilterType" v-model="filterType">
        <option v-for="type in filterTypes" :key="type" :value="type">{{ type }}</option>
      </select>
  
      <!-- Filter Frequency Control -->
      <div>
        <label for="filter-freq">Frequency:</label>
        <input type="range" id="filter-freq" min="20" max="20000" v-model="filterFrequency" step="1">
        <span>{{ filterFrequency }} Hz</span>
      </div>
  
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