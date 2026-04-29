# Step 6 — Supporting components — design

**Author:** Matthew Ignash (with Claude planning support)
**Date:** 2026-04-30
**Status:** approved, ready for implementation
**Predecessor:** `docs/plans/2026-04-30-step5b-gas-laws-extensions-design.md` (step 5b complete; merged in PR #3)

## Context

Steps 4 and 5/5b shipped a working ideal-and-VdW Gas Laws sim with three graphs, multiple species, presets, and an HL toggle. Step 6 ships the five supporting web components from spec §3 — the components that wrap the sim into a polished topic page (clickable data values with citations, EAL inline glossary, teacher-facing config panel, in-sim contextual hints). Plus two polish folds-in: replace the smoke test's HL/SL checkbox with a styled toggle switch, and reorder the gas-laws sim's rail so the species dropdown sits next to the preset dropdown at top (currently buried below sliders and graphs).

The reference data layer (`packages/data/`) gets its first real seed in this step — a minimal `core.json` + `sources.json` with R, kB, Avogadro, species molar masses, and a few VdW constants, plus a JSON schema. Step 7's full database drop layers onto the same API.

## Decisions locked during brainstorming

| Decision                        | Choice                                                                                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 6 scope                    | All 5 components + toggle UX + species reorder                                                                                                           |
| Ordering                        | Approach A — data layer first, then components in dependency order                                                                                       |
| Toggle UX                       | Styled `.sim-switch` (CSS-only switch over native checkbox)                                                                                              |
| Species rail position           | Top of rail next to preset dropdown                                                                                                                      |
| Data layer                      | JSON files (`core.json`, `sources.json`, `schema.json`) + JS API in `packages/data/src/index.js`                                                         |
| Pill→card relationship          | Pill renders child `<sim-data-card>` in shadow DOM (Option A — self-contained)                                                                           |
| Glossary data                   | `packages/data/src/glossary.json` + `getGlossaryTerm` API                                                                                                |
| Tweaks panel data               | Sims declare optional `tweaks` array on the sim module                                                                                                   |
| Coachmark scope                 | Rendering primitive + one example coachmark on first gas-laws mount (anchored to T slider). Trigger conditions beyond "first mount" defer to a sweep PR. |
| Coachmark dismissal persistence | `localStorage` per id (`aisc-simengine:coachmark:dismissed:<id>`)                                                                                        |

## Architecture

### File layout (additions)

```
packages/
├── core/
│   ├── src/
│   │   ├── components/
│   │   │   ├── sim-data-pill.js        # NEW
│   │   │   ├── sim-data-card.js        # NEW
│   │   │   ├── sim-glossary-term.js    # NEW
│   │   │   ├── sim-tweaks-panel.js     # NEW
│   │   │   └── sim-coachmark.js        # NEW
│   │   ├── sims/gas-laws/
│   │   │   └── index.js                # MODIFY: rail reorder + tweaks array + first-mount coachmark
│   │   ├── components/sim-engine.js    # MODIFY: dismissCoachmark real impl
│   │   ├── styles/components.css       # MODIFY: .sim-switch + .sim-glossary-term + .sim-coachmark
│   │   └── index.js                    # MODIFY: side-effect imports for new components
│   └── tests/
│       ├── sim-data-pill.test.js       # NEW (~7 tests)
│       ├── sim-data-card.test.js       # NEW (~6 tests)
│       ├── sim-glossary-term.test.js   # NEW (~5 tests)
│       ├── sim-tweaks-panel.test.js    # NEW (~5 tests)
│       └── sim-coachmark.test.js       # NEW (~5 tests)
└── data/
    ├── src/
    │   ├── core.json                   # NEW
    │   ├── sources.json                # NEW
    │   ├── glossary.json               # NEW
    │   ├── schema.json                 # NEW
    │   └── index.js                    # NEW (getValue, getSource, getGlossaryTerm, loadCore, loadSources, validate)
    ├── tests/
    │   └── data.test.js                # NEW (~6 tests)
    ├── package.json                    # MODIFY: add test script
    └── vite.config.js                  # NEW
```

Modified: `examples/vanilla-html/index.html` — adds glossary terms + data pill in the lede; toggles HL via the new switch; adds Tweaks button + `<sim-tweaks-panel>`.

### Polish (commits 1 + 2)

**Commit 1 — `.sim-switch` styled toggle.** Add the CSS to `packages/core/src/styles/components.css`. Smoke test HTML uses `<label class="sim-switch"><input type="checkbox"><span class="sim-switch__track"></span><span class="sim-switch__label">HL mode</span></label>`. Native checkbox under the hood for keyboard/SR/form behavior.

**Commit 2 — Species dropdown moves to top of rail.** In `gas-laws/index.js` `init(host)`, reorder so the rail receives: preset dropdown → species dropdown → P-V graph → HL graph → MB graph → T slider → V slider → n slider. One new test asserts the order.

### Data layer (commit 3)

`packages/data/src/sources.json` — citation registry (`ib-booklet-2025`, `nist-codata-2018`, `iupac-2016`).

`packages/data/src/core.json` — values keyed by ref. Each entry: `{ value, unit, symbol, name, source, description }`. Step 6 ships ~10 entries (R, kB, Avogadro, three species molar masses, three VdW constants).

`packages/data/src/glossary.json` — terms keyed by ref. Each: `{ term, definition }`. Step 6 ships ~4 terms (pressure, ideal-gas, van-der-waals, kinetic-energy).

`packages/data/src/schema.json` — JSON Schema (draft-7) for validation.

`packages/data/src/index.js` — public API:

- `getValue(ref)` — returns the entry or null.
- `getSource(sourceId)` — returns the citation or null.
- `getGlossaryTerm(ref)` — returns the glossary entry or null.
- `loadCore()`, `loadSources()` — full graph access.
- `validate()` — runs at import time, throws on bad refs.

### Components (commits 4–8)

Each is a vanilla custom element with shadow DOM, JSDoc-typed exports, and adopted constructable stylesheets.

**`<sim-data-pill ref="...">`** — clickable inline data value. Looks up via `getValue`. On click, toggles a child `<sim-data-card>` (also in shadow DOM). Outside-click and Escape close. Emits `data-pill-clicked` with `detail: { ref }`. Unknown ref renders inline error marker.

**`<sim-data-card ref="...">`** — popover with symbol, name, value+unit, description, source citation, "Copy citation" + optional "View source" link. Uses foundation `trapFocus` for modal-like focus management. Hidden by default (parent toggles `hidden`). Close button + Escape dismiss; emits `data-card-closed`.

**`<sim-glossary-term ref="...">term</sim-glossary-term>`** — inline tooltip. Slot brings in user-visible underlined text. On hover (200ms delay) or focus, tooltip appears with full definition. Tap pins (toggle on subsequent click). Escape closes pinned. ARIA `role="tooltip"` + `aria-describedby` linkage. Unknown ref renders text plain (no underline) with a console.warn.

**`<sim-tweaks-panel for="sim-id">`** — teacher-facing floating panel. Queries the referenced `<sim-engine>` for its `tweaks: [...]` array, renders one `.sim-switch` per tweak. Each tweak: `{ id, label, stateKey, on, off, asAttribute? }` — `asAttribute: true` writes via `setAttribute` (for attribute-mirrored keys like `level`). Subscribes to state changes via `_unsubs` so external changes (e.g., HL checkbox) sync the switches. Close button + Escape close. Slides in via `[data-open]` attribute.

**`<sim-coachmark id="..." anchor="...">text</sim-coachmark>`** — contextual hint anchored to a CSS-selector-resolved element. Positions absolutely (above the anchor when room, below otherwise). Slot brings in the hint text. Recomputes position on resize. "Got it" button dismisses; Escape dismisses; emits `coachmark-shown` with `detail: { id, dismissed: true }`. Persists dismissal in `localStorage` keyed by id. `<sim-engine>.dismissCoachmark(id)` is now a real implementation (was a stub from step 4).

### Sim contract additions

Sims may declare an optional `tweaks: [...]` array (parallel to `controls` and `scenarios`). The `<sim-tweaks-panel>` consumes this. gas-laws declares two tweaks for step 6: `showHLGraph` (level via attribute) and `showMBGraph` (state). The MB-graph hide path is added to gas-laws `init` to honor `state.showMBGraph`.

gas-laws `init` also adds a first-mount coachmark anchored to the T slider, gated on `localStorage` (so the hint doesn't re-show after dismissal). Wrapped in `typeof localStorage !== 'undefined'` for happy-dom safety.

## Smoke test page

The smoke test becomes the canonical "step 6 working together" demo:

- Lede paragraph contains 2 glossary terms (`pressure`, `van-der-waals`) and 1 inline data pill (`gas-constant-R`).
- HL mode `.sim-switch` (replaces checkbox) and a `⚙ Tweaks` button sit in a row above `<sim-engine>`.
- `<sim-tweaks-panel for="sim">` mounted alongside the sim; opens via the Tweaks button.
- Coachmark mounts automatically inside the sim 1.5s after first load.

Manual visual verification only — no automated test for the smoke page itself.

## Sequencing — 10 commits

| #   | Commit                                                                | Tests | Cum |
| --- | --------------------------------------------------------------------- | ----- | --- |
| 1   | `fix(examples): replace HL checkbox with styled toggle switch`        | 0     | 105 |
| 2   | `feat(core): gas-laws — move species dropdown to top of rail`         | +1    | 106 |
| 3   | `feat(data): seed core.json, sources.json, glossary.json, schema`     | +6    | 112 |
| 4   | `feat(core): <sim-data-pill> custom element`                          | +7    | 119 |
| 5   | `feat(core): <sim-data-card> popover with source citation`            | +6    | 125 |
| 6   | `feat(core): <sim-glossary-term> inline tooltip`                      | +5    | 130 |
| 7   | `feat(core): <sim-tweaks-panel> teacher config + sim tweaks contract` | +5    | 135 |
| 8   | `feat(core): <sim-coachmark> + dismissCoachmark real impl`            | +5    | 140 |
| 9   | `feat(examples): smoke test page demonstrates all step 6 components`  | 0     | 140 |
| 10  | `docs: update CHANGELOG and architecture for step 6`                  | 0     | 140 |

End state: ~140 tests (start was 105). Bundle expected to grow ~6–10 kB (5 new components + data layer + minor styles).

## Step 6 exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — ~140 tests green across both packages (`core` and `data`).
4. `pnpm build` produces ESM + IIFE bundles for `core`; `data` ships as JSON + JS modules.
5. `examples/vanilla-html/index.html` (after `pnpm build`) shows:
   - HL mode as a styled switch (not a checkbox).
   - Species dropdown at the top of the rail next to the preset dropdown.
   - Lede paragraph has underlined glossary terms (hover for tooltip) and an inline data pill (click for source card).
   - "⚙ Tweaks" button opens a teacher-config panel with switches for HL graph and MB graph.
   - On first load, a coachmark anchored to the T slider explains it; "Got it" dismisses; reload doesn't re-show it.
6. CI green on PR; merged to main.

### What's deferred to a future polish PR (~30 items)

Carrying forward from step 5b's sweep list (~25 items) plus new step-6-specific deferrals:

- Coachmark trigger conditions beyond first-mount (error states, after-N-trials)
- Tweaks panel persisting open/closed state across reloads
- Data-pill "one card open at a time" coordination across multiple pills on a page
- Glossary-term touch-pin auto-dismiss timeout
- Data-card "Copy citation" extended formats (BibTeX, MLA)
- Coachmark animation/positioning polish (collision avoidance, max-width)
- Tweaks panel slide-in animation polish
- All ~25 deferred items from step-5b sweep (state.set no-op skip, recordTrial JSDoc, etc.)

### What you will NOT have at the end of step 6 (and that is correct)

- Real reference data integration (step 7, blocked on database drop) — step 6 ships ~10 mock entries.
- Topic page wrap (step 8) — components exist but aren't yet composed into a full topic page.
- Content authoring pipeline (step 8) — markdown source for topic content lands later.
- Teacher view's data-source map flowchart (step 11).
