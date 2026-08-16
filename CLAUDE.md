# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SpellBook — a Speak & Spell–inspired single-page web app. No build system, no package manager, no tests: it's static HTML/CSS/JS served directly by nginx. All application code lives in `app/`.

## Running it

```bash
docker compose up
```

Serves `app/` via nginx at `http://localhost:8028`. There's no dev server, bundler, or transpilation step — edit files in `app/` and reload the browser. `app/js/spellbook.js` is loaded as an ES module (`<script type="module">`), and `onnxruntime-web` is resolved via an import map in `app/index.html` pointing at a jsDelivr CDN URL (no local install).

## Architecture

Three JS modules, no framework:

- **`app/js/spellbook.js`** — the entire device controller. Implements a single explicit finite state machine (`DeviceState`: `POWER_OFF → BOOTING → IDLE_READY → SAY_MODE / RECORDING → TRANSCRIBING → SPEECH_EVALUATE → SPELL_MODE → SPELL_EVALUATE → SUCCESS/FAILURE → SHUTDOWN`). All button/keyboard handlers branch on the current `state` value; there is no framework or virtual DOM — handlers mutate module-level state and write directly into the `.vfd .text` element. Audio feedback ("beeps") is synthesized on the fly via `AudioContext`/`OscillatorNode` (`playTone`), not sample playback.
- **`app/js/piper-tts.js`** — wraps `onnxruntime-web` to run a local Piper TTS ONNX model for speech synthesis. `PiperTTS.from_pretrained(modelPath, configPath)` loads the model+voice config and returns an instance; `synthesize(text)` runs inference and plays the result through `AudioContext`. Note the phoneme encoding is currently a placeholder (raw character codes, not real phonemes — see the comment in `synthesize`).
- **`app/js/model-cache.js`** — trivial in-memory `Map` cache wrapping `fetch`, used to avoid re-downloading the ONNX model/config.
- **`app/models/`** — the actual Piper voice model (`en_US-sam-medium.onnx` + `.onnx.json` config) loaded by `piper-tts.js`.

`spellbook.js` degrades gracefully if Piper fails to load (falls back to `window.speechSynthesis`), and speech-to-text is currently **simulated** (`simulateTranscription()` just echoes back `targetWord` — no real STT is wired up yet).

## Design constraints (from `.github/instructions/instructions.md`)

The UI must read as a physical late-70s–90s electronic toy (Speak & Spell), not a modern web UI. This governs any visual/CSS work:

- **No continuous/animated effects** — no pulsing, glow animation, fades, or smooth scrolling text. Only momentary button-press depression and instant/stepped VFD text updates are allowed. CSS transitions must be ease-in-out and ≤120ms.
- **VFD display**: teal-blue glow (`--c-blue: #00e6c3`) text on a dark glass panel, monospace/segment-style font, instant-on (no animated typing).
- **Palette** is fixed: body reds (`#e23b2f` / `#b1261c`), yellow accents (`#ffd54a` / `#ffbf00`), VFD teal (`#00e6c3`), panel black (`#1a1a1a`).
- **Keys** are color-coded by function: green = letters, blue = say/space, orange = replay/repeat/spell/control, pink = confirm (check/enter), gray = power/erase. Preserve this mapping when adding buttons.
- Every interactive button must have an `id`; JS should reference buttons by `id`/selector rather than relying on child-element structure.
- The full per-button behavior matrix across every device state is specified in `instructions.md` §10 — consult it before changing button semantics, since behavior is state-dependent (e.g. Replay does different things in `SAY_MODE` vs `SPELL_EVALUATE`).
