# Phase 10B — Interactive Reflection Portfolio Design

**Date:** 2026-05-02
**Predecessor:** Phase 10A v2 (PR #8 merged) + a11y polish (PR #9 awaiting review).
**Companion plan:** `docs/plans/2026-05-02-phase10b-reflection-portfolio-implementation.md` (forthcoming, written by `superpowers:writing-plans`).

---

## Goal

Add three new interactive components that complete the page-wide reflection portfolio for the Gas Laws topic page:

1. `<sim-text-response>` — inline textarea under a prompt. Used for bell ringer (3 prompts) and exit ticket (3 prompts).
2. `<sim-practice-question>` — do-then-reveal flow with 3-chip self-rating. Used for the practice question section.
3. `<sim-reflection-export>` — page-wide aggregator side panel triggered from the sticky header. Pulls state from every interactive component on the page (this includes `<sim-checklist>`, both `<sim-text-response>` instance groups, and `<sim-practice-question>`) and exports a single .md or PDF portfolio.

Refactor `<sim-checklist>` so its export buttons disappear from the panel — the aggregator is the only export path. The checklist's `exportMarkdown` method stays on the element as an internal API the aggregator calls; `exportPDF` is removed.

Result: a student opens the topic page, does the activities inline, optionally reflects on success criteria via the checklist panel, and exports the entire portfolio from one button in the sticky header.

---

## Locked decisions

| Decision                              | Choice                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<sim-text-response>` UX              | **Inline** textareas under each prompt (not panel)                                                                                                      |
| `<sim-practice-question>` post-reveal | Reveal model answer **plus 3-chip self-rating** (Got it / After reveal / Confused)                                                                      |
| `<sim-reflection-export>` placement   | **Side panel** triggered from the sticky header                                                                                                         |
| Export panel side                     | **LEFT** — joins existing `panel-opened` mutual-exclusion contract                                                                                      |
| Checklist refactor                    | **Remove** Download .md and Save as PDF buttons; **keep** Reset; remove `exportPDF` method; keep `exportMarkdown` (internal-only, called by aggregator) |
| Persistence                           | localStorage, per-instance, keyed by `<topic>:<level>:<id>`                                                                                             |
| Execution shape                       | **One PR, four commits** — same shape as Phase 10A v2                                                                                                   |
| Emojis in UI / docs                   | **None.** Existing emoji on the Reflect button gets cleaned up alongside this work too                                                                  |

---

## Architecture

### Component summary

| Element                   | DOM placement     | State shape                                | Persists?                                                       | Public API                                                             |
| ------------------------- | ----------------- | ------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `<sim-text-response>`     | inline            | `{ value: string }`                        | yes (debounced 300 ms)                                          | `getState()`, `clear()`, `focus()`                                     |
| `<sim-practice-question>` | inline            | `{ attempt, revealed, rating }`            | yes (debounced 300 ms for attempt; immediate for reveal/rating) | `getState()`, `clear()`                                                |
| `<sim-reflection-export>` | side panel (LEFT) | no own state (aggregates by document scan) | no                                                              | `open()`, `close()`, `exportMarkdown(triggerDownload?)`, `exportPDF()` |

All three observe `level` and force-flush any pending debounce on change — same pattern as `<sim-checklist>`.

### `<sim-text-response>` — full shape

```html
<sim-text-response
  topic="s1.5-gas-laws"
  level="sl"
  id="bell-1"
  section="bell-ringer"
  label="Write the ideal gas equation. Label every symbol."
></sim-text-response>
```

Renders shadow DOM:

- A prompt heading (`label` attr → `<p>` with class `sim-text-response__prompt`).
- A `<textarea>` with `aria-label` mirroring the prompt text. Min-height 80 px, vertical resize, 300 ms debounce on input.
- Optional small char-count footer (`<span class="sim-text-response__count" aria-live="polite">128 chars</span>`) — gives students a sense of "how much have I written".

Dispatches `text-response-changed` (bubbles + composed) with `{ topic, level, id, value, section }` on every debounced save.

### `<sim-practice-question>` — full shape

```html
<sim-practice-question
  topic="s1.5-gas-laws"
  level="sl"
  id="practice-1"
  section="practice"
  label="Calculate the volume occupied by 0.25 mol of an ideal gas at 250 K and 150 kPa."
>
  <div slot="answer">
    <code>V = nRT / P = (0.25 × 8.314 × 250) / (150 × 10³) = 3.46 × 10⁻³ m³ ≈ 3.46 L</code>
  </div>
</sim-practice-question>
```

Renders shadow DOM:

- Prompt heading (`label` attr).
- Attempt textarea with the same look as `<sim-text-response>`.
- A "Show answer" button (`class="sim-btn"`).
- A hidden `<div class="sim-practice__reveal">` that becomes visible after click. Inside it: a `<slot name="answer">` (so the page author keeps full control of the answer's HTML) and a 3-chip rating row.

Three rating chips:

- "Got it"
- "Got it after reveal"
- "Still confused"

Each chip is a `<button>` with `data-rating="got-it" / "after-reveal" / "confused"`. Clicking a chip applies an active class to it (deactivates the others) and persists. Tabbable, keyboard-friendly.

State: `{ attempt: string, revealed: boolean, rating: 'got-it' | 'after-reveal' | 'confused' | null }`. Persists on every change. On restore, if `revealed === true`, the reveal block renders unhidden and the previously-selected chip is highlighted.

Dispatches `practice-changed` with the full state on every persisted change.

**Mount-order safety.** If a stored state has `revealed: true` but the slotted `[slot="answer"]` content is missing (page-author error), the component logs a console warning and renders the reveal block with an empty answer area. No crash.

### `<sim-reflection-export>` — full shape

```html
<sim-reflection-export topic="s1.5-gas-laws" level="sl"></sim-reflection-export>
```

Renders shadow DOM (panel, same skeleton as `<sim-checklist>`'s panel):

- Header: title "Save your work" + close × button.
- A short description: "Download a copy of everything you have written on this page."
- A preview list — one row per scanned source component, grouped by `section` attribute (alphabetical order: bell-ringer, exit-ticket, practice, success-criteria; misc last). Each row shows the component's `label` (truncated to ~80 chars) and a small status badge: "answered" (green) or "empty" (grey).
- Two action buttons: "Download .md" / "Save as PDF".
- A small ghost-style link below: "Clear all my work for this topic" (calls `confirm`, then `clear()` on every scanned source).

`HOST_STYLES` — same `position: fixed; top: 80px; left: 16px; width: 320px; z-index: 100`, slide-in via `[data-open]`, with `prefers-reduced-motion` honored.

The panel's `_activate` dispatches `panel-opened` on document; `connectedCallback` registers the document `panel-opened` listener for sibling close.

### State pull, not push

When the panel opens (and again immediately before each export click), the aggregator does one document query:

```js
const sources = document.querySelectorAll(
  'sim-checklist, sim-text-response, sim-practice-question'
);
const states = Array.from(sources).map((el) => ({
  tag: el.tagName.toLowerCase(),
  section: el.getAttribute('section') || 'misc',
  id: el.id || null,
  label: el.getAttribute('label') || null,
  state: el.getState(),
}));
```

Pull beats push for this scope:

- The aggregator never needs to know about a component until export time.
- Components don't need to register with anything — they're independently testable.
- Adding a new reflection component later means: implement `getState()` on the new tag, update the query selector, done.

DOM order is preserved within each section. Cross-section ordering is alphabetical-by-section-name to avoid coupling to whatever order the page author wrote sections in.

### Markdown output

```markdown
# s1.5-gas-laws — Reflection portfolio

**Level:** sl · **Date:** 2026-05-02

## Bell ringer

**Q1.** Write the ideal gas equation. Label every symbol.

> [student's typed answer here, or *no response* if empty]

**Q2.** Circle the variable that is inversely proportional to pressure at constant temperature and amount of gas.

> [...]

**Q3.** [...]

> [...]

## Practice

**Q1.** Calculate the volume occupied by 0.25 mol of an ideal gas at 250 K and 150 kPa.

> Attempt: [student's working]
>
> Self-rating: Got it after reveal

## Success criteria

- [x] Describe what happens to P when V halves at constant T and n.
- [ ] Calculate P, V, T, or n given the other three quantities.
- [x] Explain the shape of a P–V graph at constant temperature and label its axes.

> Reflection: [free text from the checklist textarea]

## Exit ticket

**Q1.** [...]

> [...]

[continues for Q2, Q3...]
```

Empty values render as `> *no response*` so blanks are visible to the teacher reviewing the export.

### PDF output

Same approach as Phase 10A v2's `<sim-checklist>.exportPDF()`, scaled up:

1. Aggregator builds a `#print-reflection-output` super-block with the same content rendered as HTML headings + paragraphs.
2. Inserts (or `replaceWith`s) into `document.body`.
3. Adds `body.printing-reflection`.
4. Calls `window.print()`.
5. The existing global `@media print` rules in `components.css` already hide everything except `#print-reflection-output` — no new CSS required.
6. `afterprint` window listener clears `body.printing-reflection`.

The aggregator builds the super-block itself (does not concatenate per-component print blocks). One source of truth for the print layout.

### Empty-portfolio guard

If `document.querySelectorAll('sim-checklist, sim-text-response, sim-practice-question')` returns zero matches:

- Both export buttons render disabled.
- The preview list area shows: "This page has no reflection components yet."
- Clear-all link is hidden.

Defensive — protects against authoring mistakes, especially for non-Gas-Laws topic pages that adopt the export panel before adding interactive components.

---

## Checklist refactor

Three deletions in `packages/core/src/components/sim-checklist.js`:

1. In `_render`, remove the `mdBtn` creation block.
2. In `_render`, remove the `pdfBtn` creation block.
3. Update the `actions.append(...)` call to `actions.append(resetBtn)` (single child instead of three).

One method removal:

4. Remove `exportPDF()` from the prototype. The aggregator owns PDF synthesis; per-component PDF synthesis is dead code.

One method retained as internal-only:

5. Keep `exportMarkdown(triggerDownload = false)` on the element. The aggregator calls it with `triggerDownload = false` to get the markdown string for the portfolio. JSDoc updated to mark it as internal/aggregator-only (`@internal`).

One CSS rule retained:

6. The global `@media print` block + `#print-reflection-output` rules in `components.css` stay — the aggregator reuses them.

Test impact (one swap, no net change):

- Drop the test `'Download .md generates correct markdown payload'` (clicks the now-removed button).
- Add a test `'exportMarkdown(false) returns the .md string without triggering download'` — same behavior coverage, direct method call.

**Public API churn.** Removing `exportPDF` is a breaking change relative to PR #8. Acceptable here because:

- PR #8 just shipped; no consumer has integrated against it.
- Package scope is `@TBD/*` — pre-publish.
- CHANGELOG entry calls it out clearly.

---

## Topic-page integration

### Bell ringer

Replace the static `<ol><li>Write the ideal gas equation…` with three `<sim-text-response>` instances inside numbered `<li>` wrappers. Section attribute `bell-ringer`; ids `bell-1`, `bell-2`, `bell-3`. The `<ol class="ib-bellringer__list">` keeps numbering.

### Practice question

Replace the `<details class="ib-answer">` block with a single `<sim-practice-question>` element. The slotted `[slot="answer"]` content is the existing `<code>V = nRT / P …</code>` markup unchanged.

### Exit ticket

Replace the static `<ol><li>What surprised you most…` with three `<sim-text-response>` instances. Section attribute `exit-ticket`; ids `exit-1`, `exit-2`, `exit-3`.

### Sticky header

Add a third button next to the HL/SL toggle and Tweaks button:

```html
<button id="export-button" class="ib-btn ib-btn--ghost">Save your work</button>
```

(No emoji. Same class chain as the existing buttons.)

Wired in the existing inline `<script>` block:

```js
document.getElementById('export-button').addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelector('sim-reflection-export').toggleAttribute('data-open');
});
```

Mirrors the Reflect button wiring from Phase 10A v2.

### `<sim-reflection-export>` element

Placed alongside `<sim-data-card>`, `<sim-checklist>`, `<sim-tweaks-panel>` after `.sim-wrap`:

```html
<sim-reflection-export topic="s1.5-gas-laws" level="sl"></sim-reflection-export>
```

### Reflect button cleanup (consistency touch)

Existing button text is "📝 Reflect on these criteria". Strip the emoji to "Reflect on these criteria" in the same commit that wires the rest of the page. One-line edit. Keeps the topic page emoji-free overall.

### `applyLevel(level)` extension

Existing function has 5 steps (after Phase 10A v2). Add step 6:

```js
// 6. Push level to every interactive reflection component on the page.
for (const el of document.querySelectorAll(
  'sim-text-response, sim-practice-question, sim-reflection-export'
)) {
  el.setAttribute('level', level);
}
```

Runs once per toggle. Each component handles its own state-swap on attribute change.

---

## Persistence + mutual exclusion

### localStorage keys

```
aisc-simengine:textresponse:<topic>:<level>:<id>      → { value: string }
aisc-simengine:practice:<topic>:<level>:<id>          → { attempt, revealed, rating }
aisc-simengine:checklist:<topic>:<level>              → { checkedItems, freeText }   // unchanged
```

`<sim-reflection-export>` itself stores nothing — it's pull-only. Its panel's `[data-open]` state never persists across reloads.

### Level swap

All three new components observe `level`. On change:

1. Force-flush pending debounce save to the OLD key.
2. Load state from the NEW key.
3. Re-render.

Same race-defense pattern as `<sim-checklist>`. Each component implements `_flushTextareaSave(level)` (or equivalent) and calls it on `attributeChangedCallback('level', oldValue, newValue)` BEFORE the load.

### Reset / Clear

- `<sim-text-response>` and `<sim-practice-question>` get a `clear()` method but no in-component reset button — reset is concentrated in the aggregator.
- `<sim-checklist>` keeps its in-panel Reset (clears just the SC reflection — single section operation).
- Aggregator's panel adds a "Clear all my work for this topic" link with `confirm`. On confirm: calls `clear()` on every scanned source. Aggregator does not have its own state to clear.

### Mutual exclusion contract — extended

Phase 10A v2 contract: `<sim-data-card>` + `<sim-checklist>` dispatch + listen for `panel-opened` on `document`. `<sim-reflection-export>` joins as the third LEFT-side participant. Three panels, only one open at a time.

`<sim-tweaks-panel>` (right side) stays independent — the contract is left-side-only by convention.

The new export panel:

- Dispatches `panel-opened` with `{ source: this }, bubbles + composed` on `_activate`.
- Listens for `panel-opened` on `document` in `connectedCallback`; calls `close()` if `e.detail.source !== this && this.hasAttribute('data-open')`.
- Cleans up the listener in `disconnectedCallback`.

### Outside-click guard

Same shape as `<sim-checklist>`'s outside-click handler:

- Skip clicks whose `composedPath` includes a `<sim-data-pill>` (data-card flow).
- The trigger button (`#export-button`) calls `e.stopPropagation()` to prevent the panel's own outside-click handler from firing on the same click and immediately re-closing.

### `prefers-reduced-motion`

All three new components include the same `@media (prefers-reduced-motion: reduce) { :host, :host([data-open]) { transition: none; } }` block in `HOST_STYLES`. Matches the a11y polish pattern from PR #9. (Inline components also include the rule, even though they don't slide — defensive consistency.)

### `aria-live` patterns

- `<sim-text-response>` char-count footer: `aria-live="polite"`, `aria-atomic="true"`. Announces "128 chars" updates on debounce, not on every keystroke.
- `<sim-practice-question>` rating row: each chip is a `<button>` with `aria-pressed="true|false"`. Standard toggle-button semantics.
- `<sim-reflection-export>` preview list: each row's badge is plain text — no live-region needed (the list is built once per panel-open, not continuously updated).

---

## Sequencing — four commits

| #   | Commit                                                                                                                 | Files                                                                                                                                                                                                                                                       | Tests                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | `feat(core): <sim-text-response> + <sim-practice-question>`                                                            | NEW: 2 component files + 2 test files; MODIFY: `packages/core/src/index.js` (2 side-effect imports)                                                                                                                                                         | +13 tests (6 + 7)                      |
| 2   | `feat(core): <sim-reflection-export> aggregator + <sim-checklist> export refactor`                                     | NEW: 1 component file + 1 test file; MODIFY: `packages/core/src/components/sim-checklist.js` (remove buttons + `exportPDF`); MODIFY: `packages/core/tests/sim-checklist.test.js` (1 test swap); MODIFY: `packages/core/src/index.js` (1 side-effect import) | +9 tests (export); ±0 (checklist swap) |
| 3   | `feat(examples): topic-page wires bell-ringer + practice + exit-ticket + export panel; drop emoji from Reflect button` | MODIFY: `examples/topic-page/index.html`                                                                                                                                                                                                                    | ±0                                     |
| 4   | `docs: phase 10B — interactive reflection portfolio`                                                                   | MODIFY: `CHANGELOG.md`, `docs/architecture.md`                                                                                                                                                                                                              | ±0                                     |

**Test count target:** baseline 157 → +22 → **179** total.

**Bundle delta target:** ≤ +18 kB IIFE for the three new components combined. Estimate based on 10A v2 (one component ≈ 14 kB) — three smaller components plus the export aggregator should fit within 18 kB.

---

## Testing strategy

Vitest + happy-dom. TDD per task: write the failing test, witness RED, implement, witness GREEN. Same discipline as Phase 10A v2.

### `<sim-text-response>` tests (~6)

- renders prompt + textarea
- input persists to localStorage (debounced)
- restores from localStorage on mount
- level swap loads new key + force-flushes pending debounce to old key
- `getState()` returns `{ value }`
- localStorage write failure (Storage.prototype.setItem throws) — graceful no-op

### `<sim-practice-question>` tests (~7)

- renders prompt + attempt textarea + Show-answer button (no reveal block, no rating chips)
- click Show answer → reveal block becomes visible + slot content + 3 rating chips render
- click rating chip → records state + active class on chip + emits `practice-changed`
- attempt + revealed + rating all persist + restore from localStorage
- level swap behaves correctly (force-flush on old key + load new)
- `getState()` returns `{ attempt, revealed, rating }`
- restore with `revealed: true` but missing `[slot="answer"]` content → console warning, no crash

### `<sim-reflection-export>` tests (~9)

- panel hidden by default; `[data-open]` shows it; close × + Escape + outside-click all close it
- `panel-opened` / `panel-closed` events emit with `{ source: this }`
- closes on sibling `panel-opened` from a different source
- `exportMarkdown(false)` builds correct portfolio markdown across mocked sources (with section grouping)
- "Download .md" button click triggers download (URL.createObjectURL spy)
- empty-portfolio guard: 0 sources → buttons disabled + "no components" message
- section grouping: components emit alphabetically by section, DOM-order within each section
- preview list renders one row per scanned component with truncated label + status badge
- "Clear all" link calls `clear()` on every scanned source after `confirm` returns true; cancels gracefully when `confirm` returns false

### `<sim-checklist>` test swap

- DROP `'Download .md generates correct markdown payload'` (clicks removed button)
- ADD `'exportMarkdown(false) returns the .md string without triggering download'` (direct method call)

Net checklist delta: ±0.

### Total

+22 tests. 157 → 179.

---

## Exit criteria

From a fresh clone:

1. `pnpm install` clean.
2. `pnpm lint` clean (0 errors, 0 new warnings beyond the 6 pre-existing).
3. `pnpm test` — all 179 tests pass across both packages.
4. `pnpm build` clean. Bundle delta documented in PR description.
5. `examples/topic-page/index.html` opens in Chrome and:
   - Bell ringer: 3 textareas appear inline; type → reload → text persists.
   - Practice question: type attempt → click "Show answer" → answer block + 3 chips appear → click a chip → all three pieces persist on reload.
   - Exit ticket: 3 textareas, same as bell ringer.
   - Sticky header has "Save your work" button. Click → panel slides in from the LEFT with preview list grouped by section. Click "Download .md" → portfolio downloads with all 4 sections in alphabetical-by-section, DOM-order-within-section. Click "Save as PDF" → print dialog shows portfolio only.
   - Mutual exclusion: opening any of the three left-side panels (data-card, checklist, export) closes the other two.
   - HL/SL toggle: all components swap to per-level state.
   - Tweaks panel (right side, gear icon) coexists with any left-side panel.
   - The Reflect button on the topic page reads "Reflect on these criteria" — no emoji.
6. CI green on the PR; merged to main.

---

## Out of scope (deferred)

- Mobile / tablet responsive tweaks for any panel.
- Whole-topic-page print stylesheet (still §12 polish).
- Cross-topic portfolio aggregation (one export covering multiple topic pages).
- Server-side persistence / accounts.
- Animated check transitions; fancier progress / status visualisations.
- The two long-standing step-6 follow-ups (`<sim-engine>` private-API → public; reinstate `<slot>` in `<sim-coachmark>`).

---

## Risks + mitigations

| Risk                                                                               | Mitigation                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aggregator's PDF super-block grows large for big pages → print performance         | Empty-portfolio guard already drops zero sources; otherwise the synthesis is a one-time event, not a hot path.                                                       |
| Removing `exportPDF` from sim-checklist breaks an existing consumer                | No external consumers exist (PR #8 just merged; package is `@TBD/*`). CHANGELOG entry calls it out.                                                                  |
| Three new left-side panels in the mutual-exclusion contract could feel chaotic     | The contract is symmetric and well-tested by Phase 10A v2; adding a third participant is mechanically the same. Manual visual verification covers the choreography.  |
| Practice-question reveal restore-without-slot edge case                            | Console warning + render an empty reveal block. No crash. Test covers it.                                                                                            |
| Bundle delta might creep over the +18 kB IIFE soft target                          | Component code is similar shape to v2's checklist; if it overshoots, file as a sweep task to extract shared panel-base helpers. Not blocking.                        |
| Author/section grouping confusion (alphabetical vs DOM order) could surprise users | DOM order within section + alphabetical-by-section provides predictable output regardless of source-section interleaving in the HTML. Documented in architecture.md. |

---

Phase 10A v2 (PR #8) introduced the panel infrastructure and the export pipeline. Phase 10B builds on both — three new components, one aggregator, one refactor, one PR.
