/**
 * UI control factories — slider + button. Dropdown / toggle / initKeyboard
 * remain stubbed until a future sim or topic page consumes them.
 */

const NOT_IMPLEMENTED = 'controls.js: not implemented — lands when needed';

/**
 * @param {{
 *   key: string, label: string,
 *   min: number, max: number, step?: number, value: number, unit?: string,
 *   onChange?: (v: number) => void,
 * }} opts
 * @returns {HTMLElement}
 */
export function createSlider(opts) {
  const { key, label, min, max, step = 1, value, unit = '', onChange } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'sim-slider';
  wrap.dataset.var = key;
  wrap.style.setProperty('--pct', percentOf(value, min, max));

  const head = document.createElement('div');
  head.className = 'sim-slider__head';
  const labelEl = document.createElement('span');
  labelEl.className = 'sim-slider__label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'sim-slider__value';
  valueEl.textContent = `${formatValue(value, step)} ${unit}`.trim();
  head.append(labelEl, valueEl);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', `${label}, range ${min} to ${max}`);

  input.addEventListener('input', () => {
    const v = Number(input.value);
    valueEl.textContent = `${formatValue(v, step)} ${unit}`.trim();
    wrap.style.setProperty('--pct', percentOf(v, min, max));
    onChange?.(v);
  });

  input.addEventListener('keydown', (e) => {
    if (!e.shiftKey) return;
    if (
      e.key !== 'ArrowUp' &&
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight'
    )
      return;
    e.preventDefault();
    const dir = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? +1 : -1;
    const next = clamp(Number(input.value) + dir * 5 * step, min, max);
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  wrap.append(head, input);
  return wrap;
}

/**
 * @param {{ label: string, variant?: 'default'|'primary'|'record',
 *   onClick?: () => void, disabled?: boolean }} opts
 * @returns {HTMLButtonElement}
 */
export function createButton(opts) {
  const { label, variant = 'default', onClick, disabled = false } = opts;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sim-btn' + (variant !== 'default' ? ` sim-btn--${variant}` : '');
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener('click', () => {
    if (!btn.disabled) onClick?.();
  });
  return btn;
}

export function createDropdown() {
  throw new Error(NOT_IMPLEMENTED);
}
export function createToggle() {
  throw new Error(NOT_IMPLEMENTED);
}
export function initKeyboard() {
  throw new Error(NOT_IMPLEMENTED);
}

function percentOf(v, min, max) {
  return `${Math.round(((v - min) / (max - min)) * 100)}%`;
}
function formatValue(v, step) {
  return step >= 1 ? String(Math.round(v)) : v.toFixed(1);
}
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
