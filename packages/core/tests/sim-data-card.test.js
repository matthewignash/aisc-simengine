import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../src/components/sim-data-pill.js';
import '../src/components/sim-data-card.js';

/**
 * Helper to create the singleton card + pill(s) in document.body, drain
 * microtasks for upgrade, and return references.
 */
async function mount({ pillRefs = ['gas-constant-R'] } = {}) {
  const card = document.createElement('sim-data-card');
  document.body.appendChild(card);
  const pills = pillRefs.map((ref) => {
    const p = document.createElement('sim-data-pill');
    p.setAttribute('ref', ref);
    document.body.appendChild(p);
    return p;
  });
  await Promise.resolve();
  await Promise.resolve();
  return { card, pills };
}

describe('<sim-data-card> (singleton slide-out)', () => {
  let originalClipboardDescriptor;

  beforeEach(() => {
    document.body.replaceChildren();
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  });

  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      delete navigator.clipboard;
    }
  });

  it('renders symbol/name/value/unit/description/source on first pill click', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    const root = card.shadowRoot;
    expect(card.hasAttribute('data-open')).toBe(true);
    expect(root.querySelector('.sim-data-card__symbol').textContent).toBe('R');
    expect(root.querySelector('.sim-data-card__name').textContent).toContain('Molar gas constant');
    expect(root.querySelector('.sim-data-card__number').textContent).toBe('8.314');
    expect(root.querySelector('.sim-data-card__unit').textContent).toBe('J·K⁻¹·mol⁻¹');
    expect(root.querySelector('.sim-data-card__description').textContent).toContain('PV = nRT');
    expect(root.querySelector('.sim-data-card__source').textContent).toContain(
      'IB Chemistry Data Booklet 2025'
    );
  });

  it('clicking the same pill twice toggles open then closed', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    const button = pills[0].shadowRoot.querySelector('button');
    button.click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(true);
    button.click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(false);
  });

  it('clicking a different pill while open swaps content in place', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R', 'boltzmann-kB'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.shadowRoot.querySelector('.sim-data-card__symbol').textContent).toBe('R');
    pills[1].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    // data-open remains set across the swap.
    expect(card.hasAttribute('data-open')).toBe(true);
    expect(card.shadowRoot.querySelector('.sim-data-card__symbol').textContent).toBe('k_B');
  });

  it('close button removes data-open and emits data-card-closed', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('data-card-closed', (e) => events.push(e.detail));
    card.shadowRoot.querySelector('.sim-data-card__close').click();
    expect(card.hasAttribute('data-open')).toBe(false);
    expect(events).toEqual([{ ref: 'gas-constant-R' }]);
  });

  it('Escape key dismisses while card is visible', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(card.hasAttribute('data-open')).toBe(false);
  });

  it('outside click dismisses; click on a different pill swaps (not close-then-reopen)', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R', 'boltzmann-kB'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(true);

    // Click on Pill B should swap content; data-open stays set.
    pills[1].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(true);
    expect(card.shadowRoot.querySelector('.sim-data-card__symbol').textContent).toBe('k_B');

    // A genuine outside click (on body content that is NOT a pill) should dismiss.
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.click();
    expect(card.hasAttribute('data-open')).toBe(false);
  });

  it('Copy citation calls navigator.clipboard.writeText with formatted citation', async () => {
    const writeSpy = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeSpy },
      configurable: true,
    });
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    const copyBtn = card.shadowRoot.querySelectorAll('.sim-btn')[0];
    copyBtn.click();
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('R = 8.314 J·K⁻¹·mol⁻¹'));
  });

  it('View source link is present only when the source has a url', async () => {
    // gas-constant-R sourced from ib-booklet-2025 which has NO url → no link
    const { card, pills } = await mount({
      pillRefs: ['gas-constant-R', 'boltzmann-kB'],
    });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.shadowRoot.querySelector('a.sim-btn')).toBeNull();

    // boltzmann-kB sourced from nist-codata-2018 which HAS a url → link present
    pills[1].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    const link = card.shadowRoot.querySelector('a.sim-btn');
    expect(link).not.toBeNull();
    expect(link.href).toContain('physics.nist.gov');
  });

  it('renders error message and console.errors for an unknown ref (set directly)', async () => {
    // Pills correctly DO NOT dispatch data-pill-clicked for unknown refs
    // (the user sees the inline [missing: foo] marker instead). So we
    // exercise the card's error path by setting `ref` directly — same
    // contract as a future programmatic consumer.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const card = document.createElement('sim-data-card');
    document.body.appendChild(card);
    await Promise.resolve();
    await Promise.resolve();
    card.setAttribute('ref', 'does-not-exist');
    await Promise.resolve();
    expect(card.shadowRoot.textContent).toContain('Unknown data ref');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
