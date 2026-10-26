<script setup lang="ts">
  import { ref } from 'vue'
  import WebVCO from './components/WebVCO.vue';
  import WebVCF from './components/WebVCF.vue';
  import WebVCA from './components/WebVCA.vue';
  import WebClock from './components/WebClock.vue';
  import WebSequencer from './components/WebSequencer.vue';
  import WebOscilloscope from './components/WebOscilloscope.vue';
  import WebEffects from './components/WebEffects.vue';
  import WebLFO from './components/WebLFO.vue';
  import WebPresets from './components/WebPresets.vue';
  import { useAudioContext } from "@/composables/useAudioContext"
  import logoPng from './assets/logo.png'
  import logoWebp from './assets/logo.webp'
  import type { Component } from 'vue'

  const panelComponents: Record<string, Component> = {
    clock: WebClock,
    sequencer: WebSequencer,
    vco: WebVCO,
    vcf: WebVCF,
    vca: WebVCA,
    lfo: WebLFO,
    fx: WebEffects
  }

  const { startAudioContext, suspendAudioContext, audioContext, isRecording, recordingSeconds, startRecording, stopRecording } = useAudioContext()
  const canUseAudioContext = 'AudioContext' in window

  // One button records and exports: start a take, click again to download it
  // as a .wav. Recording silence is pointless, so activate the synth first if
  // it isn't running yet.
  const toggleRecording = async () => {
    if (isRecording.value) {
      stopRecording()
      return
    }
    if (!audioContext.value) await startAudioContext()
    await startRecording()
  }

  const formatRecordingTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = String(totalSeconds % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  // Tabbed cards on every viewport, so the oscilloscope in the header stays on
  // screen while any module is edited. Only the selected panel is shown.
  const tabs = [
    { id: 'clock', label: 'Clock' },
    { id: 'sequencer', label: 'Sequencer' },
    { id: 'vco', label: 'VCO' },
    { id: 'vcf', label: 'VCF' },
    { id: 'vca', label: 'VCA' },
    { id: 'lfo', label: 'LFO' },
    { id: 'fx', label: 'FX' }
  ]

  const activeTab = ref('sequencer')
  const tabRefs = ref<HTMLButtonElement[]>([])

  const selectTab = (id: string) => {
    activeTab.value = id
  }

  const onTabKeydown = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + direction + tabs.length) % tabs.length
    selectTab(tabs[nextIndex].id)
    tabRefs.value[nextIndex]?.focus()
  }
</script>

<template>
  <main class="main-disabled-container" v-if="!canUseAudioContext">
    <picture>
      <source :srcset="logoWebp" type="image/webp" />
      <img alt="Web Synth Wizard logo" class="logo" :src="logoPng" width="125" height="125" />
    </picture>
    <h1>Web Synth Wizard</h1>
    <p>Unfortunately, your current device or browser does not support Web Audio API's AudioContext, a crucial feature which the application heavily relies on. We recommend using a desktop computer with Firefox for the best experience. We apologize for the inconvenience and are looking forward to having you create with Web Synth Wizard on a compatible setup.</p>
  </main>

  <main class="main-container container" v-else>
    <section class="section main-head">
      <div class="main-head-intro">
        <h1 class="visually-hidden">Web Synth Wizard</h1>
        <picture>
          <source :srcset="logoWebp" type="image/webp" />
          <img
            alt="Web Synth Wizard logo"
            class="logo"
            :src="logoPng"
            width="125"
            height="125"
            fetchpriority="high"
            decoding="async"
          />
        </picture>
        <p class="main-head-callout-text">This project is currently under active development to enhance its features and improve user experience. For the best experience, I'd recommend using Firefox, as it provides the most stable and compatible environment for our project's functionalities. While other browsers may also work, you might encounter some differences in performance or layout.</p>

        <div class="utility-button-wrapper">
          <button class="button" @click="startAudioContext()">Activate Synth</button>
          <button class="button stop-button" @click="suspendAudioContext()">Stop Synth</button>
          <button
            class="button record-button"
            :class="{ 'is-recording': isRecording }"
            :aria-pressed="isRecording"
            @click="toggleRecording()"
          >
            {{ isRecording ? `Export .wav (${formatRecordingTime(recordingSeconds)})` : 'Record .wav' }}
          </button>
        </div>

        <WebPresets class="main-head-presets" />
      </div>
    </section>

    <aside class="main-head-scope">
      <WebOscilloscope />
    </aside>

    <nav class="synth-tabs" role="tablist" aria-label="Synth modules">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        ref="tabRefs"
        class="synth-tab"
        :class="{ 'is-active': activeTab === tab.id }"
        type="button"
        role="tab"
        :id="`tab-${tab.id}`"
        :aria-selected="activeTab === tab.id"
        :aria-controls="`panel-${tab.id}`"
        :tabindex="activeTab === tab.id ? 0 : -1"
        @click="selectTab(tab.id)"
        @keydown="onTabKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="synth-panels">
      <section
        v-for="tab in tabs"
        :key="tab.id"
        class="section synth-panel"
        :class="{ 'is-active': activeTab === tab.id }"
        :id="`panel-${tab.id}`"
        role="tabpanel"
        :aria-labelledby="`tab-${tab.id}`"
      >
        <component :is="panelComponents[tab.id]" />
      </section>
    </div>
  </main>
</template>

<style scoped lang="scss">
.container {
  max-width: 1200px;
  width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  padding: 1rem;
  align-content: center;

  @include md {
    padding: 2rem;
  }
}

.main-container {
  display: flex;
  flex-direction: column;
  row-gap: 1rem;

  // Desktop: modules on the left, the oscilloscope in a sticky right column so
  // it stays on screen while any module is edited.
  @include md {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 26rem);
    column-gap: 2rem;
    row-gap: 1rem;
    align-items: start;
  }
}

.main-disabled-container {
  display: grid;
  height: calc(100vh - 4rem);
  text-align: center;
  align-content: center;
  padding: 2rem;
}

.section {
  text-align: center;
}

.main-head {
  display: grid;
  text-align: center;
  justify-content: center;
  align-content: center;
  row-gap: 1rem;

  @include md {
    grid-column: 1;
    grid-row: 1;
    text-align: left;
  }
}

.main-head-intro {
  display: grid;
  justify-items: center;

  @include md {
    justify-items: start;
  }
}

.main-head-scope {
  display: flex;
  justify-content: center;
  width: 100%;

  @include md {
    grid-column: 2;
    grid-row: 1 / span 3;
    align-self: start;
    position: sticky;
    top: 1rem;
    justify-content: flex-end;
  }
}

.logo {
  display: block;
  margin: 0 auto 0rem;

  @include md {
    margin-left: 0;
  }
}

.main-head-callout-text { 
  margin-bottom: 2rem;
  font-size: 14px;
}

.utility-button-wrapper {
  display: flex;
  column-gap: 1rem;
  justify-content: center;
}

.main-head-presets {
  margin-top: 1rem;
}



.main-section3 {
  @include md {
    grid-column: 2;
    grid-row: 2;
  }
}

.init-container {
  justify-content: center;
}

.button {
  color: white;
  padding: .5rem 1rem;
  background-color: #54c3ee;
  border: 2px solid #54c3ee;
  border-radius: 2px;
  cursor: pointer;
  transition: background-color .8s;
}

.button:hover {
  background-color: transparent;
}

.stop-button {
  background-color: #d785bb;
  border-color: #d785bb;
}

.stop-button:hover {
  background-color: transparent;
}

.record-button {
  background-color: #e05555;
  border-color: #e05555;
}

.record-button:hover {
  background-color: transparent;
}

/* While a take is running the button stays hollow with a pulsing border so
   the armed state is obvious at a glance. */
.record-button.is-recording {
  background-color: transparent;
  animation: record-pulse 1.5s ease-in-out infinite;
}

@keyframes record-pulse {
  50% {
    border-color: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .record-button.is-recording {
    animation: none;
  }
}

/* Tab bar on every viewport, sticky so switching modules is always at hand. */
.synth-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 0.75rem 0;
  background: var(--color-background);

  @include md {
    grid-column: 1;
    grid-row: 2;
  }
}

.synth-tab {
  flex: 1 1 auto;
  min-width: 4rem;
  padding: 0.6rem 0.5rem;
  color: var(--color-text);
  background-color: var(--color-background-mute);
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s, border-color 0.3s, color 0.3s;
}

.synth-tab:hover {
  border-color: var(--grey-soft);
}

.synth-tab.is-active {
  color: var(--color-heading);
  border-color: var(--blue);
}

.synth-panels {
  display: grid;

  @include md {
    grid-column: 1;
    grid-row: 3;
    align-content: start;
  }
}

/* All panels share one grid cell, so the container always has the height of
   the tallest panel and the page never jumps when switching tabs. */
.synth-panel {
  grid-area: 1 / 1;
  min-width: 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--color-background-mute);
  border-radius: 8px;
  background: var(--color-background-soft);
}

/* Only the active panel is visible (and interactive); visibility keeps the
   hidden panels' height in the layout, unlike display: none. */
.synth-panel:not(.is-active) {
  visibility: hidden;
}
</style>
