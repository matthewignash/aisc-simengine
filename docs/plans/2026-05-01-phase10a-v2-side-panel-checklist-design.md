# Phase 10A v2 — `<sim-checklist>` slide-out side panel — design

**Author:** Matthew Ignash (with Claude planning support)
**Date:** 2026-05-01
**Status:** approved, ready for implementation
**Predecessor:** `docs/plans/2026-04-30-phase10a-success-checklist-export-design.md` (phase 10A v1 in PR #7 — superseded by this design)
**Companion:** `docs/plans/2026-04-30-phase9-data-card-side-panel-design.md` (the side-panel pattern this build mirrors)

## Context

Phase 10A v1 (PR #7) shipped `<sim-checklist>` as an **inline** component that replaced the topic page's static success-criteria column with interactive checkboxes + a reflection textarea + export buttons. After live review, the user preferred the side-panel UX established by phase 9 (`<sim-data-card>` slide-out from the left) and asked for the checklist to follow the same pattern instead of the inline replacement.

Phase 10A v2 redesigns the component:

- The LISC success-criteria column **reverts to a static bulleted list** (visual symmetry with the LI col).
- A **"📝 Reflect on these criteria" button** sits below that static list.
- Clicking the button slides a panel in from the **left** containing the interactive checklist + textarea + export buttons. Same persistence model, same export pipelines, same state, same events as v1 — only the UI surface and lifecycle change.
- The new panel and the existing `<sim-data-card>` are **mutually exclusive** on the left side: opening one closes the other. The right-side `<sim-tweaks-panel>` is unaffected.

PR #7 will be closed unmerged once this v2 ships. The v1 design + plan docs remain in main as a historical record of the iteration.

## Decisions locked during brainstorming

| Decision                                       | Choice                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where the checklist lives                      | Slide-out **side panel** (not inline). Same pattern as `<sim-data-card>` (phase 9) and `<sim-tweaks-panel>` (step 6). Inline interactivity in the LISC SC col is removed.                                                                                                                     |
| What the inline LISC SC col shows              | Static bulleted list of criteria (matches LI col visual style) + the new Reflect trigger button below.                                                                                                                                                                                        |
| Position                                       | `position: fixed; top: 80px; left: 16px; width: 320px`. **Slides in from the left**, mutually exclusive with `<sim-data-card>`. Tweaks panel stays on the right.                                                                                                                              |
| Mutual exclusion mechanism                     | `panel-opened` CustomEvent on `document` (`bubbles: true, composed: true; detail: { source: this }`). Each panel listens; closes itself when a sibling source fires.                                                                                                                          |
| Trigger button placement                       | In the LISC SC col, below the static criteria list. Page authors own the markup and the inline-script wiring (matches the existing `⚙ Tweaks` and HL toggle patterns).                                                                                                                        |
| Component refactor strategy                    | Refactor the existing `<sim-checklist>` (don't add a new component). Same name, same slot-based `<li>` API, same `topic`/`level`/`label` attributes, same persistence + export. Render method becomes panel-mode; positioning, slide animation, `[data-open]`, mutual-exclusion wiring added. |
| State / persistence / export — preserved as-is | localStorage key `aisc-simengine:checklist:<topic>:<level>`, debounced textarea save, `.md` download, Save-as-PDF via `window.print()`, three events, imperative API (now extended with `open()` / `close()` and two new events).                                                             |
| PR #7 disposition                              | Close PR #7 unmerged after v2 lands. v1 design + plan docs stay in main as historical record. v2 ships as a new PR (likely PR #8).                                                                                                                                                            |

## Architecture

### File layout

```
packages/core/src/components/
└── sim-checklist.js                # MAJOR REFACTOR — inline → side panel
                                    #   - position: fixed; top: 80px; left: 16px (mirrors data-card)
                                    #   - [data-open] attribute toggles slide
                                    #   - dispatches panel-opened on open
                                    #   - listens for sibling panel-opened and closes
                                    #   - close button (×) in __head; Escape; outside-click; toggle
                                    #   - keeps all state / persistence / export / events / API
└── sim-data-card.js                # MINOR MODIFY — emit panel-opened on _activate;
                                    #                listen for sibling panel-opened and close

packages/core/tests/
├── sim-checklist.test.js           # REWRITE — 7 tests modified for panel mode + 4 new tests for
                                    #            data-open lifecycle, panel-opened event,
                                    #            close-on-sibling-open, close button
└── sim-data-card.test.js           # MODIFY — +1 test for "closes when sibling panel-opened fires"

examples/topic-page/index.html       # MODIFY:
                                    #   - LISC SC col reverts: <sim-checklist> → static <ul class="ib-lisc__list">
                                    #     (the original 3 <li>s, matching LI col)
                                    #   - Add <button id="reflect-button"...>📝 Reflect on these
                                    #     criteria</button> below the static <ul>
                                    #   - Add <sim-checklist topic="s1.5-gas-laws" level="sl"
                                    #     label="Success criteria"> as a SIBLING of .sim-wrap
                                    #     (with the slotted <li>s as content)
                                    #   - Inline script: wire reflect-button to toggleAttribute('data-open')
                                    #     on the <sim-checklist>; e.stopPropagation() in the click handler

CHANGELOG.md                        # MODIFY: replace phase 10A entry with v2 (or add v2 addendum)
docs/architecture.md                # MODIFY: rewrite Phase 10A section to describe panel architecture
```

**Bundle delta expected vs. PR-#6-merged main:** roughly neutral (±2 kB IIFE). Inline render code is removed (~150 lines saved); panel render + mutual-exclusion wiring is added (~150 lines net). The HOST_STYLES grow slightly for `position: fixed` + transitions, shrink slightly elsewhere.

**No changes to** `<sim-engine>`, `<sim-data-pill>`, `<sim-glossary-term>`, `<sim-tweaks-panel>`, `<sim-coachmark>`, or `packages/data/`. Only `<sim-data-card>` gains the mutual-exclusion event (~15 lines).

## Component contract changes

### `<sim-checklist topic="…" level="…" label="…">` — refactored to side-panel

The slot-based `<li>` API and the three attributes are unchanged. State, persistence, export, the three events (`checklist-changed` / `checklist-exported` / `checklist-reset`), and the imperative API all stay. The behavior change is purely about rendering and open/close lifecycle.

| Behavior            | Before (inline, PR #7)     | After (panel)                                                                                                                                |
| ------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Position            | `display: block` (inline)  | `position: fixed; top: 80px; left: 16px; width: 320px; z-index: 100`                                                                         |
| Visibility          | Always visible             | `[data-open]` attribute toggles via transform-based slide-in (matches tweaks-panel + data-card pattern)                                      |
| Default state       | Visible                    | Hidden (`transform: translateX(-120%)`, `visibility: hidden`)                                                                                |
| Opening trigger     | n/a                        | External: page wires a `<button>` to call `setAttribute('data-open', '')` (or `toggleAttribute` for toggle)                                  |
| Closing triggers    | n/a                        | × close button in \_\_head; Escape key; outside-click (skipping clicks on the trigger button or sibling pills); sibling panel opening        |
| Mutual exclusion    | n/a                        | Listens on `document` for `panel-opened` events; closes if `e.detail.source !== this`. Emits `panel-opened` with `{ source: this }` on open. |
| Max-height + scroll | n/a (inline content flows) | `max-height: calc(100vh - 96px); overflow-y: auto`                                                                                           |
| Close button        | none                       | × button in \_\_head, after the progress indicator                                                                                           |
| Box shadow          | `--el-2`                   | `--el-3` (true panel weight; matches data-card)                                                                                              |

### Two new events emitted

- `panel-opened` with `detail: { source: this }`, `bubbles: true, composed: true` — fires when the panel opens. Other panels listen for this and close if `source` is different.
- `panel-closed` with `detail: { source: this }` — fires when the panel closes (close button, Escape, outside-click, or sibling triggering close).

### Two new imperative methods

- `open()` — adds `data-open`, dispatches `panel-opened`, captures `document.activeElement` for restore on close, applies `trapFocus`, focuses close button, registers Escape + outside-click handlers.
- `close()` — removes `data-open`, releases trap, removes Escape + outside-click handlers, dispatches `panel-closed`, restores focus.

### Slot-based item API — unchanged

```html
<sim-checklist topic="s1.5-gas-laws" level="sl" label="Success criteria">
  <li>Describe what happens to P when V halves at constant T and n.</li>
  <li>Calculate P, V, T, or n given the other three quantities.</li>
  <li>Explain the shape of a P–V graph at constant temperature and label its axes.</li>
</sim-checklist>
```

The component captures slotted text at upgrade and renders interactive checkbox-rows in shadow DOM — same logic as v1.

### `<sim-data-card>` — minor mutual-exclusion additions

| Behavior                                                | Before (phase 9) | After                                                                                                                                               |
| ------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emits `panel-opened` on `_activate`                     | No               | Yes — `dispatchEvent(new CustomEvent('panel-opened', { detail: { source: this }, bubbles: true, composed: true }))`                                 |
| Listens for sibling `panel-opened` events on `document` | No               | Yes — registered in `connectedCallback` (not `_activate`); calls `this._dismiss()` if `e.detail.source !== this` AND `[data-open]` is currently set |

Roughly 15 lines of new code in the data-card. Existing tests stay green; one new test added.

### Trigger button & topic-page wiring

The page author writes a plain `<button>` and toggles via inline script — matches the existing tweaks-panel + HL-toggle wiring patterns. Topic page's inline script gains:

```js
document.getElementById('reflect-button').addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelector('sim-checklist').toggleAttribute('data-open');
});
```

`e.stopPropagation()` prevents the panel's outside-click handler from firing on the same click and immediately re-closing.

## CSS changes

### Component shadow DOM (`sim-checklist.js` HOST_STYLES)

`:host` rules switch from inline to fixed-position panel. Inner `.sim-checklist` block keeps most rules; gains `max-height` + `overflow-y: auto`. New `.sim-checklist__close` rule for the × button.

```css
:host {
  position: fixed;
  top: 80px;
  left: 16px;
  width: 320px;
  z-index: 100;
  /* Hidden state: slid off-screen-left + visibility:hidden so inputs aren't
     reachable via Tab. Visibility transition delayed to wait for the
     slide-out to complete (matches tweaks-panel pattern from step 6 commit 7
     and the data-card pattern from phase 9). */
  transform: translateX(-120%);
  visibility: hidden;
  transition:
    transform 0.18s ease,
    visibility 0s linear 0.18s;
  font-family: var(--font-sans, sans-serif);
}
:host([data-open]) {
  transform: translateX(0);
  visibility: visible;
  transition:
    transform 0.18s ease,
    visibility 0s linear 0s;
}
.sim-checklist {
  width: 100%;
  background: var(--ib-white, #fff);
  border: 1px solid var(--ib-ink-200, #ddd);
  border-radius: var(--r-md, 8px);
  box-shadow: var(--el-3, 0 8px 24px rgba(11, 34, 101, 0.18));
  padding: var(--sp-4, 16px);
  max-height: calc(100vh - 96px);
  overflow-y: auto;
}
.sim-checklist__close {
  background: transparent;
  border: none;
  font-size: 1.4em;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
  margin-left: var(--sp-2, 8px);
}
```

The rest of the shadow CSS (`__head`, `__list`, `__reflection`, `__actions`, `.sim-btn`) is unchanged from PR #7.

### Global `components.css`

**No new additions.** The `@media print` rules and `#print-reflection-output` styles from PR #7 stay verbatim — they're scoped to `body.printing-reflection` + `#print-reflection-output` and are independent of the checklist's render mode.

### `<sim-data-card>` CSS

Unchanged. Mutual-exclusion is JS-only; doesn't affect styling.

## Lifecycle behaviors

```
[component mount via connectedCallback]
  - Capture slotted <li> textContent into items[] (using the children-filter
    pattern to avoid happy-dom's :scope limitation, same as PR #7).
  - Clear original light DOM via replaceChildren().
  - Render shadow DOM: __head (label + progress + close ×), __list, __reflection, __actions.
  - Load state from localStorage. Apply to checkboxes + textarea.
  - Register window 'afterprint' listener (same as PR #7).
  - Register document 'panel-opened' listener — for mutual exclusion.
  - Hidden by default ([data-open] not set; transform: translateX(-120%); visibility: hidden).

[user clicks the Reflect button]
  - Page's inline handler: e.stopPropagation(); toggleAttribute('data-open').
  - Component's attributeChangedCallback fires for 'data-open':
      - If newValue is non-null (just opened): open()
      - Else: close()
  - open():
      - Dispatch panel-opened CustomEvent { detail: { source: this } }
      - Save document.activeElement → _previouslyFocused
      - Apply trapFocus to the inner card element
      - Focus the close button
      - Register Escape handler on document
      - Register outside-click handler on document
  - <sim-data-card>'s document panel-opened listener fires:
      - If e.detail.source !== this AND this.hasAttribute('data-open'):
        - this._dismiss() (closes the data-card if it was open)
  - CSS transitions: transform translateX(0) over 180ms; visibility flip immediate.

[user clicks Reflect button while panel is already open]
  - toggleAttribute('data-open') removes the attribute.
  - attributeChangedCallback fires; newValue is null → close()

[user types in textarea / ticks checkboxes]
  Same as PR #7: debounced auto-save, immediate save on toggle, dispatches checklist-changed.

[user clicks the × close button]
  - close()

[user presses Escape]
  - close() (Escape handler)

[user clicks outside the panel]
  - Outside-click handler (registered in open()):
      - If e.composedPath() includes this → ignore (click was inside)
      - If e.target is the trigger button (or in its composedPath) → ignore (the trigger has its own toggle handler)
      - If a <sim-data-pill> is in composedPath → ignore (let the pill's own handling drive)
      - Else: close()
  - close()

[user clicks a data pill while checklist is open]
  - <sim-data-pill> dispatches data-pill-clicked.
  - <sim-data-card>'s document listener fires _onPillClicked → setAttribute('ref', ref)
    + setAttribute('data-open', '') + _activate().
  - _activate dispatches panel-opened { source: data-card }.
  - This component's document panel-opened listener fires → close() on this checklist.
  - CSS: checklist slides out simultaneously as data-card slides in. Both transitions 180ms.

[level attribute changes via setAttribute('level', newLevel)]
  - Same as PR #7: force-flush textarea debounce to old key, load from new key, apply state.
  - No interaction with panel-open state — checklist stays open (or closed) while content swaps.

[user clicks Download .md / Save as PDF / Reset]
  Same as PR #7. The export and reset paths don't depend on render mode.

[disconnectedCallback]
  - Same as PR #7: clear textarea debounce, remove afterprint listener.
  - PLUS: remove document 'panel-opened' listener.
  - close() if currently open (cleanup any active focus trap + Escape + outside-click handlers).
  - Reset _initialized = false (re-attach safety).
```

### Subtle interactions

**Trigger-button-while-already-open toggle:** the page's inline handler uses `toggleAttribute('data-open')` (not `setAttribute('data-open', '')`). So a second click of the same button removes the attribute and triggers the close path. Matches the existing tweaks-panel button pattern.

**Outside-click skips the trigger button:** the trigger button has `id="reflect-button"`. The outside-click handler walks `composedPath()` and ignores clicks where the path includes that element. Combined with `e.stopPropagation()` in the page's click handler, the toggle works cleanly without the outside-click handler firing on the same click.

**Outside-click skips data-pills:** matches the data-card phase-9 pattern. Pills have their own handlers; the outside-click on the checklist shouldn't pre-empt them.

**Mutual-exclusion timing:** when this checklist opens, `panel-opened` fires synchronously. Data-card's listener fires synchronously. Data-card's `_dismiss()` runs synchronously. Both panels' CSS transitions then run concurrently (180ms each). Visually smooth.

**Focus restoration:** captured at `open()` (the trigger button is `document.activeElement` if the user clicked it). `restoreFocusTo(_previouslyFocused)` on `close()` returns focus there. Same pattern as data-card's restore-to-pill-host.

**`afterprint` cleanup:** independent of panel-open state. The synthesized `#print-reflection-output` block + `body.printing-reflection` class flow works regardless of whether the checklist panel is open during print.

## Tests

### `sim-checklist.test.js` (7 → 11 tests)

Mount helper updated:

```js
async function mount(opts = {}) {
  const {
    topic = 's1.5-gas-laws',
    level = 'sl',
    label = 'Success criteria',
    items = [],
    open = false,
  } = opts;
  // ... build element + append <li>s + appendChild ...
  await Promise.resolve();
  await Promise.resolve();
  if (open) {
    el.setAttribute('data-open', '');
    await Promise.resolve();
  }
  return el;
}
```

Most existing tests use `mount({ open: true, ... })` so the rendered shadow DOM is inspectable.

| #   | Test                                                                                   | Status                                                       |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | renders slotted `<li>`s as interactive checkbox rows when opened                       | Modified                                                     |
| 2   | progress indicator updates on check toggle (when open)                                 | Modified                                                     |
| 3   | state persists to localStorage on toggle                                               | Modified — `mount({ open: true })`                           |
| 4   | state restores from localStorage on mount                                              | Modified — `mount({ open: true })` to inspect rendered state |
| 5   | level attribute change loads state from the new key                                    | Modified — same shape                                        |
| 6   | Download .md generates correct markdown payload                                        | Modified — `mount({ open: true })`                           |
| 7   | Reset clears state, localStorage, and emits checklist-reset event                      | Modified — `mount({ open: true })`                           |
| 8   | **NEW** panel is hidden by default; setting data-open shows it (and removing it hides) | New                                                          |
| 9   | **NEW** opening the panel emits panel-opened event with source = this                  | New                                                          |
| 10  | **NEW** closing the panel removes data-open and emits panel-closed event               | New                                                          |
| 11  | **NEW** closes when a sibling panel-opened event fires                                 | New                                                          |

### `sim-data-card.test.js` (9 → 10 tests)

| #   | Test                                                                          | Status |
| --- | ----------------------------------------------------------------------------- | ------ |
| 10  | **NEW** closes when a sibling panel-opened event fires from a non-self source | New    |

### Test count

Baseline (after PR #6 + PR #7 merge → 150 total per phase 10A v1's exit criteria):

If we close PR #7 unmerged and ship v2 directly off post-PR-#6 main (143 baseline):

- core: 134 (other) + 9 (data-card) + 0 (no inline checklist) = 143 → +11 (new sim-checklist tests) +1 (new data-card test) = **155 total** (149 core + 6 data)

If PR #7 is merged first then v2 is layered on top:

- core: 141 (incl. 7 inline-mode checklist tests) + 0 = 141 → -7 (drop inline tests) + 11 (new panel tests) +1 (data-card) = 146 → wait let me recount.
- PR #7 baseline: 147 (134 + 7 + 6).
- After v2 (replaces 7 inline tests with 11 panel + adds 1 to data-card): 147 - 7 + 11 + 1 = **152 total**.

Both paths land somewhere in the **150–155** range depending on the merge sequence; **the exact number** is determined when the implementation plan is written and the actual tree state is known.

### What is NOT tested in v2 (manual visual only)

- Slide-in/out CSS animations.
- Mutual-exclusion visual smoothness (one panel sliding out as another slides in).
- Reflect button's `e.stopPropagation()` preventing the outside-click double-fire — happy-dom event propagation is unreliable here; rely on the existing patterns from data-card.
- Focus return to trigger button — happy-dom focus simulation is partial; consistent with prior phases.

## Sequencing — 4 commits

Branch off the post-PR-#6 main (so this build has the data-card singleton from phase 9). PR #7 is closed unmerged after v2's PR is opened.

| #   | Commit                                                                                    | Files                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `feat(core): refactor <sim-checklist> from inline to slide-out side panel`                | `sim-checklist.js` (major refactor), `sim-checklist.test.js` (4 new + 7 modified tests)                                                                     |
| 2   | `feat(core): <sim-data-card> mutual exclusion via panel-opened events`                    | `sim-data-card.js` (event dispatch on `_activate`, listener for sibling close, cleanup in `disconnectedCallback`), `sim-data-card.test.js` (+1 new test)    |
| 3   | `feat(examples): topic-page success-criteria reverts to static + adds Reflect side panel` | `examples/topic-page/index.html` (revert SC col `<ul>`, add Reflect button + `<sim-checklist>` sibling-of-`.sim-wrap`, wire toggle + `e.stopPropagation()`) |
| 4   | `docs: phase 10A v2 — side-panel checklist (supersedes inline)`                           | `CHANGELOG.md` (replace v1 entry with v2), `docs/architecture.md` (rewrite Phase 10A section)                                                               |

### Why 4 commits

- Splitting the checklist refactor (commit 1) from the data-card mutual-exclusion (commit 2) keeps each component's change reviewable on its own.
- The topic-page integration (commit 3) is a small but distinct concern (page-author wiring vs. component internals).
- Docs (commit 4) close the phase out.

## Phase 10A v2 exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (no new warnings beyond the pre-existing 6).
3. `pnpm test` — passing. Exact count documented in the implementation plan; expected range 150–155.
4. `pnpm build` clean. Bundle delta vs. post-PR-#6 main: roughly neutral (±2 kB IIFE).
5. `examples/topic-page/index.html` (after `pnpm build`) opens in a browser and shows:
   - LISC SC column shows criteria as a clean static bulleted list (visual symmetry with LI col).
   - "📝 Reflect on these criteria" button below the list.
   - Click Reflect → `<sim-checklist>` slides in from the **left** with header (label + progress + close ×), checkboxes, reflection textarea, three action buttons.
   - Click Reflect again → panel slides out (toggle).
   - Click × close button → slides out.
   - Click outside the panel → slides out.
   - Press Escape → slides out.
   - All state behaviors (tick, persist, restore, level swap, .md export, PDF export, reset) work identically to PR #7.
   - **Mutual exclusion:** open the checklist, then click any data pill → data-card slides in from the left AND checklist slides out simultaneously. Reverse: open a data-card via pill click, then click Reflect → checklist slides in AND data-card slides out.
   - Tweaks panel (right side, ⚙ button) is unaffected by either left-side panel.
   - Focus returns to the trigger button after the panel closes via × / Escape / outside-click.
6. CI green on PR; merged to `main`.
7. PR #7 (v1) closed unmerged with a comment referencing this PR as the supersession.

### What you will NOT have at end of phase 10A v2 (and that is correct)

- Bell ringer / practice / exit ticket interactivity — phase 10B with `<sim-text-response>` and `<sim-practice-question>`.
- `<sim-reflection-export>` aggregator — phase 10B; v2's export pipeline is the foundation; 10B refactors export OUT of the checklist into the aggregator.
- Whole-topic-page print stylesheet (spec §12 polish) — only reflection-only print is implemented.
- Mobile/tablet responsive tweaks for narrow viewports.
- Animated content-swap on level change (instant; no fade).
- More sophisticated mutual-exclusion choreography (current runs both transitions concurrently; visually fine).
- The two follow-up tasks from step 6 still queued: `<sim-engine>` private API to public; reinstate `<slot>` in `<sim-coachmark>`.
