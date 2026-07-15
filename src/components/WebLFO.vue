<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'
import WebLFOStrip from './WebLFOStrip.vue'

const { lfoSettings, applyLfoSettings } = useAudioContext()

// One LFO is shown at a time; these tabs switch between them.
const activeLfo = ref(0)
const tabRefs = ref<HTMLButtonElement[]>([])

const onTabKeydown = (event: KeyboardEvent, index: number) => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const direction = event.key === 'ArrowRight' ? 1 : -1
  const nextIndex = (index + direction + lfoSettings.value.length) % lfoSettings.value.length
  activeLfo.value = nextIndex
  tabRefs.value[nextIndex]?.focus()
}

// Any edit to any LFO is pushed onto the live nodes (a no-op until the synth
// is activated; initSynth re-applies the stored settings itself).
watch(lfoSettings, () => applyLfoSettings(), { deep: true })
</script>

<template>
  <div class="web-lfo">
    <h2>LFO - Low Frequency Oscillators</h2>

    <div class="web-lfo-tabs" role="tablist" aria-label="LFO slots">
      <button
        v-for="(lfo, index) in lfoSettings"
        :key="index"
        ref="tabRefs"
        type="button"
        class="web-lfo-tab"
        :class="{ 'is-active': activeLfo === index }"
        role="tab"
        :id="`lfo-tab-${index}`"
        :aria-selected="activeLfo === index"
        :aria-controls="`lfo-panel-${index}`"
        :tabindex="activeLfo === index ? 0 : -1"
        @click="activeLfo = index"
        @keydown="onTabKeydown($event, index)"
      >
        LFO {{ index + 1 }}
        <span class="web-lfo-tab-dot" :class="{ 'is-on': lfo.enabled }" aria-hidden="true" />
      </button>
    </div>

    <div
      class="web-lfo-panel"
      :id="`lfo-panel-${activeLfo}`"
      role="tabpanel"
      :aria-labelledby="`lfo-tab-${activeLfo}`"
    >
      <WebLFOStrip :index="activeLfo" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.web-lfo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.web-lfo-tabs {
  display: flex;
  gap: 0.5rem;
}

.web-lfo-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-background-mute);
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.3s, color 0.3s;

  &:hover {
    border-color: var(--grey-soft);
  }

  &.is-active {
    color: var(--color-heading);
    border-color: var(--blue);
  }
}

// Small status light: lit while that LFO is enabled, on any tab.
.web-lfo-tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--grey-soft);
  opacity: 0.4;

  &.is-on {
    background: var(--green);
    opacity: 1;
  }
}

.web-lfo-panel {
  display: flex;
  justify-content: center;
  width: 100%;
}
</style>
