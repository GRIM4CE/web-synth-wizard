// useEnvelope.ts
import { ref } from 'vue';
import type { Ref } from 'vue';
import type { VcaEnvelope, FilterEnvelope } from "@/types"; // Adjust the import path as necessary

const FLOOR = 0.0001

export const useEnvelope = () => {
  // Note-on for the amplifier: ramp up through attack to the peak, then decay to
  // the sustain level and HOLD there. The release is deliberately not scheduled
  // here so a held note (or a run of contiguous sequencer steps) sustains
  // continuously instead of decaying to silence between steps.
  const triggerAttack = (gainNode: GainNode, audioContext: AudioContext, envelope: Ref<VcaEnvelope>) => {
    const gain = Number(envelope.value.gain)
    // Convert ms to seconds for Web Audio API scheduling
    const attack = Number(envelope.value.attack) / 1000
    const decay = Number(envelope.value.decay) / 1000
    const sustain = Number(envelope.value.sustain)

    const now = audioContext.currentTime

    // Peak level reached at the end of the attack phase
    const peak = Math.max(gain, FLOOR)
    // Sustain is a 0..1 fraction of the peak level, not an absolute gain
    const sustainLevel = Math.max(sustain * peak, FLOOR)

    // Attack always begins from silence. triggerAttack only ever runs from a
    // silent state (the first note, or a note after a rest's release), so anchoring
    // to the floor here avoids depending on the gain node's default value of 1 —
    // which would otherwise blast the first note at full volume during its attack.
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(FLOOR, now)

    // Attack: ramp up to the peak level
    gainNode.gain.exponentialRampToValueAtTime(peak, now + attack)
    // Decay: ramp down to the sustain level and hold
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel, now + attack + decay)
  }

  // Note-off for the amplifier: ramp from the current level down to silence over
  // the release time. Returns the release time in ms so the caller can schedule
  // any teardown after the tail has finished.
  const triggerRelease = (gainNode: GainNode, audioContext: AudioContext, envelope: Ref<VcaEnvelope>) => {
    const release = Number(envelope.value.release) / 1000
    const now = audioContext.currentTime

    const current = Math.max(gainNode.gain.value, FLOOR)
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(current, now)
    gainNode.gain.exponentialRampToValueAtTime(FLOOR, now + release)

    return release * 1000
  }

  // Note-on for the filter cutoff: sweep up to the peak frequency, then settle to
  // the sustain frequency and hold.
  const triggerFilterAttack = (filter: BiquadFilterNode, audioContext: AudioContext, envelope: Ref<FilterEnvelope>) => {
    const attack = Number(envelope.value.attack) / 1000
    const decay = Number(envelope.value.decay) / 1000
    const sustain = Number(envelope.value.sustain)
    const frequency = Number(envelope.value.frequency)
    const maxFrequency = Number(envelope.value.maxFrequency)

    const now = audioContext.currentTime

    const base = Math.max(frequency, FLOOR)
    const peak = Math.max(maxFrequency, FLOOR)
    const sustainFrequency = Math.max(frequency + (maxFrequency - frequency) * sustain, FLOOR)

    filter.frequency.cancelScheduledValues(now)
    filter.frequency.setValueAtTime(base, now)
    filter.frequency.exponentialRampToValueAtTime(peak, now + attack)
    filter.frequency.exponentialRampToValueAtTime(sustainFrequency, now + attack + decay)
  }

  // Note-off for the filter cutoff: ramp back down to the base frequency.
  const triggerFilterRelease = (filter: BiquadFilterNode, audioContext: AudioContext, envelope: Ref<FilterEnvelope>) => {
    const release = Number(envelope.value.release) / 1000
    const frequency = Number(envelope.value.frequency)
    const now = audioContext.currentTime

    const base = Math.max(frequency, FLOOR)
    const current = Math.max(filter.frequency.value, FLOOR)
    filter.frequency.cancelScheduledValues(now)
    filter.frequency.setValueAtTime(current, now)
    filter.frequency.exponentialRampToValueAtTime(base, now + release)
  }

  const createEnvelope = (envelopeSettings: VcaEnvelope | FilterEnvelope, type: "vca" | "filter") => {
    const envelope = ref<VcaEnvelope | FilterEnvelope>({
        ...envelopeSettings
    });

    if(type === "vca") {
      return {
          envelope,
          triggerAttack,
          triggerRelease,
      }
    }
    if(type === "filter") {
      return {
          envelope,
          triggerAttack: triggerFilterAttack,
          triggerRelease: triggerFilterRelease,
      }
    }
  }

  return { createEnvelope };
};
