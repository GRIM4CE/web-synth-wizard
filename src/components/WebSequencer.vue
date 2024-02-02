<script lang="ts" setup>
import { watch } from 'vue';
import { useAudioContext } from '@/composables/useAudioContext'; 
import DSlider from './DSlider.vue'
import DCheckbox from './DCheckbox.vue'

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
                <DSlider orient="vertical" min="100" max="1000" v-model="step.frequency"/>
                <DCheckbox type="checkbox" :id="`check-id-${index}`" v-model="step.active"/>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.web-sequencer {
    margin: 0 auto;
}

.web-sequencer-steps {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(8, 1fr);

    @include sm {
      grid-template-columns: repeat(16, 1fr);
    }
}

.web-sequencer-step {
  margin: 10px;
  display: grid;
  row-gap: .5rem;
  justify-content: center;
}
</style>