---
name: verify
description: Verify changes by driving the synth UI in headless Chromium and measuring real audio output
---

# Verifying Web Synth Wizard changes

The surface is the browser UI plus actual Web Audio output. Unit tests only
cover pure helpers; anything touching the audio graph must be heard.

## Launch

```bash
npm run dev   # serves on http://localhost:4000
```

Drive with playwright-core (install it in the scratchpad, not the repo) and
the pre-installed Chromium at `/opt/pw-browsers/chromium` (that path IS the
executable — a symlink to chrome, not a directory). Launch args:
`--autoplay-policy=no-user-gesture-required --no-sandbox`. Headless audio
works: AudioContext time advances and the graph renders in real time.

## Measuring sound

Nothing app-internal is reachable from the page, so hook the graph in
`page.addInitScript` before load:

- Wrap `AudioContext.prototype.createAnalyser` to stash the app's analyser
  (it taps the master output; scope source defaults to 'output'). Then poll
  `getFloatTimeDomainData` and compute RMS to prove/measure audible output.
- Wrap `window.AudioWorkletNode` to record processor names if worklet
  creation matters.

Reference peak RMS levels at default settings: oscillator engine sustained
~0.04; physical voice plucks ~0.01 (they decay between steps, so take the
max over 3-4s); suspended/silent ~0.003 (frozen analyser residue, not sound).

## Flows worth driving

- "Activate Synth" button starts the context + sequencer (random pattern, so
  wait a few seconds for active steps). "Stop Synth" suspends.
- Panels are behind tabs (role=tab: Clock/Sequencer/VCO/VCF/VCA/LFO/FX).
- VCO engine dropdown is `#engine-select` (oscillator | voice); damping
  slider `#damping` only exists on voice, wave select `#wave-select` only on
  oscillator.
- The oscilloscope's VCO/VCO+VCF/Out buttons + Freeze make good visual
  evidence; to catch a decaying pluck, poll RMS and screenshot on a spike.
- Reactivating after Stop rebuilds the whole graph (new AudioContext) — a
  good probe for init-order regressions.
