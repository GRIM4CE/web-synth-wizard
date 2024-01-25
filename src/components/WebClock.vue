<script lang="ts" setup>
import { watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 

const { clock } = useAudioContext();

watch(clock, (newClockValue) => {
  if(clock.value) {
    clock.value = newClockValue
  }
});
</script>

<template>
  <div class="web-clock">
    <h2>Clock</h2>
    <input type="range" min="20" max="320" step="1" v-model="clock" />
    <p>BPM: {{ clock }}</p>
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