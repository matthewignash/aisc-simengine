# Step-6 follow-ups — design

**Date:** 2026-05-03
**Predecessors:** Step 6 — supporting components (PR #4 / step-6 branch). The two follow-up items deferred since that step ship together here.
**Companion plan:** `docs/plans/2026-05-03-step6-followups-implementation.md` (forthcoming).

---

## Goal

Resolve the two long-deferred items from Step 6:

1. Add public sim-control methods to `<sim-engine>` (`pause`, `resume`, `step`, `redraw`) that downstream consumers need but aren't currently exposed.
2. Investigate whether happy-dom's slot-composition bug (which forced the original `textContent` workaround in `<sim-coachmark>`) has been resolved in the current 15.11.7 patch, and reinstate `<slot>` if so.

Both fit in one PR with two commits. Pre-publish API cleanup before v0.1.0.

---

## Locked decisions

| Decision                                       | Choice                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sim-engine API shape                           | Add 4 new public methods: `pause()`, `resume()`, `step(dt?)`, `redraw()`                               |
| Internal `_startLoop`/`_stopLoop`/`_paintOnce` | Stay private. The new public methods wrap them.                                                        |
| `_renderError`                                 | Stays private (consumer should never call this).                                                       |
| Coachmark slot probe                           | Try `<slot>` against happy-dom 15.11.7. If passes, reinstate. If not, document and defer indefinitely. |
| PR strategy                                    | One PR (#16), two commits — each item in its own commit                                                |
| Test coverage                                  | +6 tests for the new sim-engine methods. +0–2 tests for the coachmark probe (depending on outcome).    |

---

## `<sim-engine>` public-API additions

### `pause()`

Stops the rAF loop. Calls the existing private `_stopLoop()`. Idempotent — calling `pause()` while already paused is a no-op. Records the pause state internally so `resume()` knows to restart.

### `resume()`

Restarts the rAF loop if paused. Calls the existing private `_startLoop()`. Idempotent.

### `step(dt = 1 / 60)`

Advances the simulation by exactly one timestep (default 1/60 second). Calls `sim.step(dt)` once on the current sim module, then `_paintOnce()` to render. Should be safe to call while paused (intended use case: scrubbing through frames). Should also be safe to call while running (less common; advances an extra frame on top of the loop's ongoing ticks).

### `redraw()`

Forces a fresh render of the current state without advancing the sim. Calls `_paintOnce()`. Useful when an external consumer mutates state via `setVariable()` mid-pause and wants the canvas to reflect the change immediately.

### State tracking

A new private `_isPaused` boolean. `pause()` sets it to `true` after stopping the loop; `resume()` sets it to `false` after starting. The existing internal loop machinery doesn't read this flag — it's purely for the new public methods to detect their own state.

### JSDoc

Each new method gets a `@public` tag, parameter docs (where relevant), and a brief description of when to call it. Consumers reading the bundled `.d.ts` (eventually generated from JSDoc) see them as part of the official API.

### Test coverage

6 new tests in `packages/core/tests/sim-engine.test.js`:

1. `pause()` stops the loop (verifiable by mock-counting `requestAnimationFrame` invocations or by checking `_isPaused`).
2. `pause()` is idempotent.
3. `resume()` restarts the loop.
4. `step(dt)` advances by exactly one tick (mock the sim module's `step` method, verify call count + dt argument).
5. `step()` works while paused.
6. `redraw()` calls `_paintOnce` without changing state (mock the sim's `step`, verify it's NOT called; mock `render`, verify it IS called).

Test count: 188 → 194.

---

## `<sim-coachmark>` `<slot>` probe

### Probe test

Add a single new test in `packages/core/tests/sim-coachmark.test.js` that mounts a `<sim-coachmark>` with HTML content (e.g. `<sim-coachmark id="..."><strong>Bold</strong> hint</sim-coachmark>`), then asserts the rendered shadow content includes the strong-tagged text. Use `<slot>` in a stub component to test happy-dom's slot composition support directly.

If the probe passes in happy-dom 15.11.7 → the bug is fixed; reinstate `<slot>` in the real `<sim-coachmark>`. If it fails → document the result, keep the textContent workaround, defer to a future happy-dom upgrade.

### Reinstatement (if the probe passes)

Replace the textContent copy:

```js
// Before
content.textContent = this.textContent;

// After
const slot = document.createElement('slot');
content.appendChild(slot);
```

The HTML host's children get projected into the shadow content via slot semantics. Real browsers and (post-fix) happy-dom both work correctly.

Update the JSDoc header comment to remove the "slot deferred to a follow-up" caveat.

### If the probe fails

Document the result in a single new comment in `<sim-coachmark>` source:

```js
// happy-dom 15.11.7 still does not propagate slotted text through textContent
// reads. Re-test on the next major upgrade. See PR #16 probe.
```

Move the deferred item from "long-deferred step-6 follow-ups" to a more specific "happy-dom slot composition (re-test on upgrade to 16.x or 17.x)" entry.

### Test count impact

- Probe pass: +1 test (the probe itself becomes the regression test for slot composition). Component test counts unchanged.
- Probe fail: +1 test (the probe documents the failure mode). Component test counts unchanged.

Either way: 194 → 195.

---

## Files touched

### Commit 1 — sim-engine public API

| File                                         | Change                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/components/sim-engine.js` | Add `pause()`, `resume()`, `step(dt?)`, `redraw()` methods + `_isPaused` field. Update JSDoc header to list the new public API. |
| `packages/core/tests/sim-engine.test.js`     | +6 tests for the new methods.                                                                                                   |

### Commit 2 — coachmark slot probe + reinstatement

| File                                            | Change                                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/tests/sim-coachmark.test.js`     | +1 probe test for happy-dom slot composition.                                                                                                              |
| `packages/core/src/components/sim-coachmark.js` | If probe passes: replace textContent copy with `<slot>`; update JSDoc to remove the deferred caveat. If probe fails: add a single comment with the result. |

### Common docs (one or both commits)

| File                   | Change                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `CHANGELOG.md`         | New "Step-6 follow-ups (post-10B)" subsection with two bullets (one per commit).                                     |
| `docs/architecture.md` | Update the existing follow-up table; remove the two deferred items if completed; record any happy-dom probe finding. |

---

## Test count target

- Baseline: 188 (post-PR-#13 merge).
- After commit 1: 194 (+6).
- After commit 2: 195 (+1).

---

## Bundle delta

- Commit 1: ~+0.3 kB IIFE for the new methods (small wrappers over existing internal hooks).
- Commit 2: ~+0.05 kB (replacing 1 line with 1–2 lines OR adding 1 comment line).

Total: ~+0.35 kB. Negligible.

---

## Out of scope (explicitly)

- Upgrading happy-dom to 16.x or 17.x. The probe tests against 15.11.7 (current installed version). If the bug persists, the upgrade is a separate decision (other tests may break).
- Renaming `_startLoop`/`_stopLoop`/`_paintOnce`/`_renderError` to public. They stay internal.
- Adding new lifecycle hooks like `onStep`, `onPause`, etc. The current event-based design (`sim-ready`, `level-changed`, etc.) is sufficient.
- Cross-topic portfolio aggregator and shared print-block helper — those remain on the deferred queue.

---

## Risks + mitigations

| Risk                                                                   | Mitigation                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `step(dt)` while not paused causes a frame-doubling / glitchy frame    | Document the behavior explicitly. Acceptable — calling `step()` while running is an unusual use case.                                                                                                                                          |
| `redraw()` called before sim is initialized (during connectedCallback) | Guard with `if (!this._sim) return;` or similar. The existing internal methods already handle this case.                                                                                                                                       |
| Happy-dom probe passes in 15.11.7 but fails in 15.10 or earlier        | The repo pins happy-dom at `^15` which lets npm install any 15.x; we test against 15.11.7. If a downstream user has an older 15.x, they'd see the test fail. Acceptable — the package.json should bump to `>=15.11.7` if we depend on the fix. |
| Reinstating `<slot>` breaks slot-composition assumptions elsewhere     | The `<sim-coachmark>` test suite catches any regression. Manual visual check on the topic page (no current coachmark instances on it, but we can mount one for testing).                                                                       |

The pattern (public-method wrappers around existing private hooks; happy-dom probe before reinstating idiomatic patterns) is reusable for any future deferred item that boils down to "we couldn't do X because of Y; check if Y is fixed yet."
