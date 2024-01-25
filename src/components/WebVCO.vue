<script lang="ts" setup>
import {ref, watch} from "vue"
import { useAudioContext } from '@/composables/useAudioContext';

// Use the shared AudioContext and GainNode
const { oscillatorSettings } = useAudioContext();

const waves = ["sawtooth", "sine", "square", "triangle"];

const type = ref(oscillatorSettings.value.type)
const baseFrequency = ref(oscillatorSettings.value.baseFrequency)

watch(baseFrequency, (newBaseFrequencyValue: number) => {
  if(oscillatorSettings.value) {
    oscillatorSettings.value.baseFrequency = newBaseFrequencyValue
  }
});

watch(type, (newTypeValue: OscillatorType) => {
  if(oscillatorSettings.value) {
    oscillatorSettings.value.type = newTypeValue
  }
});
</script>

<template>
    <div class="web-vco">
      <h2>VCO - Voltage Controlled Oscillator</h2>
      <p>Wave Shape: {{ type }}</p>
      <select v-model="type" name="waves" id="wave-select">
        <option v-for="wave in waves" :key="wave" :value="wave">{{ wave }}</option>
      </select>
      <input type="range" min="0" max="2000" id="frequencySlider" v-model="baseFrequency" />
      <p>Base Frequency: {{ baseFrequency }} Hz</p>
    </div>
</template>

<style scoped>
/* Add your component styling here */
.web-vco {
  /* Example styling */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
</style>