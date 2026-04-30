# Step 8 — Topic Page Wrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Compose the step-6 components into a polished Gas Laws topic page (`examples/topic-page/index.html`) that demonstrates the spec §3 layout end-to-end, with realistic placeholder content for non-pedagogical sections and HL/SL variant adaptivity persisted to `localStorage`.

**Architecture:** Pure HTML + CSS additions plus a single inline `<script>` in the topic page. Three new CSS classes (`.topic-header`, `.topic-intro`, `.topic-next`) appended to `packages/core/src/styles/components.css`. No new web components, no new modules in `packages/core/src/`, no new tests. The five step-6 components are auto-defined via the IIFE bundle's existing side-effect imports.

**Tech Stack:** Vanilla HTML, CSS, ES2022 ESM (inline only), pnpm workspace, Vite library mode (no changes), Vitest + happy-dom (no new tests).

**Companion design doc:** `docs/plans/2026-04-30-step8-topic-page-wrap-design.md` (read for "why" decisions).

**Repo state at start:** `main` at `a5ce663` (step 6 merged via PR #4 + this design doc committed). 140 tests passing across both packages. Branch protected.

**Standards (carried from step 6):**

- Conventional commits.
- No git config edits — env vars per commit (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`).
- No `git add -A`. Specify files by name.
- No push between commits — controller pushes once at end of step 8.
- Work in a worktree at `.worktrees/step-8-topic-page-wrap/` on branch `step-8-topic-page-wrap`.
- Safe DOM: prefer static HTML markup. No JavaScript-driven DOM building required for this phase.

---

## Commit 1 — `feat(core): add .topic-header / .topic-intro / .topic-next styles`

Adds three new CSS rule blocks to `components.css`. No content changes; CSS only.

### Task 1.1 — Append `.topic-header` styles

**Files:**

- Modify: `packages/core/src/styles/components.css` (append at end)

Append:

```css
/* Topic page sticky header — page-level controls (HL/SL toggle for now). */
.topic-header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3, 12px) var(--sp-5, 20px);
  background: var(--ib-white, #fff);
  border-bottom: 1px solid var(--ib-ink-200, #e5e7eb);
  box-shadow: var(--el-1, 0 1px 2px rgba(11, 34, 101, 0.06));
  font-family: var(--font-sans, sans-serif);
}
.topic-header__breadcrumb {
  font-size: var(--fs-14, 14px);
  color: var(--ib-ink-700, #374151);
}
.topic-header__breadcrumb a {
  color: var(--ib-navy-700, #173080);
  text-decoration: none;
}
.topic-header__breadcrumb a:hover {
  text-decoration: underline;
}
.topic-header__controls {
  display: flex;
  align-items: center;
  gap: var(--sp-3, 12px);
}
```

### Task 1.2 — Append `.topic-intro` styles

**Files:**

- Modify: `packages/core/src/styles/components.css` (append at end, after `.topic-header` block)

Append:

```css
/* Topic introduction — adaptive prose block (default-sl, default-hl, etc.). */
.topic-intro {
  margin: var(--sp-5, 20px) 0;
  font-size: var(--fs-16, 16px);
  line-height: 1.7;
  color: var(--ib-ink-900, #111827);
  max-width: 70ch;
}
.topic-intro p {
  margin: 0 0 var(--sp-3, 12px);
}
.topic-intro [data-variant][hidden] {
  display: none;
}
```

### Task 1.3 — Append `.topic-next` styles

**Files:**

- Modify: `packages/core/src/styles/components.css` (append at end, after `.topic-intro` block)

Append:

```css
/* Next-topic link card. */
.topic-next {
  display: block;
  margin: var(--sp-6, 24px) 0;
  padding: var(--sp-4, 16px);
  border: 1px solid var(--ib-ink-200, #e5e7eb);
  border-radius: var(--r-md, 8px);
  text-decoration: none;
  color: inherit;
  background: var(--ib-navy-050, #f5f7fc);
  transition: background 0.18s ease;
}
.topic-next:hover {
  background: var(--ib-navy-100, #ebf0fa);
}
.topic-next--disabled {
  opacity: 0.6;
  pointer-events: none;
  cursor: not-allowed;
}
.topic-next__kicker {
  font-size: var(--fs-12, 12px);
  color: var(--ib-ink-500, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.topic-next__title {
  font-size: var(--fs-18, 18px);
  font-weight: 600;
  margin: 4px 0;
}
.topic-next__preview {
  font-size: var(--fs-14, 14px);
  color: var(--ib-ink-700, #374151);
}
```

### Task 1.4 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: lint clean; **140 tests** still green (no test changes); build green.

Stage exactly:

- `packages/core/src/styles/components.css`

Commit message:

```
feat(core): add .topic-header / .topic-intro / .topic-next styles

Three new CSS rule blocks appended to components.css for the step-8
topic-page wrap:

  - .topic-header — sticky page-level header (position: sticky;
    top: 0; z-index: 50). Hosts the breadcrumb on the left and
    page-level controls (HL/SL toggle, future EAL toggle, future
    print/teacher-view buttons) on the right.
  - .topic-intro — adaptive prose block with [data-variant][hidden]
    rule that hides non-active variant blocks. max-width: 70ch for
    readability.
  - .topic-next — next-topic link card with --disabled modifier
    (opacity 0.6, pointer-events: none) for placeholder state.

All tokens used (--sp-*, --ib-ink-*, --ib-white, --ib-navy-*,
--font-sans, --fs-*, --r-md, --el-1) are verified defined in
tokens.css. No undefined-token gaps.

Step 8 commit 1 of 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 2 — `feat(examples): topic-page scaffold + lede + sim region`

Creates `examples/topic-page/index.html` with the structural skeleton: top strip, sticky header, head/lede with components, equation panel, the sim, tweaks panel, and the inline script. Post-sim sections come in commit 3.

### Task 2.1 — Create the topic-page file with the structural skeleton

**Files:**

- Create: `examples/topic-page/index.html`

Create with the following content. This is the scaffold — sections 1, 2, 3, 7, 9 from the design doc's section table, plus closing tags. Post-sim content (sections 4–6, 8, 10–16) comes in commit 3.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pressure, Volume, and Temperature — IB Chemistry S1.5</title>
    <link rel="stylesheet" href="../../packages/core/src/styles/tokens.css" />
    <link rel="stylesheet" href="../../packages/core/src/styles/base.css" />
    <link rel="stylesheet" href="../../packages/core/src/styles/components.css" />
    <link rel="stylesheet" href="../../packages/core/src/styles/sim-shell.css" />
  </head>
  <body data-subject="chemistry">
    <!-- 1. Top strip -->
    <nav class="sim-topstrip">
      <div>
        <a href="#">AISC · IB Sciences</a> &nbsp;·&nbsp; Chemistry HL &nbsp;·&nbsp; Unit 1.5
        &nbsp;·&nbsp;
        <span style="color: var(--ib-navy-800)">Gas Laws</span>
      </div>
      <div class="sim-topstrip__right">
        <span class="sim-topstrip__badge">SimEngine v0.0 · step 8</span>
        <span>Topic page</span>
      </div>
    </nav>

    <!-- 2. Sticky page-level header -->
    <header class="topic-header">
      <div class="topic-header__breadcrumb">
        <a href="#">AISC</a> › <a href="#">IB Chemistry</a> ›
        <a href="#">Topic S1.5</a>
      </div>
      <div class="topic-header__controls">
        <label class="sim-switch">
          <input type="checkbox" id="hl-toggle" />
          <span class="sim-switch__track" aria-hidden="true"></span>
          <span class="sim-switch__label">HL mode</span>
        </label>
      </div>
    </header>

    <div class="sim-wrap">
      <!-- 3. Header block (kicker, title, lede) -->
      <header class="sim-head">
        <div>
          <div class="sim-head__kicker">Topic S1.5 — Gas Laws</div>
          <h1 class="sim-head__title">PV = <em>nRT</em>, plus van der Waals.</h1>
          <p class="sim-head__lede">
            An animated <sim-glossary-term ref="ideal-gas">ideal gas</sim-glossary-term> in a piston
            container. The ideal gas equation
            <code>PV = <sim-data-pill ref="gas-constant-R"></sim-data-pill>nT</code> ties together
            <sim-glossary-term ref="pressure">pressure</sim-glossary-term>, volume, temperature, and
            the amount of gas. Selecting CO₂ adds the
            <sim-glossary-term ref="van-der-waals">van der Waals correction</sim-glossary-term>
            for non-ideal behaviour.
          </p>
        </div>
        <div class="sim-head__meta">
          <span>Estimated<br /><b>25 min</b></span>
          <span>Paper relevance<br /><b>P1 SL/HL</b></span>
        </div>
      </header>

      <!-- 7. Equation panel -->
      <section class="ib-equation">
        <h2>The ideal gas equation</h2>
        <p>
          <code>P · V = n · <sim-data-pill ref="gas-constant-R"></sim-data-pill> · T</code>
        </p>
        <p style="font-size: 0.9em; color: var(--ib-ink-700)">
          where P is pressure, V is volume, n is amount of gas in moles, T is absolute temperature,
          and R is the molar gas constant. For CO₂, the van der Waals correction uses
          <sim-data-pill ref="vdw-co2-a"></sim-data-pill> and
          <sim-data-pill ref="vdw-co2-b"></sim-data-pill>.
        </p>
      </section>

      <!-- Tweaks button row above the sim -->
      <div style="display: flex; gap: 16px; align-items: center; margin: 16px 0">
        <button class="ib-btn ib-btn--ghost" id="tweaks-button">⚙ Tweaks</button>
      </div>

      <!-- 9. The sim -->
      <sim-engine sim="gas-laws" id="sim">
        <div class="sim-fallback">
          <p>Loading the simulation… enable JavaScript to run it.</p>
        </div>
      </sim-engine>
      <sim-tweaks-panel for="sim"></sim-tweaks-panel>

      <!-- Sections 4, 5, 6, 8, 10-16 land in commit 3 -->
    </div>

    <!--
      The IIFE bundle is used (not <script type="module">) so the page works
      when opened directly via file:// — modern browsers block ESM imports across
      file:// origins for security. The IIFE bundle's side effects register all
      five step-6 components plus <sim-engine>.
    -->
    <script src="../../packages/core/dist/index.global.js"></script>
    <script>
      // Step 8 inline script: variant toggle + prefs persistence.
      const TOPIC_ID = 's1.5-gas-laws';
      const PREFS_KEY = `aisc-simengine:prefs:${TOPIC_ID}`;

      function loadPrefs() {
        try {
          return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        } catch {
          return {};
        }
      }

      function savePrefs(prefs) {
        try {
          localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch {
          // localStorage unavailable — graceful no-op
        }
      }

      function applyLevel(level) {
        // 1. Flip every [data-variant] block in the page (commit 3 adds these).
        for (const el of document.querySelectorAll('[data-variant]')) {
          const visible = el.dataset.variant === `default-${level}`;
          el.hidden = !visible;
        }
        // 2. Mirror to the sim.
        document.getElementById('sim').setAttribute('level', level);
        // 3. Mirror to the header toggle (in case state was restored from prefs).
        const toggle = document.getElementById('hl-toggle');
        if (toggle) toggle.checked = level === 'hl';
      }

      // On load: restore from prefs (defaults to 'sl').
      const prefs = loadPrefs();
      const initialLevel = prefs.level === 'hl' ? 'hl' : 'sl';
      applyLevel(initialLevel);

      // Wire the header HL/SL toggle.
      document.getElementById('hl-toggle').addEventListener('change', (e) => {
        const level = e.target.checked ? 'hl' : 'sl';
        applyLevel(level);
        savePrefs({ ...loadPrefs(), level });
      });

      // Wire the Tweaks button (same as smoke test).
      document.getElementById('tweaks-button').addEventListener('click', () => {
        document.querySelector('sim-tweaks-panel').toggleAttribute('data-open');
      });
    </script>
  </body>
</html>
```

### Task 2.2 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: lint clean (Prettier may reformat the new HTML — that's fine); **140 tests** still green; build green.

Manual visual check (optional but recommended):

```bash
open examples/topic-page/index.html
```

Verify in the browser:

- Sticky header at top with breadcrumb + HL toggle.
- Lede paragraph has 3 underlined glossary terms + 1 inline data pill.
- Equation panel has 3 data pills (R, vdw-co2-a, vdw-co2-b).
- Sim renders with all controls + graphs.
- Tweaks button opens panel.
- HL toggle in sticky header flips the sim's Ideal-vs-Real graph (no content variants yet — those land in commit 3).
- Reload preserves HL toggle state.

If anything is off, pause and report.

Stage exactly:

- `examples/topic-page/index.html`

Commit message:

```
feat(examples): topic-page scaffold + lede + sim region

Creates examples/topic-page/index.html with the structural skeleton:
top strip, sticky page-level header (with HL/SL toggle persisted to
localStorage), head block with real prose lede containing 3 glossary
terms + 1 inline data pill, equation panel with 3 data pills (R and
the two CO₂ VdW constants), Tweaks button, the sim, and sibling
<sim-tweaks-panel>.

Inline <script> (~30 lines) handles:
  - Loading/saving prefs from aisc-simengine:prefs:s1.5-gas-laws
  - applyLevel(level) — flips [data-variant] blocks (commit 3 adds
    them), mirrors level to sim and header toggle
  - Wire HL toggle change handler (saves to prefs)
  - Wire Tweaks button (toggles panel data-open)

Post-sim sections (bell ringer through what's-next) land in commit 3.

Step 8 commit 2 of 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 3 — `feat(examples): topic-page post-sim sections + variant content`

Adds the remaining 11 page sections to `examples/topic-page/index.html`: bell ringer, topic intro (with both `default-sl` and `default-hl` variants), key concept, learning intentions/success criteria, worked example, practice question with hidden answer, command term reminder, mark scheme, misconceptions, exit ticket, what's next.

All HTML is inserted **between** the sim region (where commit 2 left a comment marker `<!-- Sections 4, 5, 6, 8, 10-16 land in commit 3 -->`) and the closing `</div>` of `.sim-wrap`.

### Task 3.1 — Find the insertion point

Open `examples/topic-page/index.html`. Locate the comment marker:

```html
<!-- Sections 4, 5, 6, 8, 10-16 land in commit 3 -->
```

All HTML in tasks 3.2–3.12 is inserted **at this exact location**, in the order tasks are listed. Replace the comment marker line with the new content (or insert immediately after — your choice; the comment isn't load-bearing).

### Task 3.2 — Section 4: Bell ringer (placeholder)

Insert:

```html
<!-- 4. Bell ringer -->
<section class="ib-bellringer">
  <h2>Bell ringer</h2>
  <p><strong>5 minutes — from memory:</strong></p>
  <ol>
    <li>Write the ideal gas equation. Label every symbol.</li>
    <li>
      Circle the variable that is <em>inversely</em> proportional to pressure at constant
      temperature and amount of gas.
    </li>
    <li>
      In one sentence, describe what happens to the speed of gas particles when temperature doubles
      at constant volume.
    </li>
  </ol>
</section>
```

### Task 3.3 — Section 5: Topic introduction (real prose, both variants)

Insert. Note the two `[data-variant]` divs — the inline script in commit 2 toggles their `hidden` attribute based on the current level.

```html
<!-- 5. Topic intro — adaptive prose, default-sl and default-hl variants -->
<section class="topic-intro">
  <h2>Topic introduction</h2>

  <div data-variant="default-sl">
    <p>
      A gas in a sealed container is made up of fast-moving particles that constantly bump into the
      walls. Each collision pushes outward — that push, spread over the area of the wall, is what we
      call
      <sim-glossary-term ref="pressure">pressure</sim-glossary-term>.
    </p>
    <p>
      Three properties of the gas determine how strong that push is: how hot the gas is
      (temperature, T), how much room it has (volume, V), and how many particles are present (amount
      in moles, n). The <sim-glossary-term ref="ideal-gas">ideal gas</sim-glossary-term> equation
      <code>PV = nRT</code> brings these together. R is a fixed number — the gas constant — that
      makes the units balance.
    </p>
    <p>
      Use the simulation below to see how flipping any one of T, V, or n changes pressure in real
      time.
    </p>
  </div>

  <div data-variant="default-hl">
    <p>
      A gas in a sealed container exerts
      <sim-glossary-term ref="pressure">pressure</sim-glossary-term>
      on the walls because its particles are constantly colliding with them. The
      <sim-glossary-term ref="ideal-gas">ideal gas</sim-glossary-term>
      equation <code>PV = nRT</code> models this push for an ideal gas — one whose particles have
      negligible volume of their own and exert no attractive forces on each other.
    </p>
    <p>
      Real gases approximate this idealisation at low pressure and high temperature, where the
      particles spend most of their time far apart. They diverge from <code>PV = nRT</code>
      when forced together — at high pressure, low temperature, or when the gas itself has strong
      intermolecular forces (CO₂ being a classic example).
    </p>
    <p>
      The
      <sim-glossary-term ref="van-der-waals">van der Waals equation</sim-glossary-term>
      refines <code>PV = nRT</code> for real gases by adding two correction terms: one for the
      volume the particles themselves occupy, and one for the attractive forces between them. Toggle
      CO₂ in the simulation below and watch the Ideal-vs-Real graph reveal the divergence.
    </p>
  </div>
</section>
```

### Task 3.4 — Section 6: Key concept (real)

Insert:

```html
<!-- 6. Key concept -->
<section class="ib-concept">
  <h2>Key concept</h2>
  <p>
    <em
      >Pressure, volume, temperature, and amount of gas are linked through the equation
      <code>PV = nRT</code>.</em
    >
  </p>
</section>
```

### Task 3.5 — Section 8: Learning intentions / success criteria (placeholder)

Insert:

```html
<!-- 8. Learning intentions / success criteria -->
<section class="ib-lisc">
  <h2>Learning intentions &amp; success criteria</h2>
  <div class="ib-lisc__cols">
    <div>
      <h3>I will learn to…</h3>
      <ul>
        <li>Describe how P, V, T, and n are related by the ideal gas equation.</li>
        <li>
          Use <code>PV = nRT</code> to predict how one variable changes when another is adjusted.
        </li>
        <li>
          Recognise the individual gas laws (Boyle, Charles, Gay-Lussac) as special cases of the
          ideal gas equation.
        </li>
      </ul>
    </div>
    <div>
      <h3>I can…</h3>
      <ul>
        <li>Describe what happens to P when V halves at constant T and n.</li>
        <li>Calculate P, V, T, or n given the other three quantities.</li>
        <li>Explain the shape of a P–V graph at constant temperature and label its axes.</li>
      </ul>
    </div>
  </div>
</section>
```

### Task 3.6 — Section 10: Worked example (placeholder)

Insert. The placeholder uses `<details>` for the stepped-reveal pattern.

```html
<!-- 10. Worked example -->
<section class="ib-worked">
  <h2>Worked example</h2>
  <p>
    <strong>Question:</strong> A 2.0 L container holds 0.5 mol of N₂ at 300 K. Calculate the
    pressure of the gas.
  </p>
  <details>
    <summary>Show solution</summary>
    <ol>
      <li>Identify the equation: <code>PV = nRT</code>, so <code>P = nRT / V</code>.</li>
      <li>
        Substitute (using R = 8.314 J·K⁻¹·mol⁻¹, V in m³): <br />
        <code>V = 2.0 L = 2.0 × 10⁻³ m³</code> <br />
        <code>P = (0.5 × 8.314 × 300) / (2.0 × 10⁻³)</code>
      </li>
      <li>Calculate: <code>P = 6.24 × 10⁵ Pa ≈ 624 kPa</code>.</li>
    </ol>
  </details>
</section>
```

### Task 3.7 — Section 11: Practice question + hidden answer (placeholder)

Insert:

```html
<!-- 11. Practice question -->
<section class="ib-practice">
  <h2>Practice question</h2>
  <p>
    <strong>Calculate</strong> the volume occupied by 0.25 mol of an ideal gas at 250 K and 150 kPa.
  </p>
  <details class="ib-answer">
    <summary>Show answer</summary>
    <p>
      <code>V = nRT / P = (0.25 × 8.314 × 250) / (150 × 10³) = 3.46 × 10⁻³ m³ ≈ 3.46 L</code>
    </p>
  </details>
</section>
```

### Task 3.8 — Section 12: Command term reminder (real)

Insert. The IB Chemistry Guide 2025 phrasing is paraphrased; the citation lives in the source comment.

```html
<!-- 12. Command term reminder -->
<aside class="ib-command-card">
  <h3>Command term: <em>calculate</em></h3>
  <p>
    Obtain a numerical answer showing the relevant stages in the working. (IB Chemistry Guide 2025,
    Assessment objectives.)
  </p>
</aside>
```

### Task 3.9 — Section 13: Mark scheme (placeholder)

Insert:

```html
<!-- 13. Mark scheme -->
<section class="ib-mark">
  <h3>Mark scheme</h3>
  <ul>
    <li>1 mark — correct rearrangement of <code>PV = nRT</code> to <code>V = nRT / P</code>.</li>
    <li>1 mark — correct numerical answer with appropriate units (m³ or L).</li>
  </ul>
</section>
```

### Task 3.10 — Section 14: Misconceptions (placeholder)

Insert:

```html
<!-- 14. Misconceptions -->
<section class="ib-misc">
  <h2>Common misconceptions</h2>
  <p>
    <strong>"Gas pressure is caused by gas particles pushing each other."</strong>
  </p>
  <p>
    ✗ <em>Wrong:</em> particles only exert measurable force when they collide with the container
    walls, not when passing each other.
  </p>
  <p>
    ✓ <em>Right:</em> pressure is the force per unit area from particle-wall collisions.
    Inter-particle collisions redistribute energy but don't directly cause container pressure.
  </p>
</section>
```

### Task 3.11 — Section 15: Exit ticket (placeholder)

Insert:

```html
<!-- 15. Exit ticket -->
<section class="ib-exitticket">
  <h2>Exit ticket</h2>
  <ol>
    <li>What surprised you most about how pressure changes with temperature?</li>
    <li>If you doubled the amount of gas at constant T and V, what happens to P? Why?</li>
    <li>One thing you'd like to understand more clearly:</li>
  </ol>
</section>
```

### Task 3.12 — Section 16: What's next (placeholder, disabled)

Insert (this is the last section before the closing `</div>` of `.sim-wrap`):

```html
<!-- 16. What's next — placeholder, disabled -->
<a class="topic-next topic-next--disabled" aria-disabled="true">
  <div class="topic-next__kicker">Next topic — coming soon</div>
  <div class="topic-next__title">S1.6 — Avogadro's law</div>
  <div class="topic-next__preview">
    Equal volumes of any ideal gas, at the same temperature and pressure, contain equal numbers of
    particles. Lays the groundwork for stoichiometry calculations involving gases.
  </div>
</a>
```

### Task 3.13 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: lint clean; **140 tests** still green; build green.

Manual visual check:

```bash
open examples/topic-page/index.html
```

Verify in the browser:

- All 14 sections render in order: top strip → sticky header → header block (kicker, title, lede) → equation panel → Tweaks button row → sim → tweaks panel → bell ringer → topic intro → key concept → LISC → worked example → practice → command term → mark scheme → misconceptions → exit ticket → what's next.
- HL toggle in sticky header now flips BOTH the sim's Ideal-vs-Real graph AND the topic-intro prose between SL (3 paragraphs, simpler language) and HL (3 paragraphs, with VdW preview) variants.
- Topic intro variants both contain glossary terms (hover/click for tooltips).
- Key concept and equation panel are the "real prose" sections.
- "What's next" card is visibly disabled (~60% opacity, no pointer cursor).
- Reload preserves HL toggle state and shows the correct variant on re-render.

If anything is off, pause and report. Common things to check:

- The data pills inside `<code>` blocks — does the inline-flex of the pill work inside `<code>` (which has `display: inline`)? If layout breaks, wrap the pill outside the `<code>` instead.
- Section ordering — the order matters for pedagogical flow.
- The variant divs — both must have `[data-variant]` attribute for the inline script to find them.

Stage exactly:

- `examples/topic-page/index.html`

Commit message:

```
feat(examples): topic-page post-sim sections + variant content

Adds the remaining 11 page sections to examples/topic-page/index.html:

  - Bell ringer (placeholder, realistic 5-min retrieval prompt)
  - Topic introduction with both default-sl and default-hl variants
    (real prose, ~250 words combined, glossary terms inline)
  - Key concept (real, single sentence)
  - Learning intentions & success criteria (placeholder)
  - Worked example with stepped-reveal solution (placeholder)
  - Practice question with hidden answer (placeholder)
  - Command term reminder for "calculate" (real, cited)
  - Mark scheme (placeholder)
  - Common misconceptions (placeholder, right-vs-wrong example)
  - Exit ticket (placeholder, 3 reflection questions)
  - What's next link card (placeholder, disabled state)

The HL toggle in the sticky header now flips both the sim's HL
features AND swaps in HL-flavoured prose for the topic introduction.
Variant blocks use [data-variant="default-sl"] / [data-variant="default-hl"]
attributes that the inline script (added in commit 2) toggles
[hidden] on. localStorage persistence preserves the choice across
reloads.

Step 8 commit 3 of 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 4 — `docs: update CHANGELOG and architecture for step 8`

### Task 4.1 — Update `CHANGELOG.md`

**Files:**

- Modify: `CHANGELOG.md`

After the existing "### Step 6" section but before any "### Notes" footer (or append at end if no clear delimiter), insert:

```markdown
### Step 8 — Topic page wrap

Four commits composing the step-6 components into a polished Gas Laws topic page (`examples/topic-page/index.html`) demonstrating the spec §3 layout end-to-end.

- `feat(core)`: add `.topic-header` / `.topic-intro` / `.topic-next` styles
- `feat(examples)`: topic-page scaffold + lede + sim region (sticky header, lede with glossary terms + data pill, equation panel with data pills, sim, tweaks panel, inline variant-toggle script)
- `feat(examples)`: topic-page post-sim sections + variant content (bell ringer, topic intro with `default-sl` + `default-hl` variants, key concept, LISC, worked example, practice + hidden answer, command term, mark scheme, misconceptions, exit ticket, what's next)
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 140 (unchanged from step 6 — step 8 is HTML + CSS only, no new tests).

**New CSS classes in `components.css`:**

- `.topic-header` — sticky page-level header
- `.topic-intro` — adaptive-content prose block with `[data-variant][hidden]` rule
- `.topic-next` — next-topic link card (with `--disabled` modifier)

**Page-level prefs persistence:** HL/SL toggle saves to `localStorage` under `aisc-simengine:prefs:s1.5-gas-laws`. Reload preserves the choice and restores both the sim's level attribute AND the visible content variant.

**Known follow-ups (deferred):**

- Markdown content authoring pipeline (spec §8 — future "step 8b").
- Real production-ready content for placeholder sections (spec §9 — future "step 8c").
- Teacher view + `<sim-data-map>` flowchart + lesson plan tie-in (spec §11 — future "step 9").
- EAL variants (bundled with eventual content authoring phase).
- Print stylesheet, print button (spec §12 polish).
- Real "What's next" topic link (deferred until a second topic exists).
- Two follow-up tasks from step 6 still queued: promote `<sim-engine>` private API to public, reinstate `<slot>` in `<sim-coachmark>`.
```

### Task 4.2 — Update `docs/architecture.md`

**Files:**

- Modify: `docs/architecture.md`

After the existing "## Step 6" section, append a "## Step 8" section (skipping step 7, which is blocked on the database drop):

```markdown
## Step 8 — Topic page wrap

Composes the step-6 components into a polished Gas Laws topic page. Pure HTML + CSS additions; no new web components, no new modules in `packages/core/src/`, no new tests.

### File layout

- `examples/topic-page/index.html` (NEW) — the polished Gas Laws topic page.
- `packages/core/src/styles/components.css` — appends `.topic-header`, `.topic-intro`, `.topic-next` rule blocks (~55 lines total).

The topic page loads the four design-system stylesheets and the IIFE bundle (`packages/core/dist/index.global.js`). All five step-6 components are auto-defined via the bundle's existing side-effect imports.

### Page structure (spec §3)

The topic page renders 14 ordered sections from the spec, omitting teacher-view items (steps 11+) and EAL variants:

1. Top strip (`.sim-topstrip`)
2. Sticky page-level header (`.topic-header` — new) with breadcrumb + HL/SL toggle
3. Header block (`.sim-head`) with kicker, title, lede containing 2 `<sim-glossary-term>` and 1 `<sim-data-pill>`
4. Bell ringer (`.ib-bellringer`)
5. Topic intro (`.topic-intro` — new) with `default-sl` and `default-hl` variants
6. Key concept (`.ib-concept`)
7. Equation panel (`.ib-equation`) with `<sim-data-pill>` for R and CO₂ VdW constants
8. Learning intentions / success criteria (`.ib-lisc`)
9. The sim (`<sim-engine>`) with sibling `<sim-tweaks-panel for="sim">`
10. Worked example (`.ib-worked`) with stepped-reveal solution
11. Practice question + hidden answer (`.ib-practice` + `.ib-answer`)
12. Command term reminder (`.ib-command-card`)
13. Mark scheme (`.ib-mark`)
14. Misconceptions (`.ib-misc`)
15. Exit ticket (`.ib-exitticket`)
16. What's next (`.topic-next` — new, disabled state)

### Inline script — variant toggle + prefs persistence

A single `<script>` block at the bottom of the topic page (~30 lines vanilla JS, no imports). Responsibilities:

- Loads/saves prefs from `localStorage` under `aisc-simengine:prefs:s1.5-gas-laws` (try/catch wrapped for graceful degradation).
- `applyLevel(level)` flips every `[data-variant]` block in the page based on `default-${level}` match, mirrors the level via `setAttribute('level', …)` on the sim, and mirrors the checked state of the sticky-header toggle.
- On load: restores the saved level (default `sl`) and applies it.
- Wires the HL/SL toggle change handler (saves to prefs).
- Wires the Tweaks button (toggles `data-open` attribute on the panel).

### Bidirectional level synchronization

Three surfaces all reflect the same `level` state:

- The sticky-header `.sim-switch` HL toggle.
- The `<sim-tweaks-panel>` HL graph switch (commit 7's bidirectional state-sync).
- The sim's Ideal-vs-Real graph visibility.

Flipping any of them triggers a state update that propagates through the existing state-listener subscriptions. No new code beyond the inline script's `applyLevel` call.

### What ships vs what's deferred

Step 8 is intentionally narrower than the spec's combined §8–§11. This phase ships the **page assembly** with realistic placeholder content. Each of the following is its own future phase:

| Spec § | What                                                          | Status                      |
| ------ | ------------------------------------------------------------- | --------------------------- |
| 8      | Markdown content authoring pipeline                           | Deferred (future "step 8b") |
| 9      | Author full Gas Laws content (real prose for all 14 sections) | Deferred (future "step 8c") |
| 11     | Teacher view (`<sim-data-map>`, lesson plan tie-in)           | Deferred (future "step 9")  |
| 12     | Print stylesheet, print button                                | Deferred (polish phase)     |
```

### Task 4.3 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean; lint clean; **140 tests** still green; build green.

Stage exactly:

- `CHANGELOG.md`
- `docs/architecture.md`

Commit message:

```
docs: update CHANGELOG and architecture for step 8

Records step 8 in CHANGELOG (under [Unreleased]) covering all 4 commits:
the new CSS classes (.topic-header, .topic-intro, .topic-next), the
topic-page assembly with realistic placeholder content, and the inline
variant-toggle + prefs-persistence script.

Adds a "## Step 8 — Topic page wrap" section to docs/architecture.md
covering: file layout, the 14-section page structure (spec §3),
inline-script responsibilities, three-surface level synchronization,
and the deferred-to-future-phase work (markdown pipeline, full content,
teacher view, print stylesheet).

Step 8 commit 4 of 4. Step 8 complete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Final verification

After commit 4 lands, run the final pipeline once more and verify the branch is ready for PR:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean
- **140 tests** passing across 16 core test files + 1 data test file
- build green (bundle size unchanged from step 6: ~94.89 kB ESM / ~82.39 kB IIFE)

Manual visual verification — open `examples/topic-page/index.html` in a browser and run through the exit-criteria checklist from the design doc:

1. Sticky `.topic-header` with breadcrumb left, HL/SL toggle right ✓
2. 14 ordered sections per spec §3 (omitting teacher-view + EAL items) ✓
3. Lede has 3 underlined glossary terms (hover/click) + 1 inline data pill (click for citation card) ✓
4. Equation panel has 3 data pills (R, vdw-co2-a, vdw-co2-b) ✓
5. HL toggle in sticky header flips BOTH: sim's Ideal-vs-Real graph AND topic-intro prose between SL and HL variants ✓
6. Tweaks button opens the tweaks panel ✓
7. Coachmark anchored to T slider appears 1.5s after first load; "Got it" dismisses; reload doesn't re-show ✓
8. "What's next" card is visibly disabled with placeholder text ✓
9. Page-level prefs persist: reload retains HL/SL choice (verify via `localStorage.getItem('aisc-simengine:prefs:s1.5-gas-laws')`) ✓

Push the branch and open the PR:

```bash
git push -u origin step-8-topic-page-wrap
gh pr create --title "Step 8: Gas Laws topic-page wrap (assembly only; pipeline + content + teacher view deferred)" --body "[generated body — see prior PR #4 for shape]"
```

Step 8 complete. ✅
