# Topic-page print stylesheet — design

**Date:** 2026-05-02
**Predecessors:** Phase 10A v2 (PR #8 — reflection-only print pipeline), Phase 10B (PR #10 — `<sim-text-response>` + `<sim-practice-question>` + `<sim-reflection-export>`), bell-ringer paper-only fix (PR #11).
**Companion plan:** `docs/plans/2026-05-02-topic-page-print-stylesheet-implementation.md` (forthcoming).

---

## Goal

Let a teacher (or student) hit Cmd+P on `examples/topic-page/index.html` and get a clean classroom handout: title, lede, intros, IB understandings, equation panel, key concept, success criteria list, worked example, practice question prompt, mark scheme, misconceptions, and exit ticket prompts. UI chrome and the interactive sim disappear. The sim section gets a one-line "see online" placeholder so the printout retains its narrative shape.

This is purely a polish layer. No new components, no JS behavior changes. Two CSS surfaces — one global, one per-component — combine to produce the print mode.

---

## Locked decisions

| Decision                                                           | Choice                                                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Sim section in print                                               | Replace with a one-line `::after` placeholder ("Interactive simulation — see online at …")                                            |
| Interactive post-sim sections (exit ticket × 3, practice question) | Per-component `@media print` rules in HOST_STYLES — prompts visible, textareas + chips hidden                                         |
| Practice question model answer in print                            | Prints **only if** Show-answer was clicked (mirrors `<details>` default)                                                              |
| Coexistence with reflection-only print mode (PR #8)                | Whole-page rules apply when `body.printing-reflection` is **not** set; reflection-only rules already gate on that class. No conflict. |
| URLs printed after `<a href>` text                                 | Suppressed (`a[href]::after { content: none }`)                                                                                       |
| Paper size                                                         | `@page { margin: 0.75in }` — works for Letter and A4                                                                                  |
| Test coverage                                                      | +2 lightweight CSS-string presence tests (one per affected component); manual print preview is the real verification                  |

---

## Architecture

Two CSS surfaces, layered:

```
                 Cmd+P pressed
                       │
                       ▼
        ┌──────────────────────────────────┐
        │  body.printing-reflection set?   │
        └────────┬───────────────┬─────────┘
                 │ yes            │ no
                 ▼                ▼
        Reflection-only mode   Whole-page handout mode
        (PR #8 / PR #9 rules)  (THIS DESIGN)
        Hides everything       Hides chrome + sim + side panels
        except                 Keeps title, lede, intros,
        #print-reflection-     teaching content, exit-ticket
        output                 prompts, etc.
```

The reflection-only branch already exists and ships in `components.css` (lines 1146–1190). It only fires when `<sim-reflection-export>.exportPDF()` synthesizes the `#print-reflection-output` block and adds `body.printing-reflection`. The whole-page mode is the natural complement: rules that apply UNCONDITIONALLY in `@media print` but get overridden when the reflection-only mode is active.

**Top-level rules** live in `packages/core/src/styles/components.css` at the end of the existing print section. They handle page-level structure: top strip + sticky header hidden, side panels hidden, sim section replaced, "Next topic" link hidden, link-URL suppression, page-break hints, page margins.

**Per-component rules** live inside each affected component's `HOST_STYLES` template literal. The components already use a singleton `CSSStyleSheet` via `adoptedStyleSheets`, so `@media print` blocks inside HOST_STYLES are scoped to the shadow root and apply correctly at print time. Two components affected: `<sim-text-response>` (hide textarea + char-count) and `<sim-practice-question>` (hide textarea + Show-answer button + 3-chip rating row).

---

## What gets hidden vs printed

### Hidden in print (top-level)

- `<nav class="sim-topstrip">` — the "AISC · IB Sciences" badge row.
- `<header class="topic-header">` — the sticky header (breadcrumb + HL toggle + Tweaks button + Save your work button).
- `<sim-data-card>`, `<sim-checklist>`, `<sim-reflection-export>`, `<sim-tweaks-panel>` — all four side-panel singletons.
- `#reflect-button` — the inline "Reflect on these criteria" button in the success-criteria column.
- `.sim-shell` _contents_ (children) — replaced with a `::after` placeholder.
- `.topic-next` — the disabled "Next topic" placeholder card at the bottom.

### Hidden in print (per-component)

- `<sim-text-response>`: hide `.sim-text-response__textarea` and `.sim-text-response__count`. Keep `.sim-text-response__prompt`.
- `<sim-practice-question>`: hide `.sim-practice__textarea`, `.sim-practice__show-answer`, and `.sim-practice__rating`. Keep `.sim-practice__prompt`. The reveal block (`.sim-practice__reveal`) keeps its current `[hidden]` state — if revealed on screen, the slotted model answer prints; if not, it doesn't.

### Printed unchanged (no rules needed)

- Title (`<h1 class="sim-head__title">`) and lede (`<p class="sim-head__lede">`).
- Bell ringer (already static prose post-PR-#11).
- Topic intro — currently-active variant only. The inactive `[data-variant]` block already has `hidden` from `applyLevel`, so the default `[hidden] { display: none }` covers it.
- Key concept, IB understandings, equation panel.
- Success criteria column kicker + "I can…" + bulleted list (the static `<ul>` lives outside the `<sim-checklist>` panel, so it prints by default).
- Worked example — prints whatever state `<details>` is in. Default closed → "Show solution" summary prints; click expand before printing → solution body prints.
- Command term reminder, mark scheme, misconceptions.
- Glossary-term spans, data pills — text content prints; popovers don't appear (they only render on hover/click).

---

## Sim placeholder

The `.sim-shell` element wraps `<sim-engine id="sim">` plus its tweaks-row and surrounding controls. In print:

```css
@media print {
  .sim-shell > * {
    display: none !important;
  }
  .sim-shell::after {
    content: 'Interactive simulation — see online at ' attr(data-print-url);
    display: block;
    padding: 12pt;
    border: 1pt solid #999;
    border-radius: 4pt;
    font-style: italic;
    color: #555;
    text-align: center;
  }
}
```

The page author opts in by setting `data-print-url` on the `.sim-shell` element. For Gas Laws: `data-print-url="https://aisc-sims.example/s1.5-gas-laws"` (placeholder URL — easy to swap when the real domain is locked). If the attribute is missing, `attr()` falls back to empty string — the line still prints, just without a URL.

---

## Page polish

### Margins

```css
@page {
  margin: 0.75in;
}
```

Comfortable on Letter and A4. `@page` is print-only by spec, no screen impact.

### Body baseline

The screen layout caps the topic page at a max-width and centers it. In print, fill the printable area:

```css
@media print {
  body {
    max-width: none;
  }
  .sim-wrap.topic-page {
    max-width: none;
    padding: 0;
  }
}
```

### Link URLs

Default browser behavior appends `<a href>` URLs in parentheses after link text. The topic page has many internal anchors and glossary-term links — noisy. Kill uniformly:

```css
@media print {
  a[href]::after {
    content: none;
  }
}
```

### Page breaks

```css
@media print {
  .ib-bellringer,
  .ib-concept,
  .ib-equation,
  .ib-worked,
  .ib-practice,
  .ib-mark,
  .ib-misc,
  .ib-exitticket,
  .ib-understandings__list li {
    break-inside: avoid;
  }
}
```

Encourages cohesive blocks to stay together. Browser falls back gracefully if it can't honor the hint.

### Color and backgrounds

The design's accent colors (navy, dotted-underline glossary terms, data-pill badges) print legibly in B&W on most school printers. No special color overrides needed — keep the design.

---

## Testing strategy

CSS in print mode can't be exercised in happy-dom (no real layout engine). The existing 182 unit tests stay green and unchanged.

**Two cheap regression tests** assert the per-component print rules survive future refactors:

- `<sim-text-response>` test: read the component's stylesheet text and assert it contains an `@media print` block AND the textarea-hiding selector AND the count-hiding selector.
- `<sim-practice-question>` test: same shape — assert `@media print`, textarea-hide, show-answer-hide, rating-hide.

Net **+2 tests** (182 → 184).

**Manual verification (the real test):** Chrome print preview against the 14-point checklist below.

---

## Manual verification checklist

1. Top strip + sticky header gone.
2. Title + lede at top of page 1.
3. Bell ringer prints as numbered prose ("in your notebook" framing).
4. Topic intro: ONLY the currently-active variant prints. (Flip toggle, re-print, confirm the other appears.)
5. Key concept, IB understandings, equation panel intact. List items don't split across pages.
6. Success criteria column: kicker + "I can…" + bulleted list. Reflect button gone.
7. Sim section: contents gone; bordered "Interactive simulation — see online at https://aisc-sims.example/s1.5-gas-laws" line in its place.
8. Worked example: prints whatever state `<details>` is in.
9. Practice question: prompt visible. Textarea + Show-answer + chips gone. Model answer only if revealed.
10. Command term reminder, mark scheme, misconceptions intact.
11. Exit ticket: 3 numbered prompts visible. No textareas, no char-count footers.
12. "Next topic" placeholder gone.
13. No `(https://...)` URL appendices after link text.
14. Side panels absent regardless of their on-screen state.

---

## Sequencing — 1 commit, 8 files

| File                                                    | Change                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/styles/components.css`               | Append top-level `@media print` block (sim placeholder, hidden chrome, breaks, URL suppression, page margins). |
| `packages/core/src/components/sim-text-response.js`     | Append `@media print` block to HOST_STYLES.                                                                    |
| `packages/core/src/components/sim-practice-question.js` | Append `@media print` block to HOST_STYLES.                                                                    |
| `packages/core/tests/sim-text-response.test.js`         | +1 print-rule presence test.                                                                                   |
| `packages/core/tests/sim-practice-question.test.js`     | +1 print-rule presence test.                                                                                   |
| `examples/topic-page/index.html`                        | Add `data-print-url="https://aisc-sims.example/s1.5-gas-laws"` to the existing `.sim-shell`.                   |
| `CHANGELOG.md`                                          | "Topic-page print stylesheet" entry under [Unreleased].                                                        |
| `docs/architecture.md`                                  | Short subsection describing the two-mode print contract.                                                       |

~80 lines added. One commit, one PR.

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (no new warnings).
3. `pnpm test` — **184 passing** (182 baseline + 2 new presence tests).
4. `pnpm build` clean. Bundle delta < +1 kB IIFE.
5. Manual print preview matches the 14-point checklist above.
6. CI green; PR merged.

---

## Out of scope

- Static screenshot of the canvas (mentioned in Q1 option C).
- Print-style tuning for the data-card / checklist / export panel contents (they're hidden anyway).
- Per-page-size optimization beyond Letter/A4.
- The reflection-only print mode (PR #8) stays unchanged.
- Real production URL for the sim placeholder (using `aisc-sims.example` as a placeholder; easy swap when the domain is locked).

## Risks + mitigations

| Risk                                                                                       | Mitigation                                                                                                                                                   |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Per-component shadow-DOM print rules don't fire in some browser due to stylesheet adoption | Singleton stylesheet pattern is widely supported (Chrome, Safari, Firefox); manual print preview catches any browser-specific surprise.                      |
| Page breaks land awkwardly across HL/SL switch                                             | `break-inside: avoid` on cohesive blocks; manual flip-and-print verification catches both modes.                                                             |
| Author forgets to set `data-print-url`                                                     | Graceful fallback: `attr(data-print-url)` resolves to empty string; placeholder line still prints. Future authoring docs can mention this.                   |
| Future component additions ship without print rules                                        | The convention "every interactive component owns a `@media print` block in HOST_STYLES" gets documented in architecture.md so reviewers catch missing rules. |

The two-mode print contract (whole-page vs reflection-only via `body.printing-reflection`) is the most subtle architectural piece. The architecture.md update spells it out so future contributors don't accidentally collide the two modes.
