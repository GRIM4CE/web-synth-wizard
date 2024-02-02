<script lang="ts" setup>
import { defineProps, useAttrs } from 'vue';

defineProps<{ 
    modelValue: number,
}>();

const emit = defineEmits(['update:modelValue']);
const attrs = useAttrs();

const updateValue = (event: Event) => {
  const input = event.target as HTMLInputElement;
  emit('update:modelValue', Number(input.value));
};
</script>


<template>
    <input 
        class="d-slider" 
        type="range" 
        v-bind="attrs" 
        :value="modelValue" 
        @input="updateValue"
    />
</template>

<style lang="scss" scoped>
    $slider-color: var(--green); 
    $slider-inactive-color: var(--grey-soft); 
    $knob-color: var(--green); 
    $knob-border: var(--white); 
    $knob-size: 15px;
    $slider-width: 10px;
    $shadow: var(--black);

    .d-slider {
        width: 100%;
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        border: none;
        box-sizing: border-box;

        &:focus {
            outline: none;
        }

        &[orient='vertical'] {
            appearance: slider-vertical;

            &::-webkit-slider-runnable-track {
                height: 100%;
                width: $slider-width;
            }

            &::-moz-range-track {
                height: 100%;
                width: $slider-width;
            }

            &::-moz-range-progress {
                height: 100%;
                width: $slider-width;
            }
        }

        // Style for WebKit/Blink browsers like Chrome and Safari
        &::-webkit-slider-runnable-track {
            border-radius: 30px;
        }

        &::-webkit-slider-thumb {
            -webkit-appearance: none; 
            appearance: none;
            background: $knob-color; 
            border: 3px solid $knob-border; 
            margin-top: calc(($knob-size / 2) * -1); // Half of the extra height to center the thumb
            border-radius: 50%;
            height: $knob-size; 
            width: $knob-size;
            cursor: pointer; 
            position: relative; // For z-index to work
            z-index: 2; // Raise thumb above the track
            box-shadow: 0px 0px 10px rgba($shadow, 0.5);
        }

        // Style for Firefox
        &::-moz-range-track {
            border-radius: 30px;
            background: $slider-inactive-color;
            border: none;
        }


        &::-moz-range-progress {
            background: $slider-color;
            border-radius: 8px;
        }

        &::-moz-range-thumb {
            background: $knob-color; 
            border: 3px solid $knob-border; 
            border-radius: 50%; 
            height: $knob-size;
            width: $knob-size; 
            cursor: pointer;
            box-shadow: 0px 0px 10px rgba($shadow, 0.5);
        }

          // Style for IE and Edge

        &::-ms-track {
            background: transparent;
            border-color: transparent;
            color: transparent;
        }

        &::-ms-fill-lower {
            background: $slider-color;
            border-radius: 5px;
        }

        // IE and Edge: Style for the remainder (potential value)
        &::-ms-fill-upper {
            background: $slider-inactive-color;
            border-radius: 5px;
        }


          &::-ms-thumb {
            background: $knob-color;
            border: 3px solid $knob-border; 
            border-radius: 50%;
            height: $knob-size; 
            width: $knob-size;
            cursor: pointer;
            box-shadow: 0px 0px 10px rgba($shadow, 0.5);
        }

        &::-webkit-slider-runnable-track {
            height: $slider-width;
            width: 100%;
            background: linear-gradient(to right, $slider-color 0%, $slider-color var(--value-percentage), $slider-inactive-color var(--value-percentage), $slider-inactive-color 100%);
        }

        &::-moz-range-track {
            height: $slider-width;
            width: 100%;
        }

        &::-moz-range-progress {
            height: $slider-width;
            width: 100%;
        }
    }
</style>