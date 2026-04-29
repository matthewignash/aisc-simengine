# Data schema

> **Status: stub.** This document will describe the structure of the reference-data layer in `packages/data/`.

The data schema is **blocked on the reference database drop** — see spec §5. Once that lands, this guide will document:

- The JSON Schema for topic data files (e.g., `topics/s1.5-gas-laws.json`)
- The citation registry format (`sources.json`)
- Source-of-truth precedence: IB Data Booklet 2025 > NIST > others, with explicit flags for non-booklet values so students don't confuse what's allowed in exams
- The `<sim-data-pill ref="...">` contract — every value referenced by a pill must exist in the data file with a valid source
- The `<sim-data-map>` teacher-view flowchart that visualizes how data flowed through a sim session
- CI validation: every data file must conform to schema before merge

Until then, the data package is a placeholder. See the spec at `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md` (§5) for the contract and the open questions on the database drop.
