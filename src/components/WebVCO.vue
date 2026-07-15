<script lang="ts" setup>
import { ref, watch} from "vue"
import { useAudioContext } from '@/composables/useAudioContext';
import DSlider from './DSlider.vue'
import type { MusicalKey, Octaves } from "@/types"
import DCheckbox from "./DCheckbox.vue";

// Use the shared AudioContext and GainNode
const { oscillatorSettings, selectedMusicalKey, selectedOctave, quantize, calculateFrequency, applyPulseWidth, applyVoiceSettings } = useAudioContext();

// 'oscillator' = classic waveforms, 'voice' = physical modeling (plucked string)
const engines = ["oscillator", "voice"];
const waves = ["sawtooth", "sine", "square", "triangle"];
const keys = [ "A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]
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

// Push pulse-width changes onto the live comparator (no-op until activated).
watch(() => oscillatorSettings.value.pulseWidth, () => applyPulseWidth());

// Push damping changes onto the live physical voice (no-op until activated).
watch(() => oscillatorSettings.value.damping, () => applyVoiceSettings());

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
        <label for="engine-select">Engine:</label>
        <select v-model="oscillatorSettings.engine" name="engines" id="engine-select">
          <option v-for="engine in engines" :key="engine" :value="engine">{{ engine }}</option>
        </select>
      </div>

      <div v-if="oscillatorSettings.engine === 'oscillator'">
        <label for="wave-select">Wave:</label>
        <select v-model="type" name="waves" id="wave-select">
          <option v-for="wave in waves" :key="wave" :value="wave">{{ wave }}</option>
        </select>
      </div>

      <div>
        <label for="key-select">Key:</label>
        <select v-model="selectedMusicalKey" name="key" id="key-select">
          <option v-for="musicalKey in keys" :key="musicalKey" :value="musicalKey">{{ musicalKey }}</option>
        </select>
      </div>

      <div>
        <label for="octave-select">Octave:</label>
        <select v-model="selectedOctave" name="octave" id="octave-select">
          <option v-for="octave in octaves" :key="octave" :value="octave">{{ octave }}</option>
        </select>
      </div>

      <div>
        <label for="quantize">Quantize:</label>
        <DCheckbox type="checkbox" id="quantize" aria-label="Quantize" v-model="quantize"/>
      </div>



      <div class="web-vco-freq" v-if="oscillatorSettings.engine === 'oscillator' && type === 'square'">
        <DSlider
          type="range"
          :min="0.05"
          :max="0.95"
          step="0.01"
          id="pulse-width"
          aria-label="Pulse width"
          v-model="oscillatorSettings.pulseWidth"
        />
        <p>Pulse Width: {{ Math.round(oscillatorSettings.pulseWidth * 100) }}%</p>
      </div>

      <div class="web-vco-freq" v-if="oscillatorSettings.engine === 'voice'">
        <DSlider
          type="range"
          :min="0"
          :max="1"
          step="0.01"
          id="damping"
          aria-label="Damping"
          v-model="oscillatorSettings.damping"
        />
        <p>Damping: {{ Math.round(oscillatorSettings.damping * 100) }}% (low = bright ring, high = muted pluck)</p>
      </div>

      <div class="web-vco-freq" :class="{ 'is-disabled': quantize }">
        <DSlider
          type="range"
          :min="0"
          :max="2000"
          id="frequencySlider"
          aria-label="Base frequency"
          :disabled="quantize"
          v-model="baseFrequency"
        />
        <p v-if="quantize">Base Frequency: controlled by Key/Octave while Quantize is on</p>
        <p v-else>Base Frequency: {{ baseFrequency.toFixed(2) }} Hz</p>
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

.web-vco-freq.is-disabled {
  opacity: 0.5;
}

</style>