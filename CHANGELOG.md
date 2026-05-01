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

### Step 5b — Gas Laws extensions (HL physics + MB graph + presets)

Twelve commits adding the IB SL/HL syllabus extensions and folding in three high-priority sweep cleanups deferred from steps 4 and 5. Eleven planned commits plus one in-flight test fix-up (the dt-clamp test was tautological under fake rAF; rewritten to capture the rAF callback and invoke with controlled `now`). One commit (commit 6) also corrected a 1000× error in species `a` constants discovered during TDD — caught by the implementer's hand-computed math when the "diverges below ideal" test failed under the spec's parameters.

- `fix(core)`: collect state listener unsubs in gas-laws sim dispose (listener leak)
- `fix(core)`: clamp `dt` at rAF boundary to handle backgrounded tabs
- `test(core)`: make dt-clamp test actually drive RED→GREEN
- `feat(core)`: implement `controls.createDropdown`
- `refactor(core)`: gas-laws — abstract pressure via `_pressureFn`
- `feat(core)`: gas-laws — multiple species (ideal/He/N₂/CO₂)
- `feat(core)`: gas-laws — VdW pressure for non-ideal species (also corrects species `a` constants by 1000×)
- `feat(core)`: gas-laws — HL toggle and Ideal-vs-Real graph
- `feat(core)`: gas-laws — Maxwell-Boltzmann distribution graph
- `feat(core)`: gas-laws — teacher presets (Boyle/Charles/Ideal-vs-Real)
- `feat(examples)`: smoke test page adds HL mode checkbox
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 103 (was 75 after step 5; +28 new).

**Public surface added:** species table (`SPECIES`, `SPECIES_OPTIONS` exposed via `species` state key); `controls.createDropdown` real implementation; `vdWPressure`, `speedHistogram`, `maxwellBoltzmann2D` in physics; `particles.getSpeeds()`; `gas-laws.scenarios` with 3 IB scenarios.

**Deferred to a future polish PR (~25 items):** state.set no-op skip, recordTrial JSDoc, recorder.size accessor, search palette UI, measured pressure, particle-particle collisions, exportPNG, MB Y-axis auto-scale, preset dropdown auto-revert to custom, `<sim-engine>.scenario()` attribute-aware writes, sim init re-entrancy hardening, HL graph skip-on-V-change, and others.

### Step 6 — Supporting components for the topic page

Ten commits adding the five supporting web components from spec §3 plus two polish folds-in.

- `fix(examples)`: replace HL checkbox with styled toggle switch (.sim-switch)
- `feat(core)`: gas-laws — move species dropdown to top of rail
- `feat(data)`: seed core.json, sources.json, glossary.json, schema
- `feat(core)`: <sim-data-pill> custom element — clickable inline data values
- `feat(core)`: <sim-data-card> popover with source citation + focus trap
- `feat(core)`: <sim-glossary-term> inline tooltip with EAL definitions
- `feat(core)`: <sim-tweaks-panel> teacher config + sim tweaks contract
- `feat(core)`: <sim-coachmark> + dismissCoachmark real impl (was stub from step 4)
- `feat(examples)`: smoke test page demonstrates all step 6 components
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 140 (was 105 after step 5b; +35 new across both packages).

**Public surface added to `@TBD/simengine`:**

- 5 new custom elements: `<sim-data-pill>`, `<sim-data-card>`, `<sim-glossary-term>`, `<sim-tweaks-panel>`, `<sim-coachmark>`. All auto-defined.
- `host.dismissCoachmark(id)` real implementation.
- Sim contract gains optional `tweaks: [...]` array (parallel to `controls` and `scenarios`).
- gas-laws declares 2 tweaks: `showHLGraph`, `showMBGraph`.

**Public surface added to `@TBD/simengine-data`:**

- `getValue(ref)`, `getSource(sourceId)`, `getGlossaryTerm(ref)`, `loadCore()`, `loadSources()`, `loadGlossary()`, `validate()`.
- Step 6 ships ~10 numeric entries + 4 glossary terms; step 7's database drop will expand both.

**Known follow-ups (deferred to sweep):**

- Promote `<sim-engine>`'s private `_sim` and `_state` access to a public API (`getTweaks()`, `subscribeToState(key, fn)`) used by `<sim-tweaks-panel>`.
- Reinstate proper `<slot>` composition in `<sim-coachmark>` (currently composes via direct `textContent` copy due to a happy-dom 15.x slot-projection limitation).
- ~25 sweep items carried over from step 5b (positioning polish, animation, multi-pill coordination, etc.).

### Step 8 — Topic page wrap

Four commits composing the step-6 components into a polished Gas Laws topic page (`examples/topic-page/index.html`) demonstrating the spec §3 layout end-to-end.

- `feat(core)`: add `.topic-header` / `.topic-intro` / `.topic-next` styles
- `feat(examples)`: topic-page scaffold + lede + sim region (sticky header, lede with glossary terms + data pill, equation panel with data pills, sim, tweaks panel, inline variant-toggle script)
- `feat(examples)`: topic-page post-sim sections + variant content (bell ringer, topic intro with `default-sl` + `default-hl` variants, key concept, LISC, worked example, practice + hidden answer, command term, mark scheme, misconceptions, exit ticket, what's next)
- `docs`: this CHANGELOG entry + architecture.md update

**Phase 8a (post-review polish, three additional commits):**

- `feat(core)`: topic-page polish CSS — adds `.ib-understandings` block style and a `.sim-wrap.topic-page` modifier that caps the topic-page content area at 1100px (down from the default 1440px) so reading-heavy prose doesn't sprawl on large monitors.
- `refactor(examples)`: align topic-page content to IB S1.5 syllabus. Removes all van der Waals references from the page (the IB Gas Laws syllabus does not cover VdW). Page title, kicker, lede, equation panel, and the HL topic-intro variant are reworked. The HL variant now derives `PV = nRT` from Boyle (1662), Charles (1787), Gay-Lussac (1809), and Avogadro's law. Adds an "IB Understandings" section between Key Concept and Equation Panel with paraphrased S1.5.1–S1.5.4 statements (cited "IB Chemistry Guide 2025"). The "What's next" link updates to S2.1 — The ionic model (the actual next topic in the IB sequence). The `vdw-co2-a`, `vdw-co2-b`, and `van-der-waals` data entries remain in `@TBD/simengine-data` since they're real reference values used by the sim (CO₂ species), just no longer surfaced on the topic page.
- `docs`: this addendum + architecture.md update.

**Test count:** 140 (unchanged from step 6 — step 8 is HTML + CSS only, no new tests).

**New CSS classes in `components.css`:**

- `.topic-header` — sticky page-level header
- `.topic-intro` — adaptive-content prose block with `[data-variant][hidden]` rule
- `.topic-next` — next-topic link card (with `--disabled` modifier)
- `.ib-understandings` — IB syllabus understandings block (added in phase 8a)
- `.sim-wrap.topic-page` — narrower content cap (1100px) for topic pages (added in phase 8a)

**Page-level prefs persistence:** HL/SL toggle saves to `localStorage` under `aisc-simengine:prefs:s1.5-gas-laws`. Reload preserves the choice and restores both the sim's level attribute AND the visible content variant.

**Known follow-ups (deferred):**

- Markdown content authoring pipeline (spec §8 — future "step 8b").
- Real production-ready content for placeholder sections (spec §9 — future "step 8c").
- Teacher view + `<sim-data-map>` flowchart + lesson plan tie-in (spec §11 — future "step 9").
- EAL variants (bundled with eventual content authoring phase).
- Print stylesheet, print button (spec §12 polish).
- Real "What's next" topic link (deferred until a second topic exists).
- Two follow-up tasks from step 6 still queued: promote `<sim-engine>` private API to public, reinstate `<slot>` in `<sim-coachmark>`.

### Phase 9 — `<sim-data-card>` slide-out side panel

Three commits refactoring `<sim-data-card>` from an inline-anchored absolute popover (which shifts surrounding page content when it opens) into a singleton fixed slide-out side panel. One card per page; pills emit `data-pill-clicked` events; the card listens globally and updates content in place when different pills are clicked.

- `feat(core)`: redesign `<sim-data-card>` as singleton slide-out + `<sim-data-pill>` emits events
- `feat(examples)`: topic-page + smoke test add singleton `<sim-data-card>`
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 140 → 143 (+3 net). `<sim-data-card>` test file rewritten for the singleton + event-driven model (6 → 9 tests, +3). `<sim-data-pill>` test file rewritten for the slimmed-down pill (7 → 7 tests; 2 old tests dropped, 2 new added).

**Public surface changes (`@TBD/simengine`):**

- `<sim-data-card>` is now a singleton: pages must include exactly one `<sim-data-card></sim-data-card>` element. Visibility is controlled via the `[data-open]` attribute (was `[hidden]`).
- `<sim-data-pill>` no longer creates a child `<sim-data-card>`. Click emits `data-pill-clicked` (existing event); the singleton listens.
- Card position: `position: fixed; top: 80px; left: 16px; width: 320px` (was absolute, anchored to pill). Slides in from the left; the tweaks panel still slides in from the right; both can be open simultaneously without overlap.

**Resolved:** the deferred sweep item from step 6 — "Data-pill 'one card open at a time' coordination across multiple pills on a page." With one card per page, only one card can be open.

**Known follow-ups (still deferred):**

- The two follow-up tasks from step 6 — promote `<sim-engine>` private API to public; reinstate `<slot>` in `<sim-coachmark>`.
- Mobile/tablet responsive layout for the card (`top: 80px; left: 16px; width: 320px` may need media queries on narrow viewports).
- Animated content-swap when a different pill is clicked while the card is open (currently the swap is instant — no fade/slide).
- Singleton-detection warning if a page accidentally mounts two `<sim-data-card>` elements.
- Phase 10's success-criteria interactive checklist with export — its own design phase next.

### Phase 10A v2 — Side-panel checklist + reflection export

Four commits introducing `<sim-checklist>` as a slide-out side panel from the left, mutually exclusive with `<sim-data-card>`. The Gas Laws topic page's static success-criteria column gets a "📝 Reflect on these criteria" button that opens the panel containing interactive checkboxes + a free-text reflection textarea + .md / PDF export.

This phase **supersedes phase 10A v1 (PR #7)**, which shipped an inline-replacement implementation. After live review, the user preferred the side-panel UX from phase 9 (`<sim-data-card>`) over the inline replacement of the LISC SC column. PR #7 was closed unmerged; v1 design + plan docs remain in main as a historical record of the iteration.

- `feat(core)`: `<sim-checklist>` custom element — slide-out side panel
- `feat(core)`: `<sim-data-card>` mutual exclusion via panel-opened events
- `feat(examples)`: topic-page success-criteria reverts to static + adds Reflect side panel
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** +12 net (11 new in `sim-checklist.test.js` + 1 new in `sim-data-card.test.js`).

**Public surface added (`@TBD/simengine`):**

- New custom element `<sim-checklist topic="..." level="..." label="...">` with slotted `<li>` API. Auto-defined as a side effect of importing the core package.
- Five events (bubbles + composed): `panel-opened`, `panel-closed`, `checklist-changed`, `checklist-exported`, `checklist-reset`.
- Imperative API on the element instance: `open()`, `close()`, `getState()`, `exportMarkdown(triggerDownload?)`, `exportPDF()`.
- New mutual-exclusion contract: `<sim-data-card>` and `<sim-checklist>` listen for `panel-opened` on `document` and close themselves if the source is a different element. Same contract is available to any future left-side panel.
- Print stylesheet rules for `body.printing-reflection` + `#print-reflection-output` in `components.css` — used by `<sim-checklist>.exportPDF()` to print the reflection without the rest of the page.

**Persistence:** localStorage key `aisc-simengine:checklist:<topic>:<level>` (separate state per level).

**Known follow-ups (deferred to Phase 10B):**

- `<sim-text-response>` for bell ringer + exit ticket interactivity.
- `<sim-practice-question>` with answer-reveal-and-compare flow.
- `<sim-reflection-export>` aggregator that pulls state from all interactive components on the page into a single portfolio export. Phase 10A v2's export pipeline becomes the foundation; 10B refactors export OUT of the checklist into the aggregator.

**Other deferred polish (still queued):**

- Mobile/tablet responsive tweaks for the side panel.
- Whole-topic-page print stylesheet (spec §12 polish — distinct from the reflection-only print added here).
- Animated check transitions; fancier progress bar.
- More sophisticated mutual-exclusion choreography (e.g., wait for sibling slide-out to complete before sliding in — current runs both transitions concurrently).
- The two follow-up tasks from step 6 — `<sim-engine>` private API to public; reinstate `<slot>` in `<sim-coachmark>`.

### Notes

- npm package scope is `@TBD/*` (placeholder). It will be replaced with the final scope before any publish.
- `recorder.download()` from the legacy `SimEngine.DataCollector` is intentionally deferred — it requires a real DOM and lands with browser-level test infrastructure.
- The other 31 prototype sims remain in the IB Chemistry project's legacy SimEngine folder and are out of scope for this repository (see spec §0 non-goals).
