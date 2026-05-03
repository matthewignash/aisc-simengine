# Step-6 Follow-ups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve the two long-deferred items from Step 6 — add the missing public sim-control methods to `<sim-engine>`, and reinstate `<slot>` in `<sim-coachmark>` if happy-dom 15.11.7 has fixed slot composition.

**Architecture:** Two commits in one PR. Commit 1 adds `step(dt?)` and `redraw()` to `<sim-engine>` as thin public wrappers over the existing private `_paintOnce` helper, with full JSDoc and 4 new tests. Commit 2 first writes a probe test against happy-dom 15.11.7 to determine whether slot composition works; the same commit then either reinstates `<slot>` in `<sim-coachmark>` (if probe passes) or documents the failure and keeps the textContent workaround (if probe fails).

**Tech Stack:** Vanilla JS (ES2022, ESM), Vitest + happy-dom 15.11.7, JSDoc-driven types. No new dependencies.

**Companion design doc:** `docs/plans/2026-05-03-step6-followups-design.md` (commit `2a7599c` on main). Read for "why" decisions.

---

## Scope correction from design

The design doc said "add 4 public methods (`pause`, `resume`, `step`, `redraw`)." On re-reading `packages/core/src/components/sim-engine.js`, **`pause()` already exists at line 316 and `play()` exists at line 306** (which serves the role of "resume" — calling `play()` after `pause()` restarts the loop). The earlier grep that suggested they were missing actually cut off before reaching those lines.

The actual missing methods are **just `step(dt?)` and `redraw()`**. This is a strict scope reduction — fewer additions, no API renames, no breaking changes.

The `_isPaused` state field that the design proposed is also unnecessary: `state.playing` (existing) already tracks pause state, and the existing `pause()` and `play()` methods read/write it correctly.

Test count target: **188 → 192** (was 194 in the design; -2 because we removed the redundant pause/resume tests).

---

## Repo state at start

- `main` HEAD: post-PR-#13 (mobile responsive merged) + the step-6-followups design doc.
- Worktree path: `.worktrees/step-6-followups/` on branch `step-6-followups`.
- Baseline tests: **188** (182 core + 6 data).
- happy-dom version: 15.11.7 (current installed, latest 15.x patch).

## Standards (carried from prior phases)

- TDD where it makes sense.
- Conventional commits.
- No git config edits. Use env vars on each commit:
  - `GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com"`
  - `GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com"`
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer on every commit.
- No `git add -A`. Stage files by name.
- No emojis in UI labels or commit messages.
- All synthesized DOM via `createElement` + `textContent`. **No `.innerHTML`.**

---

## Commit 1 — `feat(core): <sim-engine> step() and redraw() public methods`

2 files changed: `packages/core/src/components/sim-engine.js`, `packages/core/tests/sim-engine.test.js`.

### Task 1.1 — Write failing tests for `step()` and `redraw()` (RED)

**File:** `packages/core/tests/sim-engine.test.js`

Find the end of the existing `describe('<sim-engine>', () => { ... })` block (after the last existing `it(...)` block). Append these 4 new tests:

```js
it('step(dt) calls sim.step(dt) once and paints once', async () => {
  const el = document.createElement('sim-engine');
  el.setAttribute('sim', 'fake-sim');
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  // After mount, swap in spies for the sim's step + render
  const stepSpy = vi.fn();
  const renderSpy = vi.fn();
  el._sim = { step: stepSpy, render: renderSpy };
  el.step(0.05);
  expect(stepSpy).toHaveBeenCalledOnce();
  expect(stepSpy).toHaveBeenCalledWith(0.05);
  expect(renderSpy).toHaveBeenCalledOnce();
});

it('step() with no argument uses default dt of 1/60', async () => {
  const el = document.createElement('sim-engine');
  el.setAttribute('sim', 'fake-sim');
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  const stepSpy = vi.fn();
  el._sim = { step: stepSpy, render: vi.fn() };
  el.step();
  expect(stepSpy).toHaveBeenCalledWith(1 / 60);
});

it('step() works while paused (does not require play state)', async () => {
  const el = document.createElement('sim-engine');
  el.setAttribute('sim', 'fake-sim');
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  el.pause();
  const stepSpy = vi.fn();
  const renderSpy = vi.fn();
  el._sim = { step: stepSpy, render: renderSpy };
  el.step(0.1);
  expect(stepSpy).toHaveBeenCalledOnce();
  expect(renderSpy).toHaveBeenCalledOnce();
});

it('redraw() calls sim.render but NOT sim.step', async () => {
  const el = document.createElement('sim-engine');
  el.setAttribute('sim', 'fake-sim');
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  const stepSpy = vi.fn();
  const renderSpy = vi.fn();
  el._sim = { step: stepSpy, render: renderSpy };
  el.redraw();
  expect(stepSpy).not.toHaveBeenCalled();
  expect(renderSpy).toHaveBeenCalledOnce();
});
```

The tests rely on the existing `fake-sim` test fixture in `packages/core/tests/_fixtures/fake-sim.js` (which is already imported in this test file's setup). Verify the fixture is registered before the new tests run.

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-engine.test.js -t 'step\\|redraw' 2>&1 | tail -10
```

Expected: all 4 tests fail with `el.step is not a function` and `el.redraw is not a function`. RED witnessed.

### Task 1.2 — Implement `step()` and `redraw()` (GREEN)

**File:** `packages/core/src/components/sim-engine.js`

Find the existing `pause()` method (line 316–319). After its closing `}`, insert these two new methods (BEFORE the existing `_renderError` method at line 326):

```js
  /**
   * Advance the simulation by exactly one timestep, then paint. Safe to call
   * while paused (intended for scrubbing through frames) or while running
   * (advances an extra frame on top of the loop's ongoing ticks). No-op when
   * the sim module has no `step` function.
   *
   * @public
   * @param {number} [dt=1/60] - Timestep in seconds. Defaults to 1/60.
   */
  step(dt = 1 / 60) {
    if (typeof this._sim?.step === 'function') this._sim.step(dt);
    this._paintOnce();
  }

  /**
   * Force a single render of the current state without advancing the sim.
   * Useful when an external consumer mutates state via `setVariable()` while
   * paused and wants the canvas to reflect the change immediately.
   *
   * @public
   */
  redraw() {
    this._paintOnce();
  }
```

Update the JSDoc header at the top of the file (lines 1–23) to include the new methods in the imperative-API line:

```js
 * Imperative API: setVariable, recordTrial, exportCSV, scenario, reset,
 * dismissCoachmark, play, pause, step, redraw.
```

(Currently line 22 reads `Imperative API: setVariable, recordTrial, exportCSV, scenario, reset.` — extend it to list all the public methods.)

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-engine.test.js 2>&1 | tail -10
```

Expected: all sim-engine tests pass (existing count + 4 new = pre-existing + 4).

### Task 1.3 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean (no new warnings beyond the 6 pre-existing)
- test: **192 total** (188 baseline + 4 new in sim-engine.test.js). Verify and report actual.
- build green; bundle delta < +0.5 kB IIFE for the two small wrappers.

Stage exactly:

```bash
git add \
  packages/core/src/components/sim-engine.js \
  packages/core/tests/sim-engine.test.js
```

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(core): <sim-engine> step() and redraw() public methods

Adds two new imperative-API methods to <sim-engine>:

  - step(dt = 1/60): advance the simulation by exactly one timestep,
    then paint. Safe while paused (intended for frame scrubbing) and
    safe while running (advances an extra frame on top of the loop's
    ongoing ticks). No-op when the sim module has no `step` function.

  - redraw(): force a single render of the current state without
    advancing the sim. Useful when an external consumer mutates state
    via setVariable() mid-pause and wants the canvas to reflect the
    change immediately.

Both are thin public wrappers over the existing private _paintOnce
helper. The existing public play() and pause() already cover the
play/pause use case (the design doc proposed adding them too, but
re-reading the source confirmed they exist and have public JSDoc).

Header JSDoc updated to list all 9 imperative API methods:
setVariable, recordTrial, exportCSV, scenario, reset,
dismissCoachmark, play, pause, step, redraw.

Test count: 188 → 192 (+4 new tests for step + redraw covering:
  - step(dt) calls sim.step + sim.render exactly once
  - step() default dt is 1/60
  - step() works while paused
  - redraw() calls render but NOT step).

Step-6 follow-ups commit 1 of 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 2 — `<sim-coachmark>` happy-dom slot probe + (conditional) reinstatement

The probe runs first as a test. Based on its outcome, the source either gets the `<slot>` reinstatement (if happy-dom passes) or a documentation comment (if happy-dom still has the bug).

### Task 2.1 — Write the probe test

**File:** `packages/core/tests/sim-coachmark.test.js`

Find the end of the existing `describe('<sim-coachmark>', () => { ... })` block. Append this probe test:

```js
it('PROBE: happy-dom propagates slotted text through textContent reads (re-tested with the current happy-dom version)', async () => {
  // Define a tiny throwaway component that uses a real <slot>. If happy-dom
  // 15.11.7 propagates slotted text correctly, the assertion passes and we
  // can reinstate <slot> in <sim-coachmark>. If it fails, the textContent
  // workaround stays. This probe is the regression test either way.
  class SlotProbe extends HTMLElement {
    connectedCallback() {
      const root = this.attachShadow({ mode: 'open' });
      const wrapper = document.createElement('div');
      wrapper.id = 'wrap';
      const slot = document.createElement('slot');
      wrapper.appendChild(slot);
      root.appendChild(wrapper);
    }
  }
  if (!customElements.get('slot-probe-happy-dom')) {
    customElements.define('slot-probe-happy-dom', SlotProbe);
  }
  const el = document.createElement('slot-probe-happy-dom');
  el.textContent = 'hello world';
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  // The slot's flattened content should resolve to 'hello world'.
  const wrap = el.shadowRoot.querySelector('#wrap');
  const slot = wrap.querySelector('slot');
  const assigned = slot.assignedNodes ? slot.assignedNodes({ flatten: true }) : [];
  const slottedText = assigned
    .map((n) => (n.textContent || '').trim())
    .filter(Boolean)
    .join(' ');
  expect(slottedText).toBe('hello world');
});
```

**Run the probe:**

```bash
cd packages/core && pnpm vitest run tests/sim-coachmark.test.js -t 'PROBE' 2>&1 | tail -15
```

Two possible outcomes:

- **Probe PASSES** → happy-dom 15.11.7 correctly propagates slotted text. Proceed to Task 2.2 (reinstate slot).
- **Probe FAILS** → happy-dom still has the bug. Proceed to Task 2.3 (document the failure and keep textContent).

Note the outcome (pass or fail) and any error message for the report.

### Task 2.2 — IF probe passes: reinstate `<slot>` in `<sim-coachmark>`

**Skip this task if the probe failed in Task 2.1.**

**File:** `packages/core/src/components/sim-coachmark.js`

Find the existing line (approximately line 121):

```js
// Mirror the host's text into the shadow content div. (A <slot> would be
// the natural shadow-DOM idiom, but happy-dom 15's slot composition does
// not project text through textContent reads in tests, so we copy directly.
// Real browsers see the same text either way.)
content.textContent = this.textContent;
```

Replace with:

```js
// Project the host's children via <slot>. happy-dom's slot composition
// was previously broken (forced a textContent copy fallback); confirmed
// working in 15.11.7 via the PROBE test in tests/sim-coachmark.test.js.
const slot = document.createElement('slot');
content.appendChild(slot);
```

Also update the JSDoc header comment (lines 9–14) — replace the "slot semantics deferred to a follow-up" caveat with a clean description:

```js
 * Hint text is composed via a real <slot>. The host's children (plain text
 * or HTML) are projected into the shadow content. Dismissal is via the
 * "Got it" button or Escape; emits coachmark-shown with detail
 * { id, dismissed: true } on dismissal. Persists dismissal in localStorage
 * keyed by id; mounting with prior dismissal renders nothing.
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-coachmark.test.js 2>&1 | tail -10
```

Expected: all sim-coachmark tests pass (existing count + 1 probe = pre-existing + 1).

### Task 2.3 — IF probe fails: document the failure and keep textContent

**Skip this task if the probe passed in Task 2.1.**

**File:** `packages/core/src/components/sim-coachmark.js`

Find the existing comment block at line 117:

```js
// Mirror the host's text into the shadow content div. (A <slot> would be
// the natural shadow-DOM idiom, but happy-dom 15's slot composition does
// not project text through textContent reads in tests, so we copy directly.
// Real browsers see the same text either way.)
content.textContent = this.textContent;
```

Update with the latest probe finding:

```js
// Mirror the host's text into the shadow content div. (A <slot> would be
// the natural shadow-DOM idiom, but happy-dom 15.11.7 still does not
// propagate slotted text through .assignedNodes() reads in tests —
// confirmed by the PROBE in tests/sim-coachmark.test.js. Re-test on the
// next major upgrade (16.x or 17.x). Real browsers see the same text
// either way via the textContent copy.)
content.textContent = this.textContent;
```

No source-line behavioral change; just a more specific comment.

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-coachmark.test.js 2>&1 | tail -10
```

Expected: all sim-coachmark tests pass; the new probe test passes (it's documented as expected-failure-mode → passes if the slot text is empty; or expected-pass if you've inverted the assertion).

If the probe is a "fail = expected fail" case, you may need to invert the assertion in Task 2.1 to match the actual behavior. Report what you observed.

### Task 2.4 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean
- test: **193 total** (192 from commit 1 + 1 probe). Verify and report actual.
- build: green; bundle delta tiny (a few bytes for the source change in commit 2).

Stage exactly:

```bash
git add \
  packages/core/src/components/sim-coachmark.js \
  packages/core/tests/sim-coachmark.test.js
```

Commit with env-var attribution. **The commit message has TWO variants depending on the probe outcome.** Use the appropriate one:

**If probe PASSED (slot reinstated):**

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
fix(core): reinstate <slot> in <sim-coachmark> (happy-dom 15.11.7 confirmed)

The original <sim-coachmark> implementation copied the host's
textContent into a shadow-DOM div instead of using a real <slot>.
The reason: happy-dom 15.x (in some earlier patch) didn't propagate
slotted text through assigned-nodes reads, breaking unit tests.

Probed against happy-dom 15.11.7 via a new test in
tests/sim-coachmark.test.js: a tiny throwaway <slot-probe-happy-dom>
component asserts that slotted text is correctly accessible via
slot.assignedNodes({ flatten: true }). The probe PASSES on
15.11.7 — the bug is fixed.

This commit reinstates <slot> in <sim-coachmark>:

  - content.textContent = this.textContent → const slot = createElement('slot'); content.appendChild(slot);
  - JSDoc header updated to remove the "deferred" caveat.

Authoring impact: HTML inside a <sim-coachmark> host (e.g. <strong>,
<em>, <code>) now correctly projects into the shadow tree.
Previously, all HTML was flattened to plain text by the
.textContent copy.

Test count: 192 → 193 (+1 probe test).

Step-6 follow-ups commit 2 of 2. Closes the long-deferred slot
reinstatement item.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**If probe FAILED (textContent stays, comment updated):**

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
docs(core): probe + document happy-dom 15.11.7 slot composition (still broken)

The original <sim-coachmark> implementation copied the host's
textContent into a shadow-DOM div instead of using a real <slot>.
The reason: happy-dom 15.x didn't propagate slotted text through
assigned-nodes reads, breaking unit tests.

This commit adds a probe test against happy-dom 15.11.7 (current
installed) that mounts a tiny <slot-probe-happy-dom> and asserts
slotted text is accessible via slot.assignedNodes({ flatten: true }).
The probe FAILS in 15.11.7 — the bug is still present.

Action taken:

  - The probe test stays in the codebase as a regression test that
    will catch the moment the bug is fixed (the assertion will start
    passing in a future happy-dom upgrade).
  - The comment in <sim-coachmark>.js is updated with the specific
    finding (15.11.7 still broken; re-test on 16.x or 17.x upgrade).
  - The textContent fallback stays; no behavioral change for real
    browsers.

The slot reinstatement remains deferred — to be revisited when the
project upgrades happy-dom (a separate dependency-management
decision; some other tests may need migration).

Test count: 192 → 193 (+1 probe test).

Step-6 follow-ups commit 2 of 2. Closes the investigation portion of
the deferred slot reinstatement item.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## CHANGELOG + architecture.md (final touch — included in commit 2)

These docs updates land alongside commit 2 (so the CHANGELOG reflects both commits' work in one entry).

### Task 2.5 — CHANGELOG entry

**File:** `CHANGELOG.md`

Find the existing `### Mobile-panel responsive (post-10B)` subsection (the most recent post-10B subsection on main). After its end and BEFORE the `### Notes` footer, insert:

```markdown
### Step-6 follow-ups (post-10B)

Two long-deferred items from Step 6 (supporting components) ship together as PR #16:

- **`<sim-engine>.step(dt?)` and `.redraw()`:** new public imperative-API methods. `step()` advances the simulation by exactly one timestep (default 1/60 s) and paints once — safe while paused (frame scrubbing) and while running (advances an extra frame). `redraw()` forces a single render without advancing the sim — useful when external consumers mutate state via `setVariable()` while paused and want the canvas to reflect the change immediately. Both are thin public wrappers over the existing private `_paintOnce` helper. The previously-deferred "private API → public" item turned out to be smaller than originally framed: `play()` and `pause()` were already public; only `step()` and `redraw()` were missing.
- **`<sim-coachmark>` `<slot>` probe:** added a probe test against happy-dom 15.11.7 to determine whether slot composition is fixed in the current patch. [If the probe passed, this bullet says: "The probe passed; reinstated `<slot>` in `<sim-coachmark>` so authored HTML inside the host element correctly projects into the shadow tree. The previously-required textContent copy fallback is gone."] [If the probe failed, this bullet says: "The probe failed; happy-dom 15.11.7 still does not propagate slotted text correctly. The textContent fallback stays. The probe test stays in the codebase as a regression test that will catch the moment the bug is fixed in a future happy-dom upgrade."]
- Test count: 188 → 193 (+4 sim-engine tests, +1 happy-dom probe).
- Bundle delta: ~+0.3 kB IIFE.
- The two long-deferred items can now be removed from the `docs/architecture.md` deferred table (or a single line note remains if the slot probe failed).
```

The implementer fills in ONE of the two bracketed alternatives in the second bullet based on the actual probe outcome. Delete the bracketed prefix ("[If…", "[If…") and the leading text "this bullet says:" so the resulting prose reads cleanly.

### Task 2.6 — architecture.md update

**File:** `docs/architecture.md`

Find the table near the end of the existing `## Phase 10A v2` section (or wherever the deferred-items table currently lives — search for "follow-up list"). Locate these two rows:

```markdown
| `<slot>` reinstatement in `<sim-coachmark>` | Deferred (still on step-6 follow-up list) |
| `<sim-engine>` private API → public | Deferred (still on step-6 follow-up list) |
```

**If the probe passed** — replace BOTH rows with:

```markdown
| `<slot>` reinstatement in `<sim-coachmark>` | Shipped in PR #16 (happy-dom 15.11.7 probe passed). |
| `<sim-engine>` step(dt?) and redraw() public methods | Shipped in PR #16. play() and pause() already existed. |
```

**If the probe failed** — replace with:

```markdown
| `<slot>` reinstatement in `<sim-coachmark>` | Probed in PR #16; happy-dom 15.11.7 still broken. Re-test on 16.x / 17.x upgrade. |
| `<sim-engine>` step(dt?) and redraw() public methods | Shipped in PR #16. play() and pause() already existed. |
```

Stage these two doc files alongside the source changes in Task 2.4's commit:

```bash
git add CHANGELOG.md docs/architecture.md
```

Then run the commit (Task 2.4) — it will include all 4 files (sim-coachmark source + sim-coachmark test + CHANGELOG + architecture).

---

## Final verification

After the commit lands, run the pipeline once more from the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: all green.

**Push the branch + open PR:**

```bash
git push -u origin step-6-followups
gh pr create --base main --head step-6-followups \
  --title "Step-6 follow-ups: <sim-engine> step()/redraw() + <sim-coachmark> slot probe" \
  --body "[generated body]"
```

PR description should mention the probe outcome (pass / fail) prominently.

---

## Exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean (0 errors, 0 new warnings).
3. `pnpm test` — **193 passing** (188 baseline + 4 sim-engine + 1 probe).
4. `pnpm build` clean. Bundle delta ≤ +0.5 kB IIFE.
5. CHANGELOG and architecture.md reflect the actual probe outcome.
6. CI green; PR #16 merged to `main`.

---

## Out of scope (deferred)

- Upgrading happy-dom to 16.x or 17.x. Separate decision.
- Renaming `_startLoop` / `_stopLoop` / `_paintOnce` / `_renderError` to public methods. They stay internal — the new `step()` and `redraw()` are the right public surface for consumers.
- Cross-topic portfolio aggregator. On the deferred queue.
- Shared print-block helper module. Reassessed: not a real bundle win.
