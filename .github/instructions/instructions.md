---
applyTo: '**'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.We are building a speak and spell inspired single page app called SpellBook. 

SpellBook Visual Design Specification

1. Design Philosophy

SpellBook follows the physical electronic device idiom inspired by late 20th-century educational toys such as the Speak & Spell. The interface must evoke a tangible, hardware-based learning device — not a digital simulation. Every component and motion should have an analog justification.

Core Principles

Physicality: Elements behave as if mechanically constructed.

Authenticity: Design decisions are rooted in real-world constraints of late 70s–90s consumer electronics.

Clarity through Restraint: Use static composition, color, and texture to communicate function.

Consistency: Visual hierarchy mirrors physical layout, not web-style UX.


2. Color & Materials

Body Shells: Molded plastic tones (matte red, orange, or yellow). Slight shading or texture acceptable to imply injection molding.

Displays: Simulated Vacuum Fluorescent Display (VFD) — teal-blue glow on dark glass background, limited brightness.

Labels & Legends: Screen-printed text, flat color (no gradients).

Keys: Solid-color ABS plastic with embossed lettering. Colors are functional (e.g., green = letters, pink = confirm, orange = control).


Palette Reference

Body: #e23b2f / #b1261c

Accent Yellow: #ffd54a / #ffbf00

VFD Glow: #00e6c3

Panel Black: #1a1a1a

Background Gradient (device context only): #2b2b2b → #342a3b


3. Lighting & Effects

Permitted: Static inner shadows, pressed-state depth, subtle VFD bloom.

Prohibited: Animated glow, pulsing, or dynamic color transitions.

Rationale: Real electronics from the era could not emit continuous animated light changes.


4. Motion & Feedback

Allowed Motions:

Momentary button depression (1–2px translate or shading change).

VFD text flicker or rapid update (simulating segment refresh).


Disallowed Motions:

Continuous pulsing, fade-ins, scrolling text not constrained to display area.

Animations resembling modern UI affordances.



5. Typography & Labeling

Display Text: Monospaced VFD font or pixel-perfect approximation (e.g., Courier, OCR-A, or custom 7-segment font).

Body Labels: Sans-serif, all caps, bold; no anti-aliasing or smoothing beyond CSS defaults.

Alignment: Centered on keys, evenly spaced.


6. Layout & Structure

Split Interface: Left (Audio Console) / Right (Spell Unit).

Grid Discipline: 1970s-80s physical hardware ratios — even spacing, fixed margins.

Aspect Ratio: 4:3 or near-square tablet proportion.


7. Sound Design (Future Integration)

Use synthesized beeps or sample sets emulating hardware oscillators.

Avoid naturalistic sounds unless routed through simulated speaker cone response.


8. Component Behavior Mapping

Component	Behavior	Physical Reference

Record Button	Momentary press with LED indicator	Cassette recorder or speech training toy
VFD Display	Instant-on text, limited brightness	VFD window on calculators or early toys
Keys	Depress with click sound	Mechanical membrane or rubber dome keys
Speaker Grill	Static texture	Injection-molded vent pattern


9. Implementation Rules

CSS Motion Curves: Only ease-in-out transitions ≤ 120ms.

No CSS animations beyond brief state transitions.

Color Transitions: Instant or stepped, not gradual.

Shadowing: Inner or drop-shadows may simulate recess depth, never glow.

Ensure that all buttons have an id attribute for accessibility and scripting purposes.

Reference button ids rather than child element selectors in JavaScript for clarity and maintainability.

10. Buttons

| **Button**                    | **POWER_OFF**        | **BOOTING** | **IDLE_READY**                                | **SAY_MODE**         | **RECORDING**                 | **TRANSCRIBING**      | **SPEECH_EVALUATE**         | **SPELL_MODE**                        | **SPELL_EVALUATE**               | **SUCCESS / FAILURE**    | **SHUTDOWN** |
| ----------------------------- | -------------------- | ----------- | --------------------------------------------- | -------------------- | ----------------------------- | --------------------- | --------------------------- | ------------------------------------- | -------------------------------- | ------------------------ | ------------ |
| **Power (Gray)**              | ➕ Power On → BOOTING | No effect   | ➖ Power Off → SHUTDOWN                        | Interrupt → SHUTDOWN | Force stop + SHUTDOWN         | Force stop + SHUTDOWN | Return → SHUTDOWN           | Force stop → SHUTDOWN                 | Force stop → SHUTDOWN            | Power Off → SHUTDOWN     | Off          |
| **Replay (Orange)**           | Inactive             | Inactive    | Replay last word (Piper)                      | Replay current TTS   | Inactive                      | Inactive              | Replay original prompt      | Replay prompt                         | Replay prompt                    | Replay success sound     | Inactive     |
| **Repeat (Orange)**           | Inactive             | Inactive    | Repeat instructions (“Press Say or Spell”)    | Replay Piper audio   | Inactive                      | Inactive              | Replay Piper audio          | Inactive                              | Inactive                         | Inactive                 | Inactive     |
| **Spell (Orange)**            | Inactive             | Inactive    | Enter **SPELL_MODE**                          | Inactive             | Inactive                      | Inactive              | Inactive                    | Already active                        | Inactive                         | Inactive                 | Inactive     |
| **Hint (Blue)**               | Inactive             | Inactive    | Display first letter hint                     | Inactive             | Inactive                      | Inactive              | Inactive                    | Show next letter or syllable          | Inactive                         | Inactive                 | Inactive     |
| **Say (Blue)**                | Inactive             | Inactive    | Start **SAY_MODE** (Piper speaks target word) | Replay same word     | Inactive                      | Inactive              | Inactive                    | Inactive                              | Inactive                         | Inactive                 | Inactive     |
| **Check (Pink)**              | Inactive             | Inactive    | Inactive                                      | Inactive             | Inactive                      | Inactive              | Inactive                    | Evaluate typed input → SPELL_EVALUATE | Confirm result → SUCCESS/FAILURE | Acknowledge → IDLE_READY | Inactive     |
| **A–Z (Green)**               | Inactive             | Inactive    | No effect                                     | No effect            | No effect                     | No effect             | No effect                   | Input character(s) to VFD buffer      | Input locked                     | No effect                | Inactive     |
| **Erase (Gray)**              | Inactive             | Inactive    | Clear display (if needed)                     | No effect            | No effect                     | No effect             | No effect                   | Delete last typed letter              | No effect                        | No effect                | Inactive     |
| **Space (Blue)**              | Inactive             | Inactive    | No effect                                     | No effect            | No effect                     | No effect             | No effect                   | Insert space in typed buffer          | No effect                        | No effect                | Inactive     |
| **Enter (Pink)**              | Inactive             | Inactive    | Inactive                                      | Inactive             | Inactive                      | Inactive              | Inactive                    | Submit typed text → SPELL_EVALUATE    | Inactive                         | Reset → IDLE_READY       | Inactive     |
| **Record Button (Mic Panel)** | Inactive             | Inactive    | Start **RECORDING** (activate mic, LED on)    | Inactive             | Stop recording → TRANSCRIBING | Inactive              | Retry recording → RECORDING | Inactive                              | Inactive                         | Inactive                 | Inactive     |



10. Future Compatibility

Any additions (e.g., waveform visualizer, LED indicators, etc.) must be designed as if producible in hardware circa 1985 using LEDs, VFDs, or segment displays.


