<script setup lang="ts">
  import WebVCO from './components/WebVCO.vue';
  import WebVCF from './components/WebVCF.vue';
  import WebVCA from './components/WebVCA.vue';
  import WebClock from './components/WebClock.vue';
  import WebSequencer from './components/WebSequencer.vue';
  import { useAudioContext } from "@/composables/useAudioContext"

  const { startAudioContext, suspendAudioContext } = useAudioContext()
  const canUseAudioContext = 'AudioContext' in window
</script>

<template>
  <main class="main-disabled-container" v-if="!canUseAudioContext">
    <img alt="Web Synth Wizard logo"  class="logo" src="./assets/logo.png" width="125" height="125" />
    <h2>Web Synth Wizard</h2>
    <p>Unfortunately, your current device or browser does not support Web Audio API's AudioContext, a crucial feature which the application heavily relies on. We recommend using a desktop computer with Firefox for the best experience. We apologize for the inconvenience and are looking forward to having you create with Web Synth Wizard on a compatible setup.</p>
  </main>

  <main class="main-container container" v-else>
    <section class="section main-head">
      <img alt="Web Synth Wizard logo" class="logo" src="./assets/logo.png" width="125" height="125" />
      <p class="main-head-callout-text">This project is currently under active development to enhance its features and improve user experience. For the best experience, I'd recommend using Firefox, as it provides the most stable and compatible environment for our project's functionalities. While other browsers may also work, you might encounter some differences in performance or layout.</p>

      <div class="utility-button-wrapper">
        <button class="button" @click="startAudioContext()">Activate Synth</button>
        <button class="button stop-button" @click="suspendAudioContext()">Stop Synth</button>
      </div>
    </section>

    <section class="section">
       <WebClock />
    </section>
    <section class="section web-sequencer">
       <WebSequencer />
    </section>
    <section class="section">
      <WebVCO/>
    </section>
    <section class="section">
      <WebVCF/>
    </section>
    <section class="section">
      <WebVCA/>
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

.section {
  text-align: center;
}

.main-head {
  display: grid;
  text-align: center;
  justify-content: center;
  align-content: center;

  @include md {
    grid-column: span 3;
  }
}

.logo {
  display: block;
  margin: 0 auto 0rem;
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
</style>
