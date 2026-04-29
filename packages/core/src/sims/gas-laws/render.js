/**
 * Canvas rendering helpers for the Gas Laws sim.
 */

const CONTAINER_MARGIN_X = 30;
const CONTAINER_MARGIN_Y = 30;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width: number, height: number, V: number, Vmax: number }} opts
 */
export function drawContainer(ctx, { width, height, V, Vmax }) {
  const innerW = width - 2 * CONTAINER_MARGIN_X;
  const drawW = (V / Vmax) * innerW;
  ctx.strokeStyle = 'rgba(13, 24, 51, 0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(CONTAINER_MARGIN_X, CONTAINER_MARGIN_Y, drawW, height - 2 * CONTAINER_MARGIN_Y);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,r:number}} p
 * @param {{fillStyle:string}} opts
 */
export function drawParticle(ctx, p, { fillStyle }) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
}
