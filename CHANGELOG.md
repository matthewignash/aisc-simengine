# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

Foundation phase (steps 1–3 of the broader build sequence) — six commits:

1. pnpm monorepo scaffold with three packages (`core`, `data`, `content-aisc`), ESLint flat config, Prettier, EditorConfig, MIT license.
2. GitHub Actions CI workflow (lint + test + build on push and PR) plus a status badge on the README.
3. AISC design system port: `tokens.css` (180), `base.css` (96), `components.css` (955), and `sim-shell.css` (486 lines extracted from the design reference HTML). A vanilla-HTML smoke-test page links all four stylesheets.
4. Engine modules `state.js` (pub/sub key/value store) and `recorder.js` (RFC 4180 CSV recorder with cartesian-product parameter sweep), TDD-driven with 17 unit tests.
5. `a11y.js` helpers (`prefersReducedMotion`, `announce`, `trapFocus`, `restoreFocusTo`) and typed stubs for `particles.js` / `graph.js` / `controls.js` that throw "not implemented" on call. Three stub-throw tests bring total to 20.
6. Documentation stubs: `architecture.md`, `authoring-content.md`, `data-schema.md`.

### Step 4 — `<sim-engine>` custom element shell

Five commits adding the orchestrator that mounts a registered sim, manages reactive attributes, instantiates state and recorder, and emits lifecycle events. No real chemistry yet — that's step 5.

- `chore(core)`: happy-dom + vitest test environment
- `feat(core)`: sim registry with shape validation (`registerSim`, `lookupSim`)
- `feat(core)`: `<sim-engine>` shell scaffold (shadow DOM, adopted stylesheets, shell skeleton)
- `feat(core)`: `<sim-engine>` lifecycle wiring (state, recorder, attributes, events, imperative API)
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 41 (20 foundation + 3 dom-env + 6 registry + 12 sim-engine).

**Public surface added to `@TBD/simengine`:** `registerSim`, `lookupSim`, and the `<sim-engine>` custom element registered as a side effect of importing the package.

### Notes

- npm package scope is `@TBD/*` (placeholder). It will be replaced with the final scope before any publish.
- `recorder.download()` from the legacy `SimEngine.DataCollector` is intentionally deferred — it requires a real DOM and lands with browser-level test infrastructure.
- The other 31 prototype sims remain in the IB Chemistry project's legacy SimEngine folder and are out of scope for this repository (see spec §0 non-goals).
