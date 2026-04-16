# CLAUDE.md

## Project Overview

Web Synth Wizard is a browser-based synthesizer built with Vue 3 and the Web Audio API. It features a 16-step sequencer, VCO (oscillator), VCF (filter), and VCA (amplifier) modules modeled after classic analog synths.

## Tech Stack

- **Framework:** Vue 3 (Composition API) + TypeScript
- **Build:** Vite 5
- **Styling:** SCSS with responsive mixins
- **Testing:** Vitest + Vue Test Utils (jsdom)
- **Linting:** ESLint + Prettier
- **Deployment:** AWS Amplify

## Commands

```bash
npm run dev          # Start dev server on port 4000
npm run build        # Type-check + production build
npm run test:unit    # Run tests in watch mode
npm run test:unit -- --run  # Single test run
npm run type-check   # Vue + TypeScript type checking
npm run lint         # ESLint with auto-fix
npm run format       # Prettier formatting
```

## Architecture

### Audio Graph

```
OscillatorNode → GainNode (VCA) → BiquadFilterNode (VCF) → AudioContext.destination
```

### Key Directories

- `src/composables/` — Core audio logic (singleton state via module-level refs)
  - `useAudioContext.ts` — Public API aggregating all composables
  - `useAudioContextManager.ts` — AudioContext, GainNode, FilterNode initialization and shared state
  - `useSequencer.ts` — 16-step sequencer with setTimeout-based scheduling
  - `useVCO.ts` — Oscillator creation and note quantization
  - `useEnvelope.ts` — ADSR envelope generators for VCA and VCF
- `src/components/` — Vue components for each synth module
- `src/types/` — TypeScript type definitions
- `src/utils/` — Musical note config and helper functions

### State Pattern

All audio state is declared at module scope in `useAudioContextManager.ts` (singleton). Composables return Vue refs that are shared across all components importing `useAudioContext()`.

### Envelope Values

ADSR envelope parameters (attack, decay, sustain, release) are stored in **milliseconds** and must be converted to seconds when passed to Web Audio API scheduling methods (`setValueAtTime`, `exponentialRampToValueAtTime`).

## Code Style

- No semicolons
- Single quotes
- 2-space indentation
- 100-char line width
- No trailing commas
- Vue Composition API with `<script setup>` pattern

## Pull Requests

Always create PRs as **ready for review** (not draft).

## Browser Support

Targets Firefox for best Web Audio API compatibility. Requires `AudioContext` support.
