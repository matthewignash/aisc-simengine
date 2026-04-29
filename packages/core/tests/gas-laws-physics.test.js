import { describe, it, expect } from 'vitest';
import {
  R_GAS,
  idealPressure,
  avgKineticEnergy,
  visualParticleCount,
} from '../src/sims/gas-laws/physics.js';

describe('Gas Laws physics', () => {
  it('R_GAS is 8.314', () => {
    expect(R_GAS).toBeCloseTo(8.314, 3);
  });

  it('idealPressure computes nRT/V', () => {
    expect(idealPressure({ V: 1, T: 300, n: 1 })).toBeCloseTo(8.314 * 300, 1);
  });

  it('idealPressure returns 0 for non-positive inputs', () => {
    expect(idealPressure({ V: 0, T: 300, n: 1 })).toBe(0);
    expect(idealPressure({ V: 1, T: 0, n: 1 })).toBe(0);
    expect(idealPressure({ V: 1, T: 300, n: 0 })).toBe(0);
  });

  it('avgKineticEnergy is proportional to T', () => {
    expect(avgKineticEnergy(600) / avgKineticEnergy(300)).toBeCloseTo(2, 3);
  });

  it('visualParticleCount clamps to 4..80 with 12 per mol', () => {
    expect(visualParticleCount(0.1)).toBe(4);
    expect(visualParticleCount(1)).toBe(12);
    expect(visualParticleCount(3)).toBe(36);
    expect(visualParticleCount(100)).toBe(80);
  });
});
