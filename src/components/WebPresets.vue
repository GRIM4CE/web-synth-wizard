<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'
import { usePresets } from '@/composables/usePresets'

const { presets, selectedPresetName, savePreset, applyPreset, deletePreset, restoreLastPreset } =
  usePresets()

const presetName = ref('')

const onSave = () => {
  savePreset(presetName.value)
  presetName.value = ''
}

// Selecting from the dropdown applies the preset immediately.
watch(selectedPresetName, (name) => {
  if (name) applyPreset(name)
})

// Settings persist across reloads: the last saved/loaded preset is re-applied
// when the app starts.
onMounted(restoreLastPreset)
</script>

<template>
  <div class="web-presets">
    <form class="web-presets-save" @submit.prevent="onSave">
      <label class="visually-hidden" for="preset-name">Preset name</label>
      <input
        id="preset-name"
        class="web-presets-input"
        type="text"
        v-model="presetName"
        maxlength="40"
        placeholder="Preset name"
      />
      <button class="web-presets-button" type="submit" :disabled="!presetName.trim()">
        Save
      </button>
    </form>

    <div class="web-presets-load" v-if="presets.length">
      <label class="visually-hidden" for="preset-select">Load preset</label>
      <select id="preset-select" class="web-presets-select" v-model="selectedPresetName">
        <option value="" disabled>Load preset…</option>
        <option v-for="preset in presets" :key="preset.name" :value="preset.name">
          {{ preset.name }}
        </option>
      </select>
      <button
        class="web-presets-button web-presets-delete"
        type="button"
        :disabled="!selectedPresetName"
        @click="deletePreset(selectedPresetName)"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.web-presets {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem 1rem;

  @include md {
    justify-content: flex-start;
  }
}

.web-presets-save,
.web-presets-load {
  display: flex;
  gap: 0.5rem;
}

.web-presets-input,
.web-presets-select {
  padding: 0.4rem 0.6rem;
  color: var(--color-text);
  background: var(--color-background-soft);
  border: 2px solid var(--grey-soft);
  border-radius: 4px;
  font-size: 14px;
  min-width: 0;
  width: 10rem;

  &:focus {
    outline: none;
    border-color: var(--blue);
  }
}

.web-presets-button {
  padding: 0.4rem 0.9rem;
  color: var(--color-heading);
  background: var(--black-soft);
  border: 2px solid var(--blue);
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

.web-presets-delete {
  border-color: var(--pink);
}
</style>
