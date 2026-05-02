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

## Phase 9 — `<sim-data-card>` slide-out side panel

A focused refactor of the data-card component, prompted by user feedback after step 8 shipped: the inline-anchored popover shifted surrounding page content when it opened. Phase 9 makes the card a singleton fixed slide-out side panel that does not displace the page.

### Architecture

- One `<sim-data-card>` per page, declared in light DOM as a sibling of the main content wrapper.
- Pills emit `data-pill-clicked` events with `{ ref }`; the card listens globally on `document`.
- Card uses `position: fixed; top: 80px; left: 16px; width: 320px; z-index: 100`. Slides in from the left edge of the viewport via the `[data-open]` attribute (transform + visibility transition, matching the tweaks-panel pattern from step 6 commit 7).
- Content-swap is in-place: clicking a different pill while the card is open re-renders with the new ref without a close-then-reopen animation.
- `_currentRef` and `_previouslyFocused` are tracked on the card; `_currentRef` distinguishes "same pill clicked again" (toggle close) from "different pill" (swap); `_previouslyFocused` updates to the new pill on each swap so close still returns focus to the most recent trigger.
- `<sim-data-pill>` is slimmed: no child `<sim-data-card>` creation, no document-level listeners. Click only stops propagation and dispatches `data-pill-clicked`.

### Two-layer defense for the outside-click vs. pill-click race

When a user clicks Pill B while Pill A's content is showing, BOTH the pill's click handler AND the card's document-level outside-click handler fire (the card sees Pill B as "outside"). Without defense, the doc-click would close the panel just after the swap.

- **Layer 1**: the pill calls `e.stopPropagation()` on its button click — should halt the event before reaching `document`.
- **Layer 2**: the card's outside-click handler additionally walks `e.composedPath()` for any `<sim-data-pill>` element. If found, the click is treated as "into a pill" rather than "outside the card" and is ignored.

Belt-and-suspenders against shadow-DOM event quirks. Verified by the dedicated regression test `outside click dismisses; click on a different pill swaps (not close-then-reopen)`.

### What ships vs what's deferred

| Concern                                                | Status                                    |
| ------------------------------------------------------ | ----------------------------------------- |
| Singleton card per page                                | Shipped                                   |
| Slide from left; coexists with right-side tweaks panel | Shipped                                   |
| Multi-pill swap-in-place                               | Shipped                                   |
| Outside-click ignores pill clicks (regression test)    | Shipped                                   |
| Mobile/tablet responsive layout                        | Deferred (polish phase)                   |
| Animated content-swap                                  | Deferred                                  |
| Singleton-detection warning (two `<sim-data-card>`s)   | Deferred                                  |
| `<slot>` reinstatement in `<sim-coachmark>`            | Deferred (still on step-6 follow-up list) |
| `<sim-engine>` private API → public                    | Deferred (still on step-6 follow-up list) |

## Phase 10A v2 — Side-panel checklist + reflection export

A `<sim-checklist>` custom element ships as a slide-out side panel from the left, mutually exclusive with `<sim-data-card>`. The topic page gains a "📝 Reflect on these criteria" button below the static LISC success-criteria list; clicking it opens the panel.

**Supersedes phase 10A v1** (PR #7, unmerged): v1 shipped an inline-replacement implementation. After live review, the user preferred the side-panel UX. v1's design + plan docs remain in main as historical record.

### Architecture

- One `<sim-checklist>` per use site. Topic page mounts one as a sibling of `.sim-wrap` (alongside `<sim-data-card>` and `<sim-tweaks-panel>`).
- Slot-based item API: page authors include plain `<li>` elements as children. The component reads them at upgrade, captures `textContent`, clears the host's light DOM, and renders interactive checkbox-rows in shadow DOM.
- Per-topic-per-level localStorage key: `aisc-simengine:checklist:<topic>:<level>`. JSON shape: `{ checkedItems: number[], freeText: string }`.
- Auto-save on check toggle (immediate); on textarea input (300ms debounce). The `level` attribute change force-flushes the pending textarea save to the OLD key before switching, preventing a race where mid-debounce typing is lost.
- Position: `position: fixed; top: 80px; left: 16px; width: 320px; z-index: 100`. Slides in via `[data-open]` attribute. Same pattern as `<sim-data-card>` (phase 9) and `<sim-tweaks-panel>` (step 6).

### Mutual exclusion

`<sim-data-card>` and `<sim-checklist>` are both left-side panels. Mutual-exclusion contract:

- On `_activate` (data-card) / `_activate` (checklist), each dispatches `panel-opened` CustomEvent on `document` with `detail: { source: this }`, `bubbles: true, composed: true`.
- Each component's `connectedCallback` registers a document listener for `panel-opened`. If the source is a different element AND the listening panel has `[data-open]`, the listener calls `_dismiss()` (data-card) or `close()` (checklist).
- Both panels' CSS slide transitions (180ms) run concurrently — the user sees one panel slide out as the other slides in.
- Cleanup in `disconnectedCallback` removes the listener.

This contract is open for any future left-side panel to participate in. The right-side `<sim-tweaks-panel>` is unaffected.

### Export pipeline

Same as v1 (the export logic was preserved across the redesign):

- **Markdown** — one-click download. Generates `# topic — Reflection` + level + date + `[x]`/`[ ]` checklist + optional `## My reflection`. `Blob` + `URL.createObjectURL` + temporary `<a download>` + click + revoke.
- **PDF** — synthesizes a `#print-reflection-output` element in `document.body` (reused via `replaceWith` across exports), adds `body.printing-reflection`, calls `window.print()`. The `@media print` rules in global `components.css` hide everything except `#print-reflection-output` while `body.printing-reflection` is set. An `afterprint` listener (registered on `window` in `connectedCallback`) clears the body class when the dialog closes.

This pipeline is **reflection-only**. Whole-topic-page print stylesheet remains the deferred §12 polish item.

### Topic-page integration

The Gas Laws topic page's `applyLevel(level)` inline function now has 5 steps:

1. Flip every `[data-variant]` block (existing, step 8).
2. Mirror level to the sim (existing).
3. Mirror to the HL toggle's checked state (existing).
4. Push level to every `<sim-engine>` (n/a — only one sim per page; no-op for this topic).
5. **Push level to every `<sim-checklist>`** so per-level state swaps with the toggle. (Phase 10A v2.)

The Reflect button's click handler calls `e.stopPropagation()` to prevent the checklist's outside-click handler from immediately re-closing. The button toggles via `toggleAttribute('data-open')` so a second click closes.

### What ships vs what's deferred

| Concern                                                 | Status                                    |
| ------------------------------------------------------- | ----------------------------------------- |
| `<sim-checklist>` as slide-out side panel from the left | Shipped                                   |
| Slot-based `<li>` API                                   | Shipped                                   |
| Per-topic-per-level localStorage                        | Shipped                                   |
| Free-text reflection textarea (debounced auto-save)     | Shipped                                   |
| .md download                                            | Shipped                                   |
| Save as PDF (reflection-only via `window.print()`)      | Shipped                                   |
| Reset button with confirm                               | Shipped                                   |
| Mutual exclusion with `<sim-data-card>`                 | Shipped                                   |
| Bell ringer / practice / exit ticket interactivity      | Deferred to Phase 10B                     |
| `<sim-reflection-export>` portfolio aggregator          | Deferred to Phase 10B                     |
| Whole-topic-page print stylesheet                       | Deferred to spec §12 polish               |
| Mobile/tablet responsive tweaks                         | Deferred (polish phase)                   |
| Animated check transitions, fancier progress bar        | Deferred                                  |
| More sophisticated mutual-exclusion choreography        | Deferred                                  |
| `<sim-engine>` private API → public                     | Deferred (still on step-6 follow-up list) |
| `<slot>` reinstatement in `<sim-coachmark>`             | Deferred (still on step-6 follow-up list) |

## Phase 10B — Interactive reflection portfolio

Three new custom elements complete the topic-page reflection portfolio: `<sim-text-response>` (inline textarea bound to a prompt; used 3× on the Gas Laws page for the exit ticket), `<sim-practice-question>` (do-then-reveal flow with 3-chip self-rating; used 1× for the practice question section), and `<sim-reflection-export>` (page-wide aggregator side panel; LEFT side, joins the existing mutual-exclusion contract). The bell ringer remains paper-based — its prompts ask students to label symbols and circle variables, verbs that don't translate cleanly to a textarea. The aggregator pulls state from every reflection component on the page on each open and each export click — state pull, not push. `<sim-checklist>` is refactored to expose `clear()` and to include `items` in `getState()`, while shedding its `exportPDF()` method and its in-panel `Download .md` / `Save as PDF` buttons.

### Architecture

- One instance of each new component per use site (topic-page convention; the aggregator is a singleton; text-response and practice-question are inline and instantiated per prompt).
- All three new components store per-instance state to localStorage with the standard `aisc-simengine:<kind>:<topic>:<level>:<id>` key shape.
- Each component observes `level` and force-flushes any pending debounce save to the OLD key BEFORE loading from the NEW key on attribute change. Same race-defense pattern as `<sim-checklist>` from Phase 10A v2.
- The aggregator stores no state of its own — its panel `[data-open]` attribute does not persist across reloads.

### State pull contract

The aggregator's source-of-truth is one `document.querySelectorAll('sim-checklist, sim-text-response, sim-practice-question')` call, performed:

- On every `_activate` (panel open) — to refresh the preview list.
- On every export click — to capture the latest state into the .md or PDF.

Each component exposes a `getState()` method whose return value is the canonical snapshot used for export. No event-bus subscription, no registry pattern. Adding a new reflection component later means: implement `getState()` on the new tag, add it to the aggregator's selector, done.

### Section grouping in the export

`section` attribute (`bell-ringer` / `exit-ticket` / `practice` / `success-criteria` / `misc`) becomes the heading bucket in both the .md and PDF output. Sections render in alphabetical order; within each section, components render in DOM order. Empty values render as `> *no response*` in markdown so blanks are visible to teachers reviewing the export.

### Mutual exclusion contract — three left-side participants

Phase 10A v2's contract: `<sim-data-card>` + `<sim-checklist>` dispatch + listen for `panel-opened` on `document`. Phase 10B adds `<sim-reflection-export>` as the third participant. Three left-side panels, only one open at a time. The contract:

- Each panel dispatches `panel-opened` with `{ source: this }`, bubbles + composed, on `_activate`.
- Each panel's `connectedCallback` registers a document listener for `panel-opened`. If the source is a different element AND the listening panel is `[data-open]`, it closes itself (`_dismiss()` for data-card; `close()` for checklist + export).
- Cleanup in `disconnectedCallback`.

`<sim-tweaks-panel>` (right side) stays independent — left-side-only by convention.

### Topic-page integration

The Gas Laws topic page's `applyLevel(level)` inline function gains a step 6 — push the new level to every `<sim-text-response>`, `<sim-practice-question>`, and `<sim-reflection-export>` on the page. Per-level state swap with the HL/SL toggle works for all six new component instances.

The sticky header now contains the HL toggle, the Tweaks button, and the new "Save your work" button (no emoji, ghost style) — both top-level session-control buttons live in the header. The Tweaks button was hoisted out of its prior in-page row as part of this commit, so the topic page no longer renders a separate button row above the sim. The Save-your-work click handler toggles the export panel's `[data-open]` with `e.stopPropagation()`. The Reflect button label drops its emoji prefix in the same commit so the topic page is emoji-free overall.

### Export pipeline (consolidated)

Markdown:

1. Aggregator's `exportMarkdown(triggerDownload)` calls `_scanSources()` + `_groupBySection()`.
2. Builds a string with H1 + level/date metadata + H2-per-section + per-component lines (text-response, practice-question, checklist all rendered inline with their own format).
3. If `triggerDownload === true`, creates a `Blob`, `URL.createObjectURL`, temporary `<a download>`, click, revoke.

PDF:

1. `exportPDF()` calls `_scanSources()` + builds a `#print-reflection-output` super-block via `_buildPrintBlock`.
2. Inserts (or `replaceWith`s) into `document.body`.
3. Adds `body.printing-reflection`, calls `window.print()`.
4. Reuses the existing `@media print` rules from `components.css` (added in Phase 10A v2). No new CSS needed.
5. `afterprint` window listener clears `body.printing-reflection` when the dialog closes.

### What ships vs what's deferred

| Concern                                                             | Status                                    |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `<sim-text-response>` inline component                              | Shipped                                   |
| `<sim-practice-question>` do-then-reveal + 3-chip rating            | Shipped                                   |
| `<sim-reflection-export>` page-wide aggregator side panel           | Shipped                                   |
| `<sim-checklist>` export consolidation (refactor)                   | Shipped                                   |
| Per-instance localStorage persistence (text-response, practice)     | Shipped                                   |
| Three-way mutual exclusion (data-card / checklist / export)         | Shipped                                   |
| Section grouping in markdown + PDF (alphabetical, DOM-order within) | Shipped                                   |
| Empty-portfolio guard                                               | Shipped                                   |
| Clear-all (with confirm)                                            | Shipped                                   |
| Topic-page emoji-free pass                                          | Shipped                                   |
| Mobile/tablet responsive panel tweaks                               | Deferred (polish phase)                   |
| Whole-topic-page print stylesheet                                   | Deferred (spec §12 polish)                |
| Cross-topic portfolio aggregator                                    | Deferred (out of scope; possibly never)   |
| Server-side persistence                                             | Deferred (out of scope; possibly never)   |
| Animated check transitions; fancier progress visuals                | Deferred                                  |
| `<sim-engine>` private API → public                                 | Deferred (still on step-6 follow-up list) |
| `<slot>` reinstatement in `<sim-coachmark>`                         | Deferred (still on step-6 follow-up list) |

## Topic-page print stylesheet

Two-mode print contract layered on top of the existing CSS:

- **Reflection-only mode** (Phase 10A v2 / PR #8): `<sim-reflection-export>.exportPDF()` synthesizes a `#print-reflection-output` block in `document.body`, adds `body.printing-reflection`, calls `window.print()`. The `@media print` rules gate on `.printing-reflection` and hide everything except the synthesized block. `afterprint` listener removes the class. Used for portfolio-only output.
- **Whole-page handout mode**: a teacher hits Cmd+P from the browser. `body.printing-reflection` is NOT set. The `@media print` rules gate on `body:not(.printing-reflection)` and produce a classroom handout: UI chrome hidden, sim section replaced with a "see online" placeholder via `attr(data-print-url)`, side panels hidden, link URL appendices suppressed, page-break hints on cohesive blocks.

The two modes don't compete because their selectors are mutually exclusive on the `.printing-reflection` class. The reflection-only rules ship in `components.css` (added in PR #8). The whole-page rules ship at the END of the same file, gated on the `:not(.printing-reflection)` selector.

### Per-component print rules

Components with shadow DOM (`<sim-text-response>`, `<sim-practice-question>`) carry their own `@media print` blocks inside `HOST_STYLES`. These scope to the shadow root via the singleton `adoptedStyleSheets` pattern and apply at print time alongside the global rules. Convention: every interactive component owns its print presentation. Future contributors adding a new interactive element should add the corresponding `@media print` block in HOST_STYLES — the regression test pattern from `sim-text-response.test.js` / `sim-practice-question.test.js` provides a template.

### Sim placeholder contract

The page author opts in to the sim placeholder by setting `data-print-url="<URL>"` on the `.sim-shell` element. The print rule:

```css
.sim-shell::after {
  content: 'Interactive simulation — see online at ' attr(data-print-url);
}
```

falls back to an empty URL string if the attribute is missing. The placeholder line still prints — useful even before the real URL is locked.

## Topic-page background sections

The Gas Laws topic page now includes a "topic-background" section between the topic introduction and the key concept. The pattern: a new `<section class="topic-background">` with two `data-variant` blocks (SL + HL) for level-adaptive prose. The existing `applyLevel(level)` function in the inline page script handles the toggle automatically — any future topic page can adopt the same shape with no JS changes.

The section is intended for historical context, real-world applications, and IB international-mindedness content. The `.topic-background` CSS rule uses an amber left-accent border, distinguishing it visually from the navy-accented `.topic-intro` (concept exposition). Future topic pages adopting this pattern should target the same convention so the visual rhythm carries across the curriculum.

For HL prose, a brief TOK (theory of knowledge) note is appropriate when the historical narrative supports it. SL prose distills the same lesson into one accessible sentence.
