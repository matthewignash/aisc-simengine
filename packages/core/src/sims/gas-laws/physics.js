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
