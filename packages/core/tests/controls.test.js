import { describe, it, expect, vi } from 'vitest';
import { createSlider, createButton } from '../src/engine/controls.js';

describe('createSlider', () => {
  it('returns .sim-slider element with label, value display, and range input', () => {
    const el = createSlider({
      key: 'T',
      label: 'Temperature',
      min: 100,
      max: 1000,
      step: 1,
      value: 298,
      unit: 'K',
      onChange: () => {},
    });
    expect(el.classList.contains('sim-slider')).toBe(true);
    expect(el.dataset.var).toBe('T');
    expect(el.querySelector('.sim-slider__head .sim-slider__label').textContent).toContain(
      'Temperature'
    );
    expect(el.querySelector('.sim-slider__value').textContent).toBe('298 K');
    const input = el.querySelector('input[type="range"]');
    expect(input).not.toBeNull();
    expect(input.min).toBe('100');
    expect(input.max).toBe('1000');
    expect(input.value).toBe('298');
  });

  it('slider input event fires onChange with new numeric value', () => {
    const onChange = vi.fn();
    const el = createSlider({
      key: 'T',
      label: 'T',
      min: 0,
      max: 100,
      step: 1,
      value: 50,
      onChange,
    });
    const input = el.querySelector('input[type="range"]');
    input.value = '75';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it('Shift+ArrowUp advances by 5 × step', () => {
    const onChange = vi.fn();
    const el = createSlider({
      key: 'V',
      label: 'V',
      min: 0,
      max: 100,
      step: 2,
      value: 50,
      onChange,
    });
    const input = el.querySelector('input[type="range"]');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true }));
    expect(onChange).toHaveBeenCalledWith(60);
  });
});

describe('createButton', () => {
  it('produces button with sim-btn and variant class', () => {
    const btn = createButton({ label: 'Run', variant: 'primary', onClick: () => {} });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.classList.contains('sim-btn')).toBe(true);
    expect(btn.classList.contains('sim-btn--primary')).toBe(true);
    expect(btn.textContent).toBe('Run');
  });

  it('disabled button does not invoke onClick', () => {
    const onClick = vi.fn();
    const btn = createButton({ label: 'X', onClick, disabled: true });
    btn.dispatchEvent(new MouseEvent('click'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
