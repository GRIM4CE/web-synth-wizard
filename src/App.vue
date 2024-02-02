<script setup lang="ts">
  import WebVCO from './components/WebVCO.vue';
  import WebVCF from './components/WebVCF.vue';
  import WebVCA from './components/WebVCA.vue';
  import WebClock from './components/WebClock.vue';
  import WebSequencer from './components/WebSequencer.vue';
  import { useAudioContext } from "@/composables/useAudioContext"

  const { startAudioContext, suspendAudioContext } = useAudioContext()
</script>

<template>
  <div class="main-container-mobile">
    <img alt="Web Synth Wizard logo"  class="logo" src="./assets/logo.png" width="125" height="125" />
    <h2>Web Synth Wizard</h2>
    <p>Due to limited support for AudioContext on mobile this application is intended to be used on desktop computer.</p>
  </div>

  <main class="main-container container">
  <!-- <div class="main-container container" v-if="activeSynth"> -->
    <section class="section main-head">
      <img alt="Web Synth Wizard logo" class="logo" src="./assets/logo.png" width="125" height="125" />
      <div class="wrapper">
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
  display: none;

  @include md {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    column-gap: 2rem;
  }
}

.main-container-mobile {
  display: grid;
  height: calc(100vh - 4rem);
  text-align: center;
  align-content: center;
  padding: 2rem;
  @include md {
    display: none;
  }
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
  justify-content: center;
  align-content: center;

  @include md {
    grid-column: span 3;
  }
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

.wrapper {
  display: flex;
  column-gap: 1rem;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}
</style>
