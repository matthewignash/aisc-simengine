import core from './core.json';
import sources from './sources.json';
import glossary from './glossary.json';

/**
 * Look up a numeric reference value by id.
 *
 * @param {string} ref
 * @returns {{ value: number, unit: string, symbol?: string, name?: string, source: string, description?: string } | null}
 */
export function getValue(ref) {
  return core.values[ref] ?? null;
}

/**
 * Look up a citation source by id.
 *
 * @param {string} sourceId
 * @returns {{ label: string, section?: string, url?: string, license: string } | null}
 */
export function getSource(sourceId) {
  return sources.sources[sourceId] ?? null;
}

/**
 * Look up a glossary term by id.
 *
 * @param {string} ref
 * @returns {{ term: string, definition: string } | null}
 */
export function getGlossaryTerm(ref) {
  return glossary.terms[ref] ?? null;
}

/**
 * Returns the full core data graph (for tests and step 7 expansion).
 */
export function loadCore() {
  return core;
}

/**
 * Returns the full sources graph.
 */
export function loadSources() {
  return sources;
}

/**
 * Returns the full glossary graph.
 */
export function loadGlossary() {
  return glossary;
}

/**
 * Validate the data files for internal consistency: every value entry's
 * `source` must reference an existing source id. Throws on first violation.
 *
 * @throws {Error}
 */
export function validate() {
  for (const [ref, entry] of Object.entries(core.values)) {
    if (typeof entry.value !== 'number') {
      throw new Error(`Data entry "${ref}" missing/invalid value`);
    }
    if (!sources.sources[entry.source]) {
      throw new Error(`Data entry "${ref}" references unknown source "${entry.source}"`);
    }
  }
}

// Run validation at import time so consumers fail fast on data corruption.
validate();
