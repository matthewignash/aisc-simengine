# Gas-laws example animations — design

**Date:** 2026-05-02
**Predecessors:** Gas-laws background section + pictures (PR #14, awaiting review/merge — this work extends PR #14's branch as the third commit on top of the existing `2bd0595` prose commit and the `907e94d` photos commit).
**Companion plan:** `docs/plans/2026-05-02-gas-laws-example-animations-implementation.md` (forthcoming).

---

## Goal

Add a small didactic animated SVG diagram below each of the four real-world photos in the Gas Laws "Where you will see these laws" subsection. Each animation is a schematic loop showing the gas-law physics in motion (piston compressing for Boyle, balloon expanding for Charles, pressure rising in a sealed cooker for Gay-Lussac, equal volumes growing as particles are added for Avogadro). Photo provides the real-world anchor; animation provides the physics. Acts as a pre-sim teaser before students reach the main interactive sim further down the page.

CSS + SVG only. No JS, no new dependencies, no new components. Inline SVGs in the topic-page HTML; CSS keyframes in `components.css`.

---

## Locked decisions

| Decision         | Choice                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Animation tech   | **Custom CSS + SVG** (inline `<svg>` with `@keyframes` in `components.css`)                                             |
| Placement        | **Augment** — keep PR #14's photos; add animation below each photo, above the caption                                   |
| Scope            | **All four laws** — Boyle, Charles, Gay-Lussac, Avogadro                                                                |
| Triggering       | Always-loop (`animation-iteration-count: infinite`); no JS, no IntersectionObserver                                     |
| Reduced motion   | `@media (prefers-reduced-motion: reduce)` pauses the animation; SVG renders a single representative frame               |
| Print mode       | `@media print` (with `body:not(.printing-reflection)` gating) pauses the animation; static frame prints in the 2×2 grid |
| Mobile (≤720 px) | SVG inherits container width; aspect-ratio 7:4; loop continues; reduced-motion respected                                |
| Test coverage    | None (visual content; presence tests would be brittle). Manual check is the real verification.                          |
| PR strategy      | Extend PR #14 (third commit on top of `907e94d`)                                                                        |

---

## What each animation shows

Four animations, ~280 × 160 px each, viewBox `0 0 280 160`. Loops 3–5 s.

| Law        | Animation content                                                                                                                                           | Visual elements                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boyle      | Horizontal cylinder; piston slides in (compress) → particles crowd, pressure indicator grows; piston slides out → particles spread, pressure shrinks. Loop. | Cylinder outline (rect), piston rect with `transform: translateX` keyframed, 6 particles (small circles) with motion, pressure-arrow size keyframed.       |
| Charles    | Balloon (ellipse) at constant pressure; thermometer rises, balloon scales up, particles speed up. Loop.                                                     | Balloon ellipse with `transform: scale` keyframed, thermometer rect with colored fill keyframed, particles with translate keyframes.                       |
| Gay-Lussac | Sealed pressure cooker outline; thermometer rises, particles speed up, pressure gauge needle rotates from 0 to peak. Loop.                                  | Cooker outline (path/rect, static), thermometer fill keyframed, 8 particles with faster motion at high T, gauge needle with `transform: rotate` keyframed. |
| Avogadro   | Two cylinders side-by-side (same volume start); particles get added one at a time → both cylinders grow proportionally. Reset. Loop.                        | Two cylinders with `transform: scaleY` keyframed, particles (circles) fade in via opacity keyframes, small "+" indicators per add event.                   |

Visual style across all four:

- SimEngine palette: navy outlines (`var(--ib-navy-600, #2a46a3)`), amber accents (`var(--ib-amber-500, #f59e0b)`), ink-700 labels.
- Particles: 4–8 small filled circles per animation, ~6 px radius, drawn in navy.
- Container outlines: 2 px stroke, no fill.
- Indicators (pressure arrow, thermometer fill, gauge needle): single amber accent — "what's changing."
- Schematic, not photorealistic. The point is to show the _relationship_ (P ↔ V, V ↔ T, etc.) at a glance.

Each SVG carries an inline `<title>` for screen-reader accessibility, e.g.:

```html
<svg viewBox="0 0 280 160" aria-labelledby="anim-boyle-title" role="img">
  <title id="anim-boyle-title">
    Animated diagram: piston compressing and expanding. Pressure rises as volume decreases. Loop.
  </title>
  <!-- ...elements... -->
</svg>
```

---

## Triggering, a11y, print

### Always-loop with no JS

Each SVG element's child animations fire via CSS `@keyframes` with `animation-iteration-count: infinite`. The browser handles play/pause automatically when the tab is offscreen — no IntersectionObserver needed. Cleanest, least-code answer.

### Reduced motion

Wrap every keyframe-driven element in a `@media (prefers-reduced-motion: reduce)` rule that sets `animation-play-state: paused`. The SVG then renders whatever transform values are active at pause-time. Each SVG is designed so that its "rest" position (the `0%` keyframe state) is a representative mid-cycle frame — e.g., piston halfway compressed, balloon at medium volume — so the static frame is meaningful on its own.

The `<title>` element inside each SVG remains and gets read by screen readers as "Animated diagram: …". Three concentric @media layers per SVG (the project's established pattern):

1. `@media (prefers-reduced-motion: reduce)` — pause animation, render representative frame.
2. `@media print` (with `body:not(.printing-reflection)` gating) — also pause, also render representative frame.
3. `@media (max-width: 720px)` — full-width, aspect-ratio preserved.

### Print mode

When the user hits Cmd+P:

```css
@media print {
  body:not(.printing-reflection) .topic-background__animation * {
    animation-play-state: paused !important;
  }
}
```

The SVG renders as a static representative frame (vector graphics print without resolution loss). Inside the existing 2×2 print grid (from PR #14's photo CSS), the figure becomes: photo + animation frame + caption. `break-inside: avoid` keeps them together.

The reflection-only print mode (PR #8 / PR #10's `<sim-reflection-export>.exportPDF()`) is unaffected because the rule gates on `:not(.printing-reflection)`.

### Mobile

Below 720 px, the figure grid stacks single-column (PR #14's CSS). Each animation inherits `width: 100%` with `aspect-ratio: 7 / 4` so the SVG scales gracefully. Animation continues; reduced-motion still respected.

---

## CSS additions

Append to `packages/core/src/styles/components.css`, immediately after the existing `.topic-background__figures` rule block (added in PR #14's photo commit):

```css
/* Animated SVG diagrams below each example photo. Schematic loops that
   show the gas-law physics in motion. Always-loop on screen; pause on
   prefers-reduced-motion or print. */
.topic-background__animation {
  display: block;
  width: 100%;
  aspect-ratio: 7 / 4;
  margin-top: var(--sp-2, 8px);
  background: var(--ib-navy-050, #f5f7fc);
  border-radius: var(--r-sm, 4px);
}

/* Per-law @keyframes — see implementation plan for the full set */
@keyframes anim-boyle-piston {
  /* ... */
}
@keyframes anim-charles-balloon {
  /* ... */
}
@keyframes anim-gay-lussac-cooker {
  /* ... */
}
@keyframes anim-avogadro-cylinders {
  /* ... */
}

/* Reduced motion: pause all the per-law animations */
@media (prefers-reduced-motion: reduce) {
  .topic-background__animation * {
    animation-play-state: paused !important;
  }
}

/* Print: pause the animations; SVG renders as a static representative frame */
@media print {
  body:not(.printing-reflection) .topic-background__animation * {
    animation-play-state: paused !important;
  }
}
```

Each `@keyframes` block is the actual physics animation (piston translation, balloon scale, gauge rotation, etc.). The implementation plan has the verbatim keyframe code per law.

---

## Markup changes

Inside each `<figure>` element in the existing `<div class="topic-background__figures">` blocks (4 figures in SL, 4 in HL — 8 total), insert an `<svg class="topic-background__animation">` between the `<img>` and `<figcaption>`:

```html
<figure>
  <img
    src="img/boyle-scuba.jpg"
    alt="..."
    width="600"
    height="600"
    loading="lazy"
    decoding="async"
  />
  <svg
    class="topic-background__animation"
    viewBox="0 0 280 160"
    aria-labelledby="anim-boyle-title-sl"
    role="img"
  >
    <title id="anim-boyle-title-sl">
      Animated diagram: piston compressing and expanding. Pressure rises as volume decreases. Loop.
    </title>
    <!-- cylinder, piston, particles, pressure indicator -->
  </svg>
  <figcaption>...existing caption + attribution...</figcaption>
</figure>
```

The SL and HL variants need DIFFERENT `aria-labelledby` ids (e.g., `anim-boyle-title-sl` and `anim-boyle-title-hl`) because the same SVG markup appears in both `data-variant` blocks. Even though one variant is hidden via `[hidden]` at any given time, two `id` attributes with the same value would be invalid HTML. The implementation plan calls out the per-variant id suffixes.

The 4 unique animations × 2 variants = 8 inline SVG insertions, each ~60–100 lines. Total HTML growth: ~600–800 lines.

---

## Files touched

| File                                      | Change                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `examples/topic-page/index.html`          | MODIFY — insert 8 inline `<svg>` blocks (one per figure × two variants)                                 |
| `packages/core/src/styles/components.css` | MODIFY — append `.topic-background__animation` + 4 `@keyframes` + reduced-motion + print + mobile rules |
| `CHANGELOG.md`                            | MODIFY — append one bullet to the existing "Gas-laws background section (post-10B)" subsection          |

3 files. **No** new components, **no** new image binaries, **no** new tests.

---

## Stats

- HTML growth: ~600–800 lines (8 inline SVGs).
- CSS growth: ~120 lines (4 keyframe blocks + the `.topic-background__animation` rule + media-query overrides).
- Bundle delta: ≤ +3 kB IIFE for the CSS keyframes (Vite inlines `components.css`). Inline SVG markup in `index.html` doesn't ship in the JS bundle.
- Test count: **184 unchanged**.

---

## Manual verification additions

Add to PR #14's existing checklist:

- [ ] Each figure shows an animated SVG below the photo. The animation runs continuously (3–5 s loop).
- [ ] Each animation visually matches its law:
  - Boyle: piston compressing, particles crowding, pressure indicator growing
  - Charles: balloon expanding as thermometer rises, particles speeding up
  - Gay-Lussac: sealed cooker, gauge needle rotating, particles speeding up
  - Avogadro: two side-by-side cylinders growing as particles get added
- [ ] DevTools → Rendering tab → emulate `prefers-reduced-motion: reduce` — animations freeze on a representative frame; the `<title>` element is still announced by screen readers.
- [ ] Cmd+P (whole-page handout mode) — animations render as static frames in the 2×2 print grid; figures don't break across pages.
- [ ] Save your work → Save as PDF — reflection-only print mode unaffected (no animations or photos in the export).
- [ ] DevTools mobile (iPhone SE 375 × 667) — figures stack single-column; animations remain visible below each photo at full width.

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (no new warnings).
3. `pnpm test` — **184 unchanged**.
4. `pnpm build` clean. Bundle delta ≤ +3 kB IIFE.
5. Manual verification matches the additions above.
6. CI green on PR #14 (now including the animations commit); merged to `main`.

---

## Out of scope (deferred)

- Animation for the main `<sim-engine>` showing real physics-driven animation (the main sim already does this — it's an interactive piston simulation; no need to duplicate as a teaser).
- Sound effects on animations.
- Tooltip-on-hover that explains the animation (caption already does this textually).
- Sharing animations across other topic pages — gas-laws-specific until the broader template is established.
- Replacing the photos with the animations — explicitly rejected during brainstorm; photos stay as the real-world anchor.
- Higher-fidelity animations (more particles, smoother curves, better physics accuracy) — the schematic style is the point; over-complication risks confusing the value prop ("preview" vs. "full sim").

---

## Risks + mitigations

| Risk                                                                                  | Mitigation                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML grows by ~600–800 lines, hurting readability of `examples/topic-page/index.html` | Each SVG block is well-commented and self-contained. Implementation plan provides the verbatim code so review is verbatim-comparison, not creative review. Future cleanup could extract SVGs to separate files (deferred). |
| Animations distract students from the rest of the page                                | Always-loop is gentle (3–5 s cycles, schematic, no jarring color flashes). `prefers-reduced-motion` users get a static frame. Subjective; manual visual review will catch if any feel intrusive.                           |
| Print rendering loses critical detail (e.g., particles too small in 2-inch frame)     | SVGs are vectors — no resolution loss. The "representative frame" is designed to show the key relationship clearly even at small sizes. Manual print preview catches any frame that fails.                                 |
| Per-law animation visuals don't actually match the law                                | Each animation is designed (per Section 2 of this doc) to show the specific gas-law relationship. Implementer reviews the visuals against the design before committing. Reviewer cross-checks.                             |
| Variant duplication: SL and HL show the same animation, ids must differ               | Each `<title>` has a per-variant id suffix (`-sl` / `-hl`). The animation itself is identical because the SL and HL views show different captions but the same physics — that's correct.                                   |
| Future contributors add new figures without animations                                | The convention "every example figure on the topic page has an inline animated SVG" gets documented in architecture.md (a small addition in the implementation plan).                                                       |

The pattern (inline SVG + CSS keyframes + three concentric @media layers — reduced-motion, print, mobile) becomes a template other topic pages can adopt for their own example figures.
