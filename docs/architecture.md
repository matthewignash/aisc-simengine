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
