import { ref } from 'vue'
import type { SynthPreset } from '@/types'
import { useAudioContext } from './useAudioContext'

// Presets are persisted through this minimal storage interface. Today it is
// backed by localStorage (per-browser); pointing it at a real backend later
// (e.g. an Amplify/AppSync or Supabase table shared by all users) only means
// swapping these two functions for async API calls.
const STORAGE_KEY = 'web-synth-wizard-presets'
const LAST_PRESET_KEY = 'web-synth-wizard-last-preset'

function readStoredPresets(): SynthPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStoredPresets(presets: SynthPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  } catch {
    // Storage may be unavailable (private browsing, quota); presets then only
    // live for the session.
  }
}

const presets = ref<SynthPreset[]>(readStoredPresets())
const selectedPresetName = ref<string>('')

export const usePresets = () => {
  const {
    clock,
    timeDivision,
    oscillatorSettings,
    selectedMusicalKey,
    selectedOctave,
    quantize,
    filterEnabled,
    filterEnvelopeEnabled,
    filterSettings,
    filterEnvelope,
    vcaEnvelope,
    delayEnabled,
    delaySettings,
    applyDelaySettings,
    lfoSettings,
    applyLfoSettings,
    applyPulseWidth,
    applyVoiceSettings,
    steps
  } = useAudioContext()

  const snapshotCurrentSettings = (name: string): SynthPreset => ({
    name,
    clock: clock.value,
    timeDivision: timeDivision.value,
    oscillatorSettings: { ...oscillatorSettings.value },
    selectedMusicalKey: selectedMusicalKey.value,
    selectedOctave: selectedOctave.value,
    quantize: Boolean(quantize.value),
    filterEnabled: filterEnabled.value,
    filterEnvelopeEnabled: filterEnvelopeEnabled.value,
    filterSettings: { ...filterSettings.value },
    filterEnvelope: { ...filterEnvelope.envelope.value },
    vcaEnvelope: { ...vcaEnvelope.envelope.value },
    delayEnabled: delayEnabled.value,
    delaySettings: { ...delaySettings.value },
    lfos: lfoSettings.value.map((lfo) => ({ ...lfo })),
    steps: steps.value.map((step) => ({ ...step }))
  })

  const savePreset = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const preset = snapshotCurrentSettings(trimmed)
    const existingIndex = presets.value.findIndex((p) => p.name === trimmed)
    if (existingIndex >= 0) {
      presets.value.splice(existingIndex, 1, preset)
    } else {
      presets.value.push(preset)
    }
    writeStoredPresets(presets.value)
    selectedPresetName.value = trimmed
    try {
      localStorage.setItem(LAST_PRESET_KEY, trimmed)
    } catch {
      // Non-fatal: auto-restore just won't happen next visit.
    }
  }

  const applyPreset = (name: string) => {
    const preset = presets.value.find((p) => p.name === name)
    if (!preset) return

    clock.value = preset.clock
    timeDivision.value = preset.timeDivision
    // Presets saved before pulse width / the voice engine existed default to a
    // symmetric square on the oscillator engine; voice tone controls added
    // later default to the classic pluck (raw noise burst, no dispersion).
    oscillatorSettings.value = {
      ...preset.oscillatorSettings,
      pulseWidth: preset.oscillatorSettings.pulseWidth ?? 0.5,
      engine: preset.oscillatorSettings.engine ?? 'oscillator',
      resonatorModel: preset.oscillatorSettings.resonatorModel ?? 'string',
      damping: preset.oscillatorSettings.damping ?? 0.5,
      structure: preset.oscillatorSettings.structure ?? 0,
      brightness: preset.oscillatorSettings.brightness ?? 1,
      position: preset.oscillatorSettings.position ?? 0
    }
    applyPulseWidth()
    applyVoiceSettings()
    selectedMusicalKey.value = preset.selectedMusicalKey
    selectedOctave.value = preset.selectedOctave
    quantize.value = preset.quantize
    filterEnabled.value = preset.filterEnabled
    filterEnvelopeEnabled.value = preset.filterEnvelopeEnabled
    // Mutate in place so component watchers on individual fields fire and push
    // the new values onto any live audio nodes.
    Object.assign(filterSettings.value, preset.filterSettings)
    Object.assign(filterEnvelope.envelope.value, preset.filterEnvelope)
    Object.assign(vcaEnvelope.envelope.value, preset.vcaEnvelope)
    delayEnabled.value = preset.delayEnabled
    Object.assign(delaySettings.value, preset.delaySettings)
    applyDelaySettings()
    // Presets saved before LFOs existed have no lfos entry; leave current state.
    if (preset.lfos) {
      lfoSettings.value.forEach((lfo, index) => {
        // Presets saved before clock sync existed lack sync/syncSteps; reset
        // those to free-running defaults so stale state doesn't bleed through.
        if (preset.lfos && preset.lfos[index]) {
          Object.assign(lfo, { sync: false, syncSteps: 1 }, preset.lfos[index])
        }
      })
      applyLfoSettings()
    }
    steps.value = preset.steps.map((step) => ({ ...step }))

    selectedPresetName.value = preset.name
    try {
      localStorage.setItem(LAST_PRESET_KEY, preset.name)
    } catch {
      // Non-fatal: auto-restore just won't happen next visit.
    }
  }

  const deletePreset = (name: string) => {
    presets.value = presets.value.filter((p) => p.name !== name)
    writeStoredPresets(presets.value)
    if (selectedPresetName.value === name) {
      selectedPresetName.value = ''
      try {
        localStorage.removeItem(LAST_PRESET_KEY)
      } catch {
        // Non-fatal.
      }
    }
  }

  // Re-apply the last used preset so settings persist across page reloads.
  const restoreLastPreset = () => {
    try {
      const last = localStorage.getItem(LAST_PRESET_KEY)
      if (last) applyPreset(last)
    } catch {
      // Non-fatal.
    }
  }

  return { presets, selectedPresetName, savePreset, applyPreset, deletePreset, restoreLastPreset }
}
