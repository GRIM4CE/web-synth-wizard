// useEnvelope.ts
import { ref } from 'vue';
import type { Envelope, VcaEnvelope } from "@/types"; // Adjust the import path as necessary

export const useEnvelope = () => {
  const applyEnvelope = (gainNode: GainNode, audioContext: AudioContext, duration: number, envelope: VcaEnvelope) => {
    const now = audioContext.currentTime;
    const { attack, decay, sustain, release, gain } = envelope;

    gainNode.gain.setValueAtTime(gain, now);

    // Use exponential ramp for attack phase if gain is not very low
    if (gain > 0.0001) {
      gainNode.gain.exponentialRampToValueAtTime(1, now + attack);
    } else {
      // If gain is too low, start with a linear ramp to avoid errors with exponential ramp
      gainNode.gain.linearRampToValueAtTime(0.0001, now + attack);
      gainNode.gain.exponentialRampToValueAtTime(1, now + attack);
    }
    
    const sustainLevel = Math.max(sustain, 0.0001);
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel, now + attack + decay);

    // Schedule the release
    gainNode.gain.setValueAtTime(sustainLevel, now + duration - release);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  };

  const createEnvelope = (envelopeSettings: Envelope | VcaEnvelope) => {
    const envelope = ref<Envelope | VcaEnvelope>({
        ...envelopeSettings
    });
    return {
        envelope,
        applyEnvelope,
    }
  }

  return { createEnvelope };
};