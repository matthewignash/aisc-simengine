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

  it('emits data-pill-clicked with detail { ref } on click', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('data-pill-clicked', (e) => events.push(e.detail));
    pill.shadowRoot.querySelector('button').click();
    expect(events).toEqual([{ ref: 'gas-constant-R' }]);
  });

  it('re-emits data-pill-clicked on every click (not just the first)', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('data-pill-clicked', (e) => events.push(e.detail));
    const button = pill.shadowRoot.querySelector('button');
    button.click();
    button.click();
    button.click();
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.ref === 'gas-constant-R')).toBe(true);
  });

  it('does NOT register document-level click or keydown listeners', async () => {
    const docAddSpy = vi.spyOn(document, 'addEventListener');
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    // Pill should not add 'click' or 'keydown' listeners directly to document.
    const calls = docAddSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain('click');
    expect(calls).not.toContain('keydown');
    docAddSpy.mockRestore();
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

  it('does NOT create a child sim-data-card in its shadow DOM', async () => {
    // Phase 9 regression test: card lives at page level, not inside pill.
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    expect(pill.shadowRoot.querySelector('sim-data-card')).toBeNull();
  });
});
