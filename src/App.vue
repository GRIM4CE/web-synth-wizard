<script setup lang="ts">
  import { ref } from 'vue'
  import WebVCO from './components/WebVCO.vue';
  import WebVCF from './components/WebVCF.vue';
  import WebVCA from './components/WebVCA.vue';
  import WebClock from './components/WebClock.vue';
  import WebSequencer from './components/WebSequencer.vue';
  import WebOscilloscope from './components/WebOscilloscope.vue';
  import WebEffects from './components/WebEffects.vue';
  import { useAudioContext } from "@/composables/useAudioContext"
  import logoPng from './assets/logo.png'
  import logoWebp from './assets/logo.webp'

  const { startAudioContext, suspendAudioContext } = useAudioContext()
  const canUseAudioContext = 'AudioContext' in window

  // Tabbed cards (mobile only). On desktop every panel is shown at once, so the
  // tab bar is hidden via CSS and the active tab only drives the mobile view.
  const tabs = [
    { id: 'clock', label: 'Clock' },
    { id: 'sequencer', label: 'Sequencer' },
    { id: 'vco', label: 'VCO' },
    { id: 'vcf', label: 'VCF' },
    { id: 'vca', label: 'VCA' },
    { id: 'fx', label: 'FX' }
  ]

  const activeTab = ref('clock')
  const tabRefs = ref<HTMLButtonElement[]>([])

  const onTabKeydown = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + direction + tabs.length) % tabs.length
    activeTab.value = tabs[nextIndex].id
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
        </div>
      </div>

      <div class="main-head-scope">
        <WebOscilloscope />
      </div>
    </section>

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
        @click="activeTab = tab.id"
        @keydown="onTabKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section
      class="section synth-panel"
      :class="{ 'is-active': activeTab === 'clock' }"
      id="panel-clock"
      role="tabpanel"
      aria-labelledby="tab-clock"
    >
       <WebClock />
    </section>
    <section
      class="section web-sequencer synth-panel"
      :class="{ 'is-active': activeTab === 'sequencer' }"
      id="panel-sequencer"
      role="tabpanel"
      aria-labelledby="tab-sequencer"
    >
       <WebSequencer />
    </section>
    <section
      class="section synth-panel"
      :class="{ 'is-active': activeTab === 'vco' }"
      id="panel-vco"
      role="tabpanel"
      aria-labelledby="tab-vco"
    >
      <WebVCO/>
    </section>
    <section
      class="section synth-panel"
      :class="{ 'is-active': activeTab === 'vcf' }"
      id="panel-vcf"
      role="tabpanel"
      aria-labelledby="tab-vcf"
    >
      <WebVCF/>
    </section>
    <section
      class="section synth-panel"
      :class="{ 'is-active': activeTab === 'vca' }"
      id="panel-vca"
      role="tabpanel"
      aria-labelledby="tab-vca"
    >
      <WebVCA/>
    </section>
    <section
      class="section web-effects-panel synth-panel"
      :class="{ 'is-active': activeTab === 'fx' }"
      id="panel-fx"
      role="tabpanel"
      aria-labelledby="tab-fx"
    >
      <WebEffects/>
    </section>
  </main>
</template>

<style scoped lang="scss">
.container { 
  max-width: 1024px;
  width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  padding: 2rem;
  align-content: center;
}

.main-container {
  row-gap: 1rem;

  @include md {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    column-gap: 2rem;
  }
}

.main-disabled-container {
  display: grid;
  height: calc(100vh - 4rem);
  text-align: center;
  align-content: center;
  padding: 2rem;
}

.web-sequencer {
  @include md {
    grid-column: span 2;
  }
}

.web-effects-panel {
  @include md {
    grid-column: span 3;
  }
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
    grid-column: span 3;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: 2rem;
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

/* Tabbed cards — mobile only. Hidden on desktop where the grid shows everything. */
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
    display: none;
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

/* Below the md breakpoint (48rem) show only the active panel, styled as a card. */
@media (max-width: 47.99rem) {
  .synth-panel {
    padding: 1.25rem 1rem;
    border: 1px solid var(--color-background-mute);
    border-radius: 8px;
    background: var(--color-background-soft);
  }

  .synth-panel:not(.is-active) {
    display: none;
  }
}
</style>
