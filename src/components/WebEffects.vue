<script lang="ts" setup>
import { watch } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'
import DSlider from './DSlider.vue'
import DCheckbox from './DCheckbox.vue'
import type { FxId } from '@/types'

const {
  delayEnabled,
  delaySettings,
  applyDelaySettings,
  reverbEnabled,
  reverbSettings,
  applyReverbSettings,
  compressorEnabled,
  compressorSettings,
  applyCompressorSettings,
  fxChainOrder,
  applyFxChainOrder
} = useAudioContext()

const fxLabels: Record<FxId, string> = {
  delay: 'Delay',
  reverb: 'Reverb',
  compressor: 'Compressor'
}

const fxEnabled: Record<FxId, typeof delayEnabled> = {
  delay: delayEnabled,
  reverb: reverbEnabled,
  compressor: compressorEnabled
}

// Move an effect one slot earlier/later in the chain. The signal passes
// through the stages in this order, so reordering is audible (e.g. delay into
// reverb echoes each repeat's tail; reverb into delay echoes the whole wash).
const moveFx = (index: number, direction: -1 | 1) => {
  const target = index + direction
  if (target < 0 || target >= fxChainOrder.value.length) return
  const order = [...fxChainOrder.value]
  ;[order[index], order[target]] = [order[target], order[index]]
  fxChainOrder.value = order
}

// Settings live in the shared manager so they survive synth restarts; every
// change is pushed onto the live nodes (a no-op until the synth is activated,
// after which initSynth re-applies the stored settings itself).
watch([delayEnabled, delaySettings], () => applyDelaySettings(), { deep: true })
watch([reverbEnabled, reverbSettings], () => applyReverbSettings(), { deep: true })
watch([compressorEnabled, compressorSettings], () => applyCompressorSettings(), { deep: true })
watch(fxChainOrder, () => applyFxChainOrder())
</script>

<template>
  <div class="web-effects">
    <h2>FX - Effects</h2>

    <!-- The chain: signal flows left to right through every enabled effect. -->
    <div class="web-effects-chain" role="list" aria-label="Effects chain order">
      <template v-for="(id, index) in fxChainOrder" :key="id">
        <span class="web-effects-chain-arrow" v-if="index > 0" aria-hidden="true">→</span>
        <div class="web-effects-chain-slot" :class="{ 'is-on': fxEnabled[id].value }" role="listitem">
          <button
            type="button"
            class="web-effects-chain-move"
            :aria-label="`Move ${fxLabels[id]} earlier in the chain`"
            :disabled="index === 0"
            @click="moveFx(index, -1)"
          >
            ◀
          </button>
          <span>{{ fxLabels[id] }}</span>
          <button
            type="button"
            class="web-effects-chain-move"
            :aria-label="`Move ${fxLabels[id]} later in the chain`"
            :disabled="index === fxChainOrder.length - 1"
            @click="moveFx(index, 1)"
          >
            ▶
          </button>
        </div>
      </template>
    </div>

    <div class="web-effects-units">
      <div class="web-effects-unit" v-for="id in fxChainOrder" :key="id">
        <div class="web-effects-power">
          <label :for="`${id}-enabled`">{{ fxLabels[id] }}: {{ fxEnabled[id].value ? 'On' : 'Off' }}</label>
          <DCheckbox :id="`${id}-enabled`" :aria-label="`Enable ${fxLabels[id]}`" v-model="fxEnabled[id].value" />
        </div>

        <div class="web-effects-slider-wrapper" v-if="id === 'delay' && delayEnabled">
          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="delay-time"
              aria-label="Delay time"
              :min="20"
              :max="1500"
              step="1"
              v-model="delaySettings.time"
            />
            <label for="delay-time">Time</label>
            <span class="web-effects-value">{{ Math.round(delaySettings.time) }}ms</span>
          </div>

          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="delay-feedback"
              aria-label="Delay feedback"
              :min="0"
              :max="0.9"
              step="0.01"
              v-model="delaySettings.feedback"
            />
            <label for="delay-feedback">FB</label>
            <span class="web-effects-value">{{ Math.round(delaySettings.feedback * 100) }}%</span>
          </div>

          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="delay-mix"
              aria-label="Delay mix"
              :min="0"
              :max="1"
              step="0.01"
              v-model="delaySettings.mix"
            />
            <label for="delay-mix">Mix</label>
            <span class="web-effects-value">{{ Math.round(delaySettings.mix * 100) }}%</span>
          </div>
        </div>

        <div class="web-effects-slider-wrapper" v-if="id === 'reverb' && reverbEnabled">
          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="reverb-decay"
              aria-label="Reverb decay"
              :min="100"
              :max="8000"
              step="50"
              v-model="reverbSettings.decay"
            />
            <label for="reverb-decay">Decay</label>
            <span class="web-effects-value">{{ (reverbSettings.decay / 1000).toFixed(1) }}s</span>
          </div>

          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="reverb-mix"
              aria-label="Reverb mix"
              :min="0"
              :max="1"
              step="0.01"
              v-model="reverbSettings.mix"
            />
            <label for="reverb-mix">Mix</label>
            <span class="web-effects-value">{{ Math.round(reverbSettings.mix * 100) }}%</span>
          </div>
        </div>

        <div class="web-effects-slider-wrapper" v-if="id === 'compressor' && compressorEnabled">
          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="compressor-threshold"
              aria-label="Compressor threshold"
              :min="-60"
              :max="0"
              step="1"
              v-model="compressorSettings.threshold"
            />
            <label for="compressor-threshold">Thresh</label>
            <span class="web-effects-value">{{ Math.round(compressorSettings.threshold) }}dB</span>
          </div>

          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="compressor-ratio"
              aria-label="Compressor ratio"
              :min="1"
              :max="20"
              step="0.5"
              v-model="compressorSettings.ratio"
            />
            <label for="compressor-ratio">Ratio</label>
            <span class="web-effects-value">{{ compressorSettings.ratio }}:1</span>
          </div>

          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="compressor-attack"
              aria-label="Compressor attack"
              :min="0"
              :max="200"
              step="1"
              v-model="compressorSettings.attack"
            />
            <label for="compressor-attack">Atk</label>
            <span class="web-effects-value">{{ Math.round(compressorSettings.attack) }}ms</span>
          </div>

          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="compressor-release"
              aria-label="Compressor release"
              :min="10"
              :max="1000"
              step="5"
              v-model="compressorSettings.release"
            />
            <label for="compressor-release">Rel</label>
            <span class="web-effects-value">{{ Math.round(compressorSettings.release) }}ms</span>
          </div>

          <div class="web-effects-slider">
            <DSlider
              orient="vertical"
              id="compressor-makeup"
              aria-label="Compressor makeup gain"
              :min="0"
              :max="12"
              step="0.5"
              v-model="compressorSettings.makeup"
            />
            <label for="compressor-makeup">Gain</label>
            <span class="web-effects-value">+{{ compressorSettings.makeup }}dB</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.web-effects {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.web-effects-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  max-width: 100%;
}

.web-effects-chain-slot {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.4rem;
  font-size: 13px;
  border: 2px solid var(--grey-soft);
  border-radius: 4px;
  opacity: 0.6;
}

.web-effects-chain-slot.is-on {
  border-color: var(--blue);
  color: var(--color-heading);
  opacity: 1;
}

.web-effects-chain-move {
  padding: 0 0.2rem;
  font-size: 11px;
  color: var(--color-text);
  background: transparent;
  border: none;
  cursor: pointer;
}

.web-effects-chain-move:disabled {
  opacity: 0.3;
  cursor: default;
}

.web-effects-chain-arrow {
  font-size: 13px;
  opacity: 0.6;
}

.web-effects-units {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 1rem 2rem;
  max-width: 100%;
}

.web-effects-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.web-effects-power {
  display: flex;
  align-items: center;
  justify-content: center;
  column-gap: 0.5rem;
}

.web-effects-slider-wrapper {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem 1.5rem;
  max-width: 100%;
}

.web-effects-slider {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.web-effects-value {
  font-size: 12px;
  color: var(--color-heading);
}
</style>
