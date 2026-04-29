# Step 5b — Gas Laws Extensions — design

**Author:** Matthew Ignash (with Claude planning support)
**Date:** 2026-04-30
**Status:** approved, ready for implementation
**Predecessor:** `docs/plans/2026-04-29-step5-gas-laws-design.md` (step 5 complete; merged in PR #2)

## Context

Step 5 shipped a working ideal-gas Gas Laws sim with animated particles, T/V/n sliders, transport controls, live readouts, and a P-V graph. This step rounds out the sim toward feature parity with the prototype on the IB Chemistry SL/HL syllabus side.

Four feature tracks land in one step, plus the high-priority subset of sweep cleanup deferred from steps 4 and 5. The lower-priority polish items defer further to a future smaller PR.

## Decisions locked during brainstorming

| Decision             | Choice                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| Step 5b scope        | All four tracks: physics + HL, MB graph, presets, sweep cleanup                         |
| Ordering             | Approach A — interleaved: bug fixes / refactors land in the commits that depend on them |
| HL toggle UX         | `level` attribute (already reactive); smoke test page adds a checkbox                   |
| Species selector UX  | Dropdown via new `controls.createDropdown`                                              |
| Preset selector UX   | Dropdown at top of rail; selecting applies values                                       |
| VdW physics scope    | Active whenever the species has non-zero a, b — not gated by HL                         |
| Ideal-vs-Real graph  | Two static curves (ideal / real) over V's full range; recompute on T/n/species change   |
| MB distribution form | 2D form (matches our 2D simulator) — `f(v) = (m/kT) v exp(-mv²/(2kT))`                  |
| MB graph axes        | Fixed: x ∈ [0, 200], y ∈ [0, 0.05]. Auto-scale defers to sweep.                         |
| Pressure measurement | Computed only (instantaneous via formula). Measured (wall-collision smoothed) defers.   |

## Sweep cleanup that lands in step 5b

These were deferred from earlier steps and either gate features or are cheap to fold in:

- **Listener leak fix** (step 5 review) — gas-laws sim discards `host._state.on(...)` unsubscribes. Collect them in `this._unsubs = []` during `init`; call them in `dispose`.
- **`dt` clamping** (step 4 review) — `<sim-engine>` rAF loop computes raw `dt = (now - last) / 1000`. Backgrounded tabs spike `dt`. Clamp to `Math.min(rawDt, 0.1)` at the loop boundary.
- **`_pressureFn` abstraction** (step 5 review) — gas-laws sim's `_updateReadouts` and `derived` both call `idealPressure` directly. Single seam (`this._pressureFn`) enables clean VdW switching.

Sweep items NOT in step 5b stay tracked for a future polish PR. See "What's deferred" at the bottom of this doc.

## Architecture

### File layout (additions)

```
packages/core/
├── src/
│   ├── engine/
│   │   ├── controls.js          # MODIFY: implement createDropdown
│   │   └── particles.js         # MODIFY: render(ctx, opts) takes fillStyle; add getSpeeds()
│   ├── components/
│   │   └── sim-engine.js        # MODIFY: dt clamping, _unsubs convention
│   └── sims/
│       └── gas-laws/
│           ├── index.js         # MODIFY: presets, species, _pressureFn, HL graph, MB graph, dropdowns, _unsubs
│           ├── physics.js       # MODIFY: vdWPressure, speedHistogram, maxwellBoltzmann2D
│           ├── render.js        # unchanged
│           └── species.js       # NEW — species table with VdW params + colors
└── tests/
    ├── sim-engine.test.js       # +2 (listener leak, dt clamp)
    ├── particles.test.js        # +2 (getSpeeds, render fillStyle param)
    ├── controls.test.js         # +4 (createDropdown)
    ├── gas-laws-physics.test.js # +5 (vdW + histogram + MB curve)
    ├── gas-laws.test.js         # +6 (species, vdW switch, HL graph, MB graph, presets, level-via-preset)
```

Modified: `examples/vanilla-html/index.html` — add HL mode checkbox.

### Species data model

`packages/core/src/sims/gas-laws/species.js`:

```js
export const SPECIES = {
  ideal: { id: 'ideal', label: 'Ideal gas', a: 0, b: 0, color: '#2a9d8f' },
  he: { id: 'he', label: 'He · Helium', a: 0.0035, b: 0.0237, color: '#f4a261' },
  n2: { id: 'n2', label: 'N₂ · Nitrogen', a: 0.137, b: 0.0387, color: '#e76f51' },
  co2: { id: 'co2', label: 'CO₂ · Carbon dioxide', a: 0.366, b: 0.0429, color: '#264653' },
};
```

Constants are pedagogically tuned, not strict SI — calibrated to produce visible non-ideal behavior in our V/T/n slider ranges.

### VdW physics formula

In `physics.js`:

```js
export function vdWPressure({ V, T, n, a, b }) {
  if (V <= 0 || T <= 0 || n <= 0) return 0;
  const denom = V - n * b;
  if (denom <= 0) return Infinity; // gas compressed past minimum molar volume
  return (n * R_GAS * T) / denom - (a * n * n) / (V * V);
}
```

Returns kPa for our V/T/n unit system (matches `idealPressure`).

### `_pressureFn` switching in gas-laws/index.js

```js
this._pressureFn = (state) => {
  const sp = SPECIES[state.species ?? 'ideal'];
  if (sp.a === 0 && sp.b === 0) return idealPressure(state);
  return vdWPressure({ ...state, a: sp.a, b: sp.b });
};
```

`_updateReadouts` and `derived` both call `this._pressureFn(state)`. Reading species from state every call means no rebind on species change.

### HL toggle behavior

The `level` attribute is already reactive from step 4 (mirrored into `state.level` and emits `level-changed`). Step 5b adds:

1. The Ideal-vs-Real graph canvas is **always created** (in `init`) but its container element starts with `display: none` if `level=sl`.
2. A `state.on('level', ...)` listener flips the container visibility and triggers a redraw when level becomes `'hl'`.
3. State listeners on T, V, n, species also call `_redrawHLGraph(host)` if level is currently `hl`.

This avoids canvas re-creation on every toggle.

`_redrawHLGraph(host)` plots two static curves over V ∈ [0.1, 5.5] step 0.1: `idealPressure` and `vdWPressure` for the current T, n, species. The user sees the divergence widen at low V (high pressure) — the canonical IB pedagogical moment.

### Maxwell-Boltzmann distribution graph

Always visible (SL and HL). Updated every 15 frames in the sim's `render(ctx)` (matches the prototype's cadence). Two traces:

- `observed` — histogram of current particle speeds (24 bins, 0..200 speed range)
- `theory` — 2D MB PDF curve at the current T

The 2D PDF is `f(v) = (m/kT) · v · exp(-mv²/(2kT))`. Calibrated to match the velocity-scale convention in `particles.js` `sampleVelocity` (the `* 5` factor) so theory and observation overlap visually.

`particles.js` gets a new `getSpeeds()` method returning `particles.map(p => Math.hypot(p.vx, p.vy))`. Pure read.

### Preset scenarios

Three IB Chemistry pedagogical scenarios:

```js
scenarios: [
  { id: 'boyle',       label: "Boyle's Law (isothermal)",
    values: { T: 300, V: 2,   n: 3, species: 'ideal' } },
  { id: 'charles',     label: "Charles's Law (isobaric)",
    values: { T: 200, V: 2,   n: 3, species: 'ideal' } },
  { id: 'idealVsReal', label: 'Ideal vs Real (HL)',
    values: { T: 150, V: 0.8, n: 8, species: 'co2', level: 'hl' },
    requiresHL: true },
],
```

Preset dropdown at the top of the rail (above species). Default is `'— custom —'`. Selecting any non-empty value calls `host.scenario(id)`.

The `level: 'hl'` in `idealVsReal` is special — `level` is an attribute-mirrored state key, so the gas-laws preset application explicitly calls `host.setAttribute('level', preset.values.level)` for that case (other values use plain `state.set`). Defers a cleaner architectural fix (have `<sim-engine>.scenario()` know about attribute-mirrored keys) to a future PR.

`requiresHL` is metadata-only in step 5b — the dropdown shows all options regardless. Selecting `idealVsReal` while in SL self-promotes to HL via the attribute write. Greyed-out UI for unmet `requiresHL` defers.

### `controls.createDropdown` (new)

```js
createDropdown({
  key, label, options: [{ value, label }, ...], value, onChange,
}) → HTMLElement
```

DOM shape: a `.sim-dropdown` wrapper containing a labeled native `<select>`. Native `<select>` for accessibility (keyboard nav + screen reader support are free). Existing `.sim-dropdown` styles in `components.css` apply.

`createToggle` and `initKeyboard` stay stubbed.

### `particles.js` API change

`render(ctx)` becomes `render(ctx, { fillStyle = '#2a9d8f' } = {})`. Backward compatible — gas-laws sim passes the current species color: `this._field.render(ctx, { fillStyle: SPECIES[state.species].color })`.

### Listener-leak fix pattern

In gas-laws `init`:

```js
this._unsubs = [];
this._unsubs.push(host._state.on('T', (T) => { ... }));
this._unsubs.push(host._state.on('V', () => { ... }));
this._unsubs.push(host._state.on('n', (n) => { ... }));
this._unsubs.push(host._state.on('species', (s) => { ... }));
this._unsubs.push(host._state.on('level', (lvl) => { ... }));
```

In `dispose`:

```js
dispose() {
  for (const off of this._unsubs ?? []) off();
  this._unsubs = [];
  this._field = null;
  this._graph = null;
  this._hlGraph = null;
  this._mbGraph = null;
  this._lastHost = null;
  this._pressureFn = null;
}
```

### `dt` clamping in `<sim-engine>`

In `_startLoop`'s tick:

```js
const rawDt = (now - this._lastFrameTime) / 1000;
const dt = Math.min(rawDt, 0.1); // cap at 100ms to handle backgrounded-tab spikes
```

Prevents glitched physics on the resumed frame after a tab switch.

## Sequencing — 11 commits

| #   | Commit                                                                 | Tests added | Cumulative |
| --- | ---------------------------------------------------------------------- | ----------- | ---------- |
| 1   | `fix(core): collect state listener unsubs in gas-laws sim dispose`     | +1          | 76         |
| 2   | `fix(core): clamp dt at rAF boundary to handle backgrounded tabs`      | +1          | 77         |
| 3   | `feat(core): implement controls.createDropdown`                        | +4          | 81         |
| 4   | `refactor(core): gas-laws — abstract pressure via _pressureFn`         | +0          | 81         |
| 5   | `feat(core): gas-laws — multiple species (ideal/He/N₂/CO₂)`            | +4          | 85         |
| 6   | `feat(core): gas-laws — VdW pressure for non-ideal species`            | +4          | 89         |
| 7   | `feat(core): gas-laws — HL toggle and Ideal-vs-Real graph`             | +3          | 92         |
| 8   | `feat(core): gas-laws — Maxwell-Boltzmann distribution graph`          | +4          | 96         |
| 9   | `feat(core): gas-laws — teacher presets (Boyle/Charles/Ideal-vs-Real)` | +3          | 99         |
| 10  | `feat(examples): smoke test page adds HL mode checkbox`                | 0           | 99         |
| 11  | `docs: update CHANGELOG and architecture for step 5b`                  | 0           | 99         |

(Estimates may shift ±1–2 during TDD.)

## Test count summary

End of step 5b: ~94–99 tests (start was 75).

| File             | Step 5 | Step 5b | New    |
| ---------------- | ------ | ------- | ------ |
| state            | 10     | —       | 10     |
| recorder         | 7      | —       | 7      |
| dom-env          | 3      | —       | 3      |
| registry         | 6      | —       | 6      |
| sim-engine       | 16     | +2      | 18     |
| particles        | 9      | +2      | 11     |
| controls         | 5      | +4      | 9      |
| graph            | 4      | —       | 4      |
| gas-laws-physics | 5      | +5      | 10     |
| gas-laws-render  | 3      | —       | 3      |
| gas-laws         | 7      | +6      | 13     |
| **Total**        | **75** | **+19** | **94** |

## Step 5b exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — 94+ tests green.
4. `pnpm build` produces ESM + IIFE; bundles include all new modules.
5. `examples/vanilla-html/index.html` (after `pnpm build`) shows:
   - Animated particles colored by current species (drag the species dropdown — colors change).
   - Container narrows as V decreases (still works).
   - **3 graphs in the rail**: P-V (existing), Ideal-vs-Real (when HL is on), MB distribution (always).
   - **Preset dropdown** at top of rail; selecting applies values across multiple state keys.
   - **HL mode checkbox** above the sim toggles the Ideal-vs-Real graph visibility.
   - Selecting CO₂ at low V visibly diverges from ideal in the HL graph.
6. CI green on PR; merged to main.

## What's still deferred (post-step-5b sweep PR)

Polish items, lower-priority deferrals, and items that don't gate the topic page:

- `state.set` no-op skip
- `recordTrial` JSDoc clarification
- `connectedCallback` JSDoc on `_initialized` latch
- Replace `recorder.snapshot().length` with cheaper accessor
- Test for `disconnectedCallback` calling `sim.dispose`
- `console.warn` in `scenario()` when preset key isn't a control
- Rename `describe('shell scaffolding')` → `'shell + lifecycle'`
- Stronger graph test assertions (exact pixels, trace order)
- Graph clipping policy: clip-or-skip for line traces
- `clear(traceId)` symmetric error handling
- x-axis label centering with `measureText`
- Guard zero/negative plot rect dimensions
- Cache readout `<span>` nodes in gas-laws sim
- Seed initial P-V graph point at end of `init`
- Search palette UI (the prototype's `/` keypress feature)
- Measured pressure (wall-collision smoothed) alongside computed
- Particle-particle collisions (visual realism)
- `createToggle`, `initKeyboard` — when first consumer needs them
- `exportPNG` for graphs
- MB distribution Y-axis auto-scaling
- Preset dropdown reverts to `'— custom —'` when user moves a slider
- `<sim-engine>.scenario()` writes attribute-mirrored state keys via `setAttribute` (architectural)
- `requiresHL` UI enforcement (grey out instead of self-promote)
- `@TBD/*` package scope rename pre-publish
- Node.js 20 actions deprecation in CI workflow

## What you will NOT have at the end of step 5b (and that is correct)

- Search palette UI
- Measured pressure
- Particle-particle collisions
- `<sim-data-pill>` / `<sim-coachmark>` / `<sim-glossary-term>` / `<sim-tweaks-panel>` (step 6)
- Reference data integration (step 7, blocked on database drop)
- The full topic page wrap (step 8 onwards)
