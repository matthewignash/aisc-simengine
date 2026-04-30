import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/components/sim-data-pill.js';

describe('<sim-data-pill>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('renders value and unit from the data table for a known ref', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const root = pill.shadowRoot;
    const valueEl = root.querySelector('.sim-data-pill__value');
    const unitEl = root.querySelector('.sim-data-pill__unit');
    expect(valueEl.textContent).toBe('8.314');
    expect(unitEl.textContent).toBe('J·K⁻¹·mol⁻¹');
  });

  it('renders error marker and console.errors for an unknown ref', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'does-not-exist');
    document.body.appendChild(pill);
    await Promise.resolve();
    const missing = pill.shadowRoot.querySelector('.sim-data-pill--missing');
    expect(missing).not.toBeNull();
    expect(missing.textContent).toContain('does-not-exist');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('click toggles the child sim-data-card hidden attribute', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const card = pill.shadowRoot.querySelector('sim-data-card');
    const button = pill.shadowRoot.querySelector('button');
    expect(card.hidden).toBe(true);
    button.click();
    expect(card.hidden).toBe(false);
    button.click();
    expect(card.hidden).toBe(true);
  });

  it('Escape key closes the open card', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const card = pill.shadowRoot.querySelector('sim-data-card');
    pill.shadowRoot.querySelector('button').click();
    expect(card.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(card.hidden).toBe(true);
  });

  it('click outside the pill closes the open card', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    await Promise.resolve();
    const card = pill.shadowRoot.querySelector('sim-data-card');
    pill.shadowRoot.querySelector('button').click();
    expect(card.hidden).toBe(false);
    outside.click();
    expect(card.hidden).toBe(true);
  });

  it('emits data-pill-clicked with detail { ref }', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('data-pill-clicked', (e) => events.push(e.detail));
    pill.shadowRoot.querySelector('button').click();
    expect(events).toEqual([{ ref: 'gas-constant-R' }]);
  });

  it('button has aria-label with name + value + unit', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const button = pill.shadowRoot.querySelector('button');
    const label = button.getAttribute('aria-label');
    expect(label).toContain('Molar gas constant');
    expect(label).toContain('8.314');
    expect(label).toContain('J·K⁻¹·mol⁻¹');
  });
});
