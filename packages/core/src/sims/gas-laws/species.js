/**
 * Gas species table for the Gas Laws sim. Constants are pedagogically
 * tuned (not strict SI) — chosen to produce visible non-ideal behavior
 * in our V/T/n slider ranges. Real-world VdW constants would underflow
 * at the slider scales we use.
 *
 * a, b feed `vdWPressure` from physics.js (lands in commit 6).
 * color is the particle fill color used by particles.render().
 */
export const SPECIES = {
  ideal: { id: 'ideal', label: 'Ideal gas', a: 0, b: 0, color: '#2a9d8f' },
  he: { id: 'he', label: 'He · Helium', a: 0.0035, b: 0.0237, color: '#f4a261' },
  n2: { id: 'n2', label: 'N₂ · Nitrogen', a: 0.137, b: 0.0387, color: '#e76f51' },
  co2: { id: 'co2', label: 'CO₂ · Carbon dioxide', a: 0.366, b: 0.0429, color: '#264653' },
};

/**
 * Convenience: array of {value, label} for createDropdown options.
 */
export const SPECIES_OPTIONS = Object.values(SPECIES).map((s) => ({
  value: s.id,
  label: s.label,
}));
