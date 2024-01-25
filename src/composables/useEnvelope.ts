// useEnvelope.ts
import { ref } from 'vue';
import type { Ref } from 'vue';
import type { VcaEnvelope, FilterEnvelope } from "@/types"; // Adjust the import path as necessary

export const useEnvelope = () => {
  const applyVCAEnvelope = (gainNode: GainNode, audioContext: AudioContext, envelope: Ref<VcaEnvelope>) => {
    const gain = Number(envelope.value.gain)
    const attack = Number(envelope.value.attack)
    const decay = Number(envelope.value.decay)
    const sustain = Number(envelope.value.sustain)
    const release = Number(envelope.value.release)

    const duration = attack + decay + release

    const now = audioContext.currentTime;

    gainNode.gain.setValueAtTime(gain, now);

    // Use exponential ramp for attack phase if gain is not very low
    if (gain > 0.0001) {
      gainNode.gain.exponentialRampToValueAtTime(gain, now + attack);
    } else {
      gainNode.gain.linearRampToValueAtTime(0, now + attack);
    }
    
    const sustainLevel = Math.max(sustain, 0.0001);
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel, now + attack + decay);

    // Schedule the release
    gainNode.gain.setValueAtTime(sustainLevel, now + duration - release);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    
    return duration
  };

  const applyFilterEnvelope = (filter: BiquadFilterNode, audioContext: AudioContext, envelope: Ref<FilterEnvelope>) => {
    const attack = Number(envelope.value.attack)
    const decay = Number(envelope.value.decay)
    const sustain = Number(envelope.value.sustain)
    const release = Number(envelope.value.release)
    const peakFrequency = Number(envelope.value.peakFrequency)
    const baseFrequency = Number(envelope.value.baseFrequency)


    const now = audioContext.currentTime;

    filter.frequency.setValueAtTime(baseFrequency, now);

    // Attack: Ramp to peak frequency
    filter.frequency.linearRampToValueAtTime(peakFrequency, now + attack);
  
    // Decay: Ramp down to the sustain level
    const sustainFrequency = baseFrequency + (peakFrequency - baseFrequency) * sustain;
    filter.frequency.linearRampToValueAtTime(sustainFrequency, now + attack + decay);
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