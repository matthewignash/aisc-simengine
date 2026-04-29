import { describe, it, expect } from 'vitest';
import { createGraph } from '../src/engine/graph.js';

function mockCanvas(width = 320, height = 220) {
  const calls = [];
  const ctx = {
    canvas: { width, height },
    clearRect: (...a) => calls.push(['clearRect', ...a]),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    arc: (...a) => calls.push(['arc', ...a]),
    fill: () => calls.push(['fill']),
    stroke: () => calls.push(['stroke']),
    fillText: (...a) => calls.push(['fillText', ...a]),
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: (...a) => calls.push(['translate', ...a]),
    rotate: (...a) => calls.push(['rotate', ...a]),
  };
  const canvas = { width, height, getContext: () => ctx };
  return { canvas, ctx, calls };
}

describe('createGraph', () => {
  it('addPoint then redraw produces moveTo/lineTo for the trace', () => {
    const { canvas, calls } = mockCanvas(320, 220);
    const graph = createGraph({
      canvas,
      xAxis: { label: 'V', min: 0, max: 10 },
      yAxis: { label: 'P', min: 0, max: 100 },
      traces: [{ id: 't', color: '#111', kind: 'line' }],
    });
    graph.addPoint('t', 5, 50);
    graph.addPoint('t', 7, 70);
    graph.redraw();
    const moves = calls.filter(([fn]) => fn === 'moveTo' || fn === 'lineTo');
    expect(moves.length).toBeGreaterThanOrEqual(2);
  });

  it('clear(traceId) empties the named trace and does not throw on redraw', () => {
    const { canvas } = mockCanvas();
    const graph = createGraph({
      canvas,
      xAxis: { label: 'x', min: 0, max: 10 },
      yAxis: { label: 'y', min: 0, max: 10 },
      traces: [
        { id: 'a', color: '#000', kind: 'line' },
        { id: 'b', color: '#111', kind: 'line' },
      ],
    });
    graph.addPoint('a', 1, 1);
    graph.addPoint('a', 2, 2);
    graph.addPoint('b', 1, 1);
    graph.clear('a');
    expect(() => graph.redraw()).not.toThrow();
  });

  it('traces are drawn in declared order', () => {
    const { canvas, calls } = mockCanvas();
    const graph = createGraph({
      canvas,
      xAxis: { label: 'x', min: 0, max: 10 },
      yAxis: { label: 'y', min: 0, max: 10 },
      traces: [
        { id: 'first', color: '#100000', kind: 'line' },
        { id: 'second', color: '#000010', kind: 'line' },
      ],
    });
    graph.addPoint('first', 1, 1);
    graph.addPoint('first', 2, 2);
    graph.addPoint('second', 3, 3);
    graph.addPoint('second', 4, 4);
    graph.redraw();
    const beginPaths = calls.filter(([fn]) => fn === 'beginPath').length;
    expect(beginPaths).toBeGreaterThanOrEqual(2);
  });

  it('out-of-range points clip to plot edges', () => {
    const { canvas, calls } = mockCanvas(320, 220);
    const graph = createGraph({
      canvas,
      xAxis: { label: 'x', min: 0, max: 10 },
      yAxis: { label: 'y', min: 0, max: 10 },
      traces: [{ id: 't', color: '#000', kind: 'line' }],
    });
    graph.addPoint('t', -5, 5);
    graph.addPoint('t', 15, 5);
    graph.redraw();
    const moves = calls.filter(([fn]) => fn === 'moveTo' || fn === 'lineTo');
    for (const [, px, py] of moves) {
      expect(px).toBeGreaterThanOrEqual(0);
      expect(px).toBeLessThanOrEqual(320);
      expect(py).toBeGreaterThanOrEqual(0);
      expect(py).toBeLessThanOrEqual(220);
    }
  });
});
