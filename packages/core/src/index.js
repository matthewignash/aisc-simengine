/**
 * @aisc/simengine — public exports.
 *
 * Foundation phase complete (commits 4 + 5):
 *   - createState, createRecorder       — clean ports, fully implemented
 *   - a11y helpers                      — net new, fully implemented
 *   - particles, graph, controls        — typed stubs, throw on call
 *
 * The <sim-engine> custom element and per-sim modules land in steps 4–5
 * of the broader build sequence.
 */
export { createState } from './engine/state.js';
export { createRecorder } from './engine/recorder.js';
export { registerSim, lookupSim } from './sims/registry.js';

export { prefersReducedMotion, announce, trapFocus, restoreFocusTo } from './engine/a11y.js';

// Stub namespaces — every export throws "not implemented" until step 5.
export * as particles from './engine/particles.js';
export * as graph from './engine/graph.js';
export * as controls from './engine/controls.js';
