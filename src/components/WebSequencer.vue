<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';

export default defineComponent({
    name: 'Sequencer',
    setup() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        let intervalId: number | undefined;

        const steps = ref(Array.from({ length: 16 }, () => ({
        active: false,
        frequency: 440, // Default frequency, A4 note
        })));

        function playStep(stepIndex: number) {
        if (!steps.value[stepIndex].active) return;

        const oscillator = audioContext.createOscillator();
        oscillator.frequency.value = steps.value[stepIndex].frequency;
        oscillator.type = 'sine'; // You can change the oscillator type

        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.5; // Adjust volume

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        setTimeout(() => oscillator.stop(), 100); // Note duration
        }

        function startSequencer() {
        let currentStep = 0;
        intervalId = window.setInterval(() => {
            playStep(currentStep);
            currentStep = (currentStep + 1) % steps.value.length;
        }, 300); // Adjust tempo
        }

        onMounted(() => {
        startSequencer();
        });

        onUnmounted(() => {
        if (intervalId) clearInterval(intervalId);
        });

        return { steps };
    },
    });
</script>

<template>
    <div class="web-sequencer">
        <div v-for="(step, index) in steps" :key="index" class="step">
        <input type="checkbox" v-model="step.active" />
        <input type="range" min="100" max="1000" v-model="step.frequency" />
        </div>
    </div>
</template>

<style>
.sequencer {
  display: flex;
  flex-wrap: wrap;
}
.step {
  margin: 10px;
}
</style>