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
  const { topic = 's1.5-gas-laws', level = 'sl', label = 'Success criteria', items = [] } = opts;
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

  it('renders slotted <li>s as interactive checkbox rows', async () => {
    const el = await mount({ items: SAMPLE_ITEMS });
    const checkboxes = el.shadowRoot.querySelectorAll(
      '.sim-checklist__list input[type="checkbox"]'
    );
    const spans = el.shadowRoot.querySelectorAll('.sim-checklist__list span');
    expect(checkboxes).toHaveLength(3);
    expect(spans).toHaveLength(3);
    expect(spans[0].textContent).toContain('Describe what happens to P');
    // Original light-DOM <li>s gone.
    expect(el.querySelector('li')).toBeNull();
  });

  it('progress indicator updates on check toggle', async () => {
    const el = await mount({ items: SAMPLE_ITEMS });
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
    const el = await mount({ items: SAMPLE_ITEMS });
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
    const el = await mount({ items: SAMPLE_ITEMS });
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
    // Pre-populate SL state. Leave HL state empty.
    localStorage.setItem(
      STORAGE_KEY_SL,
      JSON.stringify({ checkedItems: [0, 1], freeText: 'sl notes' })
    );
    const el = await mount({ items: SAMPLE_ITEMS, level: 'sl' });
    let checkboxes = el.shadowRoot.querySelectorAll('.sim-checklist__list input[type="checkbox"]');
    expect(checkboxes[0].checked).toBe(true);

    // Switch to HL — should reload from a fresh (empty) key.
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
      const el = await mount({ items: SAMPLE_ITEMS });
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
    const el = await mount({ items: SAMPLE_ITEMS });
    const events = [];
    document.body.addEventListener('checklist-reset', (e) => events.push(e.detail));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

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

    confirmSpy.mockRestore();
  });
});
