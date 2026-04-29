/**
 * Gas Laws physics — pure functions, no DOM. Step 5 ships ideal gas only.
 */

export const R_GAS = 8.314; // J·K⁻¹·mol⁻¹

/**
 * @param {{ V: number, T: number, n: number }} state
 * @returns {number} pressure in kPa (V in L, T in K, n in mol)
 */
export function idealPressure({ V, T, n }) {
  if (V <= 0 || T <= 0 || n <= 0) return 0;
  return (n * R_GAS * T) / V;
}

/**
 * Mean kinetic energy per particle, in zeptojoules. KE = (3/2) k_B T.
 *
 * @param {number} T
 * @returns {number}
 */
export function avgKineticEnergy(T) {
  const kB = 1.380649e-23;
  return 1.5 * kB * T * 1e21;
}

/**
 * Visual particle count for a given number of moles. 12 per mol, clamped to 4..80.
 *
 * @param {number} n
 * @returns {number}
 */
export function visualParticleCount(n) {
  return Math.max(4, Math.min(80, Math.round(n * 12)));
}

/**
 * Van der Waals pressure: ideal-gas correction for finite particle volume
 * (b) and intermolecular attraction (a). Both species-specific; see
 * species.js. Constants are in our V/P/T/n unit system (kPa·L²·mol⁻² for
 * a, L·mol⁻¹ for b).
 *
 *     P = nRT / (V - nb)  -  a · n² / V²
 *
 * Returns 0 for non-positive V/T/n; Infinity if V <= nb (compressed
 * past minimum molar volume — non-physical regime).
 *
 * @param {{ V: number, T: number, n: number, a: number, b: number }} opts
 * @returns {number} pressure in kPa
 */
export function vdWPressure({ V, T, n, a, b }) {
  if (V <= 0 || T <= 0 || n <= 0) return 0;
  const denom = V - n * b;
  if (denom <= 0) return Infinity;
  return (n * R_GAS * T) / denom - (a * n * n) / (V * V);
}

/**
 * Bin an array of speeds into N equal-width buckets and normalize to a
 * probability density (count / (total × bucketWidth)). Returns an array
 * of { x: binCenter, y: density } entries.
 *
 * @param {number[]} speeds
 * @param {number} maxSpeed
 * @param {number} [bins]
 * @returns {Array<{ x: number, y: number }>}
 */
export function speedHistogram(speeds, maxSpeed, bins = 24) {
  const counts = new Array(bins).fill(0);
  const bucketWidth = maxSpeed / bins;
  for (const v of speeds) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(v / bucketWidth)));
    counts[idx] += 1;
  }
  const total = speeds.length || 1;
  return counts.map((c, i) => ({
    x: (i + 0.5) * bucketWidth,
    y: c / (total * bucketWidth),
  }));
}

/**
 * 2D Maxwell-Boltzmann speed distribution at temperature T.
 * Uses the velocity-scale convention from particles.js sampleVelocity
 * (mag ~ sqrt(T) * 5), so this curve aligns with the histogram of
 * actual particle speeds visually.
 *
 *     f(v) = (m / kT) · v · exp(-m v² / (2kT))   [2D form]
 *
 * Pedagogical, not strict SI. Returns N samples evenly across
 * [0, maxSpeed] for plotting.
 *
 * @param {number} T
 * @param {number} maxSpeed
 * @param {number} [samples]
 * @returns {Array<{ x: number, y: number }>}
 */
export function maxwellBoltzmann2D(T, maxSpeed, samples = 60) {
  // particles.js scales: mag = sqrt(-2 ln(u1)) * sqrt(T) * 5
  // → effective m/kT = 1 / (T * 25). The integral form below normalizes.
  const out = [];
  const beta = 1 / (T * 25);
  for (let i = 0; i < samples; i++) {
    const v = (i / (samples - 1)) * maxSpeed;
    const y = beta * v * Math.exp((-beta * v * v) / 2);
    out.push({ x: v, y });
  }
  return out;
}
