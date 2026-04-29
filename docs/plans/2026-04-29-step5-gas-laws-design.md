# Step 5 — Gas Laws sim module — design

**Author:** Matthew Ignash (with Claude planning support)
**Date:** 2026-04-29
**Status:** approved, ready for implementation
**Predecessor:** `docs/plans/2026-04-29-step4-sim-engine-design.md` (step 4 complete; merged in PR #1)
**Source spec:** `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md` §9 step 5
**Reference prototype:** `1-Projects/SimEngine/SimEngine_GasLaws.html` (1,640 lines — full feature set; step 5 ports a subset)

## Context

Step 4 landed the `<sim-engine>` custom element shell — wired to the foundation `state` and `recorder`, mounted via the registry, but with no real sim. Step 5 brings the engine to life: implements the three engine modules left as stubs in foundation (`particles.js`, `controls.js`, `graph.js`), adds a `requestAnimationFrame` loop to `<sim-engine>`, and ports the Gas Laws physics into a real sim module.

The reference prototype is feature-rich (van der Waals, multiple species, Maxwell-Boltzmann distribution, teacher presets, full data collection). Step 5 is **scoped to "Animated with P-V graph"** (Approach C from brainstorming) — the smallest deliverable that demonstrates the full architecture end-to-end without dropping below "feels like a gas sim". HL features, multiple species, and presets are deferred to step 5b.

## Decisions locked during brainstorming

| Decision                    | Choice                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Step 5 scope                | Approach C — animated ideal gas with P-V graph                                       |
| Physics included            | PV=nRT only (no VdW), single species (ideal)                                         |
| Pressure strategy           | Computed via PV=nRT (NOT measured from wall collisions)                              |
| Engine modules to implement | `particles.js`, `controls.js`, `graph.js` (full)                                     |
| Engine modules deferred     | `controls.createDropdown`/`createToggle`/`initKeyboard` (Gas Laws doesn't need them) |
| `<sim-engine>` enhancements | rAF loop with `_startLoop`/`_stopLoop`/`play`/`pause`; reduced-motion painted once   |
| Test approach               | TDD with deterministic injected RNG for particle physics                             |

## Architecture

### File layout (additions)

```
packages/core/
├── src/
│   ├── components/
│   │   └── sim-engine.js           # MODIFY: rAF loop + play/pause
│   ├── engine/
│   │   ├── particles.js            # REPLACE stub
│   │   ├── controls.js             # REPLACE stub (slider+button)
│   │   └── graph.js                # REPLACE stub
│   ├── sims/
│   │   └── gas-laws/               # NEW
│   │       ├── index.js            # registry contract
│   │       ├── physics.js          # PV=nRT, KE math
│   │       └── render.js           # canvas helpers
│   └── index.js                    # MODIFY: registerSim(gasLaws)
└── tests/
    ├── particles.test.js           # NEW (7 tests)
    ├── controls.test.js            # NEW (5 tests)
    ├── graph.test.js               # NEW (4 tests)
    ├── sim-engine.test.js          # MODIFY: +4 rAF tests
    ├── gas-laws.test.js            # NEW (6 tests)
    └── stubs.test.js               # DELETE (no longer stubs)
```

Modified: `examples/vanilla-html/index.html` — mount the working sim.

### Pressure: computed vs measured

The prototype tracks both an instantaneous P (= nRT/V) and a measured P (smoothed wall-collision rate). Step 5 ships only computed P. The particle animation is visual-only, decoupled from the physics readout. Step 5b can add measured P alongside if pedagogically valuable.

## Engine module designs

### `particles.js`

Pure 2D particle physics with elastic wall collisions; randomness is injectable for deterministic tests.

```js
createParticleField({
  count, bounds: { width, height }, temperature,
  rng = Math.random,
}) → { particles, step(dt), render(ctx),
       setCount(n), setTemperature(T), setBounds(b), reseed(seed) }
```

- Each particle: `{ x, y, vx, vy, r }`. Single visual species.
- Initial speed: Maxwell-Boltzmann-shaped via Box-Muller (gaussian magnitude, uniform direction). `setTemperature(T_new)` rescales by `sqrt(T_new / T_old)` to preserve distribution shape.
- `step(dt)`: substep when `dt > 1/60` to prevent tunneling; position update; wall reflection (flip velocity component, clamp position).
- No particle-particle collisions in step 5 — keeps testing tractable.
- `render(ctx)`: `clearRect`, draw container outline, draw particles as filled circles using `var(--chem-500)`.

**Tests (7):** count + bounds, position evolution, wall reflection, temperature rescaling, particle add/remove, deterministic re-seed, substepping under large dt.

### `controls.js`

Minimum viable: slider + button. Dropdown / toggle / `initKeyboard` stay stubbed.

```js
createSlider({ key, label, min, max, step, value, unit, onChange }) → HTMLElement
createButton({ label, variant, onClick, disabled }) → HTMLButtonElement
```

- Slider element matches `sim-shell.html` markup (`.sim-slider` wrapper, `.sim-slider__head`, range input, `.sim-slider__scale`). Existing CSS styles it.
- Keyboard: arrows ±1 step (native), Shift+arrow ±5 steps (custom handler), Home/End min/max (native).
- Button variants: `default`, `primary`, `record` — toggle CSS classes.

**Tests (5):** slider element shape, slider change fires onChange, Shift+arrow ±5×step, button variant class, disabled button doesn't fire.

### `graph.js`

Declarative trace API; sim calls `redraw()` per frame.

```js
createGraph({
  canvas,
  xAxis: { label, min, max, ticks },
  yAxis: { label, min, max, ticks },
  traces: [{ id, color, kind: 'line' | 'dots' }],
}) → { addPoint(traceId, x, y), clear(traceId), clearAll(), redraw(), exportPNG() }
```

- Linear axes only in step 5; log scale defers.
- `exportPNG()` deferred until visual regression infra arrives — return a `Promise.resolve(null)` placeholder.
- Tests use mocked canvas context for determinism (assert call sequences).

**Tests (4):** addPoint+redraw plots at expected pixel; clear empties one trace; multiple traces draw in declared order; out-of-range points clip to plot area.

## `<sim-engine>` rAF loop

New internal fields: `_rafHandle`, `_lastFrameTime`. Two new state keys: `playing: true` (default), `dt: 0`.

```js
_startLoop() {
  if (this._rafHandle != null) return;
  if (prefersReducedMotion()) { this._paintOnce(); return; }
  this._lastFrameTime = performance.now();
  const tick = (now) => {
    if (!this._state.get('playing')) { this._rafHandle = null; return; }
    const dt = (now - this._lastFrameTime) / 1000;
    this._lastFrameTime = now;
    this._state.set('dt', dt);
    this._sim.step?.(dt);
    this._paintOnce();
    this._rafHandle = requestAnimationFrame(tick);
  };
  this._rafHandle = requestAnimationFrame(tick);
}

_stopLoop() { if (this._rafHandle) { cancelAnimationFrame(this._rafHandle); this._rafHandle = null; } }
_paintOnce() {
  const canvas = this.shadowRoot.querySelector('.sim-canvas__stage canvas');
  const ctx = canvas?.getContext('2d');
  if (ctx) this._sim.render?.(ctx);
}

play()  { this._state.set('playing', true); this._startLoop(); }
pause() { this._state.set('playing', false); }
```

`connectedCallback` calls `_startLoop()` after `sim-ready` dispatch. `disconnectedCallback` calls `_stopLoop()` first.

**Reduced-motion respect:** When `prefersReducedMotion()` is true, the sim renders one frame and stops. User can call `play()` to override.

**Tests (4):** `sim.step` called within first rAF tick; `pause()` stops further calls; `play()` resumes; reduced-motion paints once but doesn't loop.

## Gas Laws sim module

### `physics.js` — pure functions

```js
export const R_GAS = 8.314;
export function idealPressure({ V, T, n }) {
  /* nRT/V in kPa */
}
export function avgKineticEnergy(T) {
  /* (3/2) k_B T in zJ */
}
export function visualParticleCount(n) {
  /* clamped 4..80 */
}
```

5 unit tests.

### `render.js` — canvas helpers

```js
export function drawContainer(ctx, { width, height, V, Vmax }) { ... }
export function drawParticle(ctx, particle, { fillStyle }) { ... }
```

3 unit tests with mocked context.

### `index.js` — the sim module

Default export:

```js
{
  id: 'gas-laws',
  syllabus: ['S1.5'],
  controls: [
    { kind: 'slider', key: 'T', label: 'Temperature', min: 100, max: 1000, step: 1, value: 298, unit: 'K' },
    { kind: 'slider', key: 'V', label: 'Volume',      min: 0.5, max: 5,    step: 0.1, value: 2,   unit: 'L' },
    { kind: 'slider', key: 'n', label: 'Moles',       min: 0.5, max: 5,    step: 0.1, value: 1,   unit: 'mol' },
  ],
  scenarios: [],
  init(host) { /* build canvas, particle field, graph, sliders, transport, readouts; wire state listeners */ },
  step(dt)   { this._field.step(dt); },
  render(ctx) { this._field.render(ctx); /* every 10 frames: append P-V point, redraw graph */ },
  derived(state) { return { P: idealPressure(state), KE: avgKineticEnergy(state.T) }; },
  dispose()  { this._field = null; this._graph = null; },
}
```

`init(host)` is the assembly step: it queries `host.shadowRoot` for the shell skeleton elements (`.sim-canvas__stage`, `.sim-rail`, `.sim-transport`, `.sim-readouts`), creates a `<canvas>` for particles, creates a P-V graph canvas in the rail, builds 3 sliders + 4 transport buttons via `controls.js` factories, wires them to `host.setVariable` / `host.play()` / etc., and subscribes to state changes via `host._state.on(...)` to keep readouts and the particle field in sync.

**Registry registration:** `packages/core/src/index.js` adds `import gasLaws from './sims/gas-laws/index.js'; registerSim(gasLaws);` so `<sim-engine sim="gas-laws">` works as a side effect of importing the package.

### Tests (`gas-laws.test.js`, 6)

1. Sim module shape passes `validateSimShape` (registered without throwing).
2. After mount, the rail contains 3 `.sim-slider` elements with the right keys (T, V, n).
3. After mount, readouts show numeric values (not "—") for P, KE, particle count.
4. Moving V slider updates `state.V` AND the displayed P readout.
5. After 10 sim.step + render cycles, P-V graph has at least one point.
6. `derived(state)` returns sensible numbers for known inputs.

## Test count summary

| File                 | Tests                        |
| -------------------- | ---------------------------- |
| `state.test.js`      | 10                           |
| `recorder.test.js`   | 7                            |
| `dom-env.test.js`    | 3                            |
| `registry.test.js`   | 6                            |
| `sim-engine.test.js` | 16 (12 existing + 4 rAF)     |
| `particles.test.js`  | 7                            |
| `controls.test.js`   | 5                            |
| `graph.test.js`      | 4                            |
| `gas-laws.test.js`   | 6                            |
| `stubs.test.js`      | DELETED                      |
| **Total**            | **64** (was 41 after step 4) |

Net new: 23 tests (-3 stubs deleted, +26 added).

## Sequencing — 8 commits

| #   | Commit                                                                 | Verifies                                                                              |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | `feat(core): implement particles.js with elastic wall collisions`      | 7 particle tests + remove particle stub test                                          |
| 2   | `feat(core): implement controls.js with slider and button factories`   | 5 controls tests + remove controls stub test                                          |
| 3   | `feat(core): implement graph.js with declarative traces`               | 4 graph tests + remove graph stub test + delete `stubs.test.js`                       |
| 4   | `feat(core): add rAF loop to <sim-engine> with reduced-motion respect` | +4 sim-engine tests; existing 12 still pass                                           |
| 5   | `feat(core): scaffold gas-laws sim — physics and render helpers`       | 5+3 unit tests; module not yet registered                                             |
| 6   | `feat(core): wire gas-laws sim — controls, readouts, P–V graph`        | 6 integration tests; sim registered; `<sim-engine sim="gas-laws">` renders end-to-end |
| 7   | `feat(examples): mount gas-laws in the smoke test page`                | Browser open: animated particles, sliders, P-V trace                                  |
| 8   | `docs: update CHANGELOG and architecture for step 5`                   | Docs accurate                                                                         |

## Step 5 exit criteria

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — **64 tests green**.
4. `pnpm build` produces ESM + IIFE bundles.
5. `examples/vanilla-html/index.html` (after `pnpm build`) shows: particles animating in the canvas, sliders adjusting state and the visible particle field, P-V graph tracing the user's path through state space, live readouts updating. No console errors.
6. CI green on PR; merged to main.

### What's deferred (correctly NOT in step 5)

- VdW physics or HL toggle
- Multiple gas species (He, N₂, CO₂)
- Maxwell-Boltzmann distribution graph
- Teacher presets (Boyle's, Charles's, Ideal vs Real)
- Search palette UI
- Measured pressure (wall-collision smoothed)
- Particle-particle collisions
- `createDropdown`, `createToggle`, `initKeyboard` factories
- `exportPNG` for graphs
- Reference data integration (step 7, blocked on database drop)
- Full topic page wrap (step 8+)

## Sweep tasks (carried from step 4 + new)

From step 4:

- [ ] `state.set` no-op skip when value unchanged
- [ ] `recordTrial` JSDoc clarifying values is controls-only
- [ ] `connectedCallback` JSDoc on `_initialized` latch behavior
- [ ] Replace `recorder.snapshot().length` in `recordTrial` with cheaper accessor
- [ ] Test for `disconnectedCallback` calling `sim.dispose`
- [ ] `console.warn` in `scenario()` when preset key isn't a declared control
- [ ] Rename `describe('shell scaffolding')` → `describe('shell + lifecycle')`

New for step 5b+:

- [ ] Multiple gas species + VdW corrections
- [ ] HL toggle + Ideal vs Real graph
- [ ] Maxwell-Boltzmann distribution graph
- [ ] Teacher presets
- [ ] Search palette UI
- [ ] Measured pressure alongside computed
- [ ] Particle-particle collisions
- [ ] `createDropdown`, `createToggle`, `initKeyboard` (when next sim or topic page needs them)
- [ ] `exportPNG()` for graph (when visual regression infra arrives)
- [ ] Node.js 20 actions deprecation in CI workflow (June 2026 deadline) — carried from step 4
- [ ] `@TBD/*` package scope rename pre-publish — carried from step 4
