/**
 * Sim registry — global lookup of registered sim modules.
 *
 * Design note: a single module-level Map is intentionally a global singleton.
 * The `<sim-engine sim="...">` custom element resolves its `sim` attribute
 * against this registry at mount time, so any sim consumed by the page must
 * be registered (via `registerSim`) before the element is upgraded. Per-sim
 * modules live under `packages/sims/<sim-id>/` and call `registerSim` from
 * their own entry point.
 *
 * Tests reset state between suites via {@link clearRegistry} — that helper
 * is intentionally not part of the public package surface (see `index.js`).
 */

/** @type {Map<string, SimModule>} */
const sims = new Map();

const REQUIRED_KEYS = ['id', 'syllabus', 'init', 'controls', 'scenarios'];

/**
 * @typedef {Object} SimModule
 * @property {string} id - Unique sim identifier (matches `<sim-engine sim="...">`).
 * @property {string[]} syllabus - IB syllabus codes this sim addresses.
 * @property {(host: Element) => void} init - Mount entrypoint, called with the host element.
 * @property {Array<unknown>} controls - Control descriptors (shape defined per-sim for now).
 * @property {Array<unknown>} scenarios - Scenario descriptors.
 */

/**
 * Validate that a candidate value is a sim module.
 *
 * @param {unknown} mod
 * @returns {asserts mod is SimModule}
 */
function validateSimShape(mod) {
  if (mod === null || typeof mod !== 'object') {
    throw new Error('registerSim: sim module must be an object');
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in mod)) {
      throw new Error(`registerSim: sim module missing required export "${key}"`);
    }
  }
}

/**
 * Register a sim module under its `id`. Re-registering the same id replaces
 * the previous entry and emits a `console.warn` — useful during HMR but a
 * smell in production builds.
 *
 * @param {SimModule} simModule
 */
export function registerSim(simModule) {
  validateSimShape(simModule);
  if (sims.has(simModule.id)) {
    console.warn(`registerSim: sim "${simModule.id}" is already registered; overwriting`);
  }
  sims.set(simModule.id, simModule);
}

/**
 * Look up a sim module by id. Returns `null` if no module is registered.
 *
 * @param {string} id
 * @returns {SimModule | null}
 */
export function lookupSim(id) {
  return sims.get(id) ?? null;
}

/**
 * Empty the registry. Test-only convenience — not re-exported from the
 * package entry point.
 */
export function clearRegistry() {
  sims.clear();
}
