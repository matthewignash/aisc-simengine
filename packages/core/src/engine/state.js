/**
 * Reactive key/value state store with pub/sub semantics.
 *
 * Each call to {@link createState} produces an isolated store. The legacy
 * SimEngine_Core.js exposed a single global SimEngine.State; this factory
 * pattern allows multiple <sim-engine> instances to coexist on a page
 * without cross-contamination.
 */

/**
 * Create a new isolated state store.
 *
 * @param {Object<string, unknown>} [initial] - Initial key/value snapshot.
 * @returns {{
 *   get(key: string): unknown,
 *   set(key: string, value: unknown): void,
 *   on(key: string, listener: (...args: unknown[]) => void): () => void,
 *   emit(key: string, ...args: unknown[]): void,
 *   getAll(): Object<string, unknown>,
 *   reset(): void,
 * }}
 */
export function createState(initial = {}) {
  const seed = { ...initial };
  const data = { ...initial };
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  function fire(key, args) {
    const subs = listeners.get(key);
    if (subs) {
      for (const fn of subs) fn(...args);
    }
  }

  return {
    get(key) {
      return data[key];
    },
    set(key, value) {
      data[key] = value;
      fire(key, [value]);
    },
    on(key, listener) {
      let subs = listeners.get(key);
      if (!subs) {
        subs = new Set();
        listeners.set(key, subs);
      }
      subs.add(listener);
      return () => subs.delete(listener);
    },
    emit(key, ...args) {
      fire(key, args);
    },
    getAll() {
      return { ...data };
    },
    reset() {
      const changedKeys = [];
      for (const key of Object.keys(data)) {
        if (data[key] !== seed[key]) changedKeys.push(key);
      }
      // Restore stored values to the seed snapshot.
      for (const key of Object.keys(data)) delete data[key];
      Object.assign(data, seed);
      // Fire listeners for keys whose value changed.
      for (const key of changedKeys) fire(key, [data[key]]);
    },
  };
}
