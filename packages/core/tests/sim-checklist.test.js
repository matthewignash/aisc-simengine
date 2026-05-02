import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/components/sim-checklist.js';

const STORAGE_KEY_SL = 'aisc-simengine:checklist:s1.5-gas-laws:sl';
const _STORAGE_KEY_HL = 'aisc-simengine:checklist:s1.5-gas-laws:hl';

const SAMPLE_ITEMS = [
  'Describe what happens to P when V halves at constant T and n.',
  'Calculate P, V, T, or n given the other three quantities.',
  'Explain the shape of a P–V graph at constant temperature and label its axes.',
];

async function mount(opts = {}) {
  const {
    topic = 's1.5-gas-laws',
    level = 'sl',
    label = 'Success criteria',
    items = [],
    open = false,
  } = opts;
  const el = document.createElement('sim-checklist');
  el.setAttribute('topic', topic);
  el.setAttribute('level', level);
  if (label) el.setAttribute('label', label);
  for (const text of items) {
    const li = document.createElement('li');
    li.textContent = text;
    el.appendChild(li);
  }
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  if (open) {
    el.setAttribute('data-open', '');
    await Promise.resolve();
  }
  return el;
}

describe('<sim-checklist>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders slotted <li>s as interactive checkbox rows when opened', async () => {
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    const checkboxes = el.shadowRoot.querySelectorAll(
      '.sim-checklist__list input[type="checkbox"]'
    );
    const spans = el.shadowRoot.querySelectorAll('.sim-checklist__list span');
    expect(checkboxes).toHaveLength(3);
    expect(spans).toHaveLength(3);
    expect(spans[0].textContent).toContain('Describe what happens to P');
    expect(el.querySelector('li')).toBeNull();
    // a11y polish: progress span gets aria-live + aria-atomic
    const progress = el.shadowRoot.querySelector('.sim-checklist__progress');
    expect(progress.getAttribute('aria-live')).toBe('polite');
    expect(progress.getAttribute('aria-atomic')).toBe('true');
  });

  it('progress indicator updates on check toggle', async () => {
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    const progress = el.shadowRoot.querySelector('.sim-checklist__progress');
    expect(progress.textContent).toBe('0 of 3 checked');
    const checkboxes = el.shadowRoot.querySelectorAll(
      '.sim-checklist__list input[type="checkbox"]'
    );
    checkboxes[0].checked = true;
    checkboxes[0].dispatchEvent(new Event('change'));
    checkboxes[2].checked = true;
    checkboxes[2].dispatchEvent(new Event('change'));
    expect(progress.textContent).toBe('2 of 3 checked');
  });

  it('state persists to localStorage on toggle', async () => {
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    const checkboxes = el.shadowRoot.querySelectorAll(
      '.sim-checklist__list input[type="checkbox"]'
    );
    checkboxes[1].checked = true;
    checkboxes[1].dispatchEvent(new Event('change'));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_SL));
    expect(stored).toEqual({ checkedItems: [1], freeText: '' });
  });

  it('state restores from localStorage on mount', async () => {
    localStorage.setItem(
      STORAGE_KEY_SL,
      JSON.stringify({ checkedItems: [0, 2], freeText: 'sample' })
    );
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    const checkboxes = el.shadowRoot.querySelectorAll(
      '.sim-checklist__list input[type="checkbox"]'
    );
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
    expect(checkboxes[2].checked).toBe(true);
    const textarea = el.shadowRoot.querySelector('.sim-checklist__reflection');
    expect(textarea.value).toBe('sample');
  });

  it('level attribute change loads state from the new key', async () => {
    localStorage.setItem(
      STORAGE_KEY_SL,
      JSON.stringify({ checkedItems: [0, 1], freeText: 'sl notes' })
    );
    const el = await mount({ items: SAMPLE_ITEMS, level: 'sl', open: true });
    let checkboxes = el.shadowRoot.querySelectorAll('.sim-checklist__list input[type="checkbox"]');
    expect(checkboxes[0].checked).toBe(true);

    el.setAttribute('level', 'hl');
    await Promise.resolve();
    checkboxes = el.shadowRoot.querySelectorAll('.sim-checklist__list input[type="checkbox"]');
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(false);
    const textarea = el.shadowRoot.querySelector('.sim-checklist__reflection');
    expect(textarea.value).toBe('');
  });

  it('Reset clears state, localStorage, and emits checklist-reset event', async () => {
    localStorage.setItem(
      STORAGE_KEY_SL,
      JSON.stringify({ checkedItems: [1], freeText: 'some text' })
    );
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    const events = [];
    document.body.addEventListener('checklist-reset', (e) => events.push(e.detail));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    try {
      const resetBtn = el.shadowRoot.querySelector('button[data-action="reset"]');
      resetBtn.click();

      const checkboxes = el.shadowRoot.querySelectorAll(
        '.sim-checklist__list input[type="checkbox"]'
      );
      expect(Array.from(checkboxes).every((cb) => !cb.checked)).toBe(true);
      const textarea = el.shadowRoot.querySelector('.sim-checklist__reflection');
      expect(textarea.value).toBe('');
      expect(localStorage.getItem(STORAGE_KEY_SL)).toBeNull();
      expect(events).toEqual([{ topic: 's1.5-gas-laws', level: 'sl' }]);
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('panel is hidden by default; setting data-open shows it (and removing hides)', async () => {
    const el = await mount({ items: SAMPLE_ITEMS });
    expect(el.hasAttribute('data-open')).toBe(false);
    el.setAttribute('data-open', '');
    await Promise.resolve();
    expect(el.hasAttribute('data-open')).toBe(true);
    el.removeAttribute('data-open');
    await Promise.resolve();
    expect(el.hasAttribute('data-open')).toBe(false);
  });

  it('opening the panel emits panel-opened event with source = this', async () => {
    const el = await mount({ items: SAMPLE_ITEMS });
    const events = [];
    document.body.addEventListener('panel-opened', (e) => events.push(e.detail));
    el.setAttribute('data-open', '');
    await Promise.resolve();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe(el);
  });

  it('closing the panel removes data-open and emits panel-closed event', async () => {
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    const events = [];
    document.body.addEventListener('panel-closed', (e) => events.push(e.detail));
    const closeBtn = el.shadowRoot.querySelector('.sim-checklist__close');
    closeBtn.click();
    expect(el.hasAttribute('data-open')).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe(el);
  });

  it('closes when a sibling panel-opened event fires', async () => {
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    expect(el.hasAttribute('data-open')).toBe(true);

    // Simulate a different panel opening — dispatch a synthetic event with
    // a different source. The checklist's listener should close itself.
    const fakeSource = document.createElement('div');
    document.body.appendChild(fakeSource);
    document.dispatchEvent(
      new CustomEvent('panel-opened', {
        detail: { source: fakeSource },
        bubbles: true,
      })
    );
    expect(el.hasAttribute('data-open')).toBe(false);
  });

  it('does not crash when localStorage.setItem throws (private mode / quota)', async () => {
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new Error('QuotaExceededError');
    };
    try {
      const el = await mount({ items: SAMPLE_ITEMS, open: true });
      const checkboxes = el.shadowRoot.querySelectorAll(
        '.sim-checklist__list input[type="checkbox"]'
      );
      // Toggling a checkbox triggers _saveState. Should not throw.
      expect(() => {
        checkboxes[0].checked = true;
        checkboxes[0].dispatchEvent(new Event('change'));
      }).not.toThrow();

      // Reset path also calls localStorage.removeItem — also should not throw
      // even when storage is broken.
      const origRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function () {
        throw new Error('storage broken');
      };
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      try {
        const resetBtn = el.shadowRoot.querySelector('button[data-action="reset"]');
        expect(() => resetBtn.click()).not.toThrow();
      } finally {
        confirmSpy.mockRestore();
        Storage.prototype.removeItem = origRemoveItem;
      }
    } finally {
      Storage.prototype.setItem = origSetItem;
    }
  });

  it('mounts with zero items and renders "0 of 0 checked"', async () => {
    const el = await mount({ topic: 'default', open: true });
    const progress = el.shadowRoot.querySelector('.sim-checklist__progress');
    expect(progress.textContent).toBe('0 of 0 checked');
    const checkboxes = el.shadowRoot.querySelectorAll(
      '.sim-checklist__list input[type="checkbox"]'
    );
    expect(checkboxes).toHaveLength(0);
    // Markdown export with no items produces just the header + empty checklist section
    const md = el.exportMarkdown(false);
    expect(md).toContain('# default — Reflection');
    expect(md).toContain('## Success criteria');
  });

  it('exportMarkdown(false) returns the .md string without triggering download', async () => {
    localStorage.setItem(
      STORAGE_KEY_SL,
      JSON.stringify({
        checkedItems: [0, 2],
        freeText: 'I got stuck on the units.',
      })
    );
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    const md = el.exportMarkdown(false);
    expect(md).toContain('# s1.5-gas-laws — Reflection');
    expect(md).toContain('**Level:** sl');
    expect(md).toContain('## Success criteria');
    expect(md).toContain('- [x] Describe what happens to P');
    expect(md).toContain('- [ ] Calculate P, V, T, or n');
    expect(md).toContain('- [x] Explain the shape of a P–V graph');
    expect(md).toContain('## My reflection');
    expect(md).toContain('I got stuck on the units.');
  });

  it('getState() includes items array', async () => {
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    const state = el.getState();
    expect(Array.isArray(state.items)).toBe(true);
    expect(state.items).toHaveLength(3);
    expect(state.items[0]).toContain('Describe what happens to P');
  });

  it('clear() empties state without prompting; matches Reset behavior post-confirm', async () => {
    localStorage.setItem(
      STORAGE_KEY_SL,
      JSON.stringify({ checkedItems: [1], freeText: 'some text' })
    );
    const el = await mount({ items: SAMPLE_ITEMS, open: true });
    expect(el.getState().checkedItems).toEqual([1]);
    el.clear();
    expect(el.getState()).toMatchObject({
      items: SAMPLE_ITEMS,
      checkedItems: [],
      freeText: '',
    });
    expect(localStorage.getItem(STORAGE_KEY_SL)).toBeNull();
  });

  it('HOST_STYLES includes a max-width: 720px @media block that shrinks the panel in place', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(path.join(here, '../src/components/sim-checklist.js'), 'utf-8');
    const m = src.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\}\s*\}/);
    expect(m).not.toBeNull();
    const block = m[1];
    expect(block).toContain('width: calc(100vw - 32px)');
    expect(block).toContain('max-width: 320px');
  });
});
