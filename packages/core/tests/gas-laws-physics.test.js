import { describe, it, expect } from 'vitest';
import {
  R_GAS,
  idealPressure,
  avgKineticEnergy,
  visualParticleCount,
  vdWPressure,
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

describe('vdWPressure', () => {
  it('matches idealPressure when a=0 and b=0', () => {
    const ideal = idealPressure({ V: 1, T: 300, n: 1 });
    const vdw = vdWPressure({ V: 1, T: 300, n: 1, a: 0, b: 0 });
    expect(vdw).toBeCloseTo(ideal, 1);
  });

  it('returns 0 for non-positive inputs', () => {
    expect(vdWPressure({ V: 0, T: 300, n: 1, a: 0.366, b: 0.0429 })).toBe(0);
    expect(vdWPressure({ V: 1, T: 0, n: 1, a: 0.366, b: 0.0429 })).toBe(0);
    expect(vdWPressure({ V: 1, T: 300, n: 0, a: 0.366, b: 0.0429 })).toBe(0);
  });

  it('diverges below ideal at moderate V (attraction-dominated regime) for CO₂', () => {
    // At V=2, T=300, n=2 with CO₂ params (a=366, b=0.0429):
    //   ideal:      nRT/V = 2*8.314*300/2 = 2494.2 kPa
    //   repulsion:  nRT/(V-nb) = 2*8.314*300/(2-0.0858) = 2607.0 kPa
    //   attraction: a·n²/V² = 366*4/4 = 366 kPa
    //   real:       2607.0 - 366 = 2241.0 kPa  (<  ideal)
    const ideal = idealPressure({ V: 2, T: 300, n: 2 });
    const real = vdWPressure({ V: 2, T: 300, n: 2, a: 366, b: 0.0429 });
    expect(real).toBeLessThan(ideal);
  });

  it('returns Infinity when V <= n*b (gas compressed past minimum molar volume)', () => {
    // n*b = 10 * 0.0429 = 0.429; V=0.4 < 0.429
    expect(vdWPressure({ V: 0.4, T: 300, n: 10, a: 366, b: 0.0429 })).toBe(Infinity);
  });
});
