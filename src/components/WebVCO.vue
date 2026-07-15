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

// The voice engine's tone controls, modeled after Mutable Instruments Rings'
// resonator macro-parameters. Each maps to an AudioParam on the worklet.
const voiceControls = [
  {
    key: 'damping',
    label: 'Damping',
    hint: 'low = bright ring, high = muted pluck'
  },
  {
    key: 'structure',
    label: 'Structure',
    hint: 'inharmonicity: low = pure string, high = metallic'
  },
  {
    key: 'brightness',
    label: 'Brightness',
    hint: 'excitation tone: low = dull thump, high = raw noise'
  },
  {
    key: 'position',
    label: 'Position',
    hint: 'pluck point: low = at the bridge, high = mid-string'
  }
] as const

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

// Push voice tone changes onto the live physical voice (no-op until activated).
watch(
  voiceControls.map((control) => () => oscillatorSettings.value[control.key]),
  () => applyVoiceSettings()
);

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

      <div class="web-vco-fields">
        <div class="web-vco-field">
          <label for="engine-select">Engine:</label>
          <select v-model="oscillatorSettings.engine" name="engines" id="engine-select">
            <option v-for="engine in engines" :key="engine" :value="engine">{{ engine }}</option>
          </select>
        </div>

        <div class="web-vco-field" v-if="oscillatorSettings.engine === 'oscillator'">
          <label for="wave-select">Wave:</label>
          <select v-model="type" name="waves" id="wave-select">
            <option v-for="wave in waves" :key="wave" :value="wave">{{ wave }}</option>
          </select>
        </div>

        <div class="web-vco-field">
          <label for="key-select">Key:</label>
          <select v-model="selectedMusicalKey" name="key" id="key-select">
            <option v-for="musicalKey in keys" :key="musicalKey" :value="musicalKey">{{ musicalKey }}</option>
          </select>
        </div>

        <div class="web-vco-field">
          <label for="octave-select">Octave:</label>
          <select v-model="selectedOctave" name="octave" id="octave-select">
            <option v-for="octave in octaves" :key="octave" :value="octave">{{ octave }}</option>
          </select>
        </div>

        <div class="web-vco-field">
          <label for="quantize">Quantize:</label>
          <DCheckbox type="checkbox" id="quantize" aria-label="Quantize" v-model="quantize"/>
        </div>
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

      <template v-if="oscillatorSettings.engine === 'voice'">
        <div class="web-vco-freq" v-for="control in voiceControls" :key="control.key">
          <DSlider
            type="range"
            :min="0"
            :max="1"
            step="0.01"
            :id="control.key"
            :aria-label="control.label"
            v-model="oscillatorSettings[control.key]"
          />
          <p>{{ control.label }}: {{ Math.round(oscillatorSettings[control.key] * 100) }}%</p>
          <p class="web-vco-hint">{{ control.hint }}</p>
        </div>
      </template>

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
.web-vco {
  display: grid;
  row-gap: 1rem;
  justify-items: center;
}

/* Label + control pairs wrap as a unit, so narrow screens stack them instead
   of squeezing everything into one overflowing row. */
.web-vco-fields {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 0.5rem 1.25rem;
  max-width: 100%;
}

.web-vco-field {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.web-vco-field select {
  max-width: 100%;
}

.web-vco-freq {
  display: grid;
  justify-items: center;
  row-gap: 0.25rem;
  width: 100%;
  max-width: 26rem;
}

.web-vco-freq :deep(.d-slider) {
  width: 100%;
  max-width: 20rem;
}

.web-vco-hint {
  font-size: 12px;
  opacity: 0.7;
}

.web-vco-freq.is-disabled {
  opacity: 0.5;
}

</style>
