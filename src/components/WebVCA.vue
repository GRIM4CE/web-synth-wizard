<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 

const gain = ref<number>(0.01);
const { gainNode } = useAudioContext();

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