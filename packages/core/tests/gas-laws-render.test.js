import { describe, it, expect } from 'vitest';
import { drawContainer, drawParticle } from '../src/sims/gas-laws/render.js';

function mockCtx() {
  const calls = [];
  return {
    calls,
    ctx: {
      clearRect: (...a) => calls.push(['clearRect', ...a]),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      strokeRect: (...a) => calls.push(['strokeRect', ...a]),
      fillRect: (...a) => calls.push(['fillRect', ...a]),
      beginPath: () => calls.push(['beginPath']),
      arc: (...a) => calls.push(['arc', ...a]),
      fill: () => calls.push(['fill']),
    },
  };
}

describe('Gas Laws render helpers', () => {
  it('drawContainer strokes a rectangle whose width tracks V/Vmax', () => {
    const { ctx, calls } = mockCtx();
    drawContainer(ctx, { width: 600, height: 400, V: 5, Vmax: 5 });
    const strokes = calls.filter(([fn]) => fn === 'strokeRect');
    expect(strokes.length).toBe(1);
    const [, , , w] = strokes[0];
    expect(w).toBeGreaterThan(500);
  });

  it('drawContainer narrows when V is reduced', () => {
    const { ctx: ctxA, calls: callsA } = mockCtx();
    const { ctx: ctxB, calls: callsB } = mockCtx();
    drawContainer(ctxA, { width: 600, height: 400, V: 5, Vmax: 5 });
    drawContainer(ctxB, { width: 600, height: 400, V: 1, Vmax: 5 });
    const wA = callsA.find(([fn]) => fn === 'strokeRect')[3];
    const wB = callsB.find(([fn]) => fn === 'strokeRect')[3];
    expect(wB).toBeLessThan(wA);
  });

  it('drawParticle issues an arc and fill', () => {
    const { ctx, calls } = mockCtx();
    drawParticle(ctx, { x: 100, y: 100, r: 6 }, { fillStyle: '#abc' });
    expect(calls.find(([fn]) => fn === 'arc')).toBeTruthy();
    expect(calls.find(([fn]) => fn === 'fill')).toBeTruthy();
    expect(ctx.fillStyle).toBe('#abc');
  });
});
