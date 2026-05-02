# Topic-page Print Stylesheet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a whole-topic-page print stylesheet so Cmd+P on the Gas Laws topic page produces a clean classroom handout (UI chrome + sim hidden, teaching content + prompts retained, sim section replaced with a one-line "see online" placeholder).

**Architecture:** Two CSS surfaces. Top-level `@media print` rules in `packages/core/src/styles/components.css` handle the page-level structure (hidden chrome, sim placeholder, page breaks, link-URL suppression, page margins). Per-component `@media print` rules inside each component's `HOST_STYLES` template literal handle shadow-DOM presentation (`<sim-text-response>` and `<sim-practice-question>`). Coexists with the existing reflection-only print mode (PR #8) — that mode is gated on `body.printing-reflection`; whole-page mode runs unconditionally in `@media print`.

**Tech Stack:** CSS only. No new JS, no new components, no new dependencies. Tests use Node's `fs/promises` to read source files for print-rule presence (works without real browser CSS parsing).

**Companion design doc:** `docs/plans/2026-05-02-topic-page-print-stylesheet-design.md` (commit `05c1143` on main). Read for "why" decisions.

---

## Repo state at start

- `main` HEAD: post-PR-#11 (bell-ringer paper-only fix merged) + the design doc commit (`05c1143`).
- Baseline tests: **182** (176 core + 6 data).
- Worktree path: `.worktrees/topic-page-print-stylesheet/` on branch `topic-page-print-stylesheet`.

## Standards (carried from prior phases)

- TDD where it makes sense (test the per-component print-rule presence). Manual print preview is the real verification.
- Conventional commits.
- No git config edits. Use env vars on each commit:
  - `GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com"`
  - `GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com"`
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer on every commit.
- No `git add -A`. Stage files by name.
- All synthesized DOM stays createElement + textContent. **No `.innerHTML`.** (This commit doesn't add JS, but the convention applies to any new test code.)
- No emojis in UI labels or commit messages.

---

## Single commit — `feat(examples): topic-page whole-page print stylesheet`

8 files, ~80 lines added. Single PR.

### Task 1 — Write the failing test for `<sim-text-response>` print rule (RED)

**File:** `packages/core/tests/sim-text-response.test.js`

Append this new test at the end of the existing `describe('<sim-text-response>', () => { ... })` block (after the last existing `it(...)` — the localStorage failure test):

```js
it('HOST_STYLES includes an @media print rule that hides textarea + char-count', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = await fs.readFile(path.join(here, '../src/components/sim-text-response.js'), 'utf-8');
  // The @media print block lives inside the HOST_STYLES template literal.
  // Match `@media print { ... }` non-greedily and assert it hides both
  // interactive children.
  const m = src.match(/@media\s+print\s*\{([\s\S]*?)\}\s*\n\s*`/);
  expect(m).not.toBeNull();
  const printBlock = m[1];
  expect(printBlock).toContain('.sim-text-response__textarea');
  expect(printBlock).toContain('.sim-text-response__count');
  expect(printBlock).toMatch(/display\s*:\s*none/);
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-text-response.test.js -t '@media print' 2>&1 | tail -10
```

Expected: the new test fails because no `@media print` block currently exists in the file. `m` is `null`, the assertion `expect(m).not.toBeNull()` fails. RED witnessed.

### Task 2 — Add `@media print` block to `<sim-text-response>` HOST_STYLES (GREEN)

**File:** `packages/core/src/components/sim-text-response.js`

Find the existing `HOST_STYLES` template literal. It currently ends with the `.sim-text-response__count` rule and a closing backtick. Insert this `@media print` block immediately BEFORE the closing backtick (after the count rule's closing brace):

```css
@media print {
  .sim-text-response__textarea,
  .sim-text-response__count {
    display: none;
  }
  .sim-text-response__prompt {
    font-weight: 500;
  }
}
```

The full HOST_STYLES tail should now look like:

```js
  .sim-text-response__count {
    display: block;
    margin-top: var(--sp-1, 4px);
    font-family: var(--font-mono, monospace);
    font-size: var(--fs-13, 13px);
    color: var(--ib-ink-500, #6b7280);
  }
  @media print {
    .sim-text-response__textarea,
    .sim-text-response__count {
      display: none;
    }
    .sim-text-response__prompt {
      font-weight: 500;
    }
  }
`;
```

The `.sim-text-response__prompt` rule inside the print block is a defensive override: in case the screen rule that styles the prompt ever changes weight, the print version stays explicit. Cheap belt-and-suspenders.

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-text-response.test.js 2>&1 | tail -10
```

Expected: **8 tests passed** (was 7; +1 from this task).

### Task 3 — Write the failing test for `<sim-practice-question>` print rule (RED)

**File:** `packages/core/tests/sim-practice-question.test.js`

Append at the end of the existing `describe` block:

```js
it('HOST_STYLES includes an @media print rule that hides textarea + show-answer + chips', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const url = await import('node:url');
  const here = path.dirname(url.fileURLToPath(import.meta.url));
  const src = await fs.readFile(
    path.join(here, '../src/components/sim-practice-question.js'),
    'utf-8'
  );
  const m = src.match(/@media\s+print\s*\{([\s\S]*?)\}\s*\n\s*`/);
  expect(m).not.toBeNull();
  const printBlock = m[1];
  expect(printBlock).toContain('.sim-practice__textarea');
  expect(printBlock).toContain('.sim-practice__show-answer');
  expect(printBlock).toContain('.sim-practice__rating');
  expect(printBlock).toMatch(/display\s*:\s*none/);
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-practice-question.test.js -t '@media print' 2>&1 | tail -10
```

Expected: the new test fails. RED witnessed.

### Task 4 — Add `@media print` block to `<sim-practice-question>` HOST_STYLES (GREEN)

**File:** `packages/core/src/components/sim-practice-question.js`

Find the HOST_STYLES template literal. It ends with the `.sim-practice__chip[aria-pressed='true']` rule and the closing backtick. Insert this block immediately BEFORE the closing backtick:

```css
@media print {
  .sim-practice__textarea,
  .sim-practice__show-answer,
  .sim-practice__rating {
    display: none;
  }
  .sim-practice__prompt {
    font-weight: 500;
  }
}
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-practice-question.test.js 2>&1 | tail -10
```

Expected: **8 tests passed** (was 7; +1 from this task).

### Task 5 — Append top-level `@media print` block to `components.css`

**File:** `packages/core/src/styles/components.css`

Find the END of the existing reflection-only print rules (the last `#print-reflection-output .reflection-text { ... }` block). Append this new top-level print mode AFTER that block:

```css
/* Phase polish: whole-topic-page print stylesheet.
   Triggered by Cmd+P when body.printing-reflection is NOT set.
   Coexists with the reflection-only print mode above (which gates on the
   .printing-reflection class). The reflection-only rules already short-
   circuit their own output; these whole-page rules apply uniformly in
   @media print and produce a clean classroom handout. */
@page {
  margin: 0.75in;
}

@media print {
  /* Body baseline: fill the printable area, drop the screen max-width cap. */
  body {
    max-width: none;
  }
  body:not(.printing-reflection) .sim-wrap.topic-page {
    max-width: none;
    padding: 0;
  }

  /* Hidden chrome (whole-page mode only). */
  body:not(.printing-reflection) .sim-topstrip,
  body:not(.printing-reflection) .topic-header,
  body:not(.printing-reflection) sim-data-card,
  body:not(.printing-reflection) sim-checklist,
  body:not(.printing-reflection) sim-reflection-export,
  body:not(.printing-reflection) sim-tweaks-panel,
  body:not(.printing-reflection) #reflect-button,
  body:not(.printing-reflection) .topic-next {
    display: none !important;
  }

  /* Sim placeholder: hide the canvas + controls; render a one-line
     "see online" line via ::after. The page author opts in by setting
     data-print-url on the .sim-shell element. */
  body:not(.printing-reflection) .sim-shell > * {
    display: none !important;
  }
  body:not(.printing-reflection) .sim-shell::after {
    content: 'Interactive simulation — see online at ' attr(data-print-url);
    display: block;
    padding: 12pt;
    border: 1pt solid #999;
    border-radius: 4pt;
    font-style: italic;
    color: #555;
    text-align: center;
  }

  /* Drop URL appendices on links — Chrome/Safari/Firefox default behavior
     adds (https://...) after every <a href>; that's noisy on a topic page
     full of internal anchors and glossary terms. */
  body:not(.printing-reflection) a[href]::after {
    content: none;
  }

  /* Page-break hints — keep cohesive blocks together. */
  body:not(.printing-reflection) .ib-bellringer,
  body:not(.printing-reflection) .ib-concept,
  body:not(.printing-reflection) .ib-equation,
  body:not(.printing-reflection) .ib-worked,
  body:not(.printing-reflection) .ib-practice,
  body:not(.printing-reflection) .ib-mark,
  body:not(.printing-reflection) .ib-misc,
  body:not(.printing-reflection) .ib-exitticket,
  body:not(.printing-reflection) .ib-understandings__list li {
    break-inside: avoid;
  }
}
```

The `body:not(.printing-reflection)` prefix on each whole-page rule is the cleanest way to gate this mode without disturbing the existing reflection-only rules. When `<sim-reflection-export>.exportPDF()` adds `body.printing-reflection`, every selector here becomes inert; only the reflection-only rules (which gate ON the class) match.

The `body { max-width: none; }` baseline rule is intentionally NOT prefixed — it's a harmless override that helps both modes if the screen-mode body has a max-width cap.

### Task 6 — Add `data-print-url` to the topic-page `.sim-shell`

**File:** `examples/topic-page/index.html`

Find the existing `.sim-shell` div (search for `class="sim-shell"`). Add a `data-print-url` attribute. The exact replacement target depends on what other attributes are on the shell, but the canonical change is:

```html
<div class="sim-shell"></div>
```

→

```html
<div class="sim-shell" data-print-url="https://aisc-sims.example/s1.5-gas-laws"></div>
```

If the existing `<div class="sim-shell">` already has other attributes (e.g. an id or a data-attr), preserve them and add `data-print-url` next to them. The URL is a placeholder — easy to swap when the real domain is locked.

### Task 7 — Update `CHANGELOG.md`

**File:** `CHANGELOG.md`

Find the existing `### Topic-page UX correction (post-10B)` subsection (added in PR #11). After its end and BEFORE the `### Notes` footer, insert:

```markdown
### Topic-page print stylesheet (post-10B)

- Whole-topic-page print mode: Cmd+P on the topic page now produces a clean classroom handout. UI chrome (top strip, sticky header, side panels, "Next topic" placeholder) hidden; sim canvas replaced with a "Interactive simulation — see online at \[URL\]" placeholder line driven by `data-print-url` on the `.sim-shell` element; page-break hints on cohesive sections; URL appendices on `<a href>` links suppressed.
- Per-component print rules: `<sim-text-response>` hides its textarea + char-count footer; `<sim-practice-question>` hides its attempt textarea, Show-answer button, and 3-chip rating row. The practice question's slotted model answer prints only if the student/teacher clicked Show answer (mirrors the worked example's `<details>` default behavior).
- Coexists with the reflection-only print mode from Phase 10A v2 — the whole-page rules gate on `body:not(.printing-reflection)`, so `<sim-reflection-export>.exportPDF()` continues to produce reflection-only output uncontaminated by handout layout.
- +2 lightweight tests assert the print-rule presence in each affected component's HOST_STYLES (catches accidental deletion in future refactors). Manual Chrome print preview is the real verification.
- Page authors opt in to the sim placeholder by setting `data-print-url` on the `.sim-shell` element. If the attribute is missing, the placeholder line still prints — just without a URL.
```

### Task 8 — Update `docs/architecture.md`

**File:** `docs/architecture.md`

Find the END of the existing Phase 10B section (`## Phase 10B — Interactive reflection portfolio`). Append:

````markdown
## Topic-page print stylesheet

Two-mode print contract layered on top of the existing CSS:

- **Reflection-only mode** (Phase 10A v2 / PR #8): `<sim-reflection-export>.exportPDF()` synthesizes a `#print-reflection-output` block in `document.body`, adds `body.printing-reflection`, calls `window.print()`. The `@media print` rules gate on `.printing-reflection` and hide everything except the synthesized block. `afterprint` listener removes the class. Used for portfolio-only output.
- **Whole-page handout mode**: a teacher hits Cmd+P from the browser. `body.printing-reflection` is NOT set. The `@media print` rules gate on `body:not(.printing-reflection)` and produce a classroom handout: UI chrome hidden, sim section replaced with a "see online" placeholder via `attr(data-print-url)`, side panels hidden, link URL appendices suppressed, page-break hints on cohesive blocks.

The two modes don't compete because their selectors are mutually exclusive on the `.printing-reflection` class. The reflection-only rules ship in `components.css` (added in PR #8). The whole-page rules ship at the END of the same file, gated on the `:not(.printing-reflection)` selector.

### Per-component print rules

Components with shadow DOM (`<sim-text-response>`, `<sim-practice-question>`) carry their own `@media print` blocks inside `HOST_STYLES`. These scope to the shadow root via the singleton `adoptedStyleSheets` pattern and apply at print time alongside the global rules. Convention: every interactive component owns its print presentation. Future contributors adding a new interactive element should add the corresponding `@media print` block in HOST_STYLES — the regression test pattern from `sim-text-response.test.js` / `sim-practice-question.test.js` provides a template.

### Sim placeholder contract

The page author opts in to the sim placeholder by setting `data-print-url="<URL>"` on the `.sim-shell` element. The print rule:

```css
.sim-shell::after {
  content: 'Interactive simulation — see online at ' attr(data-print-url);
}
```
````

falls back to an empty URL string if the attribute is missing. The placeholder line still prints — useful even before the real URL is locked.

````

### Task 9 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
````

Expected:

- format clean
- lint: 0 errors, no new warnings (the 6 pre-existing carry)
- test: **184 total** (was 182; +1 each in sim-text-response.test.js + sim-practice-question.test.js)
- build green; bundle delta < +1 kB IIFE (only the @media print blocks added to two HOST_STYLES; the components.css additions don't ship in the JS bundle).

Stage exactly these 8 files:

```bash
git add \
  packages/core/src/styles/components.css \
  packages/core/src/components/sim-text-response.js \
  packages/core/src/components/sim-practice-question.js \
  packages/core/tests/sim-text-response.test.js \
  packages/core/tests/sim-practice-question.test.js \
  examples/topic-page/index.html \
  CHANGELOG.md \
  docs/architecture.md
```

Commit with env-var attribution and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(examples): topic-page whole-page print stylesheet

Cmd+P on the topic page now produces a clean classroom handout
with UI chrome hidden, the sim section replaced by a one-line
"see online" placeholder, and the teaching content (title, lede,
intros, IB understandings, equation panel, worked example,
practice question prompt, mark scheme, misconceptions, exit
ticket prompts) intact. The reflection-only print mode from
Phase 10A v2 (PR #8) is preserved — both modes coexist via a
:not(.printing-reflection) gate on the whole-page rules.

Two CSS surfaces:

  - Top-level rules in packages/core/src/styles/components.css
    handle the page-level structure: hidden chrome (top strip,
    sticky header, side panels, "Next topic" placeholder), sim
    placeholder via .sim-shell::after content + attr(data-print-url),
    page-break hints on cohesive blocks, link URL appendix
    suppression, @page margin: 0.75in.

  - Per-component rules inside HOST_STYLES of <sim-text-response>
    and <sim-practice-question> hide their interactive UI in
    print: textarea + char-count for text-response; textarea +
    Show-answer button + 3-chip rating row for practice-question.
    The practice question's slotted model answer prints only if
    the student/teacher clicked Show answer (mirrors the worked
    example's <details> default behavior).

Topic-page integration: <div class="sim-shell"> gains
data-print-url="https://aisc-sims.example/s1.5-gas-laws"
(placeholder; easy to swap when the real domain is locked).

Tests: +2 lightweight presence tests assert the @media print
block is present in each affected component's HOST_STYLES.
Catches accidental deletion in future refactors. Net 182 → 184.

Manual verification: Chrome print preview against a 14-point
checklist in the design doc covers what the unit tests can't
(actual rendering at print time).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH from inside the implementer; the controller pushes after final review.

---

## Final verification

After the commit lands, run the pipeline once more from the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

All green expected.

**Manual print preview (the real test):**

1. Start a static server: `python3 -m http.server 8765` from the worktree root.
2. Open http://localhost:8765/examples/topic-page/index.html in Chrome.
3. Cmd+P. Walk through the 14-point checklist from the design doc:
   1. Top strip + sticky header gone.
   2. Title + lede at top of page 1.
   3. Bell ringer prints as numbered prose ("in your notebook" framing).
   4. Topic intro: ONLY the currently-active variant prints. Flip the toggle, re-print, confirm the other appears.
   5. Key concept, IB understandings, equation panel intact. List items don't split across pages.
   6. Success criteria column: kicker + "I can…" + bulleted list. Reflect button gone.
   7. Sim section: contents gone; bordered "Interactive simulation — see online at https://aisc-sims.example/s1.5-gas-laws" line.
   8. Worked example: prints whatever state `<details>` is in.
   9. Practice question: prompt visible. Textarea + Show-answer + chips gone. Model answer only if revealed.
   10. Command term reminder, mark scheme, misconceptions intact.
   11. Exit ticket: 3 numbered prompts visible. No textareas, no char-count footers.
   12. "Next topic" placeholder gone.
   13. No `(https://…)` URL appendices after link text.
   14. Side panels absent regardless of their on-screen state.

4. Sanity-check the reflection-only mode still works: open the page, click "Save your work" → "Save as PDF". The print preview should show ONLY the reflection portfolio (the whole-page rules are correctly gated off by `.printing-reflection`).

**Push the branch + open PR:**

```bash
git push -u origin topic-page-print-stylesheet
gh pr create --base main --head topic-page-print-stylesheet \
  --title "Topic-page whole-page print stylesheet" \
  --body "[generated body]"
```

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (0 errors, 0 new warnings).
3. `pnpm test` — **184 passing** across both packages.
4. `pnpm build` clean. Bundle delta < +1 kB IIFE (verify and report actual).
5. Manual print preview matches the 14-point checklist above.
6. Reflection-only mode (Save your work → Save as PDF) still works correctly.
7. CI green on the PR; merged to `main`.
