# Mobile-panel responsive — design

**Date:** 2026-05-02
**Predecessors:** Phase 10A v2 (PR #8 — `<sim-data-card>` and `<sim-checklist>` panel chrome), a11y polish (PR #9 — `prefers-reduced-motion`), Phase 10B (PR #10 — `<sim-reflection-export>` aggregator), topic-page print stylesheet (PR #12 — `<div class="sim-shell">` wrapper + per-component `@media print` blocks).
**Companion plan:** `docs/plans/2026-05-02-mobile-panel-responsive-implementation.md` (forthcoming).

---

## Goal

Make the four side panels (`<sim-data-card>`, `<sim-checklist>`, `<sim-reflection-export>`, `<sim-tweaks-panel>`) usable on phone-sized viewports. Below the existing 720 px breakpoint, each panel shrinks to `width: calc(100vw - 32px)` with `max-width: 320 px`, keeping its existing top/side offsets, slide-from-side animation, and the panel-opened mutual-exclusion contract. Desktop layout unchanged.

This is a CSS-only polish layer — no JS changes, no layout reflow, no animation rewrite. Adds ~6 lines per component.

---

## Locked decisions

| Decision                  | Choice                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Mobile UX pattern         | **Shrink-in-place** — panels stay floating, just narrower                                                                     |
| Breakpoint                | `@media (max-width: 720px)` — reuses the LISC convention from `components.css:720`                                            |
| Side coverage             | All 4 panels treated identically; left-side panels keep `left: 16px`, right-side panel keeps `right: 16px`                    |
| Slide animation direction | Unchanged — `transform: translateX(±120%)` clears any viewport size                                                           |
| Mutual-exclusion contract | Unchanged — JS event-bus contract is width-agnostic                                                                           |
| Sticky-header overflow    | Out of scope (file as follow-up if needed)                                                                                    |
| Test coverage             | +4 lightweight CSS-string presence tests (one per panel, source-read pattern matching the print-stylesheet tests from PR #12) |

---

## Architecture

Per-component HOST_STYLES additions only. No top-level CSS in `components.css`, no JS, no new components, no new dependencies.

```
                 viewport ≤ 720px
                       │
                       ▼
        ┌────────────────────────────────┐
        │  Panel HOST_STYLES @media block│
        │  shrinks :host width            │
        │   width: calc(100vw - 32px)    │
        │   max-width: 320px             │
        └────────────────────────────────┘

   Slide animation: unchanged (translateX(±120%))
   Side offset (left:16px / right:16px): unchanged
   Top offset (top:80px): unchanged
   max-height: calc(100vh - 96px): unchanged (overflow-y:auto handles tall content)
```

**Why all four panels are identical.** The host element handles the slide via `transform: translateX(±120%)` regardless of width. `position: fixed` with `left: 16px` (or `right: 16px`) plus the new `width: calc(100vw - 32px)` produces a panel that fits inside the viewport with 16 px margins on both sides, regardless of viewport width. `max-width: 320px` clamps so the panel never grows past the desktop width.

The right-side `<sim-tweaks-panel>` doesn't need any side-flip — its `right: 16px` rule is already in HOST_STYLES from prior phases. The same shrink rule keeps it floating against the right edge with 16 px margin.

---

## Per-panel CSS

Append this block to each component's HOST_STYLES, before the closing backtick of the template literal, after the existing `prefers-reduced-motion` block from PR #9:

```css
@media (max-width: 720px) {
  :host {
    width: calc(100vw - 32px);
    max-width: 320px;
  }
}
```

Identical block in all four components:

- `packages/core/src/components/sim-data-card.js`
- `packages/core/src/components/sim-checklist.js`
- `packages/core/src/components/sim-reflection-export.js`
- `packages/core/src/components/sim-tweaks-panel.js`

**Verify there's no collision with the existing `[data-open]` rule.** The existing pattern looks like:

```css
:host { position: fixed; ...; width: 320px; ... transform: translateX(-120%); ... }
:host([data-open]) { transform: translateX(0); ... }
@media (prefers-reduced-motion: reduce) { :host, :host([data-open]) { transition: none; } }
```

The new mobile block adds a third `:host` width override, which the cascade applies when both the base rule (`width: 320px`) and the @media block match. Result: 320 px on desktop, `calc(100vw - 32px)` capped at 320 px on mobile.

---

## Tests

Per-component CSS-string presence tests via `node:fs/promises` source read. Same pattern as the print-stylesheet tests from PR #12.

```js
it('HOST_STYLES includes a max-width: 720px @media block that shrinks the panel in place', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = await fs.readFile(path.join(here, '../src/components/<COMPONENT>.js'), 'utf-8');
  const m = src.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\}\s*\}/);
  expect(m).not.toBeNull();
  const block = m[1];
  expect(block).toContain('width: calc(100vw - 32px)');
  expect(block).toContain('max-width: 320px');
});
```

The regex matches `@media (max-width: 720px) { :host { … } }` (inner `:host` close + outer `@media` close). Cheap presence test; catches accidental deletion in a future refactor.

Net **+4 tests** (184 → 188).

---

## Files touched

| File                                                    | Change                             |
| ------------------------------------------------------- | ---------------------------------- |
| `packages/core/src/components/sim-data-card.js`         | Append @media block to HOST_STYLES |
| `packages/core/src/components/sim-checklist.js`         | Append @media block to HOST_STYLES |
| `packages/core/src/components/sim-reflection-export.js` | Append @media block to HOST_STYLES |
| `packages/core/src/components/sim-tweaks-panel.js`      | Append @media block to HOST_STYLES |
| `packages/core/tests/sim-data-card.test.js`             | +1 presence test                   |
| `packages/core/tests/sim-checklist.test.js`             | +1 presence test                   |
| `packages/core/tests/sim-reflection-export.test.js`     | +1 presence test                   |
| `packages/core/tests/sim-tweaks-panel.test.js`          | +1 presence test                   |
| `CHANGELOG.md`                                          | One subsection note                |
| `docs/architecture.md`                                  | Short paragraph                    |

10 files, ~50 lines added. Single commit, single PR.

---

## Manual verification

Chrome DevTools device emulation:

1. iPhone SE (375 × 667) — open each panel; confirm it fits inside the viewport with 16 px margin on each side. The panel should be ~343 px wide.
2. iPhone 12 Pro (390 × 844) — same; panel should be 320 px wide (capped by `max-width`).
3. Galaxy S20 Ultra (412 × 915) — same; panel should be 320 px wide.
4. iPad Mini (768 × 1024) portrait — above breakpoint; panel should be 320 px wide (the desktop value).
5. Desktop (1280 × 800) — panel should be 320 px wide; behavior unchanged.

For each viewport, exercise the mutual-exclusion choreography: open data-card via pill click → click "Save your work" → data-card slides out, export panel slides in. Then click "Reflect" → export panel slides out, checklist slides in. All three left-side panels remain mutually exclusive at any width.

Tweaks panel (right side) coexists with any left-side panel at any width.

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (no new warnings).
3. `pnpm test` — **188 passing** (was 184; +4 presence tests).
4. `pnpm build` clean. Bundle delta < +0.5 kB IIFE (4 × ~6-line CSS block).
5. Manual DevTools mobile-emulation check passes against the 5-viewport list above.
6. CI green; PR merged.

---

## Out of scope (deferred)

- Sticky header overflow at narrow widths (the breadcrumb + HL toggle + Tweaks + Save controls could wrap or overlap on phones). File as a follow-up if real users hit this.
- Bottom-drawer pattern (option C from the brainstorm — rejected; would require animation rewrite).
- Tablet-specific tuning beyond what 720 px catches.
- Print stylesheet (orthogonal — PR #12 already shipped).
- Touch-target sizing tuning (close × button is 1.4em font; might need tap-target adjustment on phones — defer until users report it).

---

## Risks + mitigations

| Risk                                                                                         | Mitigation                                                                                                                                                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel content (e.g. the export aggregator's preview list) overflows on very narrow viewports | `max-height: calc(100vh - 96px)` + `overflow-y: auto` already in HOST_STYLES handles vertical overflow. Horizontal overflow handled by the new width rule.           |
| Sticky header pushes panel top offset down on narrow screens                                 | Out of scope here; the panel's `top: 80px` matches desktop. Sticky header overflow is a separate follow-up if needed.                                                |
| Mobile-Safari iOS specific glitches (e.g. 100vh including the URL bar)                       | `calc(100vh - 96px)` may feel taller than the user expects on iOS, but the panel still scrolls internally. Acceptable.                                               |
| Future fifth left-side panel ships without the responsive rule                               | The convention "every floating panel includes a `@media (max-width: 720px)` block in HOST_STYLES" gets documented in architecture.md. Reviewers catch it at PR time. |

The design pattern (per-component @media rules in HOST_STYLES) is the same one established in PR #9 for `prefers-reduced-motion` and PR #12 for print. Three concentric @media layers in HOST_STYLES is becoming the project convention for component-owned responsiveness.
