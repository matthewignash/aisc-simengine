/**
 * @aisc/simengine — public exports.
 *
 * Step 5 complete. Public surface:
 *   - createState, createRecorder       — foundation factories
 *   - a11y helpers                      — focus trap, screen-reader announce, etc.
 *   - registerSim, lookupSim            — sim registry
 *   - <sim-engine> custom element       — defined as a side effect
 *   - particles, graph, controls        — engine modules (now real, no longer stubs)
 *   - 'gas-laws' sim                    — auto-registered, mount with <sim-engine sim="gas-laws">
 *
 * Future steps add VdW physics, multiple species, MB distribution, presets,
 * supporting components (data pills, coachmarks), content authoring pipeline,
 * and reference data integration.
 */
export { createState } from './engine/state.js';
export { createRecorder } from './engine/recorder.js';
export { registerSim, lookupSim } from './sims/registry.js';

// Side-effect import: defines the <sim-engine> custom element.
import './components/sim-engine.js';
import './components/sim-data-pill.js';

import gasLaws from './sims/gas-laws/index.js';
import { registerSim as _registerForBoot } from './sims/registry.js';
_registerForBoot(gasLaws);

export { prefersReducedMotion, announce, trapFocus, restoreFocusTo } from './engine/a11y.js';

// Engine module namespaces. createParticleField, createGraph, createSlider/createButton, etc.
export * as particles from './engine/particles.js';
export * as graph from './engine/graph.js';
export * as controls from './engine/controls.js';
