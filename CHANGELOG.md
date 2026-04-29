# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

Foundation phase (steps 1–3 of the broader build sequence) — six commits:

1. pnpm monorepo scaffold with three packages (`core`, `data`, `content-aisc`), ESLint flat config, Prettier, EditorConfig, MIT license.
2. GitHub Actions CI workflow (lint + test + build on push and PR) plus a status badge on the README.
3. AISC design system port: `tokens.css` (180), `base.css` (96), `components.css` (955), and `sim-shell.css` (486 lines extracted from the design reference HTML). A vanilla-HTML smoke-test page links all four stylesheets.
4. Engine modules `state.js` (pub/sub key/value store) and `recorder.js` (RFC 4180 CSV recorder with cartesian-product parameter sweep), TDD-driven with 17 unit tests.
5. `a11y.js` helpers (`prefersReducedMotion`, `announce`, `trapFocus`, `restoreFocusTo`) and typed stubs for `particles.js` / `graph.js` / `controls.js` that throw "not implemented" on call. Three stub-throw tests bring total to 20.
6. Documentation stubs: `architecture.md`, `authoring-content.md`, `data-schema.md`.

### Step 4 — `<sim-engine>` custom element shell

Five commits adding the orchestrator that mounts a registered sim, manages reactive attributes, instantiates state and recorder, and emits lifecycle events. No real chemistry yet — that's step 5.

- `chore(core)`: happy-dom + vitest test environment
- `feat(core)`: sim registry with shape validation (`registerSim`, `lookupSim`)
- `feat(core)`: `<sim-engine>` shell scaffold (shadow DOM, adopted stylesheets, shell skeleton)
- `feat(core)`: `<sim-engine>` lifecycle wiring (state, recorder, attributes, events, imperative API)
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 41 (20 foundation + 3 dom-env + 6 registry + 12 sim-engine).

**Public surface added to `@TBD/simengine`:** `registerSim`, `lookupSim`, and the `<sim-engine>` custom element registered as a side effect of importing the package.

### Step 5 — Gas Laws sim module

Nine commits implementing the foundation-stub engine modules and porting an ideal-gas Gas Laws sim. The eight planned commits plus one in-flight fix-up (`fix(core): particles.js — hex fillStyle, defensive setTemperature(0)`) addressing a code-review-identified Canvas/CSS gotcha and a divide-by-zero edge case before the bug could land in any consumer.

- `feat(core)`: implement `particles.js` with elastic wall collisions (Box-Muller speed sampling, Mulberry32 seeded PRNG, substepping at 1/60 against tunneling)
- `fix(core)`: `particles.js` — hex `fillStyle` (Canvas 2D doesn't resolve CSS `var()`); defensive `setTemperature(0)`
- `feat(core)`: implement `controls.js` with slider and button factories (slider supports Shift+arrow ±5×step; dropdown/toggle/initKeyboard remain stubbed)
- `feat(core)`: implement `graph.js` with declarative traces (line | dots; out-of-range clamping; deletes the now-empty `stubs.test.js`)
- `feat(core)`: add rAF loop to `<sim-engine>` with reduced-motion respect (`_startLoop` / `_stopLoop` / `_paintOnce` / `play` / `pause`)
- `feat(core)`: scaffold `gas-laws` sim — physics (`R_GAS`, `idealPressure`, `avgKineticEnergy`, `visualParticleCount`) and render helpers (`drawContainer`, `drawParticle`)
- `feat(core)`: wire `gas-laws` sim — `init(host)` builds canvas + P-V graph + 3 sliders + 4 transport buttons + 3 readouts; state listeners on T/V/n; auto-registered. Adds defensive null-ctx guards to `particles.render` and `graph.redraw` to support headless test environments.
- `feat(examples)`: smoke-test page mounts `<sim-engine sim="gas-laws">` and imports the ESM bundle
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 74 (was 41 after step 4; -3 stubs deleted, +36 new).

**Public surface added:** `<sim-engine sim="gas-laws">` works out of the box (registered as a side effect of importing the package). Imperative `play()` / `pause()` methods on the element instance.

**Deferred to step 5b:** VdW physics; HL toggle and Ideal-vs-Real comparison graph; multiple gas species (He, N₂, CO₂); Maxwell-Boltzmann distribution graph; teacher presets (Boyle's, Charles's); search palette UI; particle-particle collisions; measured pressure (wall-collision smoothed) alongside computed; `createDropdown` / `createToggle` / `initKeyboard`; `exportPNG`. Also: listener-leak fix on sim dispose, `dt` clamping at the rAF boundary, weaker-than-ideal graph test assertions, and several other minor sweep tasks captured in step 5 brainstorming notes.

### Notes

- npm package scope is `@TBD/*` (placeholder). It will be replaced with the final scope before any publish.
- `recorder.download()` from the legacy `SimEngine.DataCollector` is intentionally deferred — it requires a real DOM and lands with browser-level test infrastructure.
- The other 31 prototype sims remain in the IB Chemistry project's legacy SimEngine folder and are out of scope for this repository (see spec §0 non-goals).
