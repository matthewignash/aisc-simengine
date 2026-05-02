import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/components/sim-text-response.js';

const STORAGE_KEY_BELL1_SL = 'aisc-simengine:textresponse:s1.5-gas-laws:sl:bell-1';

async function mount(opts = {}) {
  const {
    topic = 's1.5-gas-laws',
    level = 'sl',
    id = 'bell-1',
    section = 'bell-ringer',
    label = 'Write the ideal gas equation. Label every symbol.',
  } = opts;
  const el = document.createElement('sim-text-response');
  el.setAttribute('topic', topic);
  el.setAttribute('level', level);
  el.id = id;
  el.setAttribute('section', section);
  if (label) el.setAttribute('label', label);
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  return el;
}

describe('<sim-text-response>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders prompt + textarea + char-count footer', async () => {
    const el = await mount();
    const prompt = el.shadowRoot.querySelector('.sim-text-response__prompt');
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    const count = el.shadowRoot.querySelector('.sim-text-response__count');
    expect(prompt.textContent).toContain('ideal gas equation');
    expect(textarea).toBeTruthy();
    expect(textarea.getAttribute('aria-label')).toContain('ideal gas equation');
    expect(count.textContent).toBe('0 chars');
    expect(count.getAttribute('aria-live')).toBe('polite');
    expect(count.getAttribute('aria-atomic')).toBe('true');
  });

  it('input persists to localStorage (debounced)', async () => {
    const el = await mount();
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    textarea.value = 'PV = nRT';
    textarea.dispatchEvent(new Event('input'));
    expect(localStorage.getItem(STORAGE_KEY_BELL1_SL)).toBeNull();
    vi.advanceTimersByTime(350);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_BELL1_SL));
    expect(stored).toEqual({ value: 'PV = nRT' });
  });

  it('restores from localStorage on mount + updates char-count', async () => {
    localStorage.setItem(STORAGE_KEY_BELL1_SL, JSON.stringify({ value: 'restored value' }));
    const el = await mount();
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    const count = el.shadowRoot.querySelector('.sim-text-response__count');
    expect(textarea.value).toBe('restored value');
    expect(count.textContent).toBe('14 chars');
  });

  it('level swap force-flushes pending debounce to OLD key, then loads NEW', async () => {
    const _STORAGE_KEY_BELL1_HL = 'aisc-simengine:textresponse:s1.5-gas-laws:hl:bell-1';
    localStorage.setItem(_STORAGE_KEY_BELL1_HL, JSON.stringify({ value: 'hl draft' }));
    const el = await mount({ level: 'sl' });
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    textarea.value = 'sl draft mid-debounce';
    textarea.dispatchEvent(new Event('input'));
    // Pending debounce. Now swap level — must flush to SL key, then load HL.
    el.setAttribute('level', 'hl');
    await Promise.resolve();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_BELL1_SL))).toEqual({
      value: 'sl draft mid-debounce',
    });
    expect(textarea.value).toBe('hl draft');
  });

  it('getState() returns { value }', async () => {
    const el = await mount();
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    textarea.value = 'snapshot';
    textarea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(350);
    expect(el.getState()).toEqual({ value: 'snapshot' });
  });

  it('clear() empties state + localStorage', async () => {
    localStorage.setItem(STORAGE_KEY_BELL1_SL, JSON.stringify({ value: 'to be cleared' }));
    const el = await mount();
    expect(el.getState().value).toBe('to be cleared');
    el.clear();
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    expect(textarea.value).toBe('');
    expect(localStorage.getItem(STORAGE_KEY_BELL1_SL)).toBeNull();
    expect(el.getState()).toEqual({ value: '' });
  });

  it('does not crash when localStorage.setItem throws', async () => {
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new Error('QuotaExceededError');
    };
    try {
      const el = await mount();
      const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
      textarea.value = 'while broken';
      textarea.dispatchEvent(new Event('input'));
      expect(() => vi.advanceTimersByTime(350)).not.toThrow();
    } finally {
      Storage.prototype.setItem = origSetItem;
    }
  });

  it('HOST_STYLES includes an @media print rule that hides textarea + char-count', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(
      path.join(here, '../src/components/sim-text-response.js'),
      'utf-8'
    );
    // The @media print block lives inside the HOST_STYLES template literal.
    // Match `@media print { ... }` non-greedily and assert it hides both
    // interactive children.
    const m = src.match(/@media\s+print\s*\{([\s\S]*?)\}\s*\n\s*`/);
    expect(m).not.toBeNull();
    const printBlock = m[1];
    expect(printBlock).toContain('.sim-text-response__textarea');
    expect(printBlock).toContain('.sim-text-response__count');
    expect(printBlock).toMatch(/display\s*:\s*none/);
  });
});
