/**
 * 2D graph component with declarative trace support. Linear axes only
 * in step 5; log axes defer to step 5b+.
 */

const PAD = { left: 40, right: 12, top: 12, bottom: 32 };

/**
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   xAxis: { label: string, min: number, max: number, ticks?: number[] },
 *   yAxis: { label: string, min: number, max: number, ticks?: number[] },
 *   traces: Array<{ id: string, color: string, kind?: 'line' | 'dots' }>,
 * }} opts
 */
export function createGraph(opts) {
  const { canvas, xAxis, yAxis, traces: traceDefs } = opts;
  const ctx = canvas.getContext('2d');
  /** @type {Map<string, {color:string, kind:string, points:Array<{x:number,y:number}>}>} */
  const traces = new Map();
  for (const t of traceDefs) {
    traces.set(t.id, { color: t.color, kind: t.kind ?? 'line', points: [] });
  }

  function plotRect() {
    return {
      x: PAD.left,
      y: PAD.top,
      w: canvas.width - PAD.left - PAD.right,
      h: canvas.height - PAD.top - PAD.bottom,
    };
  }

  function project(x, y) {
    const r = plotRect();
    const px = r.x + ((x - xAxis.min) / (xAxis.max - xAxis.min)) * r.w;
    const py = r.y + r.h - ((y - yAxis.min) / (yAxis.max - yAxis.min)) * r.h;
    return {
      px: Math.max(r.x, Math.min(r.x + r.w, px)),
      py: Math.max(r.y, Math.min(r.y + r.h, py)),
    };
  }

  function drawAxes() {
    const r = plotRect();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x, r.y + r.h);
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(xAxis.label, r.x + r.w / 2 - 10, canvas.height - 8);
    ctx.save();
    ctx.translate(12, r.y + r.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yAxis.label, 0, 0);
    ctx.restore();
  }

  function drawTrace(trace) {
    if (trace.points.length === 0) return;
    ctx.strokeStyle = trace.color;
    ctx.fillStyle = trace.color;
    ctx.lineWidth = 1.5;
    if (trace.kind === 'dots') {
      for (const pt of trace.points) {
        const { px, py } = project(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      const first = project(trace.points[0].x, trace.points[0].y);
      ctx.moveTo(first.px, first.py);
      for (let i = 1; i < trace.points.length; i++) {
        const { px, py } = project(trace.points[i].x, trace.points[i].y);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  return {
    addPoint(traceId, x, y) {
      const trace = traces.get(traceId);
      if (!trace) throw new Error(`unknown trace id: ${traceId}`);
      trace.points.push({ x, y });
    },
    clear(traceId) {
      const trace = traces.get(traceId);
      if (trace) trace.points.length = 0;
    },
    clearAll() {
      for (const trace of traces.values()) trace.points.length = 0;
    },
    redraw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawAxes();
      for (const trace of traces.values()) drawTrace(trace);
    },
    exportPNG() {
      return Promise.resolve(null);
    },
  };
}
