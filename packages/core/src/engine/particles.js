/**
 * Particle field — 2D ideal-gas physics primitives.
 *
 * STUB. The real implementation lands in step 5 of the broader build
 * sequence, when the Gas Laws sim consumes this module. The legacy logic
 * lives in 3-Resources/SimEngine/SimEngine_Core.js (SimEngine.Particles,
 * lines 156-631) and needs DOM-decoupling before it ports cleanly.
 *
 * The exported function signatures below capture the intended API so that
 * downstream consumers can be designed against it; calling any of them in
 * the foundation phase throws a clear "not implemented" error.
 */

const NOT_IMPLEMENTED = 'particles.js: not implemented — lands in step 5 when Gas Laws consumes it';

/**
 * Construct a 2D particle field for an ideal-gas simulation.
 *
 * @param {{count: number, container: { width: number, height: number }}} _opts
 * @returns {{ step(dt: number): void, render(ctx: CanvasRenderingContext2D): void, setTemperature(T: number): void, setVolume(V: number): void, getIdealPressure(): number, getVdWPressure(): number }}
 */
export function createParticleField(_opts) {
  throw new Error(NOT_IMPLEMENTED);
}

// Convenience exports — all throw "not implemented" until step 5.
export function step() {
  throw new Error(NOT_IMPLEMENTED);
}
export function render() {
  throw new Error(NOT_IMPLEMENTED);
}
export function getIdealPressure() {
  throw new Error(NOT_IMPLEMENTED);
}
export function getVdWPressure() {
  throw new Error(NOT_IMPLEMENTED);
}
export function setTemperature() {
  throw new Error(NOT_IMPLEMENTED);
}
export function setVolume() {
  throw new Error(NOT_IMPLEMENTED);
}
