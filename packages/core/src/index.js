/**
 * @aisc/simengine — public exports.
 *
 * Foundation phase, commit 4 of 6: state + recorder land here. The remaining
 * engine modules (a11y real, particles/graph/controls stubs) come in commit 5.
 * The <sim-engine> custom element and per-sim modules land in steps 4–5 of
 * the broader build sequence.
 */
export { createState } from './engine/state.js';
export { createRecorder } from './engine/recorder.js';
