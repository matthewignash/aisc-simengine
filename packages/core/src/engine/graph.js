/**
 * 2D real-time graph component.
 *
 * STUB. Real implementation lands in step 5. Legacy logic lives in
 * 3-Resources/SimEngine/SimEngine_Core.js (SimEngine.Graph, lines 638-917)
 * and needs DOM-decoupling before it ports cleanly.
 */

const NOT_IMPLEMENTED = 'graph.js: not implemented — lands in step 5 when Gas Laws consumes it';

/**
 * Construct a graph bound to a canvas element.
 *
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   xAxis: { label: string, min: number, max: number },
 *   yAxis: { label: string, min: number, max: number },
 *   traces: Array<{ id: string, color: string }>
 * }} _opts
 * @returns {{ addPoint(traceId: string, x: number, y: number): void, clear(): void, redraw(): void, exportPNG(): Promise<Blob> }}
 */
export function createGraph(_opts) {
  throw new Error(NOT_IMPLEMENTED);
}
