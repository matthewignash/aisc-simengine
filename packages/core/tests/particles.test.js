import { describe, it, expect } from 'vitest';
import { createParticleField } from '../src/engine/particles.js';

describe('createParticleField', () => {
  it('creates the requested number of particles within the bounds', () => {
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const field = createParticleField({
      count: 4,
      bounds: { width: 600, height: 400 },
      temperature: 300,
      rng,
    });
    expect(field.particles.length).toBe(4);
    for (const p of field.particles) {
      expect(p.x).toBeGreaterThanOrEqual(p.r);
      expect(p.x).toBeLessThanOrEqual(600 - p.r);
      expect(p.y).toBeGreaterThanOrEqual(p.r);
      expect(p.y).toBeLessThanOrEqual(400 - p.r);
    }
  });

  it('step(dt) advances each particle by its velocity scaled by dt', () => {
    const field = createParticleField({
      count: 1,
      bounds: { width: 1000, height: 1000 },
      temperature: 300,
    });
    field.particles[0].x = 500;
    field.particles[0].y = 500;
    field.particles[0].vx = 100;
    field.particles[0].vy = 0;
    field.step(0.1);
    expect(field.particles[0].x).toBeCloseTo(510, 1);
  });

  it('reflects velocity when a particle hits a wall', () => {
    const field = createParticleField({
      count: 1,
      bounds: { width: 600, height: 400 },
      temperature: 300,
    });
    field.particles[0].x = 590;
    field.particles[0].y = 200;
    field.particles[0].r = 6;
    field.particles[0].vx = 100;
    field.particles[0].vy = 0;
    field.step(1);
    expect(field.particles[0].vx).toBeLessThan(0);
    expect(field.particles[0].x).toBeLessThanOrEqual(594);
  });

  it('setTemperature rescales velocities by sqrt(T_new/T_old)', () => {
    const field = createParticleField({
      count: 50,
      bounds: { width: 600, height: 400 },
      temperature: 300,
    });
    const before = field.particles.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0) / 50;
    field.setTemperature(1200);
    const after = field.particles.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0) / 50;
    expect(after / before).toBeCloseTo(2, 1);
  });

  it('setCount preserves existing particles and adds/removes from the tail', () => {
    const field = createParticleField({
      count: 4,
      bounds: { width: 600, height: 400 },
      temperature: 300,
    });
    const orig = field.particles.slice(0, 4).map((p) => ({ x: p.x, y: p.y }));
    field.setCount(7);
    expect(field.particles.length).toBe(7);
    for (let i = 0; i < 4; i++) {
      expect(field.particles[i].x).toBe(orig[i].x);
    }
    field.setCount(2);
    expect(field.particles.length).toBe(2);
  });

  it('reseed(seed) produces identical layout for same seed', () => {
    const field = createParticleField({
      count: 5,
      bounds: { width: 600, height: 400 },
      temperature: 300,
    });
    field.reseed(42);
    const a = field.particles.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
    field.reseed(42);
    const b = field.particles.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
    expect(b).toEqual(a);
  });

  it('substeps large dt to prevent tunneling', () => {
    const field = createParticleField({
      count: 1,
      bounds: { width: 600, height: 400 },
      temperature: 300,
    });
    field.particles[0].x = 50;
    field.particles[0].y = 200;
    field.particles[0].r = 6;
    field.particles[0].vx = 1000;
    field.particles[0].vy = 0;
    field.step(1.0);
    expect(field.particles[0].x).toBeGreaterThanOrEqual(field.particles[0].r);
    expect(field.particles[0].x).toBeLessThanOrEqual(600 - field.particles[0].r);
  });
});
