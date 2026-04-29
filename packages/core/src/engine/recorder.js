/**
 * Trial recorder for SimEngine sims.
 *
 * Each call to {@link createRecorder} produces an isolated recorder. The
 * legacy SimEngine_Core.js had this as SimEngine.DataCollector singleton;
 * the factory pattern here matches the rest of the engine modules so
 * multiple <sim-engine> instances coexist cleanly.
 *
 * Records are pulled from a state-getter callback supplied at construction —
 * the recorder does not import or reach for any global. CSV output is
 * RFC 4180 compliant (CRLF line endings, double-quoted fields containing
 * commas/quotes/newlines).
 */

/**
 * @typedef {Object} RecorderOptions
 * @property {string[]} variables - Ordered list of state keys to record.
 * @property {() => Object<string, unknown>} getState - Returns current state snapshot.
 */

/**
 * @param {RecorderOptions} opts
 */
export function createRecorder({ variables, getState }) {
  /** @type {Array<Object<string, unknown>>} */
  const rows = [];
  let recording = false;

  return {
    startRun() {
      rows.length = 0;
      recording = true;
    },
    stopRun() {
      recording = false;
    },
    record() {
      if (!recording) return;
      const state = getState();
      const row = {};
      for (const key of variables) row[key] = state[key];
      rows.push(row);
    },
    snapshot() {
      return rows.map((row) => ({ ...row }));
    },
    toCSV() {
      const lines = [variables.join(',')];
      for (const row of rows) {
        lines.push(variables.map((key) => formatCSVField(row[key])).join(','));
      }
      return lines.join('\r\n') + '\r\n';
    },
    startSweep(spec) {
      return cartesian(spec);
    },
  };
}

/**
 * Iterate the cartesian product of a parameter spec.
 * Object key declaration order determines axis priority — the last key
 * cycles fastest, the first cycles slowest.
 *
 * @param {Object<string, Array<unknown>>} spec
 * @returns {Generator<Object<string, unknown>>}
 */
function* cartesian(spec) {
  const keys = Object.keys(spec);
  if (keys.length === 0) return;
  const arrays = keys.map((k) => spec[k]);
  const indices = arrays.map(() => 0);
  const last = keys.length - 1;
  while (true) {
    const combo = {};
    for (let i = 0; i < keys.length; i++) combo[keys[i]] = arrays[i][indices[i]];
    yield combo;
    // Increment with carry from rightmost.
    let i = last;
    while (i >= 0) {
      indices[i]++;
      if (indices[i] < arrays[i].length) break;
      indices[i] = 0;
      i--;
    }
    if (i < 0) return;
  }
}

/**
 * Format one field for RFC 4180 CSV output. Quotes the value if it contains
 * a comma, double-quote, or newline. Inner double-quotes are escaped by
 * doubling them.
 *
 * @param {unknown} value
 * @returns {string}
 */
function formatCSVField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
