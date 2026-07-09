<script lang="ts" setup>
import { watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 
import DSlider from './DSlider.vue'

const { vcaEnvelope } = useAudioContext();

const minGain = 0.0001
const maxGain = .1

const minOutput = 0.0001
const maxOutput = .03

const linearToLogarithmic = (value: number) => {
    // Ensure the value is within the range [min, max]
    const normalized = (value - minGain) / (maxGain - minGain);
    // Convert the normalized linear range [0, 1] to a logarithmic scale
    const logValue = Math.pow(maxOutput / minOutput, normalized) - 1;
    return logValue;
}

watch(vcaEnvelope.envelope, (newEnvelope) => {
  if(vcaEnvelope.envelope.value) {
    vcaEnvelope.envelope.value = newEnvelope
  }
});

watch(() => vcaEnvelope.envelope.value.gain, (newGain) => {
  linearToLogarithmic(newGain);
}, { immediate: true });


</script>

<template>
  <div class="web-vca">
    <h2>VCA - Voltage Controlled Amplifier</h2>
    <div class="web-vca-slider-wrapper">
      <div class="web-vca-slider">
        <DSlider orient="vertical" id="vca-attack" aria-label="VCA attack" type="range" :min="0.0001" :max="5000" step="0.01" v-model="vcaEnvelope.envelope.value.attack" />
        <label for="vca-attack">A</label>
      </div>

      <div class="web-vca-slider">
        <DSlider orient="vertical" id="vca-decay" aria-label="VCA decay" :min="0" :max="500" step="0.01" v-model="vcaEnvelope.envelope.value.decay" />
        <label for="vca-decay">D</label>
      </div>

      <div class="web-vca-slider">
        <DSlider orient="vertical" id="vca-sustain" aria-label="VCA sustain" :min="0" :max="1" step="0.01" v-model="vcaEnvelope.envelope.value.sustain" />
        <label for="vca-sustain">S</label>
      </div>

      <div class="web-vca-slider">
        <DSlider orient="vertical" id="vca-release" aria-label="VCA release" :min="0" :max="1000" step="0.01" v-model="vcaEnvelope.envelope.value.release" />
        <label for="vca-release">R</label>
      </div>

      <div class="web-vca-slider">
        <DSlider orient="vertical" id="vca-gain" aria-label="VCA gain" :min="minGain" :max="maxGain" step="0.001" v-model="vcaEnvelope.envelope.value.gain" />
        <label for="vca-gain">Gain</label>
      </div>
    </div>
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

.web-vca-slider-wrapper {
  display: flex;
  column-gap: 1rem;
  text-align: center;
}
</style>