// useEnvelope.ts
import { ref } from 'vue';
import type { Ref } from 'vue';
import type { VcaEnvelope, FilterEnvelope } from "@/types"; // Adjust the import path as necessary

export const useEnvelope = () => {
  const applyVCAEnvelope = (gainNode: GainNode, audioContext: AudioContext, envelope: Ref<VcaEnvelope>) => {
    const gain = Number(envelope.value.gain)
    // Convert ms to seconds for Web Audio API scheduling
    const attack = Number(envelope.value.attack) / 1000
    const decay = Number(envelope.value.decay) / 1000
    const sustain = Number(envelope.value.sustain)
    const release = Number(envelope.value.release) / 1000

    const durationSec = attack + decay + release

    const now = audioContext.currentTime;

    // Peak level reached at the end of the attack phase
    const peak = Math.max(gain, 0.0001)
    // Sustain is a 0..1 fraction of the peak level, not an absolute gain
    const sustainLevel = Math.max(sustain * peak, 0.0001);

    // Start from near-silence so the attack phase actually ramps up
    gainNode.gain.setValueAtTime(0.0001, now);

    // Attack: ramp up to the peak level
    gainNode.gain.exponentialRampToValueAtTime(peak, now + attack);

    // Decay: ramp down to the sustain level
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel, now + attack + decay);

    // Schedule the release
    gainNode.gain.setValueAtTime(sustainLevel, now + durationSec - release);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    // Return duration in ms for use with setTimeout
    return durationSec * 1000
  };

  const applyFilterEnvelope = (filter: BiquadFilterNode, audioContext: AudioContext, envelope: Ref<FilterEnvelope>) => {
    // Convert ms to seconds for Web Audio API scheduling
    const attack = Number(envelope.value.attack) / 1000
    const decay = Number(envelope.value.decay) / 1000
    const sustain = Number(envelope.value.sustain)
    const release = Number(envelope.value.release) / 1000
    const frequency = Number(envelope.value.frequency)
    const maxFrequency = Number(envelope.value.maxFrequency)

    const durationSec = attack + decay + release

    const now = audioContext.currentTime;

    // Base cutoff the envelope opens from and returns to (exponential ramps need a positive floor)
    const base = Math.max(frequency, 0.0001)
    const peak = Math.max(maxFrequency, 0.0001)

    filter.frequency.setValueAtTime(base, now);

    // Attack: Ramp to peak frequency
    filter.frequency.exponentialRampToValueAtTime(peak, now + attack);

    // Decay: Ramp down to the sustain level
    const sustainFrequency = Math.max(frequency + (maxFrequency - frequency) * sustain, 0.0001);
    filter.frequency.exponentialRampToValueAtTime(sustainFrequency, now + attack + decay);

     // Release: ramp the cutoff back down to the base frequency
     filter.frequency.setValueAtTime(sustainFrequency, now + durationSec - release);
     filter.frequency.exponentialRampToValueAtTime(base, now + durationSec);
  }

  const createEnvelope = (envelopeSettings: VcaEnvelope | FilterEnvelope, type: "vca" | "filter") => {
    const envelope = ref<VcaEnvelope | FilterEnvelope>({
        ...envelopeSettings
    });

    if(type === "vca") {
      return {
          envelope,
          applyVCAEnvelope,
      }
    }
    if(type === "filter") {
      return {
          envelope,
          applyFilterEnvelope,
      }
    }
  }

  return { createEnvelope };
};