<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { MIN_STEPS, MAX_STEPS } from '@/composables/useSequencer'
import { frequencyToNoteName } from '@/utils/config'
import DSlider from './DSlider.vue'
import DCheckbox from './DCheckbox.vue'
import type { SequencerMode } from '@/types'

const {
  steps,
  quantize,
  sequencerMode,
  turingProbability,
  turingSteps,
  setTuringLength,
  noteOn,
  noteOff,
  liveNoteFrequency,
  stepFrequency,
  setStepCount,
  randomizeNotes,
  randomizeGates,
  randomizeSteps
} = useAudioContext()

const modes: { id: SequencerMode, label: string }[] = [
  { id: 'steps', label: 'Steps' },
  { id: 'keyboard', label: 'Keyboard / MIDI' },
  { id: 'turing', label: 'Turing' }
]

const modeTabRefs = ref<HTMLButtonElement[]>([])

const onModeKeydown = (event: KeyboardEvent, index: number) => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  const direction = event.key === 'ArrowRight' ? 1 : -1
  const nextIndex = (index + direction + modes.length) % modes.length
  sequencerMode.value = modes[nextIndex].id
  modeTabRefs.value[nextIndex]?.focus()
}

// --- Step grid ---

const stepCount = computed({
  get: () => steps.value.length,
  set: (count: number) => setStepCount(count)
})

// Label each step with what it will actually play: the note name while the
// quantizer decides the pitch, the raw frequency otherwise.
const stepLabel = (note: number) => {
  const frequency = stepFrequency(note)
  return quantize.value ? frequencyToNoteName(frequency) : `${Math.round(frequency)}Hz`
}

// --- Turing machine ---

const turingLengths = [2, 4, 8, 16, 32, 64]

const onTuringLengthChange = (event: Event) => {
  setTuringLength(Number((event.target as HTMLSelectElement).value))
}

// --- Live play (computer keyboard + MIDI) ---

// Classic tracker/DAW mapping: the home row walks up chromatically from the
// VCO's key/octave, with the row above filling in between.
const KEY_TO_SEMITONE: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8,
  h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16
}

// MIDI note ids share the mono voice with keyboard ids; offset them so a MIDI
// note number can never collide with a computer-key semitone.
const MIDI_ID_OFFSET = 1000

// Everything this component is currently holding down, so it can all be
// released when the mode changes, the window blurs, or the component unmounts.
const liveIds = new Set<number>()
const lastPlayed = ref('')

const playLiveNote = (id: number, frequency: number) => {
  liveIds.add(id)
  noteOn(id, frequency)
  lastPlayed.value = frequencyToNoteName(frequency)
}

const releaseLiveNote = (id: number) => {
  liveIds.delete(id)
  noteOff(id)
}

const releaseAllLiveNotes = () => {
  liveIds.forEach((id) => noteOff(id))
  liveIds.clear()
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
  const semitone = KEY_TO_SEMITONE[event.key.toLowerCase()]
  if (semitone === undefined) return
  event.preventDefault()
  playLiveNote(semitone, liveNoteFrequency(semitone))
}

const onKeyUp = (event: KeyboardEvent) => {
  const semitone = KEY_TO_SEMITONE[event.key.toLowerCase()]
  if (semitone === undefined) return
  releaseLiveNote(semitone)
}

const midiStatus = ref<'unsupported' | 'idle' | 'connected' | 'error'>(
  'requestMIDIAccess' in navigator ? 'idle' : 'unsupported'
)
let midiAccess: MIDIAccess | null = null

// lib.dom types onmidimessage as a plain Event handler; narrow to reach .data.
const onMidiMessage = (event: Event) => {
  const data = (event as MIDIMessageEvent).data
  if (sequencerMode.value !== 'keyboard' || !data) return
  const [status, note, velocity] = data
  const command = status & 0xf0
  const id = MIDI_ID_OFFSET + note
  if (command === 0x90 && velocity > 0) {
    playLiveNote(id, 440 * Math.pow(2, (note - 69) / 12))
  } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    releaseLiveNote(id)
  }
}

const attachMidiInputs = () => {
  if (!midiAccess) return
  midiAccess.inputs.forEach((input) => {
    input.onmidimessage = onMidiMessage
  })
}

const connectMidi = async () => {
  if (midiAccess || midiStatus.value === 'unsupported') return
  try {
    midiAccess = await navigator.requestMIDIAccess()
    // Newly plugged-in controllers should start working without a refresh.
    midiAccess.onstatechange = attachMidiInputs
    attachMidiInputs()
    midiStatus.value = 'connected'
  } catch {
    midiStatus.value = 'error'
  }
}

const midiStatusLabel = computed(() => {
  switch (midiStatus.value) {
    case 'unsupported': return 'not supported by this browser (computer keyboard still works)'
    case 'connected': return 'connected — play your controller'
    case 'error': return 'access denied (computer keyboard still works)'
    default: return 'connecting…'
  }
})

// The component stays mounted while other module tabs are shown, so live play
// keeps working while tweaking the filter — the listeners just follow the mode.
watch(sequencerMode, (mode) => {
  if (mode === 'keyboard') {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAllLiveNotes)
    connectMidi()
  } else {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', releaseAllLiveNotes)
    releaseAllLiveNotes()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', releaseAllLiveNotes)
  releaseAllLiveNotes()
})
</script>

<template>
    <div class="web-sequencer">
        <h2>Sequencer</h2>

        <div class="web-sequencer-modes" role="tablist" aria-label="Sequencer mode">
            <button
                v-for="(mode, index) in modes"
                :key="mode.id"
                ref="modeTabRefs"
                type="button"
                class="web-sequencer-mode"
                :class="{ 'is-active': sequencerMode === mode.id }"
                role="tab"
                :id="`sequencer-mode-${mode.id}`"
                :aria-selected="sequencerMode === mode.id"
                :aria-controls="`sequencer-panel-${mode.id}`"
                :tabindex="sequencerMode === mode.id ? 0 : -1"
                @click="sequencerMode = mode.id"
                @keydown="onModeKeydown($event, index)"
            >
                {{ mode.label }}
            </button>
        </div>

        <div
            v-if="sequencerMode === 'steps'"
            class="web-sequencer-panel"
            id="sequencer-panel-steps"
            role="tabpanel"
            aria-labelledby="sequencer-mode-steps"
        >
            <div class="web-sequencer-controls">
                <div class="web-sequencer-count">
                    <label for="step-count">Steps: {{ stepCount }}</label>
                    <DSlider
                        type="range"
                        :min="MIN_STEPS"
                        :max="MAX_STEPS"
                        step="1"
                        id="step-count"
                        aria-label="Number of steps"
                        v-model="stepCount"
                    />
                </div>
                <div class="web-sequencer-buttons">
                    <button type="button" class="web-sequencer-button" @click="randomizeNotes">Randomize notes</button>
                    <button type="button" class="web-sequencer-button" @click="randomizeGates">Randomize on/offs</button>
                    <button type="button" class="web-sequencer-button" @click="randomizeSteps">Randomize both</button>
                </div>
            </div>

            <div class="web-sequencer-steps">
                <div class="web-sequencer-step" v-for="(step, index) in steps" :key="index">
                    <DSlider orient="vertical" :min="0" :max="12" :aria-label="`Step ${index + 1} note`" v-model="step.note"/>
                    <span class="web-sequencer-step-label">{{ stepLabel(step.note) }}</span>
                    <DCheckbox type="checkbox" :id="`check-id-${index}`" :aria-label="`Step ${index + 1} active`" v-model="step.active"/>
                </div>
            </div>
        </div>

        <div
            v-else-if="sequencerMode === 'keyboard'"
            class="web-sequencer-panel"
            id="sequencer-panel-keyboard"
            role="tabpanel"
            aria-labelledby="sequencer-mode-keyboard"
        >
            <p class="web-sequencer-hint">
                Play live with your computer keyboard: <strong>A W S E D F T G Y H U J K O L P ;</strong>
                walks up chromatically from the key and octave set on the VCO. A MIDI controller
                works too — notes are gated by your hands instead of the clock.
            </p>
            <p class="web-sequencer-midi-status">MIDI: {{ midiStatusLabel }}</p>
            <p class="web-sequencer-note-display" aria-live="polite">
                Last note: <strong>{{ lastPlayed || '—' }}</strong>
            </p>
        </div>

        <div
            v-else
            class="web-sequencer-panel"
            id="sequencer-panel-turing"
            role="tabpanel"
            aria-labelledby="sequencer-mode-turing"
        >
            <p class="web-sequencer-hint">
                A looping register of random voltages, Turing machine style. The randomness dial is
                the chance each slot is re-rolled as it plays: 0% locks the loop, 100% is pure noise.
                With Quantize on (VCO panel) voltages snap to notes in the selected key; otherwise
                they play as raw pitches.
            </p>

            <div class="web-sequencer-controls">
                <div class="web-sequencer-count">
                    <label for="turing-probability">Randomness: {{ Math.round(turingProbability * 100) }}%</label>
                    <DSlider
                        type="range"
                        :min="0"
                        :max="1"
                        step="0.01"
                        id="turing-probability"
                        aria-label="Turing machine randomness"
                        v-model="turingProbability"
                    />
                </div>
                <div class="web-sequencer-count">
                    <label for="turing-length">Loop length:</label>
                    <select id="turing-length" :value="turingSteps.length" @change="onTuringLengthChange">
                        <option v-for="length in turingLengths" :key="length" :value="length">{{ length }}</option>
                    </select>
                </div>
            </div>

            <div class="web-sequencer-register" aria-hidden="true">
                <div
                    v-for="(slot, index) in turingSteps"
                    :key="index"
                    class="web-sequencer-register-slot"
                    :class="{ 'is-on': slot.gate }"
                >
                    <div class="web-sequencer-register-fill" :style="{ height: `${Math.round(slot.voltage * 100)}%` }" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.web-sequencer {
    margin: 0 auto;
}

.web-sequencer-modes {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin: 0.5rem 0 1rem;
}

.web-sequencer-mode {
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

.web-sequencer-controls {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
}

.web-sequencer-count {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.web-sequencer-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
}

.web-sequencer-button {
    padding: 0.4rem 0.75rem;
    font-size: 13px;
    color: var(--color-text);
    background: var(--color-background-mute);
    border: 2px solid var(--grey-soft);
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 0.3s, color 0.3s;

    &:hover {
        color: var(--color-heading);
        border-color: var(--blue);
    }
}

.web-sequencer-steps {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
    justify-items: center;
}

.web-sequencer-step {
  margin: 10px 4px;
  display: grid;
  row-gap: .5rem;
  justify-content: center;
  justify-items: center;
}

.web-sequencer-step-label {
    font-size: 11px;
    color: var(--color-text);
    white-space: nowrap;
}

.web-sequencer-hint {
    max-width: 40rem;
    margin: 0 auto 1rem;
    font-size: 14px;
}

.web-sequencer-midi-status {
    font-size: 13px;
    margin-bottom: 0.5rem;
}

.web-sequencer-note-display {
    font-size: 16px;
}

/* Read-only view of the Turing register: bar height is the voltage, lit bars
   are slots whose gate fires. */
.web-sequencer-register {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    gap: 3px;
    height: 80px;
    margin-top: 1rem;
}

.web-sequencer-register-slot {
    position: relative;
    width: 12px;
    height: 100%;
    background: var(--color-background-mute);
    border-radius: 2px;
    overflow: hidden;
}

.web-sequencer-register-fill {
    position: absolute;
    bottom: 0;
    width: 100%;
    background: var(--grey-soft);
    opacity: 0.6;
}

.web-sequencer-register-slot.is-on .web-sequencer-register-fill {
    background: var(--blue);
    opacity: 1;
}
</style>
