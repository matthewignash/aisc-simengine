# Architecture

> **Status: stub.** This document will describe the engine architecture, package boundaries, and component lifecycle.

The authoritative spec for the foundation and the broader build sequence currently lives in the IB Chemistry project folder at `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md`. This document will replace that as the architecture-of-record once the build progresses past foundation.

## Foundation phase (current)

The repository is a pnpm workspace with three packages:

- **`packages/core/`** (`@TBD/simengine`) — the web component library and engine primitives. Foundation phase ships:
  - `engine/state.js` — reactive key/value store with pub/sub
  - `engine/recorder.js` — trial recorder + RFC 4180 CSV export
  - `engine/a11y.js` — focus trap, screen-reader announce, reduced-motion helpers
  - `engine/particles.js` / `graph.js` / `controls.js` — typed stubs (throw on call)
  - `styles/` — ported AISC design system (tokens, base, components, sim-shell)
- **`packages/data/`** (`@TBD/simengine-data`) — reference chemistry data (empty stub; lands after the database drop).
- **`packages/content-aisc/`** (`@TBD/content-aisc`) — topic content (empty stub; lands with the content pipeline).

## Out of scope for foundation

- The `<sim-engine>` custom element (step 4)
- Any Gas Laws sim code (step 5)
- Supporting components: `<sim-data-pill>`, `<sim-coachmark>`, etc. (step 6)
- The content authoring pipeline (markdown → HTML, step 8)
- Reference data schema and citations (step 7, blocked on database drop)
- Teacher view and data-source map (step 11)

## Step 4 — `<sim-engine>` custom element

The custom element that orchestrates a sim's lifecycle. Imported as a side effect of `@TBD/simengine` (the package's `index.js` registers the element with the global custom element registry).

### Usage

```html
<sim-engine sim="gas-laws" level="hl" teacher-view>
  <div class="sim-fallback">No-JS fallback content</div>
</sim-engine>
```

```js
import { registerSim } from '@TBD/simengine';
import gasLaws from '@TBD/simengine/sims/gas-laws';

registerSim(gasLaws);
// <sim-engine sim="gas-laws"> now works anywhere on the page.
```

### Lifecycle

1. `constructor` opens an open shadow root, adopts the host + components + sim-shell stylesheets, and renders the static skeleton (`.sim-main`, `.sim-canvas`, `.sim-rail`, `.sim-transport`).
2. `connectedCallback` reads attributes into a fresh `state` store, looks up the sim from the registry, calls `sim.init(host, dataLoader=null)`, instantiates a `recorder` keyed by the sim's `controls`, calls `recorder.startRun()`, and emits `sim-ready`.
3. `attributeChangedCallback` mirrors observed attributes into state. Toggling `level` also emits `level-changed`.
4. `disconnectedCallback` stops the recorder and calls `sim.dispose()` if defined.

### Imperative API (implemented in step 4)

`reset()`, `recordTrial()`, `exportCSV()`, `setVariable(key, value)`, `scenario(presetId)`.

### Reactive attributes (observed in step 4)

`sim`, `level`, `language`, `difficulty`, `show-graph`, `show-exit-ticket`, `teacher-view`. Each (except `sim`, set once at mount) mirrors into state on change. Toggling `level` also emits `level-changed`.

### Events emitted (step 4)

`sim-ready` (after `sim.init` completes), `level-changed` (`detail: { from, to }`), `trial-recorded` (`detail: { trialNum, values, derived }`). All bubble and cross shadow boundaries.

### Sim module contract

Required exports: `id`, `syllabus`, `init(host, dataLoader)`, `controls`, `scenarios`. Optional: `step(dt)`, `render(ctx)`, `derived(state)`, `validateTrial(state)`, `dispose()`.

### What's deferred

- Real chemistry sim — Gas Laws lands in step 5.
- `requestAnimationFrame` loop — `<sim-engine>` will own it, calling `sim.step(dt)` and `sim.render(ctx)` per frame, but that wiring lands when the first sim consumes it.
- `dismissCoachmark(id)` imperative method — step 6 (when `<sim-coachmark>` ships).
- `data-source` attribute — step 7, blocked on the database drop. Not yet in `observedAttributes`.
- `show-tweaks-panel` attribute — step 6 (when `<sim-tweaks-panel>` ships). Not yet in `observedAttributes`.
- `exit-submitted` event — step 6 (when the exit ticket lands).
- `coachmark-shown` event — step 6.
- Coachmarks, data pills, glossary terms — step 6.

## Step 5 — Gas Laws sim module

Ideal-gas simulation registered as `'gas-laws'`. Mounted via:

```html
<sim-engine sim="gas-laws"></sim-engine>
```

The sim is auto-registered when `@TBD/simengine` is imported (see `packages/core/src/index.js`), so consumers don't need to call `registerSim` manually.

### Engine modules implemented in step 5

- `particles.js` — 2D ideal-gas particle field with elastic wall collisions, Maxwell-Boltzmann initial speed distribution (Box-Muller), substepping at 1/60 to prevent tunneling. Injectable RNG (Mulberry32 PRNG) for reproducible test layouts. Defensive null-ctx guard in `render`.
- `controls.js` — `createSlider` (matches AISC `.sim-slider` markup, native range input + Shift+arrow ±5×step), `createButton` (default/primary/record variants). Dropdown / toggle / `initKeyboard` remain stubbed for step 6+.
- `graph.js` — `createGraph` with declarative traces (`line` | `dots`), linear axes, out-of-range clipping. Defensive null-ctx guard in `redraw`. `exportPNG` returns `null` until visual regression infra arrives.

### `<sim-engine>` enhancements in step 5

`requestAnimationFrame` loop with `_startLoop` / `_stopLoop` / `_paintOnce` / `play` / `pause`. Loop computes `dt` from `performance.now`, writes to `state.dt`, calls `sim.step(dt)` and `_paintOnce` per frame. Respects `prefers-reduced-motion`: when true, the loop does not start; users can call `play()` to override.

### Gas Laws sim shape

- **Controls:** 3 sliders — T (100..1000 K, step 1), V (0.5..5 L, step 0.1), n (0.5..5 mol, step 0.1).
- **Scenarios:** none in step 5 (presets are step 5b).
- **Physics:** PV = nRT only. No VdW, no measured pressure.
- **Visuals:** particles animate inside a 600×360 canvas; container outline narrows as V decreases; P-V graph in the rail traces dots at the user's path through (V, P) space; live readouts update for Pressure, Avg KE, particle count.

### What's deferred to step 5b

VdW physics; HL toggle + Ideal-vs-Real graph; multiple species (He, N₂, CO₂); Maxwell-Boltzmann distribution; teacher presets; search palette; measured pressure; particle-particle collisions; `createDropdown` / `createToggle` / `initKeyboard`; `exportPNG`. Plus several smaller polish items captured in the step 5 sweep notes (listener leak on dispose, `dt` clamping at the rAF boundary, stronger graph test assertions).

## Step 5b — Gas Laws extensions

Adds VdW physics + HL toggle, multiple species, Maxwell-Boltzmann distribution graph, and teacher presets to the existing Gas Laws sim. Plus three sweep fixes folded in: listener leak fix on sim dispose, `dt` clamping at the rAF loop boundary, and `_pressureFn` abstraction in the gas-laws sim.

### Species data

`packages/core/src/sims/gas-laws/species.js` exports `SPECIES` (object keyed by id) and `SPECIES_OPTIONS` (array for `createDropdown`). Four species: `ideal`, `he`, `n2`, `co2` — each with `a`, `b` VdW constants (in our V/P/T/n unit system: a in kPa·L²·mol⁻², b in L·mol⁻¹) and a `color`.

### VdW physics

`vdWPressure({ V, T, n, a, b })` in `gas-laws/physics.js`:

```
P = nRT / (V - nb) - a · n² / V²
```

Returns 0 for non-positive V/T/n; Infinity if V ≤ nb (gas compressed past minimum molar volume). The gas-laws sim's `_pressureFn` dispatches: ideal when species has `a=b=0`, VdW otherwise. Reads species from state every call.

### HL toggle

The `level` attribute on `<sim-engine>` is reactive from step 4. When `level=hl`, the gas-laws sim shows an additional graph below the P-V graph: two static curves (`ideal` line + `real` line) plotted across V's full range for the current T, n, and species. The user sees the divergence widen at moderate V — the canonical IB pedagogical moment.

The HL graph canvas is created once at `init` time; visibility is toggled via the container's `display` style on `state.level` change.

### Maxwell-Boltzmann distribution graph

Always visible. Updated every 15 frames in the sim's `render(ctx)`. Two traces:

- `observed`: histogram of current particle speeds (24 bins, x ∈ [0, 200])
- `theory`: 2D MB PDF curve at the current T (`f(v) = (m/kT) v exp(-mv²/(2kT))`)

The 2D form (rather than the more familiar 3D form from textbook physics) is correct for our 2D simulator. Calibrated to the velocity-scale convention in `particles.sampleVelocity` so theory and observation overlap.

### Teacher presets

Three IB Chemistry scenarios in `gas-laws.scenarios`:

- `boyle` — isothermal (T=300, V=2, n=3, ideal)
- `charles` — isobaric template (T=200, V=2, n=3, ideal)
- `idealVsReal` — high-pressure CO₂ at HL (T=150, V=0.8, n=8, CO₂, level=hl)

Preset dropdown at the top of the rail. Selecting `idealVsReal` self-promotes to HL via `host.setAttribute('level', 'hl')`, since `level` is an attribute-mirrored state key (the existing `host.scenario()` uses `state.set` only).

### Sim listener cleanup convention

Sims that register state listeners via `host._state.on(...)` MUST collect the returned unsubscribe functions in `this._unsubs = []` during `init` and call them in `dispose`. Without this, listeners persist on `_state` after the sim is disposed, calling methods on nulled fields and leaking closures across remounts. The gas-laws sim demonstrates the pattern; future sims should follow it.

### `dt` clamping

`<sim-engine>`'s rAF loop clamps the per-frame `dt` to `Math.min(rawDt, 0.1)` at the loop boundary. Without this, a backgrounded tab resumed after seconds of throttling delivers one giant `dt` that produces glitched physics on the resumed frame. The cap is invisible during normal 60fps operation.
