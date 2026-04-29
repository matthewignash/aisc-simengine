import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerSim, lookupSim, clearRegistry } from '../src/sims/registry.js';

const minimalValidSim = () => ({
  id: 'test-sim',
  syllabus: ['TEST.0'],
  init: () => {},
  controls: [],
  scenarios: [],
});

describe('sim registry', () => {
  beforeEach(() => clearRegistry());

  it('registerSim + lookupSim round-trips a valid module', () => {
    const sim = minimalValidSim();
    registerSim(sim);
    expect(lookupSim('test-sim')).toBe(sim);
  });

  it('lookupSim returns null for unknown ids', () => {
    expect(lookupSim('does-not-exist')).toBe(null);
  });

  it('throws when a required key is missing', () => {
    const broken = { id: 'broken', syllabus: ['T'], init: () => {} };
    // missing controls and scenarios
    expect(() => registerSim(broken)).toThrow(/missing required export/);
  });

  it('throws on non-object input', () => {
    expect(() => registerSim(null)).toThrow(/must be an object/);
    expect(() => registerSim('not a sim')).toThrow(/must be an object/);
  });

  it('re-registering the same id warns but does not throw, and the new module wins', () => {
    const v1 = { ...minimalValidSim(), label: 'v1' };
    const v2 = { ...minimalValidSim(), label: 'v2' };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerSim(v1);
    expect(() => registerSim(v2)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already registered'));
    expect(lookupSim('test-sim').label).toBe('v2');
    warnSpy.mockRestore();
  });

  it('clearRegistry empties the registry', () => {
    registerSim(minimalValidSim());
    expect(lookupSim('test-sim')).not.toBe(null);
    clearRegistry();
    expect(lookupSim('test-sim')).toBe(null);
  });
});
