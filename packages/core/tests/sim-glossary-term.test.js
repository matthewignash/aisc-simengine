import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../src/components/sim-glossary-term.js';

describe('<sim-glossary-term>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('renders slotted text with aria-describedby pointing to a tooltip', async () => {
    const el = document.createElement('sim-glossary-term');
    el.setAttribute('ref', 'pressure');
    el.textContent = 'pressure';
    document.body.appendChild(el);
    await Promise.resolve();
    const root = el.shadowRoot;
    const wrap = root.querySelector('.sim-glossary-term');
    expect(wrap).not.toBeNull();
    const tooltip = root.querySelector('.sim-glossary-term__tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip.id).toBeTruthy();
    expect(wrap.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.querySelector('.sim-glossary-term__definition').textContent).toContain(
      'pascals'
    );
  });

  it('mouseenter shows tooltip after a 200ms delay', async () => {
    vi.useFakeTimers();
    const el = document.createElement('sim-glossary-term');
    el.setAttribute('ref', 'pressure');
    el.textContent = 'pressure';
    document.body.appendChild(el);
    await Promise.resolve();
    const wrap = el.shadowRoot.querySelector('.sim-glossary-term');
    const tooltip = el.shadowRoot.querySelector('.sim-glossary-term__tooltip');
    expect(tooltip.hidden).toBe(true);
    wrap.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(100);
    expect(tooltip.hidden).toBe(true); // not yet
    vi.advanceTimersByTime(150);
    expect(tooltip.hidden).toBe(false);
    vi.useRealTimers();
  });

  it('click toggles tooltip pin (visible on first click, hidden on second)', async () => {
    const el = document.createElement('sim-glossary-term');
    el.setAttribute('ref', 'pressure');
    el.textContent = 'pressure';
    document.body.appendChild(el);
    await Promise.resolve();
    const wrap = el.shadowRoot.querySelector('.sim-glossary-term');
    const tooltip = el.shadowRoot.querySelector('.sim-glossary-term__tooltip');
    wrap.click();
    expect(tooltip.hidden).toBe(false);
    wrap.click();
    expect(tooltip.hidden).toBe(true);
  });

  it('Escape closes a pinned tooltip', async () => {
    const el = document.createElement('sim-glossary-term');
    el.setAttribute('ref', 'pressure');
    el.textContent = 'pressure';
    document.body.appendChild(el);
    await Promise.resolve();
    const wrap = el.shadowRoot.querySelector('.sim-glossary-term');
    const tooltip = el.shadowRoot.querySelector('.sim-glossary-term__tooltip');
    wrap.click(); // pin
    expect(tooltip.hidden).toBe(false);
    wrap.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tooltip.hidden).toBe(true);
  });

  it('unknown ref renders text plain (no underline) and console.warns', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = document.createElement('sim-glossary-term');
    el.setAttribute('ref', 'does-not-exist');
    el.textContent = 'unknown thing';
    document.body.appendChild(el);
    await Promise.resolve();
    const wrap = el.shadowRoot.querySelector('.sim-glossary-term');
    expect(wrap.classList.contains('sim-glossary-term--missing')).toBe(true);
    expect(el.shadowRoot.querySelector('.sim-glossary-term__tooltip')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
