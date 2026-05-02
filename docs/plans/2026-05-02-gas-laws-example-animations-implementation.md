# Gas-laws Example Animations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a small didactic animated SVG diagram below each of the four real-world photos in the Gas Laws "Where you will see these laws" subsection. Schematic loops showing the gas-law physics in motion.

**Architecture:** CSS + SVG only. Each animation is an inline `<svg>` element inside its parent `<figure>`, between the existing `<img>` and `<figcaption>`. Animations are driven by CSS `@keyframes` declared in `components.css`. The same SVG markup appears once in the SL `data-variant` block and once in the HL `data-variant` block (different `aria-labelledby` ids per variant); browser cache is irrelevant since the SVGs are inline. No JS, no new dependencies, no new tests.

**Tech Stack:** Plain HTML + SVG + CSS keyframes. Vanilla.

**Companion design doc:** `docs/plans/2026-05-02-gas-laws-example-animations-design.md` (commit `2b45466` on main). Read for the visual style and the per-law animation content.

**Note on PR strategy:** The companion design doc says "extends PR #14 — third commit on top of 907e94d." PR #14 has since merged. Adjusted strategy: branch off main as a new feature branch `gas-laws-example-animations` and ship as PR #15.

---

## Repo state at start

- `main` HEAD: post-PR-#14 (gas-laws background + photos merged) + the animations design doc.
- Worktree path: `.worktrees/gas-laws-example-animations/` on branch `gas-laws-example-animations`.
- Baseline tests: **184** (178 core + 6 data) — unchanged by this work.

## Standards (carried from prior phases)

- Conventional commits.
- No git config edits. Use env vars on each commit:
  - `GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com"`
  - `GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com"`
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer on every commit.
- No `git add -A`. Stage files by name.
- No emojis in UI labels or commit messages.

---

## Single commit — `feat(examples): add animated SVG diagrams to gas-laws example figures`

3 files. ~600 lines HTML + ~120 lines CSS.

### Task 1 — Add the Boyle's-law animation

**File:** `examples/topic-page/index.html`

Inside the SL `<div data-variant="default-sl">` block of the gas-laws background section, find the `<figure>` containing `<img src="img/boyle-scuba.jpg" …>`. Insert this SVG between the existing `<img>` and `<figcaption>`:

```html
<svg
  class="topic-background__animation"
  viewBox="0 0 280 160"
  aria-labelledby="anim-boyle-title-sl"
  role="img"
>
  <title id="anim-boyle-title-sl">
    Animated diagram: piston compressing and expanding. Pressure rises as volume decreases. Loop.
  </title>
  <!-- Cylinder body -->
  <rect
    x="30"
    y="40"
    width="200"
    height="80"
    fill="none"
    stroke="var(--ib-navy-600, #2a46a3)"
    stroke-width="2"
    rx="4"
  />
  <!-- Particles inside (schematic, static positions) -->
  <g fill="var(--ib-navy-600, #2a46a3)" class="boyle-particles">
    <circle cx="55" cy="60" r="5" />
    <circle cx="85" cy="100" r="5" />
    <circle cx="115" cy="70" r="5" />
    <circle cx="145" cy="95" r="5" />
    <circle cx="175" cy="55" r="5" />
    <circle cx="200" cy="80" r="5" />
  </g>
  <!-- Piston (slides left to compress) -->
  <g class="boyle-piston">
    <rect x="225" y="40" width="6" height="80" fill="var(--ib-navy-600, #2a46a3)" />
    <rect x="231" y="50" width="35" height="60" fill="var(--ib-ink-700, #374151)" rx="2" />
  </g>
  <!-- Pressure indicator (amber bar that grows) -->
  <text x="8" y="35" font-size="11" fill="var(--ib-ink-700, #374151)">P</text>
  <line
    class="boyle-pressure"
    x1="8"
    y1="80"
    x2="20"
    y2="80"
    stroke="var(--ib-amber-500, #f59e0b)"
    stroke-width="6"
    stroke-linecap="round"
  />
  <!-- Caption -->
  <text x="140" y="148" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
    P × V = constant (at constant T, n)
  </text>
</svg>
```

**Now insert the analogous SVG in the HL block** — same content, but the `aria-labelledby` and `<title id>` use the suffix `-hl` instead of `-sl`. Find the `<figure>` containing `<img src="img/boyle-scuba.jpg">` inside the `<div data-variant="default-hl">` block, and insert the same SVG as above with the two id changes:

- `aria-labelledby="anim-boyle-title-hl"`
- `<title id="anim-boyle-title-hl">`

The rest of the SVG content is identical.

### Task 2 — Add the Charles's-law animation

**File:** `examples/topic-page/index.html`

Inside the SL block's `<figure>` for `img/charles-balloon.jpg`, insert this SVG between `<img>` and `<figcaption>`:

```html
<svg
  class="topic-background__animation"
  viewBox="0 0 280 160"
  aria-labelledby="anim-charles-title-sl"
  role="img"
>
  <title id="anim-charles-title-sl">
    Animated diagram: balloon expanding as temperature rises. Volume increases with temperature at
    constant pressure. Loop.
  </title>
  <!-- Thermometer -->
  <g>
    <rect
      x="40"
      y="20"
      width="14"
      height="90"
      fill="none"
      stroke="var(--ib-navy-600, #2a46a3)"
      stroke-width="2"
      rx="7"
    />
    <circle
      cx="47"
      cy="120"
      r="14"
      fill="var(--ib-amber-500, #f59e0b)"
      stroke="var(--ib-navy-600, #2a46a3)"
      stroke-width="2"
    />
    <rect
      class="charles-thermometer-fill"
      x="42"
      y="40"
      width="10"
      height="80"
      fill="var(--ib-amber-500, #f59e0b)"
    />
    <text x="47" y="14" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
      T
    </text>
  </g>
  <!-- Balloon -->
  <g class="charles-balloon">
    <ellipse
      cx="190"
      cy="90"
      rx="40"
      ry="50"
      fill="var(--ib-amber-500, #f59e0b)"
      fill-opacity="0.3"
      stroke="var(--ib-navy-600, #2a46a3)"
      stroke-width="2"
    />
    <line
      x1="190"
      y1="140"
      x2="190"
      y2="155"
      stroke="var(--ib-ink-700, #374151)"
      stroke-width="2"
    />
  </g>
  <text x="190" y="20" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
    V
  </text>
  <!-- Caption -->
  <text x="140" y="148" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
    V ÷ T = constant (at constant P, n)
  </text>
</svg>
```

**HL version:** same SVG with `-hl` instead of `-sl` on the two id values. Insert in the HL block's `<figure>` for `img/charles-balloon.jpg`.

### Task 3 — Add the Gay-Lussac's-law animation

**File:** `examples/topic-page/index.html`

Inside the SL block's `<figure>` for `img/gay-lussac-cooker.jpg`, insert this SVG:

```html
<svg
  class="topic-background__animation"
  viewBox="0 0 280 160"
  aria-labelledby="anim-gay-lussac-title-sl"
  role="img"
>
  <title id="anim-gay-lussac-title-sl">
    Animated diagram: pressure rising in a sealed container as temperature increases. Gauge needle
    sweeps from low to high. Loop.
  </title>
  <!-- Cooker body -->
  <rect
    x="80"
    y="55"
    width="120"
    height="80"
    fill="none"
    stroke="var(--ib-navy-600, #2a46a3)"
    stroke-width="2"
    rx="6"
  />
  <!-- Cooker lid strip -->
  <rect x="76" y="50" width="128" height="8" fill="var(--ib-navy-600, #2a46a3)" rx="2" />
  <!-- Particles inside (schematic, static positions) -->
  <g fill="var(--ib-navy-600, #2a46a3)">
    <circle cx="100" cy="80" r="4" />
    <circle cx="125" cy="105" r="4" />
    <circle cx="150" cy="75" r="4" />
    <circle cx="180" cy="100" r="4" />
    <circle cx="115" cy="120" r="4" />
    <circle cx="170" cy="120" r="4" />
  </g>
  <!-- Pressure gauge on top (centered horizontally above the cooker) -->
  <g transform="translate(140, 35)">
    <circle
      cx="0"
      cy="0"
      r="20"
      fill="var(--ib-white, #fff)"
      stroke="var(--ib-navy-600, #2a46a3)"
      stroke-width="2"
    />
    <line
      class="gay-lussac-needle"
      x1="0"
      y1="0"
      x2="0"
      y2="-15"
      stroke="var(--ib-amber-500, #f59e0b)"
      stroke-width="2"
      stroke-linecap="round"
    />
    <circle cx="0" cy="0" r="2" fill="var(--ib-navy-600, #2a46a3)" />
  </g>
  <!-- Thermometer on left -->
  <g>
    <rect
      x="30"
      y="70"
      width="10"
      height="50"
      fill="none"
      stroke="var(--ib-navy-600, #2a46a3)"
      stroke-width="1.5"
      rx="5"
    />
    <circle
      cx="35"
      cy="125"
      r="8"
      fill="var(--ib-amber-500, #f59e0b)"
      stroke="var(--ib-navy-600, #2a46a3)"
      stroke-width="1.5"
    />
    <rect
      class="gay-lussac-thermometer-fill"
      x="32"
      y="85"
      width="6"
      height="40"
      fill="var(--ib-amber-500, #f59e0b)"
    />
    <text x="35" y="64" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
      T
    </text>
  </g>
  <text x="140" y="10" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
    P
  </text>
  <!-- Caption -->
  <text x="140" y="155" font-size="10" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
    P ÷ T = constant (at constant V, n)
  </text>
</svg>
```

**HL version:** same SVG with `-hl` instead of `-sl` on the two id values. Insert in the HL block's `<figure>` for `img/gay-lussac-cooker.jpg`.

### Task 4 — Add the Avogadro's-law animation

**File:** `examples/topic-page/index.html`

Inside the SL block's `<figure>` for `img/avogadro-propane.jpg`, insert this SVG:

```html
<svg
  class="topic-background__animation"
  viewBox="0 0 280 160"
  aria-labelledby="anim-avogadro-title-sl"
  role="img"
>
  <title id="anim-avogadro-title-sl">
    Animated diagram: two cylinders containing different gases. Both grow as equal numbers of
    molecules are added. Loop.
  </title>
  <!-- Left cylinder (Gas A — navy particles) -->
  <g class="avogadro-left">
    <rect
      x="40"
      y="60"
      width="80"
      height="70"
      fill="none"
      stroke="var(--ib-navy-600, #2a46a3)"
      stroke-width="2"
      rx="4"
    />
    <circle cx="55" cy="75" r="4" fill="var(--ib-navy-600, #2a46a3)" class="avogadro-p1" />
    <circle cx="80" cy="85" r="4" fill="var(--ib-navy-600, #2a46a3)" class="avogadro-p2" />
    <circle cx="105" cy="75" r="4" fill="var(--ib-navy-600, #2a46a3)" class="avogadro-p3" />
    <circle cx="65" cy="105" r="4" fill="var(--ib-navy-600, #2a46a3)" class="avogadro-p4" />
    <circle cx="95" cy="115" r="4" fill="var(--ib-navy-600, #2a46a3)" class="avogadro-p5" />
  </g>
  <!-- Right cylinder (Gas B — amber particles, larger) -->
  <g class="avogadro-right">
    <rect
      x="160"
      y="60"
      width="80"
      height="70"
      fill="none"
      stroke="var(--ib-navy-600, #2a46a3)"
      stroke-width="2"
      rx="4"
    />
    <circle cx="175" cy="75" r="6" fill="var(--ib-amber-500, #f59e0b)" class="avogadro-p1" />
    <circle cx="200" cy="85" r="6" fill="var(--ib-amber-500, #f59e0b)" class="avogadro-p2" />
    <circle cx="225" cy="75" r="6" fill="var(--ib-amber-500, #f59e0b)" class="avogadro-p3" />
    <circle cx="185" cy="105" r="6" fill="var(--ib-amber-500, #f59e0b)" class="avogadro-p4" />
    <circle cx="215" cy="115" r="6" fill="var(--ib-amber-500, #f59e0b)" class="avogadro-p5" />
  </g>
  <!-- Labels -->
  <text x="80" y="50" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
    Gas A
  </text>
  <text x="200" y="50" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
    Gas B
  </text>
  <!-- Caption -->
  <text x="140" y="148" font-size="11" text-anchor="middle" fill="var(--ib-ink-700, #374151)">
    Equal n → Equal V (at constant T, P)
  </text>
</svg>
```

**HL version:** same SVG with `-hl` instead of `-sl` on the two id values. Insert in the HL block's `<figure>` for `img/avogadro-propane.jpg`.

### Task 5 — Append the animation CSS to `components.css`

**File:** `packages/core/src/styles/components.css`

Find the existing `.topic-background__figures` rule block (added in PR #14's photo commit). Append this entire block AFTER the existing `@media print` rule that targets `.topic-background__figures` (i.e. at the end of the existing topic-background-figures CSS region):

```css
/* Animated SVG diagrams below each example photo. Schematic loops that
   show the gas-law physics in motion. Always-loop on screen; pause on
   prefers-reduced-motion or print. Inline SVGs in the topic-page HTML
   carry the per-element class names referenced by the @keyframes below. */
.topic-background__animation {
  display: block;
  width: 100%;
  aspect-ratio: 7 / 4;
  margin-top: var(--sp-2, 8px);
  background: var(--ib-navy-050, #f5f7fc);
  border-radius: var(--r-sm, 4px);
}

/* ── Boyle's law: piston compressing + pressure indicator scaling ── */
@keyframes anim-boyle-piston-translate {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(-80px);
  }
}
.boyle-piston {
  animation: anim-boyle-piston-translate 4s ease-in-out infinite;
}
@keyframes anim-boyle-pressure-scale {
  0%,
  100% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(2.5);
  }
}
.boyle-pressure {
  animation: anim-boyle-pressure-scale 4s ease-in-out infinite;
  transform-origin: 8px 80px;
}

/* ── Charles's law: balloon scaling + thermometer fill rising ── */
@keyframes anim-charles-balloon {
  0%,
  100% {
    transform: scale(0.7);
  }
  50% {
    transform: scale(1);
  }
}
.charles-balloon {
  animation: anim-charles-balloon 4s ease-in-out infinite;
  transform-origin: 190px 130px;
}
@keyframes anim-charles-thermometer {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}
.charles-thermometer-fill {
  animation: anim-charles-thermometer 4s ease-in-out infinite;
  transform-origin: 47px 120px;
}

/* ── Gay-Lussac's law: pressure-gauge needle rotating + thermometer fill ── */
@keyframes anim-gay-lussac-needle {
  0%,
  100% {
    transform: rotate(-60deg);
  }
  50% {
    transform: rotate(60deg);
  }
}
.gay-lussac-needle {
  animation: anim-gay-lussac-needle 4s ease-in-out infinite;
  transform-origin: 0 0;
}
@keyframes anim-gay-lussac-thermometer {
  0%,
  100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}
.gay-lussac-thermometer-fill {
  animation: anim-gay-lussac-thermometer 4s ease-in-out infinite;
  transform-origin: 35px 125px;
}

/* ── Avogadro's law: cylinders growing + particles fading in ── */
@keyframes anim-avogadro-grow {
  0%,
  100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}
.avogadro-left,
.avogadro-right {
  animation: anim-avogadro-grow 4s ease-in-out infinite;
  transform-origin: center 130px;
}
@keyframes anim-avogadro-fade {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
.avogadro-p1 {
  animation: anim-avogadro-fade 4s ease-in-out infinite;
  animation-delay: 0s;
}
.avogadro-p2 {
  animation: anim-avogadro-fade 4s ease-in-out infinite;
  animation-delay: 0.4s;
}
.avogadro-p3 {
  animation: anim-avogadro-fade 4s ease-in-out infinite;
  animation-delay: 0.8s;
}
.avogadro-p4 {
  animation: anim-avogadro-fade 4s ease-in-out infinite;
  animation-delay: 1.2s;
}
.avogadro-p5 {
  animation: anim-avogadro-fade 4s ease-in-out infinite;
  animation-delay: 1.6s;
}

/* ── Reduced motion: pause all the per-law animations ── */
@media (prefers-reduced-motion: reduce) {
  .topic-background__animation * {
    animation-play-state: paused !important;
  }
}

/* ── Print: pause animations; SVG renders as a static representative frame ── */
@media print {
  body:not(.printing-reflection) .topic-background__animation * {
    animation-play-state: paused !important;
  }
  body:not(.printing-reflection) .topic-background__animation {
    aspect-ratio: 7 / 4;
    max-height: 1.2in;
  }
}
```

### Task 6 — Append the CHANGELOG bullet

**File:** `CHANGELOG.md`

Find the existing `### Gas-laws background section (post-10B)` subsection (already on main from PR #14). At the end of its bullet list (immediately before the next subsection or before `### Notes`), append one new bullet:

```markdown
- **Animated diagrams:** added an inline animated SVG below each example photo (4 total: piston compressing for Boyle, balloon expanding for Charles, sealed cooker with rotating gauge for Gay-Lussac, two cylinders growing as particles are added for Avogadro). Schematic, ~280×160 viewBox, 4-second loops. Acts as a pre-sim teaser before students reach the main interactive sim. Each SVG carries an inline `<title>` for screen readers. `@media (prefers-reduced-motion: reduce)` pauses the animations and renders a single representative frame; `@media print` does the same for the whole-page handout (the static frame appears in the 2×2 print grid). Bundle delta: ~+3 kB IIFE for the new CSS keyframes; inline SVG markup doesn't ship in the JS bundle.
```

### Task 7 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean (the new HTML may need prettier reformatting; that's fine).
- lint: 0 errors, no new warnings (the 6 pre-existing carry).
- test: **184 unchanged**.
- build: green; bundle delta ≤ +3 kB IIFE for the new CSS.

Stage exactly these 3 files:

```bash
git add \
  examples/topic-page/index.html \
  packages/core/src/styles/components.css \
  CHANGELOG.md
```

Commit with env-var attribution and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(examples): add animated SVG diagrams to gas-laws example figures

Below each of the four real-world example photos in the gas-laws
"Where you will see these laws" subsection, insert a small inline
animated SVG showing the physics of that law in motion. Acts as a
pre-sim teaser before students reach the main interactive
<sim-engine> further down the page.

Per-law animations (each ~280×160 viewBox, 4-second loop):

  - Boyle: a piston that slides in (compress) then out (expand);
    a small amber pressure indicator scales horizontally with the
    inverse of volume. Caption: "P × V = constant".

  - Charles: a balloon that scales up as the thermometer rises,
    then back down. Caption: "V ÷ T = constant".

  - Gay-Lussac: a sealed pressure-cooker outline; a small pressure
    gauge needle rotates from low to high as the thermometer fill
    rises. Caption: "P ÷ T = constant".

  - Avogadro: two side-by-side cylinders (Gas A in navy, Gas B in
    amber); both scale up as particles fade in one at a time.
    Caption: "Equal n → Equal V".

Visual style: SimEngine palette (navy outlines, amber accents,
ink-700 labels). Schematic, not photorealistic — the point is to
show the relationship at a glance.

Each SVG appears twice in the topic page (once in the
default-sl variant, once in default-hl), with per-variant
aria-labelledby ids. The `<title>` element on each SVG is read by
screen readers. The whole-page handout (Cmd+P) and reflection-only
print mode are unaffected: animations pause and render a static
representative frame in print, just like reduced-motion mode.

CSS additions in packages/core/src/styles/components.css:

  - .topic-background__animation rule (display: block, full width,
    aspect-ratio 7/4, light navy background, rounded corners).
  - 4 per-law @keyframes blocks driving piston translate, balloon
    scale, gauge rotate, cylinder grow, etc.
  - @media (prefers-reduced-motion: reduce): animation-play-state:
    paused (catches all per-law animations).
  - @media print with body:not(.printing-reflection) gating: same
    pause behavior; SVG prints as a static representative frame
    (max-height 1.2in inside the 2×2 print grid).

No new tests (visual content; presence tests would be brittle).
Manual visual verification (Chrome + DevTools mobile + reduced-
motion + Cmd+P) is the real verification.

Bundle delta: ~+3 kB IIFE for the new CSS keyframes. HTML SVG
markup grows ~600 lines but doesn't ship in the JS bundle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH from inside the implementer; the controller pushes after final review.

---

## Final verification

After the commit lands, run the pipeline once more:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

All green expected.

**Manual visual check (the real test):** start a static server from the worktree root:

```bash
python3 -m http.server 8765
```

Open http://localhost:8765/examples/topic-page/index.html in Chrome. Verify:

1. Scroll to "Where you will see these laws" in the gas-laws background section.
2. Each of the 4 figures shows an animated SVG below the photo, above the caption.
3. Animations run continuously (4-second loops):
   - Boyle: piston slides in/out + pressure indicator scales
   - Charles: balloon expands + thermometer fills + cycle
   - Gay-Lussac: gauge needle rotates + thermometer fills
   - Avogadro: cylinders scale + particles fade in/out
4. Flip the HL/SL toggle. Same 4 animations appear; only the captions on the figures change. The animations themselves are identical content (just per-variant aria-labelledby ids).
5. DevTools → Rendering tab → emulate `prefers-reduced-motion: reduce`. Animations freeze. Each SVG shows a static representative frame.
6. DevTools mobile (iPhone SE 375 × 667) → figures stack into a single column; animations remain visible below each photo at full width.
7. Cmd+P (whole-page handout mode):
   - Animations render as static frames (paused) in the 2×2 print grid.
   - SVGs print cleanly as vector graphics (no resolution loss).
   - No figure breaks across pages (existing `break-inside: avoid` from PR #14 covers this).
8. Save your work → Save as PDF (reflection-only print mode):
   - Reflection portfolio prints; the animations and the rest of the topic page are absent (existing `:not(.printing-reflection)` gating covers this).

**Push the branch + open PR:**

```bash
git push -u origin gas-laws-example-animations
gh pr create --base main --head gas-laws-example-animations \
  --title "Add animated SVG diagrams to gas-laws example figures" \
  --body "[generated body]"
```

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (0 errors, 0 new warnings).
3. `pnpm test` — **184 passing** unchanged.
4. `pnpm build` clean. Bundle delta ≤ +3 kB IIFE.
5. Manual visual check matches the 8-point list above.
6. CI green; PR #15 merged to `main`.
