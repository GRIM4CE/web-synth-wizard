<script lang="ts" setup>
import { defineProps, useAttrs } from 'vue';

defineProps<{ 
    modelValue?: boolean 
    id: string
}>();

const emit = defineEmits(['update:modelValue']);
const attrs = useAttrs();

const updateValue = (event: Event) => {
  const input = event.target as HTMLInputElement;
  emit('update:modelValue', input.checked);
};
</script>


<template>
    <input :id="id" class="d-checkbox-default" type="checkbox" v-bind="attrs" :checked="modelValue" @input="updateValue"/>
    <label :for="id" class="d-checkbox"></label>
</template>

<style lang="scss" scoped>
$checkbox-color: var(--blue); 
$checkbox-inactive-color: var(--grey-soft); 
$checkbox-border-color: var(--white); 
$checkbox-size: 15px;
$checkbox-border-radius: 2px;


.d-checkbox-default {
    // Visually hide the checkbox but make it accessible to screen readers and keyboard navigation
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
}

.d-checkbox {
    display: inline-block;
    width: $checkbox-size; 
    height: $checkbox-size;
    background: $checkbox-inactive-color;
    border: 2px solid $checkbox-border-color;
    border-radius: $checkbox-border-radius;
    cursor: pointer;

    &:after {
        content: ''; // Unicode checkmark symbol
        display: block;
        width: 100%;
        background-color: $checkbox-color;
        height: 100%;
        opacity: 0; // Start fully transparent
        transition: opacity 0.2s; // Smooth transition for the checkmark appearance
    }
  }


.d-checkbox-default:checked + .d-checkbox:after {
    opacity: 1; // Make the checkmark fully visible
}

.d-checkbox-default:focus + .d-checkbox {
    // Provide focus styles for when the hidden checkbox is focused
    box-shadow: 0 0 0 3px lightblue; // Example focus style
}
</style>