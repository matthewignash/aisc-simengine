# AISC SimEngine

[![CI](https://github.com/matthewignash/aisc-simengine/actions/workflows/ci.yml/badge.svg)](https://github.com/matthewignash/aisc-simengine/actions/workflows/ci.yml)

Interactive IB Chemistry simulations as web components.

> **Status:** Foundation phase (steps 1–3 of 14). The repository scaffold, design system, and engine primitives are in place. The Gas Laws topic page (the v1 deliverable) is not yet built. See `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md` in the IB Chemistry project for the full spec.

## Workspace map

```
aisc-simengine/
├── packages/
│   ├── core/              # @TBD/simengine — web component + engine
│   ├── data/              # @TBD/simengine-data — reference chemistry data
│   └── content-aisc/      # @TBD/content-aisc — topic content (markdown source)
├── examples/
│   └── vanilla-html/      # smoke-test page — loads the design system shell
└── docs/
    ├── architecture.md
    ├── authoring-content.md
    └── data-schema.md
```

> The `@TBD/*` package scope is a placeholder. It will be replaced with the final npm scope before any publish.

## Quickstart

Requires Node ≥ 20 and pnpm 9.

```bash
pnpm install
pnpm test          # vitest, all packages
pnpm build         # vite library build, all packages
pnpm lint          # eslint + prettier check
pnpm format        # prettier write
```

## Foundation phase plan

This repository was scaffolded according to `~/.claude/plans/claude-you-will-see-stateless-nygaard.md` (Approach B — Standard rigor):

1. **Repo scaffold** — pnpm monorepo, three packages, ESLint flat config, Prettier, MIT license.
2. **Design system port** — `tokens.css`, `base.css`, `components.css`, `sim-shell.css` from the AISC design system reference.
3. **Engine skeleton** — clean ports of `state.js` / `recorder.js` / `a11y.js`; typed stubs for `particles.js` / `graph.js` / `controls.js`.

Steps 4–14 (the `<sim-engine>` element, Gas Laws sim, supporting components, content pipeline, teacher view, polish, docs, demo) come in subsequent planning sessions.

## License

Code: MIT (see `LICENSE`).
Content (when present in `packages/content-aisc/`): CC-BY-SA-4.0 — see content package metadata.
