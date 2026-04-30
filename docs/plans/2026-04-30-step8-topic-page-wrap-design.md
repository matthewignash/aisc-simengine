# Step 8 — Topic page wrap — design

**Author:** Matthew Ignash (with Claude planning support)
**Date:** 2026-04-30
**Status:** approved, ready for implementation
**Predecessor:** `docs/plans/2026-04-30-step6-supporting-components-design.md` (step 6 complete; merged in PR #4)

## Context

Steps 1–6 shipped the foundation, the engine skeleton, the `<sim-engine>` shell, the working Gas Laws sim with VdW physics + HL toggle + multiple species + presets, and the five supporting components (`<sim-data-pill>`, `<sim-data-card>`, `<sim-glossary-term>`, `<sim-tweaks-panel>`, `<sim-coachmark>`) plus the `packages/data/` first seed. Step 7 (full reference data integration) is blocked on the user's database drop — deferred.

Step 8 composes everything into the polished Gas Laws topic page that the spec §3 calls for — the canonical "this is what a finished topic looks like" deliverable. It is intentionally narrower than the spec's combined §8–§11 (which includes a markdown-pipeline build, full content authoring, the page assembly, AND the teacher view): step 8 here is **just the page assembly** with realistic placeholder content. The markdown pipeline, full content, EAL variants, teacher view, and print stylesheet each become their own follow-up phase.

## Decisions locked during brainstorming

| Decision            | Choice                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope               | Topic page assembly only (spec §10). Defer markdown pipeline (§8 spec), full content (§9 spec), teacher view (§11 spec), print stylesheet (§12 spec).                         |
| Content treatment   | Realistic placeholders. Real prose for lede + key concept + equation panel. Plausible-but-clearly-placeholder for everything else. ~800 words total.                          |
| Adaptive variants   | `default-sl` + `default-hl` only. No EAL in this phase.                                                                                                                       |
| Page-level controls | New sticky `.topic-header` with HL/SL toggle + `localStorage` persistence under `aisc-simengine:prefs:s1.5-gas-laws`. No EAL toggle, no teacher-view toggle, no print button. |
| File location       | New `examples/topic-page/index.html`. Existing `examples/vanilla-html/index.html` smoke test stays put.                                                                       |
| Infrastructure      | Pure HTML + CSS additions. Inline `<script>` for the variant toggle + prefs persistence. No new modules in `packages/core/src/`. No new web components. No new tests.         |

## Architecture

### File layout

```
examples/topic-page/
└── index.html              # NEW — the polished Gas Laws topic page

packages/core/src/styles/
└── components.css          # MODIFY — append .topic-header, .topic-intro, .topic-next CSS rules

CHANGELOG.md                # MODIFY — Step 8 entry
docs/architecture.md        # MODIFY — Step 8 section
```

The topic page loads the four design-system stylesheets (`tokens.css`, `base.css`, `components.css`, `sim-shell.css`) plus the IIFE bundle (`packages/core/dist/index.global.js`). All five step-6 components are auto-defined via the bundle's side-effect imports. No bundle changes; no new sim modules.

### The 14 page sections

The spec §3 lists 18 numbered sections; step 8's scope omits teacher-view items 16–18, leaving 14 to render:

| Spec §   | CSS class                     | Content treatment             | Notes                                                                                                          |
| -------- | ----------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1        | `.sim-topstrip`               | **Real**                      | Existing — breadcrumb + syllabus badge                                                                         |
| 2 (new)  | `.topic-header` (new)         | **Real**                      | Sticky, HL/SL toggle + localStorage prefs                                                                      |
| 3        | `.sim-head`                   | **Real** lede                 | 2 `<sim-glossary-term>` + 1 `<sim-data-pill>` (mirrors smoke test pattern)                                     |
| 4        | `.ib-bellringer`              | Placeholder                   | One realistic 5-min retrieval prompt                                                                           |
| 5        | `.topic-intro` (new)          | **Real** prose, both variants | 2–3 paragraphs each for `default-sl` and `default-hl`. Glossary terms inline.                                  |
| 6        | `.ib-concept`                 | **Real**                      | One sentence: _"Pressure, volume, temperature, and amount of gas are linked through the equation `PV = nRT`."_ |
| 7        | `.ib-equation`                | **Real**                      | `PV = nRT` with each constant as a `<sim-data-pill>`                                                           |
| 8        | `.ib-lisc`                    | Placeholder                   | 3 intentions + 3 success criteria                                                                              |
| 9        | `<sim-engine>`                | Existing                      | Same instance as smoke test, with sibling `<sim-tweaks-panel for="sim">`; coachmark wired automatically        |
| 10       | `.ib-worked`                  | Placeholder                   | One worked problem with 3-step walkthrough                                                                     |
| 11       | `.ib-practice` + `.ib-answer` | Placeholder                   | One question with `<details>`-hidden answer                                                                    |
| 12       | `.ib-command-card`            | **Real**                      | One card defining "calculate" per IB Chemistry Guide 2025                                                      |
| 13       | `.ib-mark`                    | Placeholder                   | 2 mark points                                                                                                  |
| 14       | `.ib-misc`                    | Placeholder                   | One realistic right-vs-wrong example                                                                           |
| 15       | `.ib-exitticket`              | Placeholder                   | 3 reflection questions                                                                                         |
| 16 (new) | `.topic-next` (new)           | Placeholder                   | Disabled link card: "Next topic: S1.6 — Avogadro's law (coming soon)"                                          |

### CSS additions to `components.css`

Three new rule blocks appended at the end:

**`.topic-header`** (~30 lines) — sticky page-level header with breadcrumb on the left and HL/SL toggle on the right. Uses `position: sticky; top: 0; z-index: 50;`, design tokens for color/spacing.

**`.topic-intro`** (~10 lines) — adaptive-content prose block. `max-width: 70ch` for readability, generous line-height. The `[data-variant][hidden] { display: none; }` rule is the runtime hook for variant switching.

**`.topic-next`** (~15 lines) — next-topic link card. Has a `--disabled` modifier with `opacity: 0.6; pointer-events: none;` for the placeholder state.

All tokens used (`--sp-*`, `--ib-ink-*`, `--ib-white`, `--ib-navy-*`, `--font-sans`, `--fs-*`, `--r-md`, `--el-1`) are verified defined in `tokens.css`. No `--ib-teal` / `--fs-13` / `--ib-ink-50`-style gaps.

**Total CSS added: ~55 lines.**

### Inline `<script>` for variant toggle + prefs

A single `<script>` block at the bottom of `examples/topic-page/index.html`, ~30 lines of vanilla JS. Responsibilities:

1. `loadPrefs()` / `savePrefs()` — `localStorage` read/write under `aisc-simengine:prefs:s1.5-gas-laws`, wrapped in try/catch for graceful degradation.
2. `applyLevel(level)` — flips every `[data-variant]` block to show/hide based on `default-${level}` match; mirrors the level via `setAttribute('level', …)` on the sim; mirrors to the header toggle's checked state.
3. On load: restore from prefs (default `sl`), call `applyLevel`.
4. Wire the header HL/SL toggle: on change, `applyLevel(level)` + `savePrefs({ level })`.
5. Wire the Tweaks button: same pattern as the smoke test (`toggleAttribute('data-open')`).

### Bidirectional level-toggle synchronization (free)

The Tweaks panel's HL switch (commit 7's bidirectional state-sync) keeps in sync with the header toggle automatically because:

- Tweaks panel listens on `state.on('level', …)` and reflects state changes into its switch.
- The inline script's `applyLevel()` calls `setAttribute('level', …)` on the sim, which triggers `<sim-engine>`'s `attributeChangedCallback('level')` → `state.set('level', …)` → fires listeners.

So flipping HL via the sticky header AND via the tweaks panel both end up writing the same state path. Verified mentally; no code changes needed beyond the inline script.

### Initial-load race (accepted)

`<sim-engine>` defines via `queueMicrotask`, so on first load the inline script's `applyLevel(initialLevel)` runs before the sim's `connectedCallback`. The `setAttribute('level', 'hl')` call lands _before_ the engine's init runs and reads the attribute — which is fine because the engine reads `getAttribute('level')` at init time. If this becomes flaky in practice, we add `await Promise.resolve()` before `applyLevel`.

## Testing scope

**No new automated tests.** The deliverable is HTML + CSS + ~30 lines of inline JS. Component-level coverage from steps 4–8 already covers all the moving pieces:

| Behavior                                               | Tested in                              |
| ------------------------------------------------------ | -------------------------------------- |
| `<sim-data-pill>` opens card on click                  | `sim-data-pill.test.js` (commit 4)     |
| `<sim-glossary-term>` shows tooltip on hover           | `sim-glossary-term.test.js` (commit 6) |
| `<sim-tweaks-panel>` syncs with external state changes | `sim-tweaks-panel.test.js` (commit 7)  |
| `<sim-coachmark>` persists dismissal in `localStorage` | `sim-coachmark.test.js` (commit 8)     |
| `<sim-engine>.setAttribute('level', ...)` flips state  | `sim-engine.test.js`                   |

The only step-8-specific behavior is "the variant toggle flips `[data-variant]` blocks" — five lines of `querySelectorAll` + `el.hidden = boolean`, which would just be testing the platform.

**Total tests at end of step 8: 140** (unchanged from end of step 6).

Verification is **manual visual** — open `examples/topic-page/index.html` in a browser and run through the exit-criteria checklist.

## Sequencing — 4 commits

| #   | Commit                                                              | Cum tests |
| --- | ------------------------------------------------------------------- | --------- |
| 1   | `feat(core): add .topic-header / .topic-intro / .topic-next styles` | 140       |
| 2   | `feat(examples): topic-page scaffold + lede + sim region`           | 140       |
| 3   | `feat(examples): topic-page post-sim sections + variant content`    | 140       |
| 4   | `docs: update CHANGELOG and architecture for step 8`                | 140       |

Why split commits 2 and 3? Commit 2 is the structural skeleton (header + sim + inline script — verifies the page wiring works before content lands). Commit 3 is content authoring — easy to review/iterate on prose without it intermixed with structural changes.

## Step 8 exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — **140 tests** still green (no regressions).
4. `pnpm build` produces ESM + IIFE bundles. Bundle size unchanged from step 6 (no JS additions to `packages/core/src/`).
5. `examples/topic-page/index.html` (after `pnpm build`) opens in a browser and shows:
   - Sticky `.topic-header` with breadcrumb left, HL/SL toggle right.
   - 14 ordered sections per spec §3 (omitting teacher-view + EAL items).
   - Lede has 2 underlined glossary terms + 1 inline data pill.
   - Equation panel has data pills for R and species molar masses.
   - HL toggle in sticky header flips both: sim's Ideal-vs-Real graph AND the topic-intro prose between SL and HL variants.
   - Tweaks button opens the tweaks panel.
   - Coachmark anchored to T slider appears 1.5s after first load; "Got it" dismisses; reload doesn't re-show.
   - "What's next" card is visibly disabled with placeholder text.
6. Page-level prefs persist: reload retains HL/SL choice (verify via `localStorage.getItem('aisc-simengine:prefs:s1.5-gas-laws')`).
7. CI green on PR; merged to `main`.

### What you will NOT have at the end of step 8 (and that is correct)

- Markdown content authoring pipeline — deferred (spec §8 / future "step 8b").
- Real production-ready content for worked examples, practice questions, mark schemes, misconceptions — deferred (spec §9 / future "step 8c").
- Teacher view + `<sim-data-map>` flowchart + lesson plan tie-in — deferred (spec §11 / future "step 9").
- EAL variants — bundled with eventual content authoring phase.
- Print stylesheet, print button — deferred (spec §12 polish).
- Real "what's next" topic link — deferred until a second topic exists.
- Two follow-up tasks from step 6 still queued: promote `<sim-engine>` private API to public, reinstate `<slot>` in `<sim-coachmark>`.
