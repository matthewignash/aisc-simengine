/**
 * Foundation phase stub tests.
 *
 * particles.js / graph.js / controls.js export typed APIs but have no real
 * implementation yet. The test below verifies that calling any of their
 * factory functions throws a clear "not implemented" error so that any
 * accidental consumer in the foundation phase fails loudly rather than
 * silently producing wrong output.
 *
 * These tests will be replaced when the stub modules are implemented in
 * step 5 of the broader build sequence (Gas Laws sim consumes the engine).
 */
import { describe, it, expect } from 'vitest';
import * as particles from '../src/engine/particles.js';
import * as graph from '../src/engine/graph.js';
import * as controls from '../src/engine/controls.js';

describe('particles.js stub', () => {
  it('createParticleField throws "not implemented"', () => {
    expect(() => particles.createParticleField({})).toThrow(/not implemented/);
  });
});

describe('graph.js stub', () => {
  it('createGraph throws "not implemented"', () => {
    expect(() => graph.createGraph({})).toThrow(/not implemented/);
  });
});

describe('controls.js stub', () => {
  it('createSlider throws "not implemented"', () => {
    expect(() => controls.createSlider({})).toThrow(/not implemented/);
  });
});
