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

## Step 6 — Supporting components

Five new web components plus the data layer's first real seed.

### Data layer

`@TBD/simengine-data` ships JSON files (`core.json`, `sources.json`, `glossary.json`, `schema.json`) plus a JS API in `src/index.js`. Step 6's seed: ~10 numeric entries (R, kB, Avogadro, three molar masses, three VdW constants), 3 citations (IB Booklet 2025, NIST CODATA 2018, IUPAC 2016), and 4 glossary terms. `validate()` runs at import time so consumers fail fast on data corruption.

### Components

- **`<sim-data-pill ref="...">`** — clickable inline data value. Looks up via `getValue`. Click toggles a child `<sim-data-card>` (also in shadow DOM). Outside-click and Escape close. Emits `data-pill-clicked`.
- **`<sim-data-card ref="...">`** — popover with symbol, name, value+unit, description, source citation, "Copy citation" button, optional "View source" link. Uses foundation `trapFocus`. Hidden by default; emits `data-card-closed`.
- **`<sim-glossary-term ref="...">term</sim-glossary-term>`** — inline tooltip. Slot brings in user-visible underlined text. Hover (200ms) or focus shows tooltip; click pins. Escape closes pinned. ARIA `role="tooltip"` + `aria-describedby`.
- **`<sim-tweaks-panel for="sim-id">`** — teacher-facing floating panel. Queries the referenced `<sim-engine>` for its `tweaks: [...]` array, renders one `.sim-switch` per tweak. Slides in via `[data-open]` attribute.
- **`<sim-coachmark id="..." anchor="...">text</sim-coachmark>`** — contextual hint anchored to a CSS-selector element (resolved against the coachmark's own root, so it works in light DOM or shadow DOM). Positions absolutely. "Got it" dismisses; persists per-id in `localStorage`.

### Sim contract: tweaks array

Sims may declare an optional `tweaks: [...]` array. Each entry: `{ id, label, stateKey, on, off, asAttribute? }`. Consumed by `<sim-tweaks-panel>`. gas-laws declares two: `showHLGraph` (level via attribute) and `showMBGraph` (state).

### Foundation a11y improvement (commit 5)

`trapFocus` in `packages/core/src/engine/a11y.js` now reads `activeElement` from the trapped element's `getRootNode()` (Document or ShadowRoot) instead of `document.activeElement`. This fixes the wrap-around behavior for components rooted in shadow DOM — without it, retargeting caused `document.activeElement` to return the shadow host, never matching the inner first/last focusable.

### Polish folds-in

- `.sim-switch` styled toggle (iOS-style, native checkbox under the hood) added to `components.css`. Used by the smoke test HL toggle and `<sim-tweaks-panel>`.
- gas-laws sim's rail reorders so preset and species dropdowns sit together at top.

## Step 8 — Topic page wrap

Composes the step-6 components into a polished Gas Laws topic page. Pure HTML + CSS additions; no new web components, no new modules in `packages/core/src/`, no new tests.

### File layout

- `examples/topic-page/index.html` (NEW) — the polished Gas Laws topic page.
- `packages/core/src/styles/components.css` — appends `.topic-header`, `.topic-intro`, `.topic-next` rule blocks (~82 lines total), plus phase-8a additions for `.ib-understandings` and a `.sim-wrap.topic-page` width modifier.

The topic page loads the four design-system stylesheets and the IIFE bundle (`packages/core/dist/index.global.js`). All five step-6 components are auto-defined via the bundle's existing side-effect imports.

### Page structure (spec §3)

The topic page renders 15 ordered sections (14 from spec §3 plus the new `.ib-understandings` block added in phase 8a), omitting teacher-view items (steps 11+) and EAL variants:

1. Top strip (`.sim-topstrip`)
2. Sticky page-level header (`.topic-header` — new) with breadcrumb + HL/SL toggle
3. Header block (`.sim-head`) with kicker, title, lede containing 2 `<sim-glossary-term>` and 1 `<sim-data-pill>`
4. Bell ringer (`.ib-bellringer`)
5. Topic intro (`.topic-intro` — new) with `default-sl` and `default-hl` variants
6. Key concept (`.ib-concept`)
7. IB Understandings (`.ib-understandings` — new in phase 8a) with paraphrased S1.5.1–S1.5.4 statements (cited "IB Chemistry Guide 2025")
8. Equation panel (`.ib-equation`) with `<sim-data-pill>` for R (the gas constant)
9. Learning intentions / success criteria (`.ib-lisc`)
10. The sim (`<sim-engine>`) with sibling `<sim-tweaks-panel for="sim">`
11. Worked example (`.ib-worked`) with stepped-reveal solution
12. Practice question + hidden answer (`.ib-practice` + `.ib-answer`)
13. Command term reminder (`.ib-command-card`)
14. Mark scheme (`.ib-mark`)
15. Misconceptions (`.ib-misc`)
16. Exit ticket (`.ib-exitticket`)
17. What's next (`.topic-next` — new, disabled state) → S2.1 The ionic model

### Inline script — variant toggle + prefs persistence

A single `<script>` block at the bottom of the topic page (~30 lines vanilla JS, no imports). Responsibilities:

- Loads/saves prefs from `localStorage` under `aisc-simengine:prefs:s1.5-gas-laws` (try/catch wrapped for graceful degradation).
- `applyLevel(level)` flips every `[data-variant]` block in the page based on `default-${level}` match, mirrors the level via `setAttribute('level', …)` on the sim, and mirrors the checked state of the sticky-header toggle.
- On load: restores the saved level (default `sl`) and applies it.
- Wires the HL/SL toggle change handler (saves to prefs).
- Wires the Tweaks button (toggles `data-open` attribute on the panel).

### Bidirectional level synchronization

Three surfaces all reflect the same `level` state:

- The sticky-header `.sim-switch` HL toggle.
- The `<sim-tweaks-panel>` HL graph switch (commit 7's bidirectional state-sync).
- The sim's Ideal-vs-Real graph visibility.

Flipping any of them triggers a state update that propagates through the existing state-listener subscriptions. No new code beyond the inline script's `applyLevel` call.

### What ships vs what's deferred

Step 8 is intentionally narrower than the spec's combined §8–§11. This phase ships the **page assembly** with realistic placeholder content. Each of the following is its own future phase:

| Spec § | What                                                          | Status                      |
| ------ | ------------------------------------------------------------- | --------------------------- |
| 8      | Markdown content authoring pipeline                           | Deferred (future "step 8b") |
| 9      | Author full Gas Laws content (real prose for all 14 sections) | Deferred (future "step 8c") |
| 11     | Teacher view (`<sim-data-map>`, lesson plan tie-in)           | Deferred (future "step 9")  |
| 12     | Print stylesheet, print button                                | Deferred (polish phase)     |

## Phase 10A — Interactive success-criteria checklist + export

A new `<sim-checklist>` custom element makes the topic page's success-criteria column interactive. Students tick items, write a free-text reflection, and export their work as `.md` or PDF. State persists per-topic-per-level via localStorage.

### Architecture

- One `<sim-checklist>` per use site. The topic page mounts one inside the existing `.ib-lisc__col--sc` column (kicker + title preserved; the static `<ul>` becomes a `<sim-checklist>` with slotted `<li>` items).
- Slot-based item API: page authors include plain `<li>` elements as children. The component reads them at upgrade, captures `textContent`, clears the host's light DOM, and renders interactive checkbox-rows in shadow DOM.
- Per-topic-per-level localStorage key: `aisc-simengine:checklist:<topic>:<level>`. State JSON: `{ checkedItems: number[], freeText: string }`.
- Auto-save on check toggle (immediate); on textarea input (300ms debounce). The `level` attribute change force-flushes the pending textarea save to the OLD key before switching, preventing a race where mid-debounce typing is lost.
- All DOM rendered via `createElement` + `textContent`. No `.innerHTML` anywhere.

### Export pipeline

**Markdown** — one-click download. The component generates a markdown string (topic title, level, date, `[x]`/`[ ]` checklist items, optional `## My reflection` section if the textarea has content), wraps it in a `Blob`, creates a temporary `<a download="<topic>-<level>-reflection.md">`, programmatically clicks it, and revokes the object URL on the next tick.

**PDF** — via the browser's native print dialog. The component synthesizes a `#print-reflection-output` element in `document.body` (the same element is reused across exports via `replaceWith`), adds `body.printing-reflection`, and calls `window.print()`. The `@media print` rules in global `components.css` hide everything except `#print-reflection-output` while `body.printing-reflection` is set. An `afterprint` listener (registered on `window` in `connectedCallback`) clears the body class when the dialog closes — regardless of whether the user printed or canceled.

This print pipeline is **reflection-only**. The whole-topic-page print stylesheet remains the deferred §12 polish item.

### Topic-page integration

The Gas Laws topic page's `applyLevel(level)` inline function (added in step 8) gains a fourth step: push the new level to every `<sim-checklist>` element via `setAttribute('level', ...)`. The HL/SL toggle in the sticky header now swaps:

1. The variant-content blocks (existing).
2. The sim's `level` attribute (existing).
3. The HL toggle's checked state (existing).
4. **The checklist's per-level state.** (Phase 10A.)

### What ships vs what's deferred

| Concern                                             | Status                                    |
| --------------------------------------------------- | ----------------------------------------- |
| Generic `<sim-checklist>` with slotted `<li>`s      | Shipped                                   |
| Per-topic-per-level localStorage                    | Shipped                                   |
| Free-text reflection textarea (debounced auto-save) | Shipped                                   |
| .md download                                        | Shipped                                   |
| Save as PDF (reflection-only via `window.print()`)  | Shipped                                   |
| Reset button with confirm                           | Shipped                                   |
| Bell ringer / practice / exit ticket interactivity  | Deferred to Phase 10B                     |
| `<sim-reflection-export>` portfolio aggregator      | Deferred to Phase 10B                     |
| Whole-topic-page print stylesheet                   | Deferred to spec §12 polish               |
| Mobile/tablet responsive tweaks                     | Deferred (polish phase)                   |
| Animated check transitions, fancy progress bar      | Deferred                                  |
| `<sim-engine>` public API → public                  | Deferred (still on step-6 follow-up list) |
| `<slot>` reinstatement in `<sim-coachmark>`         | Deferred (still on step-6 follow-up list) |
