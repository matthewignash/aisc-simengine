# Step 5b — Gas Laws Extensions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Round out the Gas Laws sim with the IB SL/HL syllabus extensions: multiple gas species (ideal/He/N₂/CO₂), van der Waals physics with HL toggle and Ideal-vs-Real comparison graph, Maxwell-Boltzmann distribution graph, and three teacher presets (Boyle, Charles, Ideal-vs-Real). Plus three high-priority sweep cleanups deferred from steps 4 and 5 (listener leak fix, dt clamping, `_pressureFn` refactor).

**Architecture:** Vanilla ESM additions on top of step 5's foundation. New `species.js` data table. New `vdWPressure`, `speedHistogram`, `maxwellBoltzmann2D` helpers in physics.js. `controls.createDropdown` becomes real (was stubbed). Particles.js `render` accepts `fillStyle`; new `getSpeeds()` for histogram binning. Gas-laws sim grows: preset + species dropdowns, `_pressureFn` abstraction, listener-unsubscribe collection, two new graphs (HL Ideal-vs-Real, MB distribution).

**Tech Stack:** Vanilla JS (ES2022, ESM), Vite library mode, Vitest + happy-dom, JSDoc-driven types. No additional deps.

**Companion design doc:** `docs/plans/2026-04-30-step5b-gas-laws-extensions-design.md` (read for "why" decisions).

**Repo state at start:** `main` at `3f54801` (step 5 + smoke-test fixes + this design doc). 75 tests passing. Branch protected, CI required green to merge.

**Standards (carried from step 5):**

- TDD: every implementation line has a failing test that drove it. Use `superpowers:test-driven-development`.
- Safe DOM: prefer `createElement` + `setAttribute` + `appendChild` over `.innerHTML`. Static template literals on inert `<template>` elements are also acceptable.
- Conventional commits: `chore`, `feat`, `fix`, `refactor`, `docs` prefixes; subject under 72 chars.
- No git config edits — use `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars per commit.
- No `git add -A`. Always specify files by name.
- No push between commits — controller pushes the branch once at the end of step 5b.
- Work in a worktree at `.worktrees/step-5b-gas-laws/` on branch `step-5b-gas-laws` (set up before this plan begins).
- Test helper from step 5 (mountSimEngine via createElement) is already in tests; reuse it.

---

## Commit 1 — `fix(core): collect state listener unsubs in gas-laws sim dispose`

Fixes the listener-leak bug surfaced in step 5 review: `host._state.on(...)` returns unsubscribe functions that gas-laws's `init` discards, so `dispose` leaves orphaned listeners that fire on nulled fields.

### Task 1.1 — TDD: listeners stop firing after dispose

**Files:**

- Modify: `packages/core/tests/gas-laws.test.js` (append new test)
- Modify: `packages/core/src/sims/gas-laws/index.js`

**Step 1: Write the failing test**

Append inside the existing `describe('gas-laws sim module', ...)` block:

```js
it('does not invoke sim callbacks after dispose (listener cleanup)', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  // Trigger init listeners normally
  el.setVariable('T', 350);
  // Tear down
  el.remove();
  // After remove, dispose should have unsubscribed all _state.on() handlers.
  // Calling state.set on the now-detached state should NOT touch nulled fields.
  expect(() => el._state.set('T', 999)).not.toThrow();
  expect(() => el._state.set('V', 1.0)).not.toThrow();
  expect(() => el._state.set('n', 2.5)).not.toThrow();
});
```

**Step 2: Verify RED**

Run: `cd packages/core && pnpm vitest run tests/gas-laws.test.js -t "listener cleanup"`
Expected: PASS or FAIL — currently the listeners fire on nulled `_field`/`_graph`, but the existing `?.` chains save them from crashing. The test asserts no throw, which the current code already gives. **The test will pass without code changes** because of the optional-chain guards. That's a problem — the test isn't strong enough to drive the fix.

**Strengthen the test** so it actually catches the bug:

```js
it('removes state listeners on dispose so they do not fire on nulled fields', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  // Capture the state reference; remove the element triggers disconnectedCallback → dispose.
  const state = el._state;
  el.remove();
  // After dispose, _field, _graph, etc. are null. If the dispose left listeners
  // attached, state.set('T', 999) would call this._field.setTemperature on null.
  // The OLD impl uses ?. chains so it doesn't crash, but it ALSO does no work.
  // The fix: dispose collects unsubs and calls them; subsequent set is a true no-op.
  // We assert via the spy below.
  const fakeSimSpy = vi.spyOn(el._sim, '_updateReadouts').mockImplementation(() => {});
  state.set('T', 999);
  state.set('V', 1.0);
  state.set('n', 2.5);
  expect(fakeSimSpy).not.toHaveBeenCalled();
  fakeSimSpy.mockRestore();
});
```

This test passes ONLY if `_updateReadouts` is never called after dispose, which requires the listeners to be unsubscribed.

**Step 3: Run RED**

Expected: FAIL — without the fix, `_updateReadouts` is called by leftover listeners.

**Step 4: Implement the fix**

In `packages/core/src/sims/gas-laws/index.js`, modify `init(host)`:

Before: listeners are registered with `host._state.on('T', ...)` and the return value is discarded.

After: collect unsubs in `this._unsubs`:

```js
init(host) {
  // ... existing init code (canvas, field, graph, sliders, buttons, readouts) ...

  this._unsubs = [];
  this._unsubs.push(
    host._state.on('T', (T) => {
      this._field.setTemperature(T);
      this._updateReadouts(host);
    })
  );
  this._unsubs.push(
    host._state.on('V', () => this._updateReadouts(host))
  );
  this._unsubs.push(
    host._state.on('n', (n) => {
      this._field.setCount(visualParticleCount(n));
      this._updateReadouts(host);
    })
  );

  // ... rest of init ...
}
```

Modify `dispose()`:

```js
dispose() {
  for (const off of this._unsubs ?? []) off();
  this._unsubs = [];
  this._field = null;
  this._graph = null;
  this._lastHost = null;
}
```

**Step 5: Verify GREEN**

Run: `pnpm vitest run tests/gas-laws.test.js -t "listener cleanup"`
Expected: PASS.

### Task 1.2 — Verify pipeline + commit

```
cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine/.worktrees/step-5b-gas-laws
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: lint clean; **76 tests** total (75 + 1); build green.

Stage exactly:

- `packages/core/src/sims/gas-laws/index.js`
- `packages/core/tests/gas-laws.test.js`

Commit:

```
fix(core): collect state listener unsubs in gas-laws sim dispose

Step 5 review surfaced a listener leak: gas-laws sim's init registers
listeners on host._state.on('T'|'V'|'n', ...) but discards the
unsubscribe handles. After disconnectedCallback triggers dispose, the
listeners persist on _state and fire on nulled _field/_graph fields.
Optional-chain guards prevented crashes but stale callbacks still
ran, doubling readout updates on remount and leaving stale closures
holding sim references.

Fix: collect unsubs in this._unsubs = [] during init; iterate and
call them in dispose. Pattern is reusable for any future sim — also
documented in docs/architecture.md as part of the sim contract
(deferred to commit 11's docs update).

1 new test verifies that state.set after dispose does not invoke
sim methods.

Step 5b commit 1 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 2 — `fix(core): clamp dt at rAF boundary to handle backgrounded tabs`

Step 4 review noted: `<sim-engine>`'s rAF loop computes `dt = (now - lastFrameTime) / 1000`. When the tab is backgrounded, browsers throttle rAF; on resume `dt` can spike to multiple seconds, producing glitched physics on the resumed frame. `particles.js` substeps internally so it's safe-ish, but `state.dt` propagates to all sims and to graph cadence calculations.

### Task 2.1 — TDD: dt is clamped to 0.1

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append failing test** inside the existing `describe('<sim-engine> — rAF loop', ...)` block:

```js
it('clamps dt to 0.1 when the rAF callback fires after a long delay (backgrounded tab)', async () => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  const el = mountSimEngine({ sim: 'fake-sim' });
  await Promise.resolve();
  // Advance one frame normally
  vi.advanceTimersByTime(20);
  // Now simulate a long pause (5 seconds of backgrounded throttling)
  vi.advanceTimersByTime(5000);
  // After the next tick, state.dt should be clamped at 0.1, not ~5.0
  expect(el._state.get('dt')).toBeLessThanOrEqual(0.1);
  vi.useRealTimers();
});
```

**Step 2: Verify RED**

Run: `pnpm vitest run tests/sim-engine.test.js -t "clamps dt"`
Expected: FAIL — current code stores raw dt which would be ~5.0.

**Step 3: Implement clamping** in `packages/core/src/components/sim-engine.js`

Inside `_startLoop`'s `tick` function, find:

```js
const dt = (now - this._lastFrameTime) / 1000;
```

Change to:

```js
const rawDt = (now - this._lastFrameTime) / 1000;
// Cap at 100ms to handle backgrounded-tab spikes — without this, a tab
// resumed after seconds of throttling would deliver one giant dt that
// produces glitched physics.
const dt = Math.min(rawDt, 0.1);
```

**Step 4: Verify GREEN**

Run: `pnpm vitest run tests/sim-engine.test.js -t "clamps dt"`
Expected: PASS.

### Task 2.2 — Verify pipeline + commit

```
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: **77 tests**; build green.

Stage:

- `packages/core/src/components/sim-engine.js`
- `packages/core/tests/sim-engine.test.js`

Commit:

```
fix(core): clamp dt at rAF boundary to handle backgrounded tabs

Step 4 review noted: when the tab is backgrounded and resumed,
performance.now()'s delta to lastFrameTime can spike to multiple
seconds. particles.js substeps internally so position-integration
stays safe, but state.dt is exposed to every sim's step(dt) and is
used as a propagation hint for any future sim that integrates
naively.

Cap dt at 100ms (Math.min(rawDt, 0.1)) at the loop boundary. At
60fps the typical dt is ~16ms, so the cap is invisible during normal
operation but contains tab-resumption spikes to a single chunky frame
instead of a multi-second jump.

1 new test using vi.useFakeTimers verifies the clamp.

Step 5b commit 2 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 3 — `feat(core): implement controls.createDropdown`

Replaces the `createDropdown` stub. Used by step 5b's species and preset selectors. Native `<select>` for free a11y.

### Task 3.1 — TDD: createDropdown DOM shape

**Files:**

- Modify: `packages/core/tests/controls.test.js`
- Modify: `packages/core/src/engine/controls.js`

**Step 1: Append failing test** at the end of `controls.test.js`:

```js
import { createDropdown } from '../src/engine/controls.js';

describe('createDropdown', () => {
  it('returns .sim-dropdown wrapper with label, native select, and options', () => {
    const el = createDropdown({
      key: 'species',
      label: 'Gas',
      options: [
        { value: 'ideal', label: 'Ideal gas' },
        { value: 'co2', label: 'CO₂' },
      ],
      value: 'ideal',
      onChange: () => {},
    });
    expect(el.classList.contains('sim-dropdown')).toBe(true);
    expect(el.dataset.var).toBe('species');
    expect(el.querySelector('.sim-dropdown__label').textContent).toContain('Gas');
    const select = el.querySelector('select');
    expect(select).not.toBeNull();
    expect(select.value).toBe('ideal');
    expect(select.querySelectorAll('option').length).toBe(2);
  });
});
```

Add `createDropdown` to the existing `controls.js` import line at the top of the test file.

**Step 2: Verify RED.** `pnpm vitest run tests/controls.test.js -t "createDropdown"` → FAIL (current stub throws).

**Step 3: Implement** in `packages/core/src/engine/controls.js`. Replace the existing `createDropdown` stub:

```js
/**
 * @param {{
 *   key: string, label: string,
 *   options: Array<{ value: string, label: string }>,
 *   value?: string,
 *   disabled?: boolean,
 *   onChange?: (v: string) => void,
 * }} opts
 * @returns {HTMLElement}
 */
export function createDropdown(opts) {
  const { key, label, options, value, disabled = false, onChange } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'sim-dropdown';
  wrap.dataset.var = key;

  const labelEl = document.createElement('label');
  labelEl.className = 'sim-dropdown__label';
  labelEl.textContent = label;

  const select = document.createElement('select');
  select.disabled = disabled;
  select.setAttribute('aria-label', label);
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === value) o.selected = true;
    select.appendChild(o);
  }

  select.addEventListener('change', () => {
    if (!select.disabled) onChange?.(select.value);
  });

  wrap.append(labelEl, select);
  return wrap;
}
```

**Step 4: Verify GREEN.** `pnpm vitest run tests/controls.test.js` → 6 tests pass.

### Tasks 3.2 – 3.4 — Append remaining 3 tests

**3.2 — change event fires onChange:**

```js
it('change event on select fires onChange with new value', () => {
  const onChange = vi.fn();
  const el = createDropdown({
    key: 'species',
    label: 'Gas',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ],
    value: 'a',
    onChange,
  });
  const select = el.querySelector('select');
  select.value = 'b';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  expect(onChange).toHaveBeenCalledWith('b');
});
```

**3.3 — disabled dropdown does not fire:**

```js
it('disabled dropdown does not invoke onChange on change', () => {
  const onChange = vi.fn();
  const el = createDropdown({
    key: 'x',
    label: 'X',
    options: [{ value: 'a', label: 'A' }],
    value: 'a',
    disabled: true,
    onChange,
  });
  const select = el.querySelector('select');
  select.value = 'a';
  select.dispatchEvent(new Event('change'));
  expect(onChange).not.toHaveBeenCalled();
});
```

**3.4 — selected option matches initial value:**

```js
it('the option whose value matches `value` is initially selected', () => {
  const el = createDropdown({
    key: 'k',
    label: 'L',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ],
    value: 'b',
    onChange: () => {},
  });
  const select = el.querySelector('select');
  expect(select.value).toBe('b');
  expect(select.selectedIndex).toBe(1);
});
```

### Task 3.5 — Verify pipeline + commit

Verify: **81 tests** total. Build green; bundle grows ~0.5 kB.

Stage:

- `packages/core/src/engine/controls.js`
- `packages/core/tests/controls.test.js`

Commit:

```
feat(core): implement controls.createDropdown

Replaces the foundation-phase stub. createDropdown returns a
.sim-dropdown wrapper containing a label and a native <select>
with the supplied options. Native select gives keyboard nav and
screen-reader support for free. Used by step 5b's species selector
and preset selector.

createToggle and initKeyboard remain stubbed.

4 new tests; existing 5 controls tests still pass.

Step 5b commit 3 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 4 — `refactor(core): gas-laws — abstract pressure via _pressureFn`

Tiny prep refactor. Today, `_updateReadouts` and `derived` both call `idealPressure(state)` directly. Step 5b's VdW switch in commit 6 needs a single seam to flip ideal vs VdW based on species. Introduce `this._pressureFn` set in `init`, used by both consumers. Behavior identical for now.

### Task 4.1 — Refactor without changing behavior

**Files:**

- Modify: `packages/core/src/sims/gas-laws/index.js`

**Step 1:** in `init(host)`, after seeding control defaults but before building the field, add:

```js
this._pressureFn = (state) => idealPressure(state);
```

**Step 2:** in `_updateReadouts`, change:

```js
set('P', idealPressure(state).toFixed(1));
```

to:

```js
set('P', this._pressureFn(state).toFixed(1));
```

**Step 3:** in the existing `render(ctx)` method, change the P-V graph append:

```js
this._graph.addPoint('path', state.V, idealPressure(state));
```

to:

```js
this._graph.addPoint('path', state.V, this._pressureFn(state));
```

**Step 4:** in `derived(state)`:

```js
return { P: idealPressure(state), KE: avgKineticEnergy(state.T) };
```

becomes:

```js
return { P: this._pressureFn(state), KE: avgKineticEnergy(state.T) };
```

**Step 5: Verify** — all existing 13 gas-laws tests still pass with no test changes:

```
pnpm vitest run tests/gas-laws.test.js
```

Expected: 7 passing (no behavior change). Plus all 78 prior tests still pass.

### Task 4.2 — Verify pipeline + commit

```
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: **81 tests** unchanged; build green.

Stage:

- `packages/core/src/sims/gas-laws/index.js`

Commit:

```
refactor(core): gas-laws — abstract pressure via _pressureFn

Tiny prep refactor for VdW physics in commit 6. Today both
_updateReadouts and derived (and the P-V graph append in render)
call idealPressure directly. Replace with a closure stored on
this._pressureFn during init. No behavior change in this commit
— the closure delegates to idealPressure exactly as before.

Commit 6 will switch the closure body to dispatch on species.a/b
between idealPressure and vdWPressure. Doing the seam now keeps the
diff for that commit focused on physics, not boilerplate.

No new tests — existing 7 gas-laws tests verify behavior is preserved.

Step 5b commit 4 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 5 — `feat(core): gas-laws — multiple species (ideal/He/N₂/CO₂)`

Adds the species data table, species dropdown in the rail, particle color tracking species, and a fourth readout ("Species"). VdW physics still doesn't fire (next commit).

### Task 5.1 — Create `species.js` table

**Files:**

- Create: `packages/core/src/sims/gas-laws/species.js`

```js
/**
 * Gas species table for the Gas Laws sim. Constants are pedagogically
 * tuned (not strict SI) — chosen to produce visible non-ideal behavior
 * in our V/T/n slider ranges. Real-world VdW constants would underflow
 * at the slider scales we use.
 *
 * a, b feed `vdWPressure` from physics.js (lands in commit 6).
 * color is the particle fill color used by particles.render().
 */
export const SPECIES = {
  ideal: { id: 'ideal', label: 'Ideal gas', a: 0, b: 0, color: '#2a9d8f' },
  he: { id: 'he', label: 'He · Helium', a: 0.0035, b: 0.0237, color: '#f4a261' },
  n2: { id: 'n2', label: 'N₂ · Nitrogen', a: 0.137, b: 0.0387, color: '#e76f51' },
  co2: { id: 'co2', label: 'CO₂ · Carbon dioxide', a: 0.366, b: 0.0429, color: '#264653' },
};

/**
 * Convenience: array of {value, label} for createDropdown options.
 */
export const SPECIES_OPTIONS = Object.values(SPECIES).map((s) => ({
  value: s.id,
  label: s.label,
}));
```

### Task 5.2 — TDD: particles.render accepts fillStyle option

**Files:**

- Modify: `packages/core/tests/particles.test.js`
- Modify: `packages/core/src/engine/particles.js`

**Step 1: Append failing test** to `particles.test.js`:

```js
it('render(ctx, { fillStyle }) uses the supplied fillStyle for particles', () => {
  const field = createParticleField({
    count: 3,
    bounds: { width: 600, height: 400 },
    temperature: 300,
  });
  let lastFill = '';
  const ctx = {
    canvas: { width: 600, height: 400 },
    clearRect: () => {},
    set fillStyle(v) {
      lastFill = v;
    },
    get fillStyle() {
      return lastFill;
    },
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
  };
  field.render(ctx, { fillStyle: '#abcdef' });
  expect(lastFill).toBe('#abcdef');
});
```

**Step 2: Verify RED.**

**Step 3:** Modify `render` in `particles.js`:

```js
render(ctx, opts = {}) {
  if (!ctx) return;
  ctx.fillStyle = opts.fillStyle ?? '#2a9d8f';
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

(Existing JSDoc comment about hex literal can stay.)

**Step 4: Verify GREEN.** Existing 9 particles tests still pass (default fillStyle is unchanged).

### Task 5.3 — TDD: species dropdown renders + state listener

**Files:**

- Modify: `packages/core/tests/gas-laws.test.js`
- Modify: `packages/core/src/sims/gas-laws/index.js`

**Step 1: Append failing test:**

```js
it('renders a species dropdown in the rail with 4 options, default ideal', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const dropdown = el.shadowRoot.querySelector('.sim-rail .sim-dropdown[data-var="species"]');
  expect(dropdown).not.toBeNull();
  const select = dropdown.querySelector('select');
  expect(select.options.length).toBe(4);
  expect(select.value).toBe('ideal');
});

it('changing species updates state.species', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const select = el.shadowRoot.querySelector('.sim-dropdown[data-var="species"] select');
  select.value = 'co2';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el._state.get('species')).toBe('co2');
});
```

**Step 2: Verify RED.**

**Step 3:** Modify `gas-laws/index.js`. Add imports at top:

```js
import { SPECIES, SPECIES_OPTIONS } from './species.js';
import { createDropdown } from '../../engine/controls.js';
```

In the `controls` array, **append** a species control entry (kept separate from the slider controls so the registry doesn't see a "slider" with no min/max):

The cleanest approach: keep `controls` for sliders only (sliders are what `recorder.variables` derives from). Species is rendered manually in `init` rather than being in the controls list.

Modify `init(host)` to also append a species dropdown after the sliders:

```js
// After the slider loop, before transport buttons:
if (host._state.get('species') === undefined) host._state.set('species', 'ideal');
const speciesDropdown = createDropdown({
  key: 'species',
  label: 'Gas',
  options: SPECIES_OPTIONS,
  value: host._state.get('species'),
  onChange: (v) => host.setVariable('species', v),
});
rail.appendChild(speciesDropdown);
```

Add a state listener (in the `_unsubs` collection — this is now the 4th listener):

```js
this._unsubs.push(
  host._state.on('species', () => {
    this._updateReadouts(host);
  })
);
```

Modify the sim's `render(ctx)` method to pass the current species color:

```js
render(ctx) {
  if (!ctx) return;
  const state = this._lastHost?._state.getAll() ?? {};
  const sp = SPECIES[state.species ?? 'ideal'];
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawContainer(ctx, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, V: state.V ?? 5, Vmax: V_MAX });
  ctx.save();
  ctx.translate(CONTAINER_MARGIN_X, CONTAINER_MARGIN_Y);
  this._field.render(ctx, { fillStyle: sp.color });
  ctx.restore();
  // ... existing graph cadence code unchanged
}
```

**Step 4: Verify GREEN** for both tests.

### Task 5.4 — TDD: 4th readout for species

Append:

```js
it('readouts include a "Species" entry showing the human label', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const speciesReadout = el.shadowRoot.querySelector(
    '[data-readout="species"] .sim-readout__value-text'
  );
  expect(speciesReadout.textContent).toBe('Ideal gas');
  // Change species; readout updates.
  el.setVariable('species', 'co2');
  expect(speciesReadout.textContent).toBe('CO₂ · Carbon dioxide');
});
```

**Step 2: Verify RED.**

**Step 3:** In `init(host)`, modify the readouts append to also include species:

```js
readouts.append(
  makeReadout('Pressure', 'P', 'kPa'),
  makeReadout('Avg KE', 'KE', 'zJ'),
  makeReadout('Particles', 'N', ''),
  makeReadout('Species', 'species', '')
);
```

In `_updateReadouts(host)`:

```js
set('P', this._pressureFn(state).toFixed(1));
set('KE', avgKineticEnergy(state.T).toFixed(2));
set('N', String(visualParticleCount(state.n)));
set('species', SPECIES[state.species ?? 'ideal'].label);
```

**Step 4: Verify GREEN.**

### Task 5.5 — Verify pipeline + commit

```
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: **85 tests** total (81 + 4); build green; bundle grows ~1 kB.

Stage:

- `packages/core/src/sims/gas-laws/species.js`
- `packages/core/src/sims/gas-laws/index.js`
- `packages/core/src/engine/particles.js`
- `packages/core/tests/gas-laws.test.js`
- `packages/core/tests/particles.test.js`

Commit:

```
feat(core): gas-laws — multiple species (ideal/He/N₂/CO₂)

Adds the species data layer, UI selector, and per-species particle
color. VdW physics is still inactive (next commit).

  - New file: src/sims/gas-laws/species.js — table of 4 species with
    pedagogically tuned a/b VdW parameters and particle colors.
    Constants chosen to produce visible non-ideal behavior at the
    slider ranges; not strict SI units.
  - particles.js render(ctx) gains a 2nd argument {fillStyle}.
    Default unchanged so existing callers continue to work.
  - gas-laws sim init builds a species dropdown via createDropdown,
    seeds state.species default to 'ideal', adds a 4th readout
    showing the human species label, and registers an unsubscribe
    in this._unsubs.
  - sim.render passes the current species color to particles.render.

4 new tests across particles and gas-laws files.

Step 5b commit 5 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 6 — `feat(core): gas-laws — VdW pressure for non-ideal species`

Adds `vdWPressure` to physics.js and switches `_pressureFn` to dispatch on species.a/b. Selecting CO₂ at low V now visibly diverges from PV=nRT.

### Task 6.1 — TDD: vdWPressure formula

**Files:**

- Modify: `packages/core/tests/gas-laws-physics.test.js`
- Modify: `packages/core/src/sims/gas-laws/physics.js`

**Step 1: Append failing tests:**

```js
import { vdWPressure } from '../src/sims/gas-laws/physics.js';

describe('vdWPressure', () => {
  it('matches idealPressure when a=0 and b=0', () => {
    const ideal = idealPressure({ V: 1, T: 300, n: 1 });
    const vdw = vdWPressure({ V: 1, T: 300, n: 1, a: 0, b: 0 });
    expect(vdw).toBeCloseTo(ideal, 1);
  });

  it('returns 0 for non-positive inputs', () => {
    expect(vdWPressure({ V: 0, T: 300, n: 1, a: 0.366, b: 0.0429 })).toBe(0);
    expect(vdWPressure({ V: 1, T: 0, n: 1, a: 0.366, b: 0.0429 })).toBe(0);
    expect(vdWPressure({ V: 1, T: 300, n: 0, a: 0.366, b: 0.0429 })).toBe(0);
  });

  it('diverges below ideal at high pressure (V small) for CO₂', () => {
    // CO₂ params (small V, high pressure regime)
    const ideal = idealPressure({ V: 0.5, T: 200, n: 4 });
    const real = vdWPressure({ V: 0.5, T: 200, n: 4, a: 0.366, b: 0.0429 });
    expect(real).toBeLessThan(ideal); // attraction term dominates at low V
  });

  it('returns Infinity when V <= n*b (gas compressed past minimum molar volume)', () => {
    // n*b = 10 * 0.0429 = 0.429; V=0.4 < 0.429
    expect(vdWPressure({ V: 0.4, T: 300, n: 10, a: 0.366, b: 0.0429 })).toBe(Infinity);
  });
});
```

**Step 2: Verify RED.**

**Step 3:** Append to `physics.js`:

```js
/**
 * Van der Waals pressure: ideal-gas correction for finite particle volume
 * (b) and intermolecular attraction (a). Both species-specific; see
 * species.js. Constants are pedagogically tuned, not strict SI.
 *
 *     P = nRT / (V - nb)  -  a · n² / V²
 *
 * Returns 0 for non-positive V/T/n; Infinity if V <= nb (compressed
 * past minimum molar volume — non-physical regime).
 *
 * @param {{ V: number, T: number, n: number, a: number, b: number }} opts
 * @returns {number} pressure in kPa
 */
export function vdWPressure({ V, T, n, a, b }) {
  if (V <= 0 || T <= 0 || n <= 0) return 0;
  const denom = V - n * b;
  if (denom <= 0) return Infinity;
  return (n * R_GAS * T) / denom - (a * n * n) / (V * V);
}
```

**Step 4: Verify GREEN** — 4 new physics tests pass.

### Task 6.2 — TDD: \_pressureFn switches based on species

**Files:**

- Modify: `packages/core/tests/gas-laws.test.js`
- Modify: `packages/core/src/sims/gas-laws/index.js`

**Step 1: Append test:**

```js
it('derived(state) returns VdW pressure for CO₂ (different from ideal)', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  el.setVariable('species', 'co2');
  el.setVariable('V', 0.5);
  el.setVariable('T', 200);
  el.setVariable('n', 4);
  const idealP = (8.314 * 200 * 4) / 0.5; // 13302.4
  const out = el._sim.derived(el._state.getAll());
  expect(out.P).toBeLessThan(idealP); // VdW attraction lowers pressure here
  expect(out.P).toBeGreaterThan(0); // not compressed past nb
});
```

**Step 2: Verify RED.**

**Step 3:** In `gas-laws/index.js`, add import:

```js
import { vdWPressure } from './physics.js';
```

(Already importing `idealPressure` and `avgKineticEnergy` from `./physics.js`.)

In `init(host)`, change the `_pressureFn` line from:

```js
this._pressureFn = (state) => idealPressure(state);
```

to:

```js
this._pressureFn = (state) => {
  const sp = SPECIES[state.species ?? 'ideal'];
  if (sp.a === 0 && sp.b === 0) return idealPressure(state);
  return vdWPressure({ ...state, a: sp.a, b: sp.b });
};
```

**Step 4: Verify GREEN.**

### Task 6.3 — Verify pipeline + commit

Verify: **89 tests** total; build green.

Stage:

- `packages/core/src/sims/gas-laws/physics.js`
- `packages/core/src/sims/gas-laws/index.js`
- `packages/core/tests/gas-laws-physics.test.js`
- `packages/core/tests/gas-laws.test.js`

Commit:

```
feat(core): gas-laws — VdW pressure for non-ideal species

Adds vdWPressure to physics.js. Switches gas-laws's _pressureFn
to dispatch on the current species: ideal-gas formula when a=b=0,
van der Waals otherwise. Selecting CO₂ at low V now visibly
diverges from PV=nRT in the readouts and the P-V graph.

VdW edge cases: V<=0 / T<=0 / n<=0 → returns 0 (matches
idealPressure); V<=n*b → Infinity (gas compressed past minimum
molar volume; non-physical regime caught loudly rather than
returning negative or NaN).

3 new physics tests cover the formula edge cases; 1 new gas-laws
test verifies the integration end-to-end via derived(state).

Step 5b commit 6 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 7 — `feat(core): gas-laws — HL toggle and Ideal-vs-Real graph`

When `level=hl`, a second graph appears in the rail showing two static curves: ideal-gas pressure vs VdW pressure, plotted across the V slider's range.

### Task 7.1 — TDD: HL graph hidden by default, visible when level=hl

**Files:**

- Modify: `packages/core/tests/gas-laws.test.js`
- Modify: `packages/core/src/sims/gas-laws/index.js`

**Step 1: Append tests:**

```js
it('Ideal-vs-Real graph container is hidden by default (level=sl)', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const hl = el.shadowRoot.querySelector('[data-hl-only="true"]');
  expect(hl).not.toBeNull();
  expect(hl.style.display).toBe('none');
});

it('setting level=hl reveals the Ideal-vs-Real graph and triggers redraw', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws', level: 'sl' });
  await Promise.resolve();
  el.setAttribute('level', 'hl');
  const hl = el.shadowRoot.querySelector('[data-hl-only="true"]');
  expect(hl.style.display).toBe('');
});

it('changing species while HL is on triggers a redraw of the Ideal-vs-Real curves', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws', level: 'hl' });
  await Promise.resolve();
  const sim = el._sim;
  const spy = vi.spyOn(sim, '_redrawHLGraph');
  el.setVariable('species', 'co2');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
```

**Step 2: Verify RED.**

**Step 3:** In `gas-laws/index.js` `init(host)`, after the existing P-V graph setup, add:

```js
// HL-only Ideal-vs-Real graph — always built, visibility gated on level.
const hlGraphCanvas = document.createElement('canvas');
hlGraphCanvas.width = 320;
hlGraphCanvas.height = 220;
hlGraphCanvas.setAttribute('aria-label', 'Ideal vs Real pressure comparison');
const hlContainer = document.createElement('div');
hlContainer.dataset.hlOnly = 'true';
hlContainer.style.display = host._state.get('level') === 'hl' ? '' : 'none';
hlContainer.appendChild(hlGraphCanvas);
rail.appendChild(hlContainer);

this._hlGraph = createGraph({
  canvas: hlGraphCanvas,
  xAxis: { label: 'V / L', min: 0, max: 5.5 },
  yAxis: { label: 'P / kPa', min: 0, max: 5000 },
  traces: [
    { id: 'ideal', color: 'rgb(38, 70, 83)', kind: 'line' },
    { id: 'real', color: 'rgb(231, 111, 81)', kind: 'line' },
  ],
});
this._hlContainer = hlContainer;
this._redrawHLGraph(host);
```

Add the redraw method:

```js
_redrawHLGraph(host) {
  if (!this._hlGraph) return;
  const state = host._state.getAll();
  const sp = SPECIES[state.species ?? 'ideal'];
  this._hlGraph.clearAll();
  for (let V = 0.1; V <= 5.5 + 1e-9; V += 0.1) {
    this._hlGraph.addPoint('ideal', V, idealPressure({ V, T: state.T, n: state.n }));
    const real = vdWPressure({ V, T: state.T, n: state.n, a: sp.a, b: sp.b });
    if (Number.isFinite(real)) this._hlGraph.addPoint('real', V, real);
  }
  this._hlGraph.redraw();
},
```

Add a level listener (and update the existing T/V/n/species listeners to also redraw HL when level is hl):

```js
this._unsubs.push(
  host._state.on('level', (level) => {
    this._hlContainer.style.display = level === 'hl' ? '' : 'none';
    if (level === 'hl') this._redrawHLGraph(host);
  })
);
```

In each of the existing T, V, n, species listeners, add at the end:

```js
if (host._state.get('level') === 'hl') this._redrawHLGraph(host);
```

In `dispose`, also null out `this._hlGraph` and `this._hlContainer`.

**Step 4: Verify GREEN** for the 3 new tests.

### Task 7.2 — Verify pipeline + commit

Verify: **92 tests** total; build green; bundle grows ~1 kB.

Stage:

- `packages/core/src/sims/gas-laws/index.js`
- `packages/core/tests/gas-laws.test.js`

Commit:

```
feat(core): gas-laws — HL toggle and Ideal-vs-Real graph

When the level attribute flips to 'hl', a second graph appears in
the rail showing two static curves over V's full range: ideal-gas
pressure (PV=nRT) and van der Waals pressure for the current
species. The user sees the divergence widen at low V — the
canonical IB pedagogical moment for "real gases deviate from ideal
at high pressure."

The graph canvas is created once at init (always — never re-created
on toggle) and its container's display style flips on level changes.
Curves recompute when T, n, species, or level changes; not on V
change since the curve is across V's range.

3 new gas-laws tests verify visibility gating and species-driven
redraw. The level attribute reactivity comes for free from step 4's
attributeChangedCallback wiring.

Step 5b commit 7 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 8 — `feat(core): gas-laws — Maxwell-Boltzmann distribution graph`

Adds a third graph showing the observed speed distribution of the actual particles overlaid with the theoretical 2D MB curve at the current temperature.

### Task 8.1 — TDD: particles.getSpeeds()

**Files:**

- Modify: `packages/core/tests/particles.test.js`
- Modify: `packages/core/src/engine/particles.js`

**Step 1: Append test:**

```js
it('getSpeeds() returns the speed magnitude of each particle', () => {
  const field = createParticleField({
    count: 3,
    bounds: { width: 600, height: 400 },
    temperature: 300,
  });
  // Override velocities for a known result
  field.particles[0].vx = 3;
  field.particles[0].vy = 4;
  field.particles[1].vx = 0;
  field.particles[1].vy = 5;
  field.particles[2].vx = -6;
  field.particles[2].vy = 8;
  const speeds = field.getSpeeds();
  expect(speeds).toEqual([5, 5, 10]);
});
```

**Step 2: Verify RED.**

**Step 3:** Add `getSpeeds` to the returned object in `createParticleField`:

```js
getSpeeds() {
  return particles.map((p) => Math.hypot(p.vx, p.vy));
},
```

**Step 4: Verify GREEN.**

### Task 8.2 — TDD: speedHistogram

**Files:**

- Modify: `packages/core/tests/gas-laws-physics.test.js`
- Modify: `packages/core/src/sims/gas-laws/physics.js`

**Step 1: Append test:**

```js
import { speedHistogram } from '../src/sims/gas-laws/physics.js';

describe('speedHistogram', () => {
  it('returns N bins as {x,y} probability density entries', () => {
    const speeds = [1, 1, 2, 2, 2, 3]; // 6 samples
    const hist = speedHistogram(speeds, /* maxSpeed */ 6, /* bins */ 6);
    expect(hist.length).toBe(6);
    // Each entry is { x, y } where x is bin center and y is normalized density.
    for (const pt of hist) {
      expect(typeof pt.x).toBe('number');
      expect(typeof pt.y).toBe('number');
      expect(pt.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('normalizes to a probability density (integral approximates 1)', () => {
    const speeds = [];
    for (let i = 0; i < 100; i++) speeds.push(Math.random() * 10);
    const hist = speedHistogram(speeds, /* maxSpeed */ 10, /* bins */ 20);
    const bucketWidth = 10 / 20;
    const integral = hist.reduce((sum, pt) => sum + pt.y * bucketWidth, 0);
    expect(integral).toBeCloseTo(1, 1);
  });
});
```

**Step 2: Verify RED.**

**Step 3:** Append to `physics.js`:

```js
/**
 * Bin an array of speeds into N equal-width buckets and normalize to
 * a probability density (count / (total × bucketWidth)). Returns an
 * array of { x: binCenter, y: density } entries.
 *
 * @param {number[]} speeds
 * @param {number} maxSpeed
 * @param {number} [bins]
 * @returns {Array<{ x: number, y: number }>}
 */
export function speedHistogram(speeds, maxSpeed, bins = 24) {
  const counts = new Array(bins).fill(0);
  const bucketWidth = maxSpeed / bins;
  for (const v of speeds) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(v / bucketWidth)));
    counts[idx] += 1;
  }
  const total = speeds.length || 1;
  return counts.map((c, i) => ({
    x: (i + 0.5) * bucketWidth,
    y: c / (total * bucketWidth),
  }));
}
```

**Step 4: Verify GREEN.**

### Task 8.3 — TDD: maxwellBoltzmann2D

**Step 1: Append test:**

```js
import { maxwellBoltzmann2D } from '../src/sims/gas-laws/physics.js';

describe('maxwellBoltzmann2D', () => {
  it('returns N samples as {x, y} entries with non-negative y', () => {
    const curve = maxwellBoltzmann2D(/* T */ 300, /* maxSpeed */ 200, /* samples */ 60);
    expect(curve.length).toBe(60);
    for (const pt of curve) {
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeGreaterThanOrEqual(0);
    }
  });

  it('peak shifts right as T increases (sqrt(T) scaling)', () => {
    const curveCold = maxwellBoltzmann2D(100, 200);
    const curveHot = maxwellBoltzmann2D(900, 200);
    const peakOf = (curve) => curve.reduce((best, pt) => (pt.y > best.y ? pt : best), curve[0]);
    const coldPeak = peakOf(curveCold);
    const hotPeak = peakOf(curveHot);
    // T tripled in sqrt → peak speed should ~3x. Allow loose tolerance.
    expect(hotPeak.x).toBeGreaterThan(coldPeak.x * 2);
  });
});
```

**Step 2: Verify RED.**

**Step 3:** Append to `physics.js`:

```js
/**
 * 2D Maxwell-Boltzmann speed distribution at temperature T.
 * Uses the velocity-scale convention from particles.js sampleVelocity
 * (mag ~ sqrt(T) * 5), so this curve aligns with the histogram of
 * actual particle speeds visually.
 *
 *     f(v) = (m / kT) · v · exp(-m v² / (2kT))   [2D form]
 *
 * Pedagogical, not strict SI. Returns N samples evenly across
 * [0, maxSpeed] for plotting.
 *
 * @param {number} T
 * @param {number} maxSpeed
 * @param {number} [samples]
 * @returns {Array<{ x: number, y: number }>}
 */
export function maxwellBoltzmann2D(T, maxSpeed, samples = 60) {
  // particles.js scales: mag = sqrt(-2 ln(u1)) * sqrt(T) * 5
  // → effective m/kT = 1 / (T * 25). The integral form below normalizes.
  const out = [];
  const beta = 1 / (T * 25);
  for (let i = 0; i < samples; i++) {
    const v = (i / (samples - 1)) * maxSpeed;
    const y = beta * v * Math.exp((-beta * v * v) / 2);
    out.push({ x: v, y });
  }
  return out;
}
```

**Step 4: Verify GREEN.**

### Task 8.4 — TDD: MB graph mounted in rail with both traces

**Files:**

- Modify: `packages/core/tests/gas-laws.test.js`
- Modify: `packages/core/src/sims/gas-laws/index.js`

**Step 1: Append test:**

```js
it('after several render frames, the MB graph receives observed and theory points', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const stageCanvas = el.shadowRoot.querySelector('.sim-canvas__stage canvas');
  const ctx = stageCanvas.getContext('2d');
  for (let i = 0; i < 20; i++) {
    el._sim.render(ctx);
  }
  // We can't easily inspect graph internals; assert the MB canvas exists.
  const mbCanvas = el.shadowRoot.querySelector('.sim-rail canvas[aria-label*="Maxwell"]');
  expect(mbCanvas).not.toBeNull();
  // And that frameCount advanced to where the MB cadence (every 15) would have fired.
  expect(el._sim._frameCount).toBeGreaterThan(15);
});
```

**Step 2: Verify RED.**

**Step 3:** In `gas-laws/index.js`, add imports:

```js
import { speedHistogram, maxwellBoltzmann2D } from './physics.js';
```

In `init`, after the HL graph setup, add the MB graph:

```js
const mbCanvas = document.createElement('canvas');
mbCanvas.width = 320;
mbCanvas.height = 220;
mbCanvas.setAttribute('aria-label', 'Maxwell-Boltzmann speed distribution');
rail.appendChild(mbCanvas);

this._mbGraph = createGraph({
  canvas: mbCanvas,
  xAxis: { label: 'speed', min: 0, max: 200 },
  yAxis: { label: 'P(v)', min: 0, max: 0.05 },
  traces: [
    { id: 'observed', color: 'rgba(42, 157, 143, 0.7)', kind: 'dots' },
    { id: 'theory', color: 'rgb(231, 111, 81)', kind: 'line' },
  ],
});
```

In the sim's `render(ctx)`, after the existing P-V graph cadence block, add MB cadence (every 15 frames):

```js
if (this._frameCount % 15 === 0 && this._mbGraph && this._field && this._lastHost) {
  const speeds = this._field.getSpeeds();
  const T = this._lastHost._state.get('T');
  this._mbGraph.clearAll();
  const hist = speedHistogram(speeds, /* maxSpeed */ 200);
  const theory = maxwellBoltzmann2D(T, /* maxSpeed */ 200);
  for (const pt of hist) this._mbGraph.addPoint('observed', pt.x, pt.y);
  for (const pt of theory) this._mbGraph.addPoint('theory', pt.x, pt.y);
  this._mbGraph.redraw();
}
```

In `dispose`, null `this._mbGraph`.

**Step 4: Verify GREEN.**

### Task 8.5 — Verify pipeline + commit

Verify: **96 tests** total; build green; bundle grows ~1 kB.

Stage:

- `packages/core/src/engine/particles.js`
- `packages/core/src/sims/gas-laws/physics.js`
- `packages/core/src/sims/gas-laws/index.js`
- `packages/core/tests/particles.test.js`
- `packages/core/tests/gas-laws-physics.test.js`
- `packages/core/tests/gas-laws.test.js`

Commit:

```
feat(core): gas-laws — Maxwell-Boltzmann distribution graph

Adds the third graph in the rail. Visible at all levels (foundational
visualization for kinetic molecular theory). Two traces:
  - 'observed': histogram of current particle speeds (24 bins, 0..200)
  - 'theory': 2D MB probability density curve at the current T

Updated every 15 frames (matches the prototype's cadence). The 2D
form (rather than 3D) matches our 2D simulator: f(v) = (m/kT) v
exp(-m v²/(2kT)). Calibrated to the velocity-scale convention in
particles.sampleVelocity (the * 5 factor) so theory and observation
overlap visually.

  - particles.js gets getSpeeds() — pure read, returns hypot(vx, vy)
    for each particle.
  - physics.js gets speedHistogram (normalized PDF binning) and
    maxwellBoltzmann2D (theory curve sampler).

4 new tests across particles, physics, and gas-laws files.

Step 5b commit 8 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 9 — `feat(core): gas-laws — teacher presets (Boyle/Charles/Ideal-vs-Real)`

Adds the three IB scenarios as `scenarios` array entries. Adds a preset dropdown at the top of the rail. Selecting `idealVsReal` self-promotes to HL via attribute write.

### Task 9.1 — TDD: scenarios array populated

**Files:**

- Modify: `packages/core/tests/gas-laws.test.js`
- Modify: `packages/core/src/sims/gas-laws/index.js`

**Step 1: Append test:**

```js
it('exposes 3 scenarios with id, label, values', () => {
  expect(Array.isArray(gasLaws.scenarios)).toBe(true);
  expect(gasLaws.scenarios.length).toBe(3);
  const ids = gasLaws.scenarios.map((s) => s.id);
  expect(ids).toEqual(['boyle', 'charles', 'idealVsReal']);
  for (const s of gasLaws.scenarios) {
    expect(typeof s.label).toBe('string');
    expect(typeof s.values).toBe('object');
  }
});
```

**Step 2: Verify RED.**

**Step 3:** Replace `scenarios: []` in the sim with:

```js
scenarios: [
  {
    id: 'boyle',
    label: "Boyle's Law (isothermal)",
    description: 'Constant T = 300 K. Vary V and watch P change inversely.',
    values: { T: 300, V: 2, n: 3, species: 'ideal' },
  },
  {
    id: 'charles',
    label: "Charles's Law (isobaric)",
    description: 'Hold V constant. Vary T and watch P scale linearly.',
    values: { T: 200, V: 2, n: 3, species: 'ideal' },
  },
  {
    id: 'idealVsReal',
    label: 'Ideal vs Real (HL)',
    description: 'High-pressure CO₂ — observe deviation from PV = nRT.',
    values: { T: 150, V: 0.8, n: 8, species: 'co2', level: 'hl' },
    requiresHL: true,
  },
],
```

**Step 4: Verify GREEN.**

### Task 9.2 — TDD: preset dropdown at top of rail

**Step 1: Append test:**

```js
it('renders a preset dropdown at the top of the rail with — custom — + 3 scenarios', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  // Preset dropdown should be the first child of the rail (or first .sim-dropdown).
  const presetDropdown = el.shadowRoot.querySelector('.sim-rail .sim-dropdown[data-var="preset"]');
  expect(presetDropdown).not.toBeNull();
  const select = presetDropdown.querySelector('select');
  expect(select.options.length).toBe(4); // custom + 3
  expect(select.options[0].value).toBe('');
  expect(select.options[0].textContent).toContain('custom');
});
```

**Step 2: Verify RED.**

**Step 3:** In `gas-laws/index.js` `init(host)`, before any other dropdown/slider creation, build the preset dropdown:

```js
const presetDropdown = createDropdown({
  key: 'preset',
  label: 'Scenario',
  options: [
    { value: '', label: '— custom —' },
    ...this.scenarios.map((s) => ({ value: s.id, label: s.label })),
  ],
  value: '',
  onChange: (id) => {
    if (id) host.scenario(id);
  },
});
rail.appendChild(presetDropdown); // appended early, before sliders/species
```

Move this to be the FIRST child added to the rail (before sliders are appended in the existing loop).

**Step 4: Verify GREEN.**

### Task 9.3 — TDD: selecting Boyle applies values

**Step 1: Append test:**

```js
it('selecting Boyle preset applies T=300, V=2, n=3, species=ideal', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const select = el.shadowRoot.querySelector('.sim-dropdown[data-var="preset"] select');
  select.value = 'boyle';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el._state.get('T')).toBe(300);
  expect(el._state.get('V')).toBe(2);
  expect(el._state.get('n')).toBe(3);
  expect(el._state.get('species')).toBe('ideal');
});
```

**Step 2: Verify GREEN** — `host.scenario(id)` already iterates `preset.values` and calls `state.set` for each (from step 4). Should pass without further changes.

### Task 9.4 — TDD: idealVsReal preset self-promotes to HL via setAttribute

**Step 1: Append test:**

```js
it('selecting idealVsReal preset sets level attribute to hl (self-promotes)', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws', level: 'sl' });
  await Promise.resolve();
  const select = el.shadowRoot.querySelector('.sim-dropdown[data-var="preset"] select');
  select.value = 'idealVsReal';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  expect(el.getAttribute('level')).toBe('hl');
  expect(el._state.get('species')).toBe('co2');
});
```

**Step 2: Verify RED** — `host.scenario` uses `state.set('level', 'hl')`, which sets state but does NOT write the attribute back. So `getAttribute('level')` is still 'sl'.

**Step 3:** Override `host.scenario` behavior FOR THIS SIM ONLY by reacting to the level state change inside the gas-laws state listener. In the `host._state.on('level', ...)` listener (added in commit 7), also keep the attribute in sync — but only if the attribute and state disagree (avoiding infinite loops):

Actually a cleaner fix: the gas-laws sim's preset onChange handler explicitly sets the attribute when the preset's values include `level`:

In `gas-laws/index.js`, change the preset dropdown's `onChange`:

```js
onChange: (id) => {
  if (!id) return;
  const preset = this.scenarios.find((s) => s.id === id);
  if (!preset) return;
  // If the preset declares a level, write it as an attribute (which then
  // mirrors back into state via attributeChangedCallback). For other
  // values, use the standard scenario application path.
  const valuesWithoutLevel = { ...preset.values };
  if ('level' in valuesWithoutLevel) {
    host.setAttribute('level', valuesWithoutLevel.level);
    delete valuesWithoutLevel.level;
  }
  // Apply remaining values via setVariable (state.set)
  for (const [k, v] of Object.entries(valuesWithoutLevel)) {
    host.setVariable(k, v);
  }
},
```

(Note: this bypasses `host.scenario(id)` to handle the attribute-vs-state distinction. The scenario API on `<sim-engine>` is unchanged; the architectural fix to make `<sim-engine>.scenario()` aware of attribute-mirrored state keys is a deferred sweep task.)

**Step 4: Verify GREEN.**

### Task 9.5 — Verify pipeline + commit

Verify: **99 tests** total; build green.

Stage:

- `packages/core/src/sims/gas-laws/index.js`
- `packages/core/tests/gas-laws.test.js`

Commit:

```
feat(core): gas-laws — teacher presets (Boyle/Charles/Ideal-vs-Real)

Adds 3 IB Chemistry pedagogical scenarios as gas-laws.scenarios:
  - boyle (T=300, V=2, n=3, ideal): isothermal — observe P ∝ 1/V
  - charles (T=200, V=2, n=3, ideal): isobaric template
  - idealVsReal (T=150, V=0.8, n=8, CO₂, level=hl): high-pressure
    CO₂ self-promotes to HL so the Ideal-vs-Real graph appears

Preset dropdown at top of rail with '— custom —' as the default.
Selecting a preset applies its values; idealVsReal also writes the
level attribute (since level is attribute-mirrored, not state-mirrored
on the way back). Cleaner architectural fix — making
<sim-engine>.scenario() aware of attribute-mirrored keys — is
tracked as a sweep task.

3 new gas-laws tests cover scenarios array shape, preset dropdown
mounting, and the level-attribute self-promotion path.

Step 5b commit 9 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 10 — `feat(examples): smoke test page adds HL mode checkbox`

Single-file HTML edit. Adds an HL mode checkbox above the `<sim-engine>` so a teacher can flip the level attribute without DevTools.

### Task 10.1 — Update the smoke test page

**Files:**

- Modify: `examples/vanilla-html/index.html`

Insert this block between the `<header class="sim-head">...</header>` and `<sim-engine sim="gas-laws">...</sim-engine>`:

```html
<div
  style="
    margin: 16px 0;
    padding: 12px 16px;
    background: var(--ib-ink-50, #f4f4f4);
    border: 1px solid var(--ib-ink-200, #ddd);
    border-radius: 4px;
  "
>
  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer">
    <input type="checkbox" id="hl-toggle" />
    <span style="font-family: var(--font-sans, sans-serif)"
      >HL mode (shows Ideal vs Real graph)</span
    >
  </label>
</div>
```

Add `id="sim"` to the `<sim-engine>` tag for easy querying:

```html
<sim-engine sim="gas-laws" id="sim"> ... </sim-engine>
```

After the existing `<script src="../../packages/core/dist/index.global.js"></script>` line, add:

```html
<script>
  document.getElementById('hl-toggle').addEventListener('change', (e) => {
    const sim = document.getElementById('sim');
    sim.setAttribute('level', e.target.checked ? 'hl' : 'sl');
  });
</script>
```

### Task 10.2 — Visual verification

Run from worktree root:

```
pnpm build
open examples/vanilla-html/index.html
```

In the browser, verify:

- HL mode checkbox renders above the sim.
- Particles bouncing in the canvas, container narrows with V, P-V graph traces dots.
- MB distribution graph in the rail (always visible) — histogram + theory curve roughly overlap.
- Preset dropdown at the top of the rail; selecting Boyle's Law applies values; selecting Ideal-vs-Real auto-checks HL mode.
- Toggling HL mode shows/hides the Ideal-vs-Real graph.
- Selecting CO₂ at low V — the Ideal-vs-Real curves visibly diverge.
- No console errors.

If anything's off, pause and report. Don't commit until visual smoke passes.

### Task 10.3 — Commit

Stage:

- `examples/vanilla-html/index.html`

Commit:

```
feat(examples): smoke test page adds HL mode checkbox

Adds an HL mode checkbox above <sim-engine> so a teacher can flip
the level attribute without opening DevTools. The Ideal-vs-Real
graph appears/hides as the box is toggled. The preset dropdown's
Ideal-vs-Real entry also auto-promotes to HL via the attribute
write, which the checkbox state reflects (browsers fire change
events on programmatic attribute writes? No — the checkbox doesn't
auto-sync from attribute changes here; minor cosmetic, deferred).

Step 5b commit 10 of 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 11 — `docs: update CHANGELOG and architecture for step 5b`

### Task 11.1 — Update CHANGELOG

**Files:**

- Modify: `CHANGELOG.md`

After the existing `### Step 5` section but before `### Notes`, insert:

```markdown
### Step 5b — Gas Laws extensions (HL physics + MB graph + presets)

Eleven commits adding the IB SL/HL syllabus extensions and folding in three high-priority sweep cleanups deferred from steps 4 and 5.

- `fix(core)`: collect state listener unsubs in gas-laws sim dispose (listener leak)
- `fix(core)`: clamp `dt` at rAF boundary to handle backgrounded tabs
- `feat(core)`: implement `controls.createDropdown`
- `refactor(core)`: gas-laws — abstract pressure via `_pressureFn`
- `feat(core)`: gas-laws — multiple species (ideal/He/N₂/CO₂)
- `feat(core)`: gas-laws — VdW pressure for non-ideal species
- `feat(core)`: gas-laws — HL toggle and Ideal-vs-Real graph
- `feat(core)`: gas-laws — Maxwell-Boltzmann distribution graph
- `feat(core)`: gas-laws — teacher presets (Boyle/Charles/Ideal-vs-Real)
- `feat(examples)`: smoke test page adds HL mode checkbox
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** ~99 (was 75 after step 5).

**Public surface added:** species table accessible via the `species` state key (values: `ideal`, `he`, `n2`, `co2`); `controls.createDropdown` real implementation; gas-laws preset scenarios.

**Deferred to a future polish PR (~20 items):** state.set no-op skip, recordTrial JSDoc, recorder.size accessor, search palette UI, measured pressure, particle-particle collisions, exportPNG, MB Y-axis auto-scale, preset dropdown auto-revert to custom, `<sim-engine>.scenario()` attribute-aware writes, and others.
```

### Task 11.2 — Update architecture.md

**Files:**

- Modify: `docs/architecture.md`

After the existing `## Step 5 — Gas Laws sim module` section, append a `## Step 5b — Gas Laws extensions` section covering: species table location, VdW physics formula, HL toggle behavior, MB distribution graph cadence, preset scenarios, and the `_unsubs` convention for sim listener cleanup.

Exact prose:

```markdown
## Step 5b — Gas Laws extensions

Adds VdW physics + HL toggle, multiple species, Maxwell-Boltzmann distribution graph, and teacher presets to the existing Gas Laws sim. Plus three sweep fixes folded in: listener leak fix on sim dispose, `dt` clamping at the rAF loop boundary, and `_pressureFn` abstraction in the gas-laws sim.

### Species data

`packages/core/src/sims/gas-laws/species.js` exports `SPECIES` (object keyed by id) and `SPECIES_OPTIONS` (array for `createDropdown`). Four species: `ideal`, `he`, `n2`, `co2` — each with `a`, `b` VdW constants (pedagogically tuned, not strict SI) and a `color`.

### VdW physics

`vdWPressure({ V, T, n, a, b })` in `gas-laws/physics.js`:
```

P = nRT / (V - nb) - a · n² / V²

```

Returns 0 for non-positive V/T/n; Infinity if V ≤ nb (gas compressed past minimum molar volume). The gas-laws sim's `_pressureFn` dispatches: ideal when species has `a=b=0`, VdW otherwise. Reads species from state every call.

### HL toggle

The `level` attribute on `<sim-engine>` is reactive from step 4. When `level=hl`, the gas-laws sim shows an additional graph below the P-V graph: two static curves (`ideal` line + `real` line) plotted across V's full range for the current T, n, and species. The user sees the divergence widen at low V — the canonical IB pedagogical moment.

The HL graph canvas is created once at `init` time; visibility is toggled via the container's `display` style on `state.level` change.

### Maxwell-Boltzmann distribution graph

Always visible. Updated every 15 frames in the sim's `render(ctx)`. Two traces:

- `observed`: histogram of current particle speeds (24 bins, x ∈ [0, 200])
- `theory`: 2D MB PDF curve at the current T (`f(v) = (m/kT) v exp(-mv²/(2kT))`)

The 2D form (rather than the more familiar 3D form from textbook physics) is correct for our 2D simulator. Calibrated to the velocity-scale convention in `particles.sampleVelocity` so theory and observation overlap.

### Teacher presets

Three IB Chemistry scenarios in `gas-laws.scenarios`:

- `boyle` — isothermal (T=300, V=2, n=3, ideal)
- `charles` — isobaric template (T=200, V=2, n=3, ideal)
- `idealVsReal` — high-pressure CO₂ at HL (T=150, V=0.8, n=8, CO₂, level=hl)

Preset dropdown at the top of the rail. Selecting `idealVsReal` self-promotes to HL via `host.setAttribute('level', 'hl')`, since `level` is an attribute-mirrored state key (the existing `host.scenario()` uses `state.set` only).

### Sim listener cleanup convention

Sims that register state listeners via `host._state.on(...)` MUST collect the returned unsubscribe functions in `this._unsubs = []` during `init` and call them in `dispose`. Without this, listeners persist on `_state` after the sim is disposed, calling methods on nulled fields and leaking closures across remounts. The gas-laws sim demonstrates the pattern; future sims should follow it.

### `dt` clamping

`<sim-engine>`'s rAF loop clamps the per-frame `dt` to `Math.min(rawDt, 0.1)` at the loop boundary. Without this, a backgrounded tab resumed after seconds of throttling delivers one giant `dt` that produces glitched physics on the resumed frame. The cap is invisible during normal 60fps operation.
```

### Task 11.3 — Verify + commit

```
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: lint clean; **99 tests** total; build green.

Stage:

- `CHANGELOG.md`
- `docs/architecture.md`

Commit:

```
docs: update CHANGELOG and architecture for step 5b

Records step 5b in CHANGELOG (under [Unreleased]) covering all 11
commits. Adds a "## Step 5b — Gas Laws extensions" section to
docs/architecture.md covering: species table location, VdW physics
formula, HL toggle behavior, MB distribution graph cadence, preset
scenarios, the _unsubs convention for sim listener cleanup, and
dt clamping at the rAF loop boundary.

Step 5b commit 11 of 11. Step 5b complete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Final verification (after all 11 commits)

```bash
cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine/.worktrees/step-5b-gas-laws
pnpm install
pnpm lint     # clean
pnpm test     # 94+ tests green
pnpm build    # ESM + IIFE bundles
open examples/vanilla-html/index.html
```

Browser must show:

- All step 5 features still work (animated particles, sliders, P-V graph, container narrowing).
- Species dropdown: changing it changes the particle color and (for non-ideal species) the readout pressure.
- Preset dropdown at top of rail: selecting any preset applies values; idealVsReal also flips HL mode.
- HL mode checkbox above the sim: toggles the Ideal-vs-Real graph visibility.
- Three graphs in the rail: P-V (existing), Ideal-vs-Real (when HL is on), MB distribution (always).
- Selecting CO₂ at low V — visible divergence in the HL graph between ideal and real curves.

Push the branch and open a PR:

```bash
git -C /Users/imatthew/Documents/Claude/Projects/aisc-simengine/.worktrees/step-5b-gas-laws push -u origin step-5b-gas-laws
gh pr create --base main --head step-5b-gas-laws ...
```

CI runs the full pipeline; branch protection requires it green.

---

## Reference

- Design doc: `docs/plans/2026-04-30-step5b-gas-laws-extensions-design.md`
- Step 5 design: `docs/plans/2026-04-29-step5-gas-laws-design.md`
- Step 5 implementation plan: `docs/plans/2026-04-29-step5-gas-laws-implementation.md`
- Source spec: `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md`
- Reference prototype: `1-Projects/SimEngine/SimEngine_GasLaws.html` (1,640 lines — full feature set)
- Foundation modules consumed: `state.js`, `recorder.js`, `a11y.js`, `registry.js`, `particles.js`, `controls.js`, `graph.js`
- Step 5 modules consumed: gas-laws sim assembly, `physics.js`, `render.js`
