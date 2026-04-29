# Step 4 — `<sim-engine>` Custom Element Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the `<sim-engine>` custom element shell — a wired orchestrator that mounts a registered sim, manages reactive attributes, instantiates state + recorder, and emits lifecycle events. No real chemistry yet (Gas Laws is step 5).

**Architecture:** Vanilla custom element (`class extends HTMLElement`) with shadow DOM and adopted constructable stylesheets. A global `Map`-based sim registry decouples `<sim-engine sim="...">` from explicit module wiring. Tests use Vitest + happy-dom and a fake-sim fixture that implements the registry contract deterministically.

**Tech Stack:** Vanilla JS (ES2022, ESM), Vite library mode, Vitest, happy-dom. Pinned versions in `packages/core/package.json`.

**Companion design doc:** `docs/plans/2026-04-29-step4-sim-engine-design.md` (read this first for "why" decisions; this plan covers "exactly what to type").

**Repo state at start:** `main` is at `75f4e36` (foundation complete + this plan's design doc landed). Branch is protected (CI required green to merge). 20 tests passing.

**Standards:**

- TDD: every implementation line has a failing test that drove it. Use the `superpowers:test-driven-development` skill.
- Safe DOM: build skeleton DOM via `<template>` + `content.cloneNode(true)` (or `document.createElement` chains). Avoid setting `.innerHTML` on the live shadow root.
- Conventional commits: `chore`, `feat`, `docs` prefixes; subject under 72 chars.
- No git config edits — all commits use env vars `GIT_AUTHOR_NAME` / `_EMAIL` / `GIT_COMMITTER_NAME` / `_EMAIL`.
- Push only at end of step 4 (or per natural review checkpoint), one shot. Branch protection requires CI green.

---

## Commit 1 — Add happy-dom and configure vitest test environment

### Task 1.1: Install happy-dom

**Files:**

- Modify: `packages/core/package.json`

**Step 1: Add the devDep**

```bash
cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine
pnpm --filter @TBD/simengine add -D happy-dom@^15
```

Expected: `pnpm-lock.yaml` updates; `packages/core/package.json` gains `"happy-dom": "^15.x.y"` under `devDependencies`.

**Step 2: Verify install**

Run: `pnpm install`
Expected: "Done in N s" with no errors.

### Task 1.2: Wire happy-dom into vitest

**Files:**

- Modify: `packages/core/vite.config.js`

**Step 1: Update test config**

In `packages/core/vite.config.js`, change the `test` block's `environment` from `'node'` to `'happy-dom'`. The other fields (`globals`, `include`) stay the same.

### Task 1.3: TDD — sanity test for happy-dom

**Files:**

- Create: `packages/core/tests/dom-env.test.js`

**Step 1: Write the failing test**

The test asserts three things:

1. `document.createElement('div')` works (basic DOM).
2. `customElements.define` is a function (custom element support).
3. A shadow root supports `adoptedStyleSheets` and accepts a `CSSStyleSheet` constructed via `replaceSync`.

Use `vitest`'s `describe`/`it`/`expect`. The test exercises the DOM APIs directly with no module imports beyond vitest itself.

**Step 2: Run test to verify it passes**

Run: `cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine/packages/core && pnpm vitest run tests/dom-env.test.js`
Expected: PASS — 3 tests green. (If the environment is misconfigured the failure is loud — `document is not defined` or similar.)

### Task 1.4: Verify full pipeline

**Step 1: Run lint, test, build from repo root**

Run: `cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine && pnpm lint && pnpm test && pnpm build`
Expected:

- Lint clean
- Test count: **23** (20 foundation + 3 dom-env)
- Build green

If lint complains about formatting, run `pnpm format` then re-check.

### Task 1.5: Commit

Stage these files: `packages/core/package.json`, `packages/core/vite.config.js`, `packages/core/tests/dom-env.test.js`, `pnpm-lock.yaml`.

Commit message:

```
chore(core): add happy-dom and configure vitest test environment

Sets up the DOM-aware test environment needed for <sim-engine> shell
testing in step 4. happy-dom provides custom elements, shadow DOM, and
constructable stylesheets without launching a real browser.

Step 4 commit 1 of 5.
```

Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Use env-var attribution as in foundation commits.

Push not required between commits; one push at the end of step 4.

---

## Commit 2 — Sim registry with shape validation

### Task 2.1: TDD — registerSim + lookupSim round-trip

**Files:**

- Create: `packages/core/tests/registry.test.js`

**Step 1: Write the failing test**

The test imports `registerSim`, `lookupSim`, and `clearRegistry` from `../src/sims/registry.js`. A `minimalValidSim()` helper returns an object with the five required fields: `id`, `syllabus`, `init`, `controls`, `scenarios`. Inside a `describe('sim registry', ...)`:

- `beforeEach(() => clearRegistry())`
- Test: `registerSim` followed by `lookupSim('test-sim')` returns the same module reference.
- Test: `lookupSim('does-not-exist')` returns `null`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/registry.test.js`
Expected: FAIL — "Failed to load url ../src/sims/registry.js".

**Step 3: Create the registry module**

Create `packages/core/src/sims/registry.js` with:

- A module-level `const sims = new Map()`.
- `export function registerSim(simModule)` — calls `validateSimShape(simModule)`; if `sims.has(simModule.id)`, `console.warn(...)`; sets in map.
- `export function lookupSim(id)` — returns `sims.get(id) ?? null`.
- `export function clearRegistry()` — `sims.clear()`. Documented as test-only.
- `function validateSimShape(mod)` — throws if `mod` is not an object; throws if any of `['id', 'syllabus', 'init', 'controls', 'scenarios']` is missing. Error messages must match the regexes used by the validation tests below.

Module-level JSDoc explains the global-singleton design choice and points at the design doc.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/registry.test.js`
Expected: PASS — 2 tests green.

### Task 2.2: TDD — validateSimShape rejects missing keys

**Files:**

- Modify: `packages/core/tests/registry.test.js`

**Step 1: Append the failing tests**

Inside the existing `describe('sim registry', ...)`:

- Test: An object missing `controls` and `scenarios` (but with `id`, `syllabus`, `init`) — `expect(() => registerSim(broken)).toThrow(/missing required export/)`.
- Test: `null` and a string each throw `/must be an object/`.

**Step 2: Run test to verify it passes**

Run: `pnpm vitest run tests/registry.test.js`
Expected: PASS — 4 tests green. (No impl change needed; validation already wired in 2.1.)

### Task 2.3: TDD — re-register warns but does not throw

**Files:**

- Modify: `packages/core/tests/registry.test.js`

**Step 1: Append the failing test**

Add `vi` to the vitest imports. The test:

- Spies on `console.warn` with `vi.spyOn(console, 'warn').mockImplementation(() => {})`.
- Registers v1 (a `minimalValidSim()` with an extra `label: 'v1'` field).
- Registers v2 (same id, `label: 'v2'`); asserts no throw.
- Asserts the spy was called with a string containing `'already registered'`.
- Asserts `lookupSim('test-sim').label === 'v2'`.
- Restores the spy.

**Step 2: Run test to verify it passes**

Run: `pnpm vitest run tests/registry.test.js`
Expected: PASS — 5 tests green.

### Task 2.4: TDD — clearRegistry empties

**Files:**

- Modify: `packages/core/tests/registry.test.js`

**Step 1: Append the failing test**

The test registers a minimal sim, asserts `lookupSim` returns it, calls `clearRegistry()`, asserts `lookupSim` now returns `null`.

**Step 2: Run test to verify it passes**

Run: `pnpm vitest run tests/registry.test.js`
Expected: PASS — 6 tests green.

### Task 2.5: Re-export from index.js

**Files:**

- Modify: `packages/core/src/index.js`

**Step 1: Add the re-export**

After the existing `createRecorder` re-export, add:

```js
export { registerSim, lookupSim } from './sims/registry.js';
```

`clearRegistry` is intentionally NOT re-exported — test-only.

**Step 2: Verify build still works**

Run: `pnpm build`
Expected: bundle sizes increase slightly, build green.

### Task 2.6: Commit

Stage: `packages/core/src/sims/registry.js`, `packages/core/src/index.js`, `packages/core/tests/registry.test.js`.

Commit message:

```
feat(core): add sim registry with shape validation

Global Map<id, simModule> populated by explicit registerSim() calls.
<sim-engine sim="..."> will look up modules here at mount time.

  - registerSim(mod)     — validates shape, registers, warns on overwrite
  - lookupSim(id)        — returns module or null
  - clearRegistry()      — test-only convenience (not in public surface)
  - validateSimShape     — rejects missing required keys (id, syllabus,
                           init, controls, scenarios) and non-objects

6 tests, TDD-driven.

Step 4 commit 2 of 5.
```

---

## Commit 3 — `<sim-engine>` shell scaffold (shadow DOM + adopted styles)

This commit creates the test fixture, then scaffolds the custom element constructor with shadow DOM, adopted stylesheets, and the static shell skeleton. Lifecycle wiring lands in commit 4.

### Task 3.1: Create the fake sim test fixture

**Files:**

- Create: `packages/core/tests/_fixtures/fake-sim.js`

**Step 1: Write the fixture**

The module exports:

- `fakeSimCalls` — a mutable record `{ init: 0, step: 0, render: 0, derived: 0, validateTrial: 0 }`.
- `resetFakeSimCalls()` — zeroes every counter on `fakeSimCalls`.
- `default` — a sim module with:
  - `id: 'fake-sim'`
  - `syllabus: ['TEST.0']`
  - `init(host)` — increments `fakeSimCalls.init`, sets `host._fakeHostRef = host`
  - `step(_dt)` — increments `fakeSimCalls.step`
  - `render(_ctx)` — increments `fakeSimCalls.render`
  - `controls` — two slider declarations (`T` 0–1000 default 298, `V` 0.1–50 default 6.4)
  - `scenarios` — `cold` (T=100), `hot` (T=500)
  - `derived(state)` — increments counter; returns `{ sum: (state.T ?? 0) + (state.V ?? 0) }`
  - `validateTrial(state)` — increments counter; returns `{ valid: state.T > 0, message }`

JSDoc header explains: test-only fixture, deterministic, side-effect-free, designed to verify the shell's wiring without depending on real physics.

### Task 3.2: TDD — adopted stylesheets present on shadow root

**Files:**

- Create: `packages/core/tests/sim-engine.test.js`

**Step 1: Write the failing test**

Imports: `describe`, `it`, `expect`, `beforeEach` from vitest. `registerSim`, `clearRegistry` from registry. `fakeSim` (default) from the fixture. Side-effect import: `'../src/components/sim-engine.js'`.

`describe('<sim-engine> — shell scaffolding', ...)` with:

- `beforeEach`: `clearRegistry()`, `registerSim(fakeSim)`, clear `document.body`.
- Test: After mounting `<sim-engine sim="fake-sim">`, `el.shadowRoot` is truthy AND `el.shadowRoot.adoptedStyleSheets.length > 0`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js`
Expected: FAIL — "Failed to load url ../src/components/sim-engine.js".

**Step 3: Create the sim-engine module skeleton**

Create `packages/core/src/components/sim-engine.js`. The module:

- Imports CSS as inline strings via Vite's `?inline` query: `componentsCss` from `'../styles/components.css?inline'` and `simShellCss` from `'../styles/sim-shell.css?inline'`.
- At module load, constructs three singleton `CSSStyleSheet` instances using `new CSSStyleSheet()` + `replaceSync(...)`:
  - `hostSheet` — `:host { display: block; } :host([hidden]) { display: none; }`
  - `componentsSheet` — the contents of `componentsCss`
  - `simShellSheet` — the contents of `simShellCss`
- Defines a `<template>` element at module load that holds the static shell skeleton: `<div class="sim-main"><div class="sim-canvas"><div class="sim-canvas__head"></div><div class="sim-canvas__stage"></div><div class="sim-readouts"></div></div><aside class="sim-rail"></aside></div><div class="sim-transport"></div><slot name="exit-ticket"></slot>`. (Template is a `<template>` element in module scope; setting its content via the template API rather than touching the live shadow root with markup.)
- Defines `class SimEngineElement extends HTMLElement`:
  - `static get observedAttributes()` returns `['sim', 'level', 'language', 'difficulty', 'show-graph', 'show-exit-ticket', 'teacher-view']`.
  - `constructor()`: calls `super()`, attaches an open shadow root, sets `root.adoptedStyleSheets = [hostSheet, componentsSheet, simShellSheet]`, appends `template.content.cloneNode(true)` to the shadow root.
- Conditionally defines the element: `if (!customElements.get('sim-engine')) customElements.define('sim-engine', SimEngineElement);` so re-imports during tests are idempotent.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js`
Expected: PASS — 1 test green.

### Task 3.3: TDD — shell skeleton DOM exists in shadow root

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`

**Step 1: Append the failing test**

The test mounts `<sim-engine sim="fake-sim">` and asserts that `shadowRoot.querySelector` finds non-null elements for each of `.sim-main`, `.sim-canvas`, `.sim-rail`, and `.sim-transport`.

**Step 2: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js`
Expected: PASS — 2 tests green. (Skeleton already in `constructor`.)

### Task 3.4: Re-export from index.js + verify build

**Files:**

- Modify: `packages/core/src/index.js`

**Step 1: Add the side-effect import**

After the registry re-export, add:

```js
// Side-effect import: defines the <sim-engine> custom element.
import './components/sim-engine.js';
```

**Step 2: Verify everything builds and tests pass**

Run: `cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine && pnpm format && pnpm lint && pnpm test && pnpm build`
Expected:

- Lint clean
- Tests: **31** (23 from commit 1 + 6 registry + 2 sim-engine)
- Build green; `dist/index.global.js` size grows because the inlined CSS is now in the bundle.

### Task 3.5: Commit

Stage: `packages/core/src/components/sim-engine.js`, `packages/core/src/index.js`, `packages/core/tests/sim-engine.test.js`, `packages/core/tests/_fixtures/fake-sim.js`.

Commit message:

```
feat(core): scaffold <sim-engine> shell with shadow DOM and adopted styles

Vanilla custom element. Constructor opens an open shadow root, adopts
three constructable stylesheets (host, components.css, sim-shell.css)
shared as singletons across all instances, and renders the simulation-
portion shell skeleton (.sim-main, .sim-canvas, .sim-rail, .sim-transport)
via a <template> + cloneNode pattern. Slot reserved for the exit
ticket (filled in step 6).

Lifecycle wiring (state, recorder, sim init, events, imperative API)
lands in the next commit. This commit is intentionally render-only.

Includes the fake-sim test fixture used by step 4 and step 5 tests.

Step 4 commit 3 of 5.
```

---

## Commit 4 — Wire `<sim-engine>` lifecycle to state, recorder, and sim module

This is the largest commit by test count (10 new tests, all TDD). Each subtask adds one test and the minimum implementation to pass it.

### Task 4.1: TDD — sim.init called once, sim-ready emitted

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append the failing test**

Update the test imports to include `resetFakeSimCalls` and `fakeSimCalls` from `./_fixtures/fake-sim.js`. Add `resetFakeSimCalls()` to the existing `beforeEach`. The test:

- Attaches a one-shot `sim-ready` listener to `document.body`.
- Mounts `<sim-engine sim="fake-sim">`.
- `await Promise.resolve()` to let microtasks settle.
- Asserts `fakeSimCalls.init === 1` and that exactly one `sim-ready` event fired.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js -t "sim-ready"`
Expected: FAIL — `fakeSimCalls.init` is `0`.

**Step 3: Add `connectedCallback` to sim-engine.js**

Import the engine deps at the top of `sim-engine.js`:

```js
import { createState } from '../engine/state.js';
import { createRecorder } from '../engine/recorder.js';
import { lookupSim } from '../sims/registry.js';
```

Inside `SimEngineElement`, add `connectedCallback()`:

- Guard: if `this._initialized`, return. Set `this._initialized = true`.
- Create `this._state` via `createState({...})` reading from the six reactive attributes (`level` default `'sl'`, `language` default `'default'`, etc.).
- Look up the sim by `this.getAttribute('sim')`. If `null`, call `this._renderError(\`Unknown sim id: "${id}"\`)` and return early.
- Store `this._sim = simModule`.
- Call `this._sim.init(this, /* dataLoader */ null)`.
- Create `this._recorder = createRecorder({ variables: simModule.controls.map(c => c.key), getState: () => this._state.getAll() })`.
- Call `this._recorder.startRun()`.
- Dispatch `new CustomEvent('sim-ready', { bubbles: true, composed: true })`.

Add `_renderError(message)` method:

- Find `.sim-canvas__stage` in the shadow root.
- Set its `textContent` to `message` (NOT `innerHTML` — text only, safe).
- Set `role="alert"` on it.
- `console.error(\`<sim-engine>: ${message}\`)`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "sim-ready"`
Expected: PASS.

### Task 4.2: TDD — unknown sim id renders error, does not throw

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`

**Step 1: Append the failing test**

Add `vi` to the test imports. The test:

- Spies `console.error` with `vi.spyOn(...).mockImplementation(() => {})`.
- Wraps mounting `<sim-engine sim="does-not-exist">` in `expect(() => ...).not.toThrow()`.
- Queries `.sim-canvas__stage` from the shadow root; asserts `textContent` matches `/unknown sim id/i` and `getAttribute('role') === 'alert'`.
- Asserts the spy was called.
- Restores the spy.

**Step 2: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "unknown"`
Expected: PASS — error path already implemented in 4.1.

### Task 4.3: TDD — `level` attribute reflects to state and emits level-changed

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append the failing test**

The test:

- Mounts `<sim-engine sim="fake-sim" level="sl">`.
- Awaits a microtask; asserts `el._state.get('level') === 'sl'`.
- Adds a `level-changed` listener that pushes `e.detail` into an array.
- Calls `el.setAttribute('level', 'hl')`.
- Asserts `el._state.get('level') === 'hl'` AND the array is `[{ from: 'sl', to: 'hl' }]`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js -t "level-changed"`
Expected: FAIL — state not updated, no event dispatched.

**Step 3: Implement attributeChangedCallback**

Inside `SimEngineElement`, add `attributeChangedCallback(name, oldValue, newValue)`:

- Guard: if `!this._initialized || !this._state`, return (skips the initial parse pass during upgrade).
- A `switch (name)` block handling each reactive attribute:
  - `'level'` — `this._state.set('level', newValue)`; dispatch a `level-changed` `CustomEvent` with `detail: { from: oldValue, to: newValue }`, `bubbles: true`, `composed: true`.
  - `'language'`, `'difficulty'` — `this._state.set(camelCaseKey, newValue)`.
  - `'show-graph'`, `'show-exit-ticket'`, `'teacher-view'` — boolean: `this._state.set(camelCaseKey, newValue !== null)`.
- `'sim'` is intentionally NOT reactive — set once at mount.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "level-changed"`
Expected: PASS.

### Task 4.4: TDD — boolean attribute (teacher-view)

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`

**Step 1: Append the failing test**

The test mounts `<sim-engine sim="fake-sim">`, awaits, asserts `_state.get('teacherView') === false`. Then `setAttribute('teacher-view', '')` — asserts `true`. Then `removeAttribute('teacher-view')` — asserts `false`.

**Step 2: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "teacher-view"`
Expected: PASS — already wired in 4.3.

### Task 4.5: TDD — setVariable updates state

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append the failing test**

The test:

- Mounts and awaits.
- Subscribes to `'T'` via `el._state.on('T', v => calls.push(v))`.
- Calls `el.setVariable('T', 350)`.
- Asserts `el._state.get('T') === 350` AND `calls === [350]`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js -t "setVariable"`
Expected: FAIL — `el.setVariable is not a function`.

**Step 3: Add the imperative method**

Inside `SimEngineElement`, add `setVariable(key, value)` that guards on `this._state` and delegates to `this._state.set(key, value)`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "setVariable"`
Expected: PASS.

### Task 4.6: TDD — recordTrial emits trial-recorded

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append the failing test**

The test:

- Mounts and awaits.
- Calls `el.setVariable('T', 350)` and `el.setVariable('V', 8)`.
- Adds a `trial-recorded` listener that captures `e.detail`.
- Calls `el.recordTrial()`.
- Asserts the captured detail matches `{ trialNum: 1, values: { T: 350, V: 8 }, derived: { sum: 358 } }`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js -t "recordTrial"`
Expected: FAIL — `el.recordTrial is not a function`.

**Step 3: Add the imperative method**

Inside `SimEngineElement`, add `recordTrial()`:

- Guard on `this._recorder && this._sim`.
- Call `this._recorder.record()`.
- Compute `values` by filtering `this._state.getAll()` to keys present in `new Set(this._sim.controls.map(c => c.key))`.
- Compute `derived` by calling `this._sim.derived(allState)` if it's a function, else `{}`.
- Compute `trialNum = this._recorder.snapshot().length`.
- Dispatch `trial-recorded` `CustomEvent` with `detail: { trialNum, values, derived }`, `bubbles: true`, `composed: true`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "recordTrial"`
Expected: PASS.

### Task 4.7: TDD — exportCSV after multiple trials

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append the failing test**

The test:

- Mounts and awaits.
- `setVariable('T', 298)`, `setVariable('V', 6.4)`, `recordTrial()`.
- `setVariable('T', 350)`, `recordTrial()` (V unchanged).
- Asserts `el.exportCSV()` equals `'T,V\r\n298,6.4\r\n350,6.4\r\n'`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js -t "exportCSV"`
Expected: FAIL — `el.exportCSV is not a function`.

**Step 3: Add the method**

Add `exportCSV()` that returns `this._recorder.toCSV()` if `this._recorder` exists, else `''`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "exportCSV"`
Expected: PASS.

### Task 4.8: TDD — scenario applies preset

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append the failing test**

The test mounts and awaits, then calls `el.scenario('cold')` and asserts `_state.get('T') === 100`. Then `scenario('hot')` and asserts `T === 500`.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js -t "scenario"`
Expected: FAIL — `el.scenario is not a function`.

**Step 3: Add the method**

Add `scenario(id)`:

- Guard on `this._sim && this._state`.
- Find `preset = this._sim.scenarios.find(s => s.id === id)`.
- If none, `console.warn(...)` and return.
- For each `[k, v]` in `Object.entries(preset.values)`, call `this._state.set(k, v)`.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "scenario"`
Expected: PASS.

### Task 4.9: TDD — reset restores initial state and starts a fresh recorder run

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append the failing test**

The test:

- Mounts `<sim-engine sim="fake-sim" level="hl">`, awaits.
- `setVariable('T', 999)`, `recordTrial()`.
- Asserts `exportCSV()` split on `\r\n` filtered for truthy has length 2 (header + 1 row).
- Calls `el.reset()`.
- Asserts `_state.get('level') === 'hl'` (initial seed preserved).
- Asserts `_state.get('T')` is `undefined` (T was a `setVariable` add, not in initial seed).
- Asserts `exportCSV()` equals `'T,V\r\n'` (header only after reset).

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js -t "reset"`
Expected: FAIL — `el.reset is not a function`.

**Step 3: Add the method**

Add `reset()` that calls `this._state.reset()` and `this._recorder.startRun()`, each guarded on existence.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "reset"`
Expected: PASS.

### Task 4.10: TDD — disconnectedCallback stops recorder

**Files:**

- Modify: `packages/core/tests/sim-engine.test.js`
- Modify: `packages/core/src/components/sim-engine.js`

**Step 1: Append the failing test**

The test:

- Mounts `<sim-engine sim="fake-sim">`, awaits.
- `recordTrial()`; asserts `exportCSV().split('\r\n').filter(Boolean).length === 2`.
- `el.remove()` (triggers `disconnectedCallback`).
- Calls `el._recorder.record()` directly.
- Asserts `el._recorder.snapshot().length === 1` — unchanged because `stopRun` made `record` a no-op.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sim-engine.test.js -t "disconnect"`
Expected: FAIL — recorder still records.

**Step 3: Add disconnectedCallback**

Add to `SimEngineElement`:

- `disconnectedCallback()`:
  - If `this._recorder`, call `this._recorder.stopRun()`.
  - If `this._sim` has a function `dispose`, call it inside a try/catch (log to console.error on throw — defensive against buggy sims).

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sim-engine.test.js -t "disconnect"`
Expected: PASS.

### Task 4.11: Full pipeline verification

**Step 1: Run lint, format, test, build**

Run: `cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine && pnpm format && pnpm lint && pnpm test && pnpm build`
Expected:

- Lint clean
- **Tests: 41** total
  - 20 foundation
  - 3 dom-env (commit 1)
  - 6 registry (commit 2)
  - 12 sim-engine (2 from commit 3 + 10 from commit 4)
- Build green

### Task 4.12: Commit

Stage: `packages/core/src/components/sim-engine.js`, `packages/core/tests/sim-engine.test.js`.

Commit message:

```
feat(core): wire <sim-engine> lifecycle to state, recorder, and sim module

Adds connectedCallback, attributeChangedCallback, disconnectedCallback,
and the imperative API:
  - setVariable(key, value)
  - recordTrial()        — emits trial-recorded with values + derived
  - exportCSV()
  - scenario(id)         — applies sim's preset
  - reset()              — state.reset + recorder.startRun

Lifecycle: connectedCallback initializes state from attributes, looks
up the sim from the registry, runs sim.init, instantiates the recorder
with sim.controls.map(c => c.key) as variables, and emits sim-ready.

Reactive attributes (level, language, difficulty, show-graph,
show-exit-ticket, teacher-view) flow through attributeChangedCallback
into state. Toggling level emits level-changed.

Unknown sim ids render an inline error in the shadow root and log to
console; they do NOT throw.

10 new tests using the fake-sim fixture. Step 4 commit 4 of 5.
```

---

## Commit 5 — Documentation

### Task 5.1: Update CHANGELOG

**Files:**

- Modify: `CHANGELOG.md`

**Step 1: Add a step-4 section under [Unreleased]**

After the existing foundation phase entry, insert a "Step 4 — `<sim-engine>` custom element shell" section that:

- Lists the five commits in order with one-line descriptions.
- Reports the new test count: **41 (20 foundation + 3 dom-env + 6 registry + 12 sim-engine)**.
- States the public surface added to `@TBD/simengine`: `registerSim`, `lookupSim`, and the `<sim-engine>` custom element registered as a side effect of importing the package.

### Task 5.2: Update architecture.md

**Files:**

- Modify: `docs/architecture.md`

**Step 1: Add a step-4 section**

After the existing "Foundation phase (current)" section, add a "Step 4 — `<sim-engine>` custom element" section covering:

- Usage example (HTML mounting + `registerSim` JS).
- Lifecycle: constructor (shadow root + adopted styles + skeleton clone), connectedCallback (state init, sim lookup, sim.init, recorder, sim-ready), attributeChangedCallback (mirrors observed attrs into state, emits level-changed for `level`), disconnectedCallback (recorder.stopRun, sim.dispose if present).
- Imperative API: `reset`, `recordTrial`, `exportCSV`, `setVariable`, `scenario`, `dismissCoachmark`.
- Sim module contract: required exports (`id`, `syllabus`, `init`, `controls`, `scenarios`); optional (`step`, `render`, `derived`, `validateTrial`, `dispose`).
- "What's deferred": real chemistry sim (step 5), rAF loop, coachmarks/data pills/glossary terms (step 6), real `dataLoader` (step 7).

### Task 5.3: Verify docs are well-formed

**Step 1: Format and lint**

Run: `pnpm format && pnpm lint`
Expected: Lint clean.

### Task 5.4: Commit

Stage: `CHANGELOG.md`, `docs/architecture.md`.

Commit message:

```
docs: update CHANGELOG and architecture for step 4

Records the <sim-engine> shell landing in CHANGELOG (under
[Unreleased]) and replaces the "Foundation phase only" stub in
docs/architecture.md with usage, lifecycle, imperative API, and the
sim module contract.

Step 4 commit 5 of 5. Step 4 complete.
```

---

## Final verification (after all 5 commits)

```bash
cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine
pnpm install
pnpm lint     # clean, zero warnings
pnpm test     # 41 tests green
pnpm build    # ESM + IIFE bundles
```

Browser-level smoke (manual):

1. Build the package, then load `dist/index.global.js` from any HTML page that also links the four CSS files.
2. Before the `<sim-engine>` mounts, register a tiny demo sim via `SimEngine.registerSim({...})` with `id: 'demo'`, `syllabus: ['DEMO']`, `init() {}`, one slider in `controls`, and an empty `scenarios` array.
3. Add `<sim-engine sim="demo" teacher-view></sim-engine>` to the body.
4. Open in a browser → see the `.sim-main` / `.sim-canvas` / `.sim-rail` / `.sim-transport` skeleton with AISC styling inside the shadow root, no console errors.

Push all five commits with `git push origin main`. CI runs the full pipeline; branch protection requires it green.

---

## Reference

- Design doc: `docs/plans/2026-04-29-step4-sim-engine-design.md`
- Foundation plan: `~/.claude/plans/claude-you-will-see-stateless-nygaard.md`
- Source spec: `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md` (§2 + §3)
- Foundation modules used: `packages/core/src/engine/{state,recorder,a11y}.js`
