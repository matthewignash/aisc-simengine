# Architecture

> **Status: stub.** This document will describe the engine architecture, package boundaries, and component lifecycle.

The authoritative spec for the foundation and the broader build sequence currently lives in the IB Chemistry project folder at `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md`. This document will replace that as the architecture-of-record once the build progresses past foundation.

## Foundation phase (current)

The repository is a pnpm workspace with three packages:

- **`packages/core/`** (`@TBD/simengine`) — the web component library and engine primitives. Foundation phase ships:
  - `engine/state.js` — reactive key/value store with pub/sub
  - `engine/recorder.js` — trial recorder + RFC 4180 CSV export
  - `engine/a11y.js` — focus trap, screen-reader announce, reduced-motion helpers
  - `engine/particles.js` / `graph.js` / `controls.js` — typed stubs (throw on call)
  - `styles/` — ported AISC design system (tokens, base, components, sim-shell)
- **`packages/data/`** (`@TBD/simengine-data`) — reference chemistry data (empty stub; lands after the database drop).
- **`packages/content-aisc/`** (`@TBD/content-aisc`) — topic content (empty stub; lands with the content pipeline).

## Out of scope for foundation

- The `<sim-engine>` custom element (step 4)
- Any Gas Laws sim code (step 5)
- Supporting components: `<sim-data-pill>`, `<sim-coachmark>`, etc. (step 6)
- The content authoring pipeline (markdown → HTML, step 8)
- Reference data schema and citations (step 7, blocked on database drop)
- Teacher view and data-source map (step 11)

## Step 4 — `<sim-engine>` custom element

The custom element that orchestrates a sim's lifecycle. Imported as a side effect of `@TBD/simengine` (the package's `index.js` registers the element with the global custom element registry).

### Usage

```html
<sim-engine sim="gas-laws" level="hl" teacher-view>
  <div class="sim-fallback">No-JS fallback content</div>
</sim-engine>
```

```js
import { registerSim } from '@TBD/simengine';
import gasLaws from '@TBD/simengine/sims/gas-laws';

registerSim(gasLaws);
// <sim-engine sim="gas-laws"> now works anywhere on the page.
```

### Lifecycle

1. `constructor` opens an open shadow root, adopts the host + components + sim-shell stylesheets, and renders the static skeleton (`.sim-main`, `.sim-canvas`, `.sim-rail`, `.sim-transport`).
2. `connectedCallback` reads attributes into a fresh `state` store, looks up the sim from the registry, calls `sim.init(host, dataLoader=null)`, instantiates a `recorder` keyed by the sim's `controls`, calls `recorder.startRun()`, and emits `sim-ready`.
3. `attributeChangedCallback` mirrors observed attributes into state. Toggling `level` also emits `level-changed`.
4. `disconnectedCallback` stops the recorder and calls `sim.dispose()` if defined.

### Imperative API

`reset()`, `recordTrial()`, `exportCSV()`, `setVariable(key, value)`, `scenario(presetId)`, `dismissCoachmark(id)`.

### Sim module contract

Required exports: `id`, `syllabus`, `init(host, dataLoader)`, `controls`, `scenarios`. Optional: `step(dt)`, `render(ctx)`, `derived(state)`, `validateTrial(state)`, `dispose()`.

### What's deferred

- Real chemistry sim — Gas Laws lands in step 5.
- `requestAnimationFrame` loop — `<sim-engine>` will own it, calling `sim.step(dt)` and `sim.render(ctx)` per frame, but that wiring lands when the first sim consumes it.
- `dismissCoachmark` real implementation — step 6 (when `<sim-coachmark>` ships).
- Coachmarks, data pills, glossary terms — step 6.
- Real `dataLoader` — step 7, blocked on the database drop.
