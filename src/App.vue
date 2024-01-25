<script setup lang="ts">
  import WebVCO from './components/WebVCO.vue';
  import WebVCF from './components/WebVCF.vue';
  import WebVCA from './components/WebVCA.vue';
  import WebClock from './components/WebClock.vue';
  import WebSequencer from './components/WebSequencer.vue';
  import { useAudioContext } from "@/composables/useAudioContext"

  const { activeSynth, startAudioContext, suspendAudioContext } = useAudioContext()
</script>

<template>
  <!-- <main class="init-container container" v-if="!activeSynth">
    <img alt="Vue logo" class="logo" src="./assets/logo.png" width="125" height="125" />
    <button class="button" @click="startAudioContext()">Activate Synth</button>
  </main> -->

  <main class="main-container container">
  <!-- <div class="main-container container" v-if="activeSynth"> -->
    <section class="main-section1">
       <WebClock />
    </section>
    <section class="main-section2">
       <WebSequencer />
    </section>
    <aside class="main-aside">
      <img alt="Vue logo" class="logo" src="./assets/logo.png" width="125" height="125" />
      <div class="wrapper">
        <button class="button" @click="startAudioContext()">Activate Synth</button>
        <button class="button stop-button" @click="suspendAudioContext()">Stop Synth</button>
      </div>
    </aside>
    <section class="main-section3">
      <WebVCO/>
      <WebVCF/>
      <WebVCA/>
    </section>

  </main>
</template>

<style scoped>
.container { 
  display: grid;
  max-width: 1024px;
  width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  padding: 2rem;
  align-content: center;
}

.main-container {
  grid-template-columns: 1fr 2fr;
  row-gap: 2rem;
  column-gap: 2rem;
}


.main-section1 {
  grid-column: 1;

}
.main-section2 {
  grid-column: 2;
  grid-row: 1;
}

.main-aside {
  display: grid;
  grid-column: 1;
  justify-content: center;
  align-content: center;
}


.main-section3 {
  grid-column: 2;
  grid-row: 2;
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
