/**
 * Gas species table for the Gas Laws sim. The `a` and `b` constants are
 * scaled to match our V (in L) / P (in kPa) / T (in K) / n (in mol) unit
 * system: a is in kPa·L²·mol⁻², b is in L·mol⁻¹. These are within the
 * order of magnitude of real-world species constants converted to this
 * unit system, but exact values are pedagogically chosen to produce
 * visible non-ideal behavior in our slider ranges (T 100-1000, V 0.5-5,
 * n 0.5-5).
 *
 * a feeds the attraction term (-a·n²/V²) of vdWPressure; b feeds the
 * repulsion term via (V - n·b).
 *
 * color is the particle fill color used by particles.render().
 */
export const SPECIES = {
  ideal: { id: 'ideal', label: 'Ideal gas', a: 0, b: 0, color: '#2a9d8f' },
  he: { id: 'he', label: 'He · Helium', a: 3.5, b: 0.0237, color: '#f4a261' },
  n2: { id: 'n2', label: 'N₂ · Nitrogen', a: 137, b: 0.0387, color: '#e76f51' },
  co2: { id: 'co2', label: 'CO₂ · Carbon dioxide', a: 366, b: 0.0429, color: '#264653' },
};

/**
 * Convenience: array of {value, label} for createDropdown options.
 */
export const SPECIES_OPTIONS = Object.values(SPECIES).map((s) => ({
  value: s.id,
  label: s.label,
}));
