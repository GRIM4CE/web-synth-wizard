<script lang="ts" setup>
import { ref, watch} from "vue"
import { useAudioContext } from '@/composables/useAudioContext';
import DSlider from './DSlider.vue'
import type { MusicalKey, Octaves } from "@/types"
import DCheckbox from "./DCheckbox.vue";

// Use the shared AudioContext and GainNode
const { oscillatorSettings, selectedMusicalKey, selectedOctave, quantize, calculateFrequency } = useAudioContext();

const waves = ["sawtooth", "sine", "square", "triangle"];
const keys = [ "A", "A#", "B", "C", "D", "D#", "E", "F", "F#", "G", "G#"]
const octaves = [1, 2, 3, 4, 5, 6, 7]

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

watch(selectedMusicalKey, (newSelectedMusicalKey: MusicalKey) => {
  if(selectedMusicalKey.value) {
    selectedMusicalKey.value = newSelectedMusicalKey
    const baseFreq = calculateFrequency(newSelectedMusicalKey, selectedOctave.value)
    baseFrequency.value = baseFreq

  }
});

watch(selectedOctave, (newSelectedOctave: Octaves) => {
  if(selectedOctave.value) {
    selectedOctave.value = newSelectedOctave
    const baseFreq = calculateFrequency(selectedMusicalKey.value, newSelectedOctave)
    baseFrequency.value = baseFreq
  }
});
</script>

<template>
    <div class="web-vco">
      <h2 class="web-vco-title">VCO - Voltage Controlled Oscillator</h2>
      <div>
        <p>Wave:</p>
        <select v-model="type" name="waves" id="wave-select">
          <option v-for="wave in waves" :key="wave" :value="wave">{{ wave }}</option>
        </select>
      </div>

      <div>
        <p>Key:</p>
        <select v-model="selectedMusicalKey" name="key" id="key-select">
          <option v-for="musicalKey in keys" :key="musicalKey" :value="musicalKey">{{ musicalKey }}</option>
        </select>
      </div>

      <div>
        <p>Octave:</p>
        <select v-model="selectedOctave" name="key" id="key-select">
          <option v-for="octave in octaves" :key="octave" :value="octave">{{ octave }}</option>
        </select>
      </div>

      <div>
        <p>Quantize:</p>
        <DCheckbox type="checkbox" id="quantize" v-model="quantize"/>
      </div>

      

      <div class="web-vco-freq">
        <DSlider type="range" :min="0" :max="2000" id="frequencySlider" v-model="baseFrequency" />
        <p>Base Frequency: {{ baseFrequency.toFixed(2) }} Hz</p>
      </div>
    </div>
</template>

<style scoped>
/* Add your component styling here */
.web-vco {
  /* Example styling */
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  row-gap: 1rem;
}

.web-vco-title,
.web-vco-freq {
  grid-column: span 4;
}

</style>