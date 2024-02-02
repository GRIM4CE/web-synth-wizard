<script lang="ts" setup>
import { watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 
import DSlider from './DSlider.vue'

const { clock, timeDivision} = useAudioContext();

watch(clock, (newClockValue) => {
  if(clock.value) {
    clock.value = newClockValue
  }
});

watch(timeDivision, (newTimeDivisionVale) => {
  if(timeDivision.value) {
    timeDivision.value = newTimeDivisionVale
  }
});

const timeDivisions = [
  { value: 1, label: 'Whole notes' },
  { value: 2, label: 'Half notes' },
  { value: 4, label: 'Quarter notes (4th)' },
  { value: 8, label: 'Eighth notes (8th)' },
  { value: 16, label: 'Sixteenth notes (16th)' },
  { value: 32, label: 'Thirty-second notes (32nd)' },
];

</script>

<template>
  <div class="web-clock">
    <h2>Clock</h2>
    <DSlider type="range" :min="20" :max="400" step="1" v-model="clock" />
    <p>BPM: {{ clock }}</p>

    <h2>Time Division</h2>
    <select v-model="timeDivision">
      <option v-for="division in timeDivisions" :key="division.value" :value="division.value">
        {{ division.label }}
      </option>
    </select>
  </div>


</template>

<style scoped>
.web-clock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
</style>