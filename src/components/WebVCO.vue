<script lang="ts" setup>
import { useAudioContext } from '@/composables/useAudioContext';

// Use the shared AudioContext and GainNode
const { updateOscillatorFreq, updateOscillatorWave, waveform, frequency } = useAudioContext();

const waves = ["sawtooth", "sine", "square", "triangle"];

// Function to update frequency based on the slider input
const updateFrequency = () => {
  updateOscillatorFreq(frequency.value)
};

const updateWave = () => {
  updateOscillatorWave(waveform.value)
};
</script>

<template>
    <div class="web-vco">
      <h2>VCO - Voltage Controlled Oscillator</h2>
      <p>Wave Shape: {{ waveform }}</p>
      <select @input="updateWave" v-model="waveform" name="waves" id="wave-select">
        <option v-for="wave in waves" :key="wave" :value="wave">{{ wave }}</option>
      </select>
      <input type="range" min="20" max="2000" value="440" id="frequencySlider" @input="updateFrequency" v-model="frequency" />
      <p>Frequency: {{ frequency }} Hz</p>
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