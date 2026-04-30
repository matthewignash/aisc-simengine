# Phase 9 — `<sim-data-card>` slide-out side panel — design

**Author:** Matthew Ignash (with Claude planning support)
**Date:** 2026-04-30
**Status:** approved, ready for implementation
**Predecessor:** `docs/plans/2026-04-30-step8-topic-page-wrap-design.md` (step 8 + phase 8a complete; merged in PR #5)

## Context

Step 8 shipped a polished Gas Laws topic page demonstrating all the step-6 components composed together. Reviewing the live page, the user flagged that the `<sim-data-card>` popover (which currently opens at the click position via `position: absolute`) shifts surrounding page content when it appears — visually disruptive on a content-heavy topic page.

Phase 9 redesigns `<sim-data-card>` from an inline-anchored popover to a fixed slide-out side panel that does not displace page content. The data-card moves from being a child of `<sim-data-pill>` (in the pill's shadow root) to a singleton at the page level. Pills emit events; the singleton card listens and updates content in place.

This phase also incidentally resolves the deferred sweep item from step 6: "Data-pill 'one card open at a time' coordination across multiple pills on a page." With one card per page, there is naturally only ever one open card.

The tweaks panel (step 6 commit 7) already established the slide-out side-panel pattern from the right; phase 9 mirrors it on the left for student-facing reading content. Both panels can be open simultaneously without overlap.

## Decisions locked during brainstorming

| Decision               | Choice                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pill–card relationship | Singleton at page level. One `<sim-data-card>` per page. Pills emit `data-pill-clicked` events; the card listens globally on `document`.                                                                                                                                                                          |
| Position               | `position: fixed; top: 80px; left: 16px; width: 320px`. Slides in from the left edge of the viewport. Tweaks panel stays on the right; both can be open simultaneously without overlap.                                                                                                                           |
| Visibility mechanism   | `[data-open]` attribute (transform-based slide-in), matching the tweaks-panel pattern from step 6 commit 7. Replaces the previous `[hidden]`-attribute toggle.                                                                                                                                                    |
| Mount strategy         | Explicit `<sim-data-card></sim-data-card>` element placed in page HTML by the page author. Matches the tweaks-panel convention. Console-warns on the first `data-pill-clicked` event if no card element is present in the document.                                                                               |
| Multi-pill flow        | Click a different pill while panel is open → content swaps in place (no close-then-reopen flicker). Click the same pill again → toggle close. Outside-click → close. Escape → close. Close button → close.                                                                                                        |
| Backward compatibility | None required. `@TBD/simengine` is unpublished; this is an internal-only refactor.                                                                                                                                                                                                                                |
| Test scope             | Both step-6 test files rewritten. Pill drops 2 tests (Escape/outside-click are now the card's responsibility), gains 2 (no doc-listener registration; multi-click event emission). Card adds 3 (multi-pill swap, swap-vs-outside-click regression, content-update assertion). 13 → 14 tests; pipeline target 141. |

## Architecture

### File layout

```
packages/core/src/components/
├── sim-data-pill.js               # MODIFY — remove child <sim-data-card> creation
│                                  #          remove document-level click + keydown listeners
│                                  #          on click → only dispatch data-pill-clicked
└── sim-data-card.js               # MAJOR REFACTOR
                                   #   - position: fixed (was absolute)
                                   #   - [data-open] visibility (was [hidden])
                                   #   - listens for data-pill-clicked globally
                                   #   - tracks _currentRef + _previouslyFocused for swap UX
                                   #   - own document-level outside-click + Escape listeners

packages/core/tests/
├── sim-data-pill.test.js          # MODIFY — drop child-card-coupled tests, add pure-pill tests
└── sim-data-card.test.js          # REWRITE — singleton + event-driven, multi-pill swap

examples/
├── vanilla-html/index.html        # MODIFY — add <sim-data-card></sim-data-card> sibling element
└── topic-page/index.html          # MODIFY — add <sim-data-card></sim-data-card> sibling element

CHANGELOG.md                       # MODIFY — phase 9 entry
docs/architecture.md               # MODIFY — new "Phase 9" section
```

No new components. No new modules. No API changes for `@TBD/simengine-data`. Bundle delta expected ≤ +2 kB IIFE (positioning math goes, event-listener wiring lands).

### Component contract changes

#### `<sim-data-pill ref="…">` — thinner click-to-emit button

| Behavior                              | Before                                            | After                                         |
| ------------------------------------- | ------------------------------------------------- | --------------------------------------------- |
| Render value+unit button              | ✓                                                 | unchanged                                     |
| Click handler                         | toggles its child card; emits `data-pill-clicked` | dispatches `data-pill-clicked` with `{ ref }` |
| Outside-click handler on `document`   | ✓                                                 | gone                                          |
| Escape handler on `document`          | ✓                                                 | gone                                          |
| Child `<sim-data-card>` in shadow DOM | created at render                                 | gone                                          |
| `disconnectedCallback` cleanup        | removes both doc listeners                        | simplified — no listeners to clean up         |

#### `<sim-data-card ref="…">` — singleton-style, event-driven

| Behavior                           | Before                                                            | After                                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Position                           | `position: absolute; top: calc(100% + 6px); left: 0` (vs. parent) | `position: fixed; top: 80px; left: 16px` (vs. viewport)                                                                     |
| Visibility                         | `[hidden]` attribute (display: none)                              | `[data-open]` attribute (transform-based slide-in)                                                                          |
| Open trigger                       | parent pill toggles `hidden`                                      | listens globally for `data-pill-clicked`; sets own `ref` + `data-open`                                                      |
| Same-pill clicked again while open | toggles closed                                                    | toggles closed (preserved by tracking `_currentRef`)                                                                        |
| Different pill clicked while open  | n/a (each pill had its own card)                                  | content swaps in place: re-render with new `ref`, focus moves to close button, `_previouslyFocused` updates to the new pill |
| Outside-click                      | parent's handler                                                  | own document-level listener; closes when click is outside the card AND not on a pill                                        |
| Escape                             | own handler                                                       | unchanged                                                                                                                   |
| Close button + `_dismiss`          | same                                                              | same; emits `data-card-closed` with `{ ref }`                                                                               |
| Focus restoration                  | save activeElement at open; restore on close                      | save the triggering pill's host element at open and on every content swap; restore on close                                 |

## CSS changes

The data-card's host styles are inside its own shadow root (adopted constructable stylesheet). Three concrete changes:

1. **Positioning moves from `.sim-data-card` to `:host`** — fixed instead of absolute, anchored to the viewport instead of the pill parent. Matches the tweaks-panel pattern.
2. **`[hidden]` switches to `[data-open]`** with a transform + visibility transition — same a11y-correct pattern as the tweaks-panel fix from step 6 commit 7. The visibility flip is delayed so tab order is removed only after the slide-out completes.
3. **`max-height: calc(100vh - 96px); overflow-y: auto`** — long source citations and descriptions scroll within the panel rather than running off the viewport. The 96px reservation accounts for the 80px top offset plus 16px breathing room.

Box-shadow elevation upgrades from `--el-2` (subtle) to `--el-3` (heavier) since the card is now a true panel-on-page rather than an inline popover. Matches the tweaks-panel weight.

**No changes to `packages/core/src/styles/components.css`.** Everything stays scoped inside the data-card's shadow root.

## Lifecycle behaviors

```
[page mount]
  <sim-data-card> connectedCallback:
    - render placeholder shell (no ref yet → no data fetch)
    - register document listener for `data-pill-clicked`
    - hidden by default (no [data-open])

[user clicks Pill A (ref="gas-constant-R")]
  Pill emits data-pill-clicked { ref: "gas-constant-R" }
  Card's listener fires:
    - _currentRef = "gas-constant-R"
    - _previouslyFocused = composedPath()[0]?.getRootNode()?.host  (the pill host)
    - setAttribute("ref", "gas-constant-R")  (triggers re-render via existing attributeChangedCallback)
    - setAttribute("data-open", "")
    - _activate(): trapFocus, focus close button, register Escape + outside-click handlers

[user clicks Pill B while panel is open]
  Pill B emits data-pill-clicked { ref: "boltzmann-kB" }
  Card's listener fires:
    - _currentRef !== detail.ref → swap (not toggle)
    - _previouslyFocused = Pill B's host  (focus-return target updates)
    - setAttribute("ref", "boltzmann-kB")  (re-render)
    - _deactivate then _activate()  (re-trap on new card content, re-focus close button)
    - data-open already set; no slide animation replay

[user clicks the same pill again — same ref while open]
  Card's listener:
    - _currentRef === detail.ref → toggle close
    - _dismiss()

[user clicks outside the card]
  Document click handler fires (registered by _activate):
    - if !this.contains(e.target) && !e.composedPath().includes(this):
      - AND no <sim-data-pill> in composedPath:
        - _dismiss()
    - (Click on a different pill: pill's handler runs first synchronously,
       dispatches data-pill-clicked → card swaps. Then doc-click fires —
       but it sees a pill in composedPath and skips the close.)

[user presses Escape]
  _dismiss()

[user clicks close button]
  _dismiss()

_dismiss():
  - removeAttribute("data-open")  (CSS slides out, visibility:hidden after 180ms)
  - _deactivate()  (release trap, remove Escape + outside-click handlers)
  - restoreFocusTo(_previouslyFocused)  (focus returns to the triggering pill)
  - _currentRef = null
  - _previouslyFocused = null
  - dispatchEvent("data-card-closed", { detail: { ref }, bubbles: true, composed: true })
```

### Subtle interaction: outside-click vs. pill-click swap

When the user clicks Pill B while Pill A's content is showing, BOTH the pill's click handler AND the card's document-level outside-click handler will fire (the card is "outside" Pill B). The pill's handler runs first synchronously (dispatch is synchronous), updating `_currentRef` and re-rendering. Without defense, the doc-click handler then runs and calls `_dismiss()` — closing the panel that was just swapped.

**Defense, two layers:**

1. The pill calls `e.stopPropagation()` on its button click (already does, per step 6 commit 4). This should halt the event before it reaches the document.
2. The card's outside-click handler additionally checks `e.composedPath()` for any `<sim-data-pill>` element. If found, the click is treated as "into a pill" rather than "outside the card" — close is skipped.

Both layers belt-and-suspenders against shadow-DOM event quirks. Verified during implementation; the two-layer approach makes the regression test in Section 5 (`outside click dismisses but click on a pill does not double-fire close-then-open`) robust.

### Focus-restoration target

On open from a click, `composedPath()[0]?.getRootNode()?.host` returns the pill HOST element in light DOM. The card's `_previouslyFocused = pillHost` saves that. On close, `restoreFocusTo(pillHost)` calls `pillHost.focus()`. The pill host is a generic HTMLElement (not natively focusable), but `HTMLElement.focus()` works on any element and does no harm if the host has no tabindex. The user-visible effect: focus returns to "near the pill" on close, even if not exactly to the inner button. This is acceptable for phase 9; refinement (have the pill expose a `focus()` method that focuses its inner button) can be a polish PR.

## Tests

### `sim-data-pill.test.js` (7 → 7 tests, behavior changes)

| #     | Test                                                        | Status                                                                                |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1     | renders value and unit from the data table                  | unchanged                                                                             |
| 2     | renders error marker for unknown ref                        | unchanged                                                                             |
| 3     | (was) click toggles child sim-data-card hidden              | replaced: `re-emits data-pill-clicked on every click (not just first)`                |
| 4     | (was) Escape closes the open card                           | deleted                                                                               |
| 5     | (was) click outside the pill closes the open card           | deleted                                                                               |
| 6     | emits data-pill-clicked with detail { ref }                 | unchanged                                                                             |
| 7     | button has aria-label with name + value + unit              | unchanged                                                                             |
| (new) | does NOT register document-level click or keydown listeners | sanity check: spy on `document.addEventListener`, assert pill connect doesn't call it |
| (new) | re-emits data-pill-clicked on every click (not just first)  | (counted above as #3)                                                                 |

Net: 7 tests, 2 dropped, 2 added.

### `sim-data-card.test.js` (6 → 9 tests, full rewrite)

Tests use the singleton pattern: `beforeEach` creates an explicit `<sim-data-card>` element + at least one `<sim-data-pill>` in `document.body` (replaces the prior pattern of pill-creates-child-card).

| #   | Test                                                                               | Behavior                                                                                              |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | renders symbol/name/value/unit/description/source on first pill click              | Pill click → card opens with right content (existing assertion, new trigger)                          |
| 2   | pill click toggles data-open (open then close on second click of same pill)        | Same-ref re-click closes (toggle)                                                                     |
| 3   | clicking a different pill while card is open swaps content in place                | Click Pill A → kB. Click Pill B → R. Content updates; `data-open` stays set                           |
| 4   | close button sets data-open=false and emits data-card-closed                       | Close button click → `data-open` removed; `data-card-closed` event fires                              |
| 5   | Escape key dismisses while card is visible                                         | Doc-level Escape → close                                                                              |
| 6   | outside click dismisses (but click on a pill does not double-fire close-then-open) | Click outside → close. Click on a pill → swap (NOT close-then-reopen). Regression for the timing bug. |
| 7   | Copy citation calls navigator.clipboard.writeText with formatted citation          | Same as before, new trigger                                                                           |
| 8   | View source link is present only when the source has a url                         | Two pills with different sources → click each → check link presence                                   |
| 9   | unknown ref renders error message and console.errors                               | Pill with bad ref → click → card shows the missing-data fallback                                      |

**Total:** 13 → 14 tests (+1 net). Pipeline target: **140 → 141**.

## Sequencing — 3 commits

| #   | Commit                                                                                       | Files                                                                                    | Cum tests |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------- |
| 1   | `feat(core): redesign <sim-data-card> as singleton slide-out + <sim-data-pill> emits events` | `sim-data-pill.js`, `sim-data-card.js`, `sim-data-pill.test.js`, `sim-data-card.test.js` | 141       |
| 2   | `feat(examples): topic-page + smoke test add singleton <sim-data-card>`                      | `examples/topic-page/index.html`, `examples/vanilla-html/index.html`                     | 141       |
| 3   | `docs: phase 9 — data-card side-panel CHANGELOG + architecture`                              | `CHANGELOG.md`, `docs/architecture.md`                                                   | 141       |

Why combine the pill and card into one commit (rather than two): the two components are tightly coupled via the new event flow. Splitting would leave the pipeline broken between commit 1 and commit 2 (card tests assume the new event-driven flow; pill is the thing dispatching events). One coherent component refactor commit avoids that.

## Phase 9 exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — **141 tests** passing (was 140 after step 8 / phase 8a).
4. `pnpm build` produces ESM + IIFE bundles. Bundle size delta ≤ +2 kB IIFE.
5. `examples/topic-page/index.html` (after `pnpm build`) opens in a browser and shows:
   - Click any data pill → side panel slides in from the **left**.
   - Click a different data pill while panel is open → panel content swaps in place (no close-then-reopen flicker).
   - Click the same pill twice → panel closes.
   - Click outside the panel → closes.
   - Click on a different pill outside → swaps (NOT close-then-reopen).
   - Escape key → closes.
   - Close button (×) → closes.
   - Tab from the trigger pill cycles through panel contents (close button, copy citation, optional view-source link), then wraps back.
   - Focus returns to the triggering pill on close.
   - The panel does NOT push or shift any page content — the whole point of the redesign.
6. `examples/vanilla-html/index.html` (smoke test) shows the same behaviors.
7. The tweaks panel (right side) and data card (left side) can both be open simultaneously without overlap.
8. CI green on PR; merged to `main`.

### What you will NOT have at the end of phase 9 (and that is correct)

- Multi-page state coordination — if you navigate to a different topic that also has pills, the new page mounts a fresh card. That's the intended scope of "singleton per page," not "singleton across navigations."
- Animated content-swap (when a different pill is clicked while panel is open) — content updates in place without a fade/slide transition. If that feels jarring, polish in a follow-up phase.
- Mobile/tablet responsive layout — `top: 80px; left: 16px; width: 320px` may need media queries for narrow viewports. Defer to a polish phase if needed.
- The `<slot>` reinstatement in `<sim-coachmark>` (still queued from step 6) and `<sim-engine>` private API promotion (also queued) — both deferred to their own phases.
- Phase 10's success-criteria interactive checklist with export — its own design phase next.
