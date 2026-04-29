# Step 4 — `<sim-engine>` custom element shell — design

**Author:** Matthew Ignash (with Claude planning support)
**Date:** 2026-04-29
**Status:** approved, ready for implementation
**Predecessor:** `~/.claude/plans/claude-you-will-see-stateless-nygaard.md` (foundation plan, complete)
**Source spec:** `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md` §2

## Context

The foundation phase landed `state`, `recorder`, `a11y`, and stubbed `particles` / `graph` / `controls` modules across seven commits. CI runs green on `main`; branch is protected. Step 4 of the spec's 14-step build sequence is the `<sim-engine>` custom element shell — the wrapper that orchestrates the engine modules, mounts a sim, manages reactive attributes, and emits lifecycle events. Step 5 (Gas Laws sim module) consumes this shell.

This document captures the design agreed during brainstorming. The implementation plan sits next to it as `2026-04-29-step4-sim-engine-implementation.md` (produced via the writing-plans skill).

## Decisions locked during brainstorming

| Decision     | Choice                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Step 4 scope | Shell only — no real sim mounted                                                                 |
| DOM strategy | Shadow DOM with style adoption (constructable stylesheets)                                       |
| Test setup   | Vitest + happy-dom                                                                               |
| Approach     | Wired shell — instantiates state + recorder, registers fake sim in tests, full lifecycle covered |

## Architecture

### File layout (additions)

```
packages/core/
├── src/
│   ├── components/
│   │   └── sim-engine.js            # the custom element class
│   ├── sims/
│   │   └── registry.js              # registerSim, lookupSim, validateSimShape
│   └── index.js                     # re-exports the new APIs
└── tests/
    ├── sim-engine.test.js           # full lifecycle (12 tests)
    ├── registry.test.js             # registration mechanism (4 tests)
    └── _fixtures/
        └── fake-sim.js              # test-only sim module
```

Modified:

- `packages/core/vite.config.js` — `test.environment: 'happy-dom'`
- `packages/core/package.json` — add `happy-dom` devDep

### Shadow DOM construction

`<sim-engine>` opens a shadow root in `constructor()` and adopts `components.css` and `sim-shell.css` via `shadowRoot.adoptedStyleSheets`. Stylesheets are imported as inline strings (Vite `?inline` query) at module load and used to construct singleton `CSSStyleSheet` instances shared across all instances on the page (no per-instance duplication).

`tokens.css` is **not** adopted — its CSS custom properties cascade through the shadow boundary via inheritance, so the page-level `<link>` to `tokens.css` is sufficient.

`base.css` is also not adopted — body resets don't apply inside a shadow root.

### Internal state model

Inside `connectedCallback`:

```js
this._state = createState({
  level: this.getAttribute('level') ?? 'sl',
  language: this.getAttribute('language') ?? 'default',
  difficulty: this.getAttribute('difficulty') ?? 'standard',
  showGraph: this.hasAttribute('show-graph'),
  showExitTicket: this.hasAttribute('show-exit-ticket'),
  teacherView: this.hasAttribute('teacher-view'),
});

const simModule = lookupSim(this.getAttribute('sim'));
if (!simModule) {
  this._renderError(`Unknown sim id: ${id}`);
  return;
}
this._sim = simModule;
this._sim.init(this, /* dataLoader */ null);
this._recorder = createRecorder({
  variables: simModule.controls.map((c) => c.key),
  getState: () => this._state.getAll(),
});
this._recorder.startRun();
this.dispatchEvent(new CustomEvent('sim-ready', { bubbles: true, composed: true }));
```

### Shell skeleton (rendered into shadow root)

Per spec §3, only the **simulation portion** of `sim-shell.html` lives inside `<sim-engine>`. The outer `.sim-wrap`, `.sim-topstrip`, `.sim-head`, `.sim-lisc`, and post-sim regions are page-level (light DOM, owned by the topic page in step 8).

Inside the shadow root:

- `.sim-main`
  - `.sim-canvas` (`.sim-canvas__head`, `.sim-canvas__stage`, `.sim-readouts`)
  - `.sim-rail` (formula card, controls panel)
- `.sim-transport` (run / pause / step / reset / record buttons)
- `<slot name="exit-ticket"></slot>` (filled in step 6)

The default light-DOM slot is reserved for fallback content; it's hidden via CSS once the element upgrades.

## Public API contract

### Tag and attributes

`<sim-engine>` with these observed attributes:

| Attribute           | Type                                 | Default                       | Reactive |
| ------------------- | ------------------------------------ | ----------------------------- | -------- |
| `sim`               | string                               | required                      | No       |
| `level`             | `sl` \| `hl`                         | `sl`                          | Yes      |
| `language`          | `default` \| `eal`                   | `default`                     | Yes      |
| `difficulty`        | `intro` \| `standard` \| `challenge` | `standard`                    | Yes      |
| `data-source`       | URL                                  | required (deferred to step 7) | No       |
| `show-graph`        | boolean                              | true                          | Yes      |
| `show-exit-ticket`  | boolean                              | true                          | Yes      |
| `show-tweaks-panel` | boolean                              | false                         | No       |
| `teacher-view`      | boolean                              | false                         | Yes      |

### Events emitted

`CustomEvent` with `bubbles: true, composed: true`:

- `sim-ready` — after sim's `init` completes
- `trial-recorded` — `detail: { trialNum, values, derived }`
- `exit-submitted` — `detail: { answers }` (stub for step 6)
- `level-changed` — `detail: { from, to }`
- `coachmark-shown` — `detail: { id }` (stub for step 6)

### Imperative API

- `reset()` — `state.reset()` + `recorder.startRun()`
- `recordTrial()` — `recorder.record()` + emit `trial-recorded`
- `exportCSV()` — returns `recorder.toCSV()`
- `setVariable(key, value)` — `state.set(key, value)`
- `scenario(presetId)` — applies sim's matching preset values
- `dismissCoachmark(id)` — stub for step 6

### Error handling

- Unknown `sim` id → render inline error in shadow root, console.error, do not throw.
- Missing required sim exports → `validateSimShape` throws synchronously at `registerSim` time.
- Methods called before `connectedCallback` → defensive guards return early.

## Sim registration pattern

A global `Map<id, simModule>` populated by explicit `registerSim()` calls.

```js
// packages/core/src/sims/registry.js
const sims = new Map();

export function registerSim(simModule) {
  validateSimShape(simModule);
  if (sims.has(simModule.id)) {
    console.warn(`Sim "${simModule.id}" already registered — overwriting`);
  }
  sims.set(simModule.id, simModule);
}

export function lookupSim(id) {
  return sims.get(id) ?? null;
}

export function clearRegistry() {
  sims.clear();
}

function validateSimShape(mod) {
  const required = ['id', 'syllabus', 'init', 'controls', 'scenarios'];
  for (const key of required) {
    if (!(key in mod)) throw new Error(`Sim module missing required export: ${key}`);
  }
}
```

Required sim module exports: `id`, `syllabus`, `init`, `controls`, `scenarios`.
Optional: `step`, `render`, `derived`, `validateTrial`, `dispose`.

The global-registry choice (vs per-instance config) keeps `<sim-engine sim="gas-laws">` HTML-authorable without requiring the topic page to explicitly pass module references.

## Test plan

### `tests/sim-engine.test.js` (12 tests, TDD)

1. Mounting `<sim-engine sim="fake-sim">` calls `fakeSim.init` exactly once and emits `sim-ready`.
2. Mounting with unknown sim id renders an error in the shadow root and does NOT throw.
3. `level` attribute is reflected into state; changing it fires `level-changed`.
4. Setting `teacher-view` attribute updates `state.teacherView`.
5. `element.setVariable('T', 350)` updates state; listeners fire.
6. `element.recordTrial()` appends a row and emits `trial-recorded`.
7. After two `recordTrial()` calls, `element.exportCSV()` returns a 2-row CSV with the right values.
8. `element.scenario('cold')` applies the preset values to state.
9. `element.reset()` restores initial state and starts a fresh recorder run.
10. `disconnectedCallback` stops the recorder and clears listeners.
11. Adopted stylesheets are present on the shadow root after mount.
12. Shell skeleton DOM (`.sim-main`, `.sim-canvas`, `.sim-rail`, `.sim-transport`) exists in shadow root.

### `tests/registry.test.js` (4 tests, TDD)

1. `registerSim` + `lookupSim` round-trips a valid module.
2. `registerSim` throws when required keys are missing.
3. Re-registering the same id warns but does not throw.
4. `clearRegistry` empties the registry.

### `tests/_fixtures/fake-sim.js`

Test-only sim module that implements the registry contract with deterministic, side-effect-free behavior. Tracks call counts on a shared `fakeSimCalls` object so tests can assert lifecycle hooks fire in the right order. `derived(state)` returns `{ sum: state.T + state.V }` — arbitrary, deterministic, just enough to verify wiring.

**Total new tests: 16. Combined with foundation: 36 tests.**

## Sequencing — 5 reviewable commits

| #   | Commit message                                                               | Contents                                                                                                                                              | Verifies                                                        |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | `chore(core): add happy-dom and configure vitest test environment`           | `happy-dom` devDep, `test.environment: 'happy-dom'`, one DOM-touch sanity test                                                                        | `pnpm test` green; happy-dom wired                              |
| 2   | `feat(core): add sim registry with shape validation`                         | `src/sims/registry.js`, `tests/registry.test.js` (4 TDD tests), index.js re-export                                                                    | Registry tests green; full pipeline green                       |
| 3   | `feat(core): scaffold <sim-engine> shell with shadow DOM and adopted styles` | `src/components/sim-engine.js` (constructor, shadow root, adopted stylesheets, observed attributes, attribute mirroring stubs), tests 11–12 from plan | Two sim-engine tests green; bundle includes adopted stylesheets |
| 4   | `feat(core): wire <sim-engine> lifecycle to state, recorder, and sim module` | `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`, imperative API. Tests 1–10 from plan with fake sim                           | All 12 sim-engine tests green; full suite at 36                 |
| 5   | `docs: update CHANGELOG and architecture.md for step 4`                      | CHANGELOG entry; architecture.md "Step 4" section                                                                                                     | Docs accurate; PR-able state                                    |

## Step 4 exit criteria

Foundation-style verification on a fresh clone:

1. `pnpm install` succeeds (lockfile includes `happy-dom`).
2. `pnpm lint` clean.
3. `pnpm test` — **36 tests green** (20 foundation + 16 new).
4. `pnpm build` produces ESM + IIFE bundles including inlined component/shell stylesheets and registry + sim-engine code.
5. Mounting `<sim-engine sim="fake-sim">` in a browser via the smoke-test page (after `registerSim(fakeSim)`) renders the shell layout with AISC styling, no console errors.
6. From the browser console: `element.setVariable('T', 350); element.recordTrial(); element.exportCSV()` returns the expected CSV.
7. CI green on `main` (branch ruleset already in place).

### Out of scope for step 4

- Real chemistry sim (Gas Laws lands in step 5)
- Animated canvas (waiting on `step` / `render` from a real sim)
- Working slider widgets (`controls.js` is still a stub from foundation)
- Coachmarks, data pills, glossary terms (step 6)
- Content authoring pipeline (step 8)
- Reference data integration (step 7, blocked on database drop)

## Sweep tasks (later phases)

- [ ] Reconsider `?inline` CSS imports vs `?url` + `<link>` tags inside shadow root if bundle size grows.
- [ ] Wire a real `dataLoader` argument into `sim.init(host, dataLoader)` once `packages/data/` lands (step 7).
- [ ] Decide whether `<sim-engine>` owns the `requestAnimationFrame` loop (default plan: yes — calls `sim.step(dt)` and `sim.render(ctx)` each frame). Implement when the first sim consumes it.
