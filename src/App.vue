<script setup lang="ts">
  import WebVCO from './components/WebVCO.vue';
  import WebVCA from './components/WebVCA.vue';
  import { useAudioContext } from "@/composables/useAudioContext"

  const { activeSynth, startAudioContext, suspendAudioContext } = useAudioContext()
</script>

<template>
  <div class="init-container container" v-if="!activeSynth">
    <img alt="Vue logo" class="logo" src="./assets/logo.png" width="125" height="125" />
    <button class="button" @click="startAudioContext()">Activate Synth</button>
  </div>

  <!-- <div class="main-container container"> -->
  <div class="main-container container" v-if="activeSynth">
    <aside class="main-aside">
      <img alt="Vue logo" class="logo" src="./assets/logo.png" width="125" height="125" />
      <div class="wrapper">
        <button class="button" @click="startAudioContext()">Activate Synth</button>
        <button class="button stop-button" @click="suspendAudioContext()">Stop Synth</button>
      </div>
    </aside>
    <main>
      <WebVCO/>
      <WebVCA/>
    </main>
  </div>
</template>

<style scoped>
.container { 
  display: grid;
  max-width: 1024px;
  width: 100%;
  height: 100vh;
  margin: 0 auto;
  padding: 2rem;
  align-content: center;
}

.init-container {
  justify-content: center;
}

.main-container {
  grid-template-columns: 1fr 2fr;
}

.main-aside {
  display: grid;
  justify-content: center;
  align-content: center;
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
