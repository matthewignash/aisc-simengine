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

  it('Download .md generates correct markdown payload', async () => {
    const blobs = [];
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob) => {
      blobs.push(blob);
      return 'blob:fake-url';
    });
    URL.revokeObjectURL = vi.fn();

    try {
      localStorage.setItem(
        STORAGE_KEY_SL,
        JSON.stringify({
          checkedItems: [0, 2],
          freeText: 'I got stuck on the units.',
        })
      );
      const el = await mount({ items: SAMPLE_ITEMS, open: true });
      const mdBtn = el.shadowRoot.querySelector('button[data-action="download-md"]');
      mdBtn.click();
      expect(blobs).toHaveLength(1);
      const text = await blobs[0].text();
      expect(text).toContain('# s1.5-gas-laws — Reflection');
      expect(text).toContain('**Level:** sl');
      expect(text).toContain('## Success criteria');
      expect(text).toContain('- [x] Describe what happens to P');
      expect(text).toContain('- [ ] Calculate P, V, T, or n');
      expect(text).toContain('- [x] Explain the shape of a P–V graph');
      expect(text).toContain('## My reflection');
      expect(text).toContain('I got stuck on the units.');
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
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
});
