import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../src/components/sim-data-card.js';

describe('<sim-data-card>', () => {
  let originalClipboardDescriptor;

  beforeEach(() => {
    document.body.replaceChildren();
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  });

  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      // The property didn't exist before — delete what the test added.
      delete navigator.clipboard;
    }
  });

  it('renders symbol, name, value+unit, description, and source citation for a known ref', async () => {
    const card = document.createElement('sim-data-card');
    card.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(card);
    await Promise.resolve();
    const root = card.shadowRoot;
    expect(root.querySelector('.sim-data-card__symbol').textContent).toBe('R');
    expect(root.querySelector('.sim-data-card__name').textContent).toContain('Molar gas constant');
    expect(root.querySelector('.sim-data-card__number').textContent).toBe('8.314');
    expect(root.querySelector('.sim-data-card__unit').textContent).toBe('J·K⁻¹·mol⁻¹');
    expect(root.querySelector('.sim-data-card__description').textContent).toContain('PV = nRT');
    expect(root.querySelector('.sim-data-card__source').textContent).toContain(
      'IB Chemistry Data Booklet 2025'
    );
  });

  it('close button sets hidden=true and emits data-card-closed', async () => {
    const card = document.createElement('sim-data-card');
    card.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(card);
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('data-card-closed', (e) => events.push(e.detail));
    card.shadowRoot.querySelector('.sim-data-card__close').click();
    expect(card.hidden).toBe(true);
    expect(events).toEqual([{ ref: 'gas-constant-R' }]);
  });

  it('Escape key dismisses while card is visible', async () => {
    const card = document.createElement('sim-data-card');
    card.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(card);
    await Promise.resolve();
    expect(card.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(card.hidden).toBe(true);
  });

  it('Copy citation calls navigator.clipboard.writeText with formatted citation', async () => {
    const writeSpy = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeSpy },
      configurable: true,
    });
    const card = document.createElement('sim-data-card');
    card.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(card);
    await Promise.resolve();
    const copyBtn = card.shadowRoot.querySelectorAll('.sim-btn')[0];
    copyBtn.click();
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('R = 8.314 J·K⁻¹·mol⁻¹'));
  });

  it('View source link is present only when the source has a url', async () => {
    // gas-constant-R sourced from ib-booklet-2025 which has NO url → no link
    const cardR = document.createElement('sim-data-card');
    cardR.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(cardR);
    await Promise.resolve();
    const linkR = cardR.shadowRoot.querySelector('a.sim-btn');
    expect(linkR).toBeNull();

    // boltzmann-kB sourced from nist-codata-2018 which HAS a url → link present
    const cardK = document.createElement('sim-data-card');
    cardK.setAttribute('ref', 'boltzmann-kB');
    document.body.appendChild(cardK);
    await Promise.resolve();
    const linkK = cardK.shadowRoot.querySelector('a.sim-btn');
    expect(linkK).not.toBeNull();
    expect(linkK.href).toContain('physics.nist.gov');
  });

  it('renders error message and console.errors for an unknown ref', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const card = document.createElement('sim-data-card');
    card.setAttribute('ref', 'does-not-exist');
    document.body.appendChild(card);
    await Promise.resolve();
    expect(card.shadowRoot.textContent).toContain('Unknown data ref');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
