# Mobile-panel Responsive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the four side panels (`<sim-data-card>`, `<sim-checklist>`, `<sim-reflection-export>`, `<sim-tweaks-panel>`) usable on phone-width viewports by shrinking each panel in place below a 720 px breakpoint.

**Architecture:** Per-component HOST_STYLES additions only. Identical `@media (max-width: 720px) { :host { width: calc(100vw - 32px); max-width: 320px; } }` block in each of the four components. No JS changes, no top-level CSS changes, no new dependencies. The slide animation, mutual-exclusion contract, and all existing behavior continue unchanged.

**Tech Stack:** CSS only. Tests use `node:fs/promises` to read source files for presence assertions (same pattern as PR #12's print-stylesheet tests).

**Companion design doc:** `docs/plans/2026-05-02-mobile-panel-responsive-design.md` (commit `84b5b94` on main). Read for "why" decisions.

---

## Repo state at start

- `main` HEAD: post-PR-#12 (topic-page print stylesheet merged) + the design doc commit (`84b5b94`).
- Baseline tests: **184** (178 core + 6 data).
- Worktree path: `.worktrees/mobile-panel-responsive/` on branch `mobile-panel-responsive`.

## Standards (carried from prior phases)

- TDD where it makes sense (presence tests for the new @media block — same pattern as PR #12).
- Conventional commits.
- No git config edits. Use env vars on each commit:
  - `GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com"`
  - `GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com"`
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer on every commit.
- No `git add -A`. Stage files by name.
- No emojis in UI labels or commit messages.

---

## Single commit — `feat(core): mobile-panel responsive shrink-in-place`

10 files, ~50 lines added.

### Task 1 — Write failing test for `<sim-data-card>` (RED)

**File:** `packages/core/tests/sim-data-card.test.js`

Append at the END of the existing `describe` block (after the last existing `it(...)`):

```js
it('HOST_STYLES includes a max-width: 720px @media block that shrinks the panel in place', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = await fs.readFile(path.join(here, '../src/components/sim-data-card.js'), 'utf-8');
  const m = src.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\}\s*\}/);
  expect(m).not.toBeNull();
  const block = m[1];
  expect(block).toContain('width: calc(100vw - 32px)');
  expect(block).toContain('max-width: 320px');
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-data-card.test.js -t '720px' 2>&1 | tail -10
```

Expected: the new test fails because no `@media (max-width: 720px)` block exists in the file. `m` is `null`. RED witnessed.

### Task 2 — Add `@media (max-width: 720px)` block to `<sim-data-card>` (GREEN)

**File:** `packages/core/src/components/sim-data-card.js`

Find the existing HOST_STYLES template literal. It currently ends with the `prefers-reduced-motion` block from PR #9, then a closing backtick. Insert this `@media` block immediately AFTER the `prefers-reduced-motion` block, BEFORE the closing backtick:

```css
@media (max-width: 720px) {
  :host {
    width: calc(100vw - 32px);
    max-width: 320px;
  }
}
```

The HOST_STYLES tail should look like:

```js
  @media (prefers-reduced-motion: reduce) {
    :host,
    :host([data-open]) {
      transition: none;
    }
  }
  @media (max-width: 720px) {
    :host {
      width: calc(100vw - 32px);
      max-width: 320px;
    }
  }
`;
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-data-card.test.js 2>&1 | tail -10
```

Expected: all sim-data-card tests pass (the original count + 1).

### Task 3 — Write failing test for `<sim-checklist>` (RED)

**File:** `packages/core/tests/sim-checklist.test.js`

Append at the END of the existing `describe` block:

```js
it('HOST_STYLES includes a max-width: 720px @media block that shrinks the panel in place', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = await fs.readFile(path.join(here, '../src/components/sim-checklist.js'), 'utf-8');
  const m = src.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\}\s*\}/);
  expect(m).not.toBeNull();
  const block = m[1];
  expect(block).toContain('width: calc(100vw - 32px)');
  expect(block).toContain('max-width: 320px');
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-checklist.test.js -t '720px' 2>&1 | tail -10
```

Expected: failure. RED witnessed.

### Task 4 — Add `@media (max-width: 720px)` block to `<sim-checklist>` (GREEN)

**File:** `packages/core/src/components/sim-checklist.js`

Same edit as Task 2 — insert the identical block AFTER the existing `prefers-reduced-motion` block:

```css
@media (max-width: 720px) {
  :host {
    width: calc(100vw - 32px);
    max-width: 320px;
  }
}
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-checklist.test.js 2>&1 | tail -10
```

Expected: all sim-checklist tests pass (+1 from the new presence test).

### Task 5 — Write failing test for `<sim-reflection-export>` (RED)

**File:** `packages/core/tests/sim-reflection-export.test.js`

Append at the END of the existing `describe` block:

```js
it('HOST_STYLES includes a max-width: 720px @media block that shrinks the panel in place', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = await fs.readFile(
    path.join(here, '../src/components/sim-reflection-export.js'),
    'utf-8'
  );
  const m = src.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\}\s*\}/);
  expect(m).not.toBeNull();
  const block = m[1];
  expect(block).toContain('width: calc(100vw - 32px)');
  expect(block).toContain('max-width: 320px');
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-reflection-export.test.js -t '720px' 2>&1 | tail -10
```

Expected: failure. RED witnessed.

### Task 6 — Add `@media (max-width: 720px)` block to `<sim-reflection-export>` (GREEN)

**File:** `packages/core/src/components/sim-reflection-export.js`

Same edit as Task 2/4 — insert the identical block AFTER the existing `prefers-reduced-motion` block:

```css
@media (max-width: 720px) {
  :host {
    width: calc(100vw - 32px);
    max-width: 320px;
  }
}
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-reflection-export.test.js 2>&1 | tail -10
```

Expected: all sim-reflection-export tests pass.

### Task 7 — Write failing test for `<sim-tweaks-panel>` (RED)

**File:** `packages/core/tests/sim-tweaks-panel.test.js`

Append at the END of the existing `describe` block:

```js
it('HOST_STYLES includes a max-width: 720px @media block that shrinks the panel in place', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = await fs.readFile(path.join(here, '../src/components/sim-tweaks-panel.js'), 'utf-8');
  const m = src.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\}\s*\}/);
  expect(m).not.toBeNull();
  const block = m[1];
  expect(block).toContain('width: calc(100vw - 32px)');
  expect(block).toContain('max-width: 320px');
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-tweaks-panel.test.js -t '720px' 2>&1 | tail -10
```

Expected: failure. RED witnessed.

### Task 8 — Add `@media (max-width: 720px)` block to `<sim-tweaks-panel>` (GREEN)

**File:** `packages/core/src/components/sim-tweaks-panel.js`

Same edit. The tweaks-panel keeps `right: 16px` (right-side panel), but the shrink rule itself is identical — `right: 16px` is unaffected by changing `width`.

If the tweaks-panel does NOT have a `prefers-reduced-motion` block in its HOST_STYLES (the a11y polish in PR #9 added that block to all 3 panels in scope at that time), insert the new `@media (max-width: 720px)` block at the end of HOST_STYLES, immediately before the closing backtick. If a `prefers-reduced-motion` block IS present, insert AFTER it as in the other components.

```css
@media (max-width: 720px) {
  :host {
    width: calc(100vw - 32px);
    max-width: 320px;
  }
}
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-tweaks-panel.test.js 2>&1 | tail -10
```

Expected: all sim-tweaks-panel tests pass.

### Task 9 — Update `CHANGELOG.md`

**File:** `CHANGELOG.md`

Find the existing `### Topic-page print stylesheet (post-10B)` subsection. After its end and BEFORE the `### Notes` footer, insert:

```markdown
### Mobile-panel responsive (post-10B)

- Each of the four side panels (`<sim-data-card>`, `<sim-checklist>`, `<sim-reflection-export>`, `<sim-tweaks-panel>`) gains a `@media (max-width: 720px)` block in its `HOST_STYLES` that shrinks the host width to `calc(100vw - 32px)` capped at `max-width: 320px`. Below the breakpoint the panel still floats with the same `top: 80px` and `left: 16px` (or `right: 16px`) offsets, the same slide animation, and the same mutual-exclusion contract — just narrower so it fits inside a phone-width viewport with 16 px margins on each side.
- Reuses the project's existing 720 px breakpoint (the LISC layout rule in `components.css`).
- +4 lightweight CSS-string presence tests (one per panel; same source-read pattern as PR #12's print-rule tests).
- Out of scope (file as follow-up if needed): sticky-header overflow at narrow widths, bottom-drawer mobile pattern, tablet-specific tuning beyond what 720 px catches, touch-target sizing for the close × button.
```

### Task 10 — Update `docs/architecture.md`

**File:** `docs/architecture.md`

Find the existing `## Topic-page print stylesheet` section. After its end, append:

```markdown
## Mobile-panel responsive

All four floating side panels carry a `@media (max-width: 720px)` block in their HOST_STYLES that shrinks the host width to `calc(100vw - 32px)` capped at `max-width: 320px`. Below the breakpoint, the panel still floats with the same top/side offsets and slide animation, just narrower. Desktop layout unchanged.

The convention is now three concentric @media layers per panel, all inside HOST_STYLES:

1. `@media (prefers-reduced-motion: reduce)` — disables the slide transition (PR #9).
2. `@media print` — hides interactive UI in print mode (PR #12, applies to `<sim-text-response>` and `<sim-practice-question>` only).
3. `@media (max-width: 720px)` — shrinks the panel in place for phone-width viewports (this section).

Future contributors adding a new floating panel should include the prefers-reduced-motion and max-width: 720px blocks. The print rule depends on whether the panel has interactive UI to hide (the export aggregator's panel, for example, is fully hidden in print via global CSS rather than per-component rules).

The 720 px breakpoint matches the existing LISC single-column rule in `components.css`. Single shared breakpoint for the whole topic page.
```

### Task 11 — Final pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint: 0 errors, no new warnings (the 6 pre-existing carry)
- test: **188 total** (was 184; +4 new presence tests)
- build green; bundle delta < +0.5 kB IIFE (4 × ~6-line CSS block; Vite inlines components.css but the per-component HOST_STYLES are part of the JS bundle)

Stage exactly these 10 files:

```bash
git add \
  packages/core/src/components/sim-data-card.js \
  packages/core/src/components/sim-checklist.js \
  packages/core/src/components/sim-reflection-export.js \
  packages/core/src/components/sim-tweaks-panel.js \
  packages/core/tests/sim-data-card.test.js \
  packages/core/tests/sim-checklist.test.js \
  packages/core/tests/sim-reflection-export.test.js \
  packages/core/tests/sim-tweaks-panel.test.js \
  CHANGELOG.md \
  docs/architecture.md
```

Commit with env-var attribution and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(core): mobile-panel responsive shrink-in-place

The four side panels (<sim-data-card>, <sim-checklist>,
<sim-reflection-export>, <sim-tweaks-panel>) gain a
@media (max-width: 720px) block in their HOST_STYLES that shrinks
the host to width: calc(100vw - 32px) capped at max-width: 320px.
Below the 720 px breakpoint the panel still floats with its
existing top/side offsets, slide animation, and mutual-exclusion
contract — just narrower so it fits inside a phone-width viewport
with 16 px margins on each side. Desktop layout unchanged.

The 720 px breakpoint reuses the existing LISC convention from
components.css. All four panels get the identical CSS block; the
right-side <sim-tweaks-panel> keeps its right: 16px offset (the
shrink rule only changes width, not the side anchor).

CSS-only polish layer:
  - No JS changes.
  - No top-level CSS in components.css.
  - No new dependencies.
  - No layout reflow or animation rewrite.

The pattern of per-component @media rules in HOST_STYLES is now
consistent across three concentric layers: prefers-reduced-motion
(PR #9), @media print (PR #12, where applicable), and now
max-width: 720px. Architecture.md documents the convention so
future floating panels follow the same shape.

+4 lightweight CSS-string presence tests (one per panel; same
source-read pattern as PR #12's print-rule tests). Net 184 → 188.

Manual verification: Chrome DevTools device emulation against
iPhone SE, iPhone 12 Pro, Galaxy S20 Ultra, iPad Mini portrait,
and desktop. Mutual-exclusion choreography preserved at all widths.

Out of scope (file as follow-up if needed): sticky-header overflow
at narrow widths, bottom-drawer mobile pattern, touch-target
sizing for the close × button.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH. The controller pushes after final review.

---

## Final verification

After the commit lands, run the pipeline once more from the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

All green expected.

**Manual visual check (the real test):** start a static server from the worktree root:

```bash
python3 -m http.server 8765
```

Open http://localhost:8765/examples/topic-page/index.html in Chrome. Use DevTools device emulation:

1. iPhone SE (375 × 667) — open each panel; should be ~343 px wide with 16 px margins.
2. iPhone 12 Pro (390 × 844) — panel should be 320 px wide (capped by `max-width`).
3. Galaxy S20 Ultra (412 × 915) — panel should be 320 px wide.
4. iPad Mini (768 × 1024) portrait — above breakpoint; panel should be 320 px wide (the desktop value).
5. Desktop (1280 × 800) — panel should be 320 px wide; behavior unchanged.

For each viewport, exercise the mutual-exclusion choreography:

- Open data-card via pill click → click "Save your work" → data-card slides out, export panel slides in.
- Click "Reflect" → export panel slides out, checklist slides in.
- All three left-side panels remain mutually exclusive at any width.
- Tweaks panel (right side) coexists with any left-side panel.

**Push the branch + open PR:**

```bash
git push -u origin mobile-panel-responsive
gh pr create --base main --head mobile-panel-responsive \
  --title "Mobile-panel responsive shrink-in-place" \
  --body "[generated body]"
```

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (0 errors, 0 new warnings).
3. `pnpm test` — **188 passing** across both packages.
4. `pnpm build` clean. Bundle delta < +0.5 kB IIFE (verify and report actual).
5. Manual DevTools mobile-emulation check passes against the 5-viewport list above.
6. CI green on the PR; merged to `main`.
