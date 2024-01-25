<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 

// Define a reactive reference for gain
const gain = ref<number>(0.01);

// Retrieve the shared AudioContext and gain node from a composable
const { audioContext, gainNode } = useAudioContext();

// Watch the gain value and update the GainNode accordingly
watch(gain, (newGain) => {
  if(gainNode.value) {
    gainNode.value.gain.value = newGain
  }
});
</script>

<template>
  <div class="web-vca">
    <h2>VCA - Voltage Controlled Amplifier</h2>
    <input type="range" min="0" max="1" step="0.01" v-model="gain" />
    <p>Gain: {{ gain }}</p>
  </div>
</template>

<style scoped>
/* Add your component styling here */
.web-vca {
  /* Example styling */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
</style>