/**
 * UI control factories — sliders, dropdowns, toggles, buttons.
 *
 * STUB. Real implementation lands in step 5. Legacy logic lives in
 * 3-Resources/SimEngine/SimEngine_Core.js (SimEngine.Controls, lines
 * 924-1113) and needs DOM-decoupling before it ports cleanly.
 */

const NOT_IMPLEMENTED = 'controls.js: not implemented — lands in step 5 when Gas Laws consumes it';

/**
 * Build a slider control bound to a state key.
 *
 * @param {{
 *   key: string,
 *   label: string,
 *   min: number,
 *   max: number,
 *   step?: number,
 *   value?: number,
 *   onChange?: (v: number) => void
 * }} _opts
 * @returns {HTMLElement}
 */
export function createSlider(_opts) {
  throw new Error(NOT_IMPLEMENTED);
}

export function createDropdown(_opts) {
  throw new Error(NOT_IMPLEMENTED);
}

export function createToggle(_opts) {
  throw new Error(NOT_IMPLEMENTED);
}

export function createButton(_opts) {
  throw new Error(NOT_IMPLEMENTED);
}

export function initKeyboard(_host) {
  throw new Error(NOT_IMPLEMENTED);
}
