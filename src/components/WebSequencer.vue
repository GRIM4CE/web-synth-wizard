<script lang="ts" setup>
import { watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 

const { steps } = useAudioContext()

watch(steps, (newStepsValue) => {
  if(steps.value) {
    steps.value = newStepsValue
  }
});
</script>

<template>
    <div class="web-sequencer">
        <h2>Sequencer</h2>
        <div class="web-sequencer-steps">
            <div class="web-sequencer-step" v-for="(step, index) in steps" :key="index">
                <input class="web-sequencer-freq-slider" orient="vertical" type="range" min="100" max="1000" v-model="step.frequency" />
                <input type="checkbox" v-model="step.active"/>
            </div>
        </div>
    </div>
</template>

<style>
.web-sequencer {
    margin: 0 auto;
}

.web-sequencer-steps {
    width: 100%;
    display: flex;
}

.web-sequencer-step {
  margin: 10px;
}

.web-sequencer-freq-slider {
    appearance: slider-vertical;
    display: flex;
}
</style>