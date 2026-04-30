# Phase 10A — Success-Checklist + Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `<sim-checklist>` — a generic interactive checklist web component with per-topic-per-level localStorage state, a free-text reflection textarea, and two export buttons (.md download + Save as PDF via `window.print()`). Replace the topic page's static success-criteria column with an instance of it.

**Architecture:** New custom element in `packages/core/src/components/sim-checklist.js`. Slot-based `<li>` items captured at upgrade. Shadow DOM with adopted constructable stylesheet. Per-topic-per-level localStorage key `aisc-simengine:checklist:<topic>:<level>`. Markdown export via Blob + `<a download>`. PDF export via a synthesized `#print-reflection-output` block in `document.body` plus `body.printing-reflection` class plus `@media print` rules in global `components.css` (the only CSS landing outside the shadow root). All DOM via `createElement` + `textContent` — no `innerHTML` anywhere.

**Tech Stack:** Vanilla JS (ES2022, ESM), Vitest + happy-dom, JSDoc-driven types. No new dependencies.

**Companion design doc:** `docs/plans/2026-04-30-phase10a-success-checklist-export-design.md` (read for "why" decisions).

**Repo state at start:** `main` at `8e4e10e` (phase 9 in PR #6 ready to merge; this design doc committed). 143 tests passing on the in-flight phase-9 branch (PR #6); main itself is at 140 tests. Implementation runs on top of merged main, so the baseline depends on whether PR #6 has merged when execution starts. If PR #6 is merged first: baseline 143. If not: baseline 140 and we pick up phase 9 in the same worktree.

**Standards (carried from prior phases):**

- TDD red-green cycles. New tests first, see them fail because the component file doesn't exist yet, then implement.
- Conventional commits.
- No git config edits — env vars per commit (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`).
- No `git add -A`. Specify files by name.
- No push between commits — controller pushes once at end of phase 10A.
- Work in a worktree at `.worktrees/phase-10a-success-checklist/` on branch `phase-10a-success-checklist`.
- All synthesized DOM via `createElement` + `textContent`. **No `.innerHTML`.**

---

## Commit 1 — `feat(core): <sim-checklist> custom element`

The big commit: component, tests, side-effect import, and the print CSS together. Splitting them would leave the pipeline broken between sub-commits because the tests import the component, the print CSS is what makes the PDF export visually correct, and the import order in `index.js` is what registers the element when consumers import the package.

### Task 1.1 — Write the failing test suite (RED)

**File:** `packages/core/tests/sim-checklist.test.js` (NEW)

Create with this exact content:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/components/sim-checklist.js';

const STORAGE_KEY_SL = 'aisc-simengine:checklist:s1.5-gas-laws:sl';
const STORAGE_KEY_HL = 'aisc-simengine:checklist:s1.5-gas-laws:hl';

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
```

**Note** the unused `STORAGE_KEY_HL` constant is intentional — it's a contract reference for the implementer (and possible future test additions for HL-specific state). If lint complains about unused, prefix with `_STORAGE_KEY_HL` or drop. Decide at lint time.

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-checklist.test.js 2>&1 | tail -10
```

Expected: **all 7 tests fail** with `Failed to resolve import '../src/components/sim-checklist.js'`. The file doesn't exist yet. That's the RED witness.

### Task 1.2 — Implement `sim-checklist.js` (GREEN)

**File:** `packages/core/src/components/sim-checklist.js` (NEW)

Create with this exact content:

```js
/**
 * <sim-checklist topic="..." level="..." label="..."> — interactive checklist.
 *
 * Reads slotted <li> items at upgrade and renders them as interactive
 * checkbox rows in shadow DOM. Tracks check state + an optional free-text
 * reflection textarea, persisted to localStorage keyed by topic + level.
 * Provides three action buttons:
 *   - Download .md  → one-click markdown download
 *   - Save as PDF   → window.print() into a synthesized print block; the
 *                     @media print rules in components.css hide everything
 *                     else on the page during the print dialog
 *   - Reset         → window.confirm() prompt; clears state + storage
 *
 * Designed for the topic-page success-criteria use case (replacing the
 * static .ib-lisc__col--sc column), but generic enough for any tickable
 * list.
 *
 * Events (bubbles + composed):
 *   - checklist-changed: { topic, level, checkedCount, total, freeText }
 *   - checklist-exported: { topic, level, format: 'md' | 'pdf' }
 *   - checklist-reset: { topic, level }
 *
 * Imperative API:
 *   - getState() → { topic, level, checkedItems: number[], freeText: string }
 *   - exportMarkdown(triggerDownload?) → string  (optionally triggers download)
 *   - exportPDF() → triggers window.print()
 *
 * DOM-safety: all rendering uses createElement + textContent. No .innerHTML.
 */

const HOST_STYLES = `
  :host {
    display: block;
    font-family: var(--font-sans, sans-serif);
  }
  .sim-checklist {
    background: var(--ib-white, #fff);
    border: 1px solid var(--ib-ink-200, #e5e7eb);
    border-radius: var(--r-md, 8px);
    padding: var(--sp-4, 16px);
  }
  .sim-checklist__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0 0 var(--sp-3, 12px);
  }
  .sim-checklist__label {
    margin: 0;
    font-size: var(--fs-18, 18px);
    font-weight: 600;
    color: var(--ib-navy-800, #0b2265);
  }
  .sim-checklist__progress {
    font-family: var(--font-mono, monospace);
    font-size: var(--fs-13, 13px);
    color: var(--ib-ink-500, #6b7280);
  }
  .sim-checklist__list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--sp-4, 16px);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2, 8px);
  }
  .sim-checklist__list li label {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3, 12px);
    cursor: pointer;
    padding: 6px 0;
    line-height: 1.5;
  }
  .sim-checklist__list li input[type='checkbox'] {
    margin-top: 4px;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--ib-navy-600, #2a46a3);
  }
  .sim-checklist__list li input[type='checkbox']:checked + span {
    color: var(--ib-ink-500, #6b7280);
    text-decoration: line-through;
  }
  .sim-checklist__reflection {
    width: 100%;
    min-height: 80px;
    padding: var(--sp-3, 12px);
    border: 1px solid var(--ib-ink-200, #e5e7eb);
    border-radius: var(--r-md, 8px);
    font-family: inherit;
    font-size: var(--fs-14, 14px);
    line-height: 1.6;
    resize: vertical;
    box-sizing: border-box;
  }
  .sim-checklist__reflection:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 2px #5b9dff);
  }
  .sim-checklist__actions {
    display: flex;
    gap: var(--sp-2, 8px);
    margin-top: var(--sp-3, 12px);
    flex-wrap: wrap;
  }
  .sim-btn {
    padding: 6px 12px;
    border: 1px solid var(--ib-ink-300, #c9cdd6);
    border-radius: 4px;
    background: var(--ib-white, #fff);
    cursor: pointer;
    font-size: var(--fs-14, 14px);
    font-family: inherit;
  }
  .sim-btn:hover { background: var(--ib-ink-100, #f4f4f4); }
  .sim-btn--ghost { color: var(--ib-ink-700, #374151); }
  .sim-btn--ghost:hover { background: var(--ib-navy-050, #f5f7fc); }
`;

const sheet = new CSSStyleSheet();
sheet.replaceSync(HOST_STYLES);

const STORAGE_PREFIX = 'aisc-simengine:checklist';
const TEXTAREA_DEBOUNCE_MS = 300;

class SimChecklistElement extends HTMLElement {
  static get observedAttributes() {
    return ['level', 'label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    this._items = [];
    this._state = { checkedItems: [], freeText: '' };
    this._textareaDebounce = null;
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;

    // Capture slotted <li> textContent into items[].
    const listItems = Array.from(this.querySelectorAll(':scope > li'));
    this._items = listItems.map((li) => (li.textContent || '').trim()).filter((s) => s.length > 0);

    // Clear original light-DOM children — the rendered version lives in shadow.
    this.replaceChildren();

    this._render();
    this._loadState();
    this._applyStateToDOM();

    // afterprint listener for cleanup of body.printing-reflection class.
    this._afterPrintHandler = () => {
      document.body.classList.remove('printing-reflection');
    };
    window.addEventListener('afterprint', this._afterPrintHandler);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._initialized) return;
    if (name === 'level' && oldValue !== newValue) {
      // Force-flush pending textarea debounce to the OLD key before switching.
      this._flushTextareaSave(oldValue);
      this._loadState();
      this._applyStateToDOM();
    } else if (name === 'label' && oldValue !== newValue) {
      const head = this.shadowRoot.querySelector('.sim-checklist__head');
      if (!head) return;
      const existing = head.querySelector('.sim-checklist__label');
      if (newValue) {
        if (existing) {
          existing.textContent = newValue;
        } else {
          const labelEl = document.createElement('h3');
          labelEl.className = 'sim-checklist__label';
          labelEl.textContent = newValue;
          head.insertBefore(labelEl, head.firstChild);
        }
      } else if (existing) {
        existing.remove();
      }
    }
  }

  disconnectedCallback() {
    if (this._textareaDebounce) {
      clearTimeout(this._textareaDebounce);
      this._textareaDebounce = null;
    }
    if (this._afterPrintHandler) {
      window.removeEventListener('afterprint', this._afterPrintHandler);
      this._afterPrintHandler = null;
    }
    // Allow re-render if the element is moved/reattached.
    this._initialized = false;
  }

  _render() {
    const root = this.shadowRoot;
    root.replaceChildren();

    const wrap = document.createElement('div');
    wrap.className = 'sim-checklist';

    const head = document.createElement('header');
    head.className = 'sim-checklist__head';
    const labelText = this.getAttribute('label');
    if (labelText) {
      const labelEl = document.createElement('h3');
      labelEl.className = 'sim-checklist__label';
      labelEl.textContent = labelText;
      head.appendChild(labelEl);
    }
    const progressEl = document.createElement('span');
    progressEl.className = 'sim-checklist__progress';
    progressEl.textContent = `0 of ${this._items.length} checked`;
    head.appendChild(progressEl);

    const list = document.createElement('ul');
    list.className = 'sim-checklist__list';
    for (let i = 0; i < this._items.length; i++) {
      const li = document.createElement('li');
      const lbl = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.idx = String(i);
      cb.addEventListener('change', () => this._onCheckToggle(i, cb.checked));
      const sp = document.createElement('span');
      sp.textContent = this._items[i];
      lbl.append(cb, sp);
      li.appendChild(lbl);
      list.appendChild(li);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'sim-checklist__reflection';
    textarea.setAttribute('placeholder', 'Where did you get stuck? What surprised you? (optional)');
    textarea.setAttribute('aria-label', 'My reflection');
    textarea.addEventListener('input', (e) => this._onTextareaInput(e.target.value));

    const actions = document.createElement('div');
    actions.className = 'sim-checklist__actions';
    const mdBtn = this._makeButton('📄 Download .md', 'download-md', () =>
      this.exportMarkdown(true)
    );
    const pdfBtn = this._makeButton('🖨 Save as PDF', 'save-pdf', () => this.exportPDF());
    const resetBtn = this._makeButton('Reset', 'reset', () => this._onReset(), true);
    actions.append(mdBtn, pdfBtn, resetBtn);

    wrap.append(head, list, textarea, actions);
    root.appendChild(wrap);

    this._progressEl = progressEl;
    this._textarea = textarea;
  }

  _makeButton(text, action, handler, isGhost = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = isGhost ? 'sim-btn sim-btn--ghost' : 'sim-btn';
    btn.dataset.action = action;
    btn.textContent = text;
    btn.addEventListener('click', handler);
    return btn;
  }

  _storageKey(level) {
    const lvl =
      level !== undefined && level !== null ? level : this.getAttribute('level') || 'default';
    return `${STORAGE_PREFIX}:${this.getAttribute('topic') || 'default'}:${lvl}`;
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        this._state = {
          checkedItems: Array.isArray(parsed.checkedItems) ? parsed.checkedItems : [],
          freeText: typeof parsed.freeText === 'string' ? parsed.freeText : '',
        };
        return;
      }
    } catch {
      // localStorage unavailable / parse failure — fall through to default state
    }
    this._state = { checkedItems: [], freeText: '' };
  }

  _saveState(level) {
    try {
      localStorage.setItem(this._storageKey(level), JSON.stringify(this._state));
    } catch {
      // localStorage unavailable — graceful no-op
    }
  }

  _applyStateToDOM() {
    const checkboxes = this.shadowRoot.querySelectorAll(
      '.sim-checklist__list input[type="checkbox"]'
    );
    checkboxes.forEach((cb, i) => {
      cb.checked = this._state.checkedItems.includes(i);
    });
    if (this._textarea) {
      this._textarea.value = this._state.freeText;
    }
    this._updateProgress();
  }

  _updateProgress() {
    if (this._progressEl) {
      this._progressEl.textContent = `${this._state.checkedItems.length} of ${this._items.length} checked`;
    }
  }

  _onCheckToggle(idx, checked) {
    const set = new Set(this._state.checkedItems);
    if (checked) set.add(idx);
    else set.delete(idx);
    this._state.checkedItems = Array.from(set).sort((a, b) => a - b);
    this._saveState();
    this._updateProgress();
    this._dispatchChanged();
  }

  _onTextareaInput(value) {
    this._state.freeText = value;
    if (this._textareaDebounce) clearTimeout(this._textareaDebounce);
    this._textareaDebounce = setTimeout(() => {
      this._saveState();
      this._dispatchChanged();
      this._textareaDebounce = null;
    }, TEXTAREA_DEBOUNCE_MS);
  }

  _flushTextareaSave(level) {
    if (this._textareaDebounce) {
      clearTimeout(this._textareaDebounce);
      this._textareaDebounce = null;
      this._saveState(level);
    }
  }

  _dispatchChanged() {
    this.dispatchEvent(
      new CustomEvent('checklist-changed', {
        detail: {
          topic: this.getAttribute('topic') || 'default',
          level: this.getAttribute('level') || 'default',
          checkedCount: this._state.checkedItems.length,
          total: this._items.length,
          freeText: this._state.freeText,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  _onReset() {
    const confirmed = window.confirm(
      'Clear all checks and reflection text? This cannot be undone.'
    );
    if (!confirmed) return;
    this._state = { checkedItems: [], freeText: '' };
    try {
      localStorage.removeItem(this._storageKey());
    } catch {
      // localStorage unavailable — graceful no-op
    }
    this._applyStateToDOM();
    this.dispatchEvent(
      new CustomEvent('checklist-reset', {
        detail: {
          topic: this.getAttribute('topic') || 'default',
          level: this.getAttribute('level') || 'default',
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  // ── Public imperative API ─────────────────────────────────────

  /**
   * Returns a snapshot of the current state.
   *
   * @returns {{ topic: string, level: string, checkedItems: number[], freeText: string }}
   */
  getState() {
    return {
      topic: this.getAttribute('topic') || 'default',
      level: this.getAttribute('level') || 'default',
      checkedItems: this._state.checkedItems.slice(),
      freeText: this._state.freeText,
    };
  }

  /**
   * Generates the markdown representation of the current state. If
   * `triggerDownload` is true, also creates a Blob and triggers a browser
   * file download.
   *
   * @param {boolean} [triggerDownload]
   * @returns {string}
   */
  exportMarkdown(triggerDownload = false) {
    const state = this.getState();
    const date = new Date().toISOString().slice(0, 10);
    const title = this.getAttribute('topic') || 'default';
    const lines = [
      `# ${title} — Reflection`,
      `**Level:** ${state.level} · **Date:** ${date}`,
      '',
      `## ${this.getAttribute('label') || 'Checklist'}`,
      '',
    ];
    for (let i = 0; i < this._items.length; i++) {
      const mark = state.checkedItems.includes(i) ? '[x]' : '[ ]';
      lines.push(`- ${mark} ${this._items[i]}`);
    }
    if (state.freeText.trim()) {
      lines.push('', '## My reflection', '', state.freeText);
    }
    const md = lines.join('\n');

    if (triggerDownload) {
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}-${state.level}-reflection.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      this.dispatchEvent(
        new CustomEvent('checklist-exported', {
          detail: { topic: state.topic, level: state.level, format: 'md' },
          bubbles: true,
          composed: true,
        })
      );
    }

    return md;
  }

  /**
   * Synthesizes the print block, sets body.printing-reflection, and calls
   * window.print(). The afterprint listener (registered in connectedCallback)
   * removes the body class when the print dialog closes.
   */
  exportPDF() {
    const state = this.getState();
    const newBlock = this._buildPrintBlock(state);

    const old = document.getElementById('print-reflection-output');
    if (old) old.replaceWith(newBlock);
    else document.body.appendChild(newBlock);

    document.body.classList.add('printing-reflection');
    window.print();

    this.dispatchEvent(
      new CustomEvent('checklist-exported', {
        detail: { topic: state.topic, level: state.level, format: 'pdf' },
        bubbles: true,
        composed: true,
      })
    );
  }

  _buildPrintBlock(state) {
    const container = document.createElement('div');
    container.id = 'print-reflection-output';

    const h1 = document.createElement('h1');
    h1.textContent = `${state.topic} — Reflection`;
    container.appendChild(h1);

    const meta = document.createElement('p');
    meta.className = 'reflection-meta';
    const date = new Date().toISOString().slice(0, 10);
    meta.textContent = `Level: ${state.level} · Date: ${date}`;
    container.appendChild(meta);

    const h2 = document.createElement('h2');
    h2.textContent = this.getAttribute('label') || 'Checklist';
    container.appendChild(h2);

    const ul = document.createElement('ul');
    for (let i = 0; i < this._items.length; i++) {
      const li = document.createElement('li');
      if (state.checkedItems.includes(i)) li.classList.add('checked');
      li.textContent = this._items[i];
      ul.appendChild(li);
    }
    container.appendChild(ul);

    if (state.freeText.trim()) {
      const h2b = document.createElement('h2');
      h2b.textContent = 'My reflection';
      container.appendChild(h2b);
      const div = document.createElement('div');
      div.className = 'reflection-text';
      div.textContent = state.freeText;
      container.appendChild(div);
    }

    return container;
  }
}

if (!customElements.get('sim-checklist')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-checklist')) {
      customElements.define('sim-checklist', SimChecklistElement);
    }
  });
}
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-checklist.test.js 2>&1 | tail -10
```

Expected: **7 tests passed.** If any fail, investigate. Common things to check:

- Test 6 (Download .md) uses `vi.fn()` to spy on `URL.createObjectURL`. The `Blob` constructor's `.text()` method is asynchronous (returns a Promise). The test awaits it. If `Blob` isn't defined in happy-dom, the test fails — should NOT happen; happy-dom 15+ supports Blob.
- Test 7 (Reset) uses `vi.spyOn(window, 'confirm').mockReturnValue(true)`. happy-dom supports `window.confirm` as a no-op stub returning `true` by default — the spy override works.
- Test 5 (level change) — make sure `attributeChangedCallback` is called when `setAttribute('level', 'hl')` runs. If the test fails because state didn't reload, the `_loadState` + `_applyStateToDOM` calls need a microtask flush; add `await Promise.resolve()` after `setAttribute`.

### Task 1.3 — Add print stylesheet to global `components.css`

**File:** `packages/core/src/styles/components.css`

Append at the end:

```css
/* Phase 10A: Reflection-only print stylesheet for <sim-checklist> exportPDF.
   The component synthesizes a #print-reflection-output block in the body,
   adds body.printing-reflection, then calls window.print(). The afterprint
   listener clears the body class. The synthesized block is left in place
   between exports (cheap; reused via element.replaceWith). */
@media print {
  body.printing-reflection > *:not(#print-reflection-output) {
    display: none !important;
  }
  body.printing-reflection #print-reflection-output {
    display: block !important;
  }
}
#print-reflection-output {
  display: none; /* hidden in screen mode; shown only via print stylesheet */
}
#print-reflection-output h1 {
  font-size: 20pt;
  margin: 0 0 16pt;
}
#print-reflection-output h2 {
  font-size: 14pt;
  margin: 16pt 0 8pt;
}
#print-reflection-output ul {
  list-style: none;
  padding: 0;
}
#print-reflection-output ul li {
  padding: 4pt 0;
  font-size: 11pt;
}
#print-reflection-output ul li::before {
  content: '[ ] ';
  font-family: monospace;
}
#print-reflection-output ul li.checked::before {
  content: '[x] ';
}
#print-reflection-output .reflection-meta {
  color: #555;
  font-size: 10pt;
  margin-bottom: 12pt;
}
#print-reflection-output .reflection-text {
  font-size: 11pt;
  line-height: 1.5;
  white-space: pre-wrap;
}
```

### Task 1.4 — Side-effect import in `packages/core/src/index.js`

**File:** `packages/core/src/index.js`

Find the existing `import './components/sim-coachmark.js';` line and add immediately after:

```js
import './components/sim-checklist.js';
```

So the imports section now ends with:

```js
import './components/sim-engine.js';
import './components/sim-data-pill.js';
import './components/sim-data-card.js';
import './components/sim-glossary-term.js';
import './components/sim-tweaks-panel.js';
import './components/sim-coachmark.js';
import './components/sim-checklist.js';
```

### Task 1.5 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean (the existing 6 pre-existing warnings carry; that's OK). If lint flags `STORAGE_KEY_HL` as unused, prefix it with `_` or drop it.
- **150 tests** passing across both packages: core 144 (was 137 after phase 9; +7 new) + data 6
- build green; bundle delta ≤ +3 kB IIFE (was 86.09 kB after phase 9)

If you get a different total than 150, recount carefully and report the exact breakdown.

Stage **exactly** these four files:

```bash
git add \
  packages/core/src/components/sim-checklist.js \
  packages/core/src/styles/components.css \
  packages/core/src/index.js \
  packages/core/tests/sim-checklist.test.js
```

Commit with **env-var attribution** and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(core): <sim-checklist> custom element

New generic interactive checklist component for the topic page's
success-criteria use case. Reads slotted <li> items at upgrade and
renders them as interactive checkbox rows in shadow DOM. Tracks
check state + an optional free-text reflection textarea, persisted
to localStorage keyed by topic + level (per-topic-per-level scoping).

Three action buttons inside the component:
  - 📄 Download .md  → one-click markdown download via Blob + <a download>
  - 🖨 Save as PDF   → window.print() into a synthesized print block;
                       @media print rules in components.css hide
                       everything else during the print dialog
  - Reset            → window.confirm() prompt; clears state + storage

Events emitted (bubbles + composed):
  - checklist-changed: { topic, level, checkedCount, total, freeText }
  - checklist-exported: { topic, level, format: 'md' | 'pdf' }
  - checklist-reset: { topic, level }

Imperative API: getState(), exportMarkdown(triggerDownload?),
exportPDF(). Phase 10B's <sim-reflection-export> aggregator will use
getState() to pull each checklist's state into a unified portfolio.

DOM safety: all rendering uses createElement + textContent. No
.innerHTML anywhere — matches the codebase's existing convention
from step 6.

Subtle behaviors:
  - Textarea has a 300ms debounce. Level attribute change force-
    flushes the pending save to the OLD key BEFORE switching to the
    new key (prevents the "level switch eats unsaved typing" race).
  - localStorage write/read failures wrapped in try/catch — graceful
    degradation in private mode / restricted contexts.
  - afterprint listener (registered on window) clears
    body.printing-reflection on print-dialog close, regardless of
    whether the user printed or canceled.
  - disconnectedCallback resets _initialized = false (re-attach
    safety, matches every other component in the codebase).

Print stylesheet (~25 lines) appended to components.css with the
@media print rules and the #print-reflection-output element styling.
The element is hidden in screen mode by default; only visible during
print when body.printing-reflection is set.

7 new tests; auto-defined as a side effect of importing the package
(import order placed after sim-coachmark.js).

Phase 10A commit 1 of 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 2 — `feat(examples): topic-page replaces static success-criteria with <sim-checklist>`

### Task 2.1 — Replace SC column markup

**File:** `examples/topic-page/index.html`

Find the existing Learning intentions / success criteria block. Look for the `<section>` containing `<h2>Learning intentions &amp; success criteria</h2>`, and within it the `.ib-lisc__col--sc` div with the static `<ul>`:

```html
<div class="ib-lisc__col ib-lisc__col--sc">
  <div class="ib-lisc__kicker">Success criteria</div>
  <h3 class="ib-lisc__title">I can…</h3>
  <ul class="ib-lisc__list">
    <li>Describe what happens to P when V halves at constant T and n.</li>
    <li>Calculate P, V, T, or n given the other three quantities.</li>
    <li>Explain the shape of a P–V graph at constant temperature and label its axes.</li>
  </ul>
</div>
```

Replace the `<ul class="ib-lisc__list">...</ul>` with `<sim-checklist>`. Keep the kicker and title in place (they provide visual symmetry with the LI col):

```html
<div class="ib-lisc__col ib-lisc__col--sc">
  <div class="ib-lisc__kicker">Success criteria</div>
  <h3 class="ib-lisc__title">I can…</h3>
  <sim-checklist topic="s1.5-gas-laws" level="sl">
    <li>Describe what happens to P when V halves at constant T and n.</li>
    <li>Calculate P, V, T, or n given the other three quantities.</li>
    <li>Explain the shape of a P–V graph at constant temperature and label its axes.</li>
  </sim-checklist>
</div>
```

**Note** the absence of a `label` attribute on `<sim-checklist>` — the existing kicker + title provide the heading. The component renders only the progress indicator on the right of its \_\_head when `label` is missing.

### Task 2.2 — Update the inline `<script>`'s `applyLevel` to push level to all checklists

**File:** `examples/topic-page/index.html`

Find the existing `applyLevel(level)` function in the inline `<script>` block at the bottom. It currently looks like:

```js
function applyLevel(level) {
  // 1. Flip every [data-variant] block in the page.
  for (const el of document.querySelectorAll('[data-variant]')) {
    const visible = el.dataset.variant === `default-${level}`;
    el.hidden = !visible;
  }
  // 2. Mirror to the sim.
  document.getElementById('sim').setAttribute('level', level);
  // 3. Mirror to the header toggle (in case state was restored from prefs).
  const toggle = document.getElementById('hl-toggle');
  if (toggle) toggle.checked = level === 'hl';
}
```

Add a fourth step at the end, before the closing `}`:

```js
function applyLevel(level) {
  // 1. Flip every [data-variant] block in the page.
  for (const el of document.querySelectorAll('[data-variant]')) {
    const visible = el.dataset.variant === `default-${level}`;
    el.hidden = !visible;
  }
  // 2. Mirror to the sim.
  document.getElementById('sim').setAttribute('level', level);
  // 3. Mirror to the header toggle (in case state was restored from prefs).
  const toggle = document.getElementById('hl-toggle');
  if (toggle) toggle.checked = level === 'hl';
  // 4. Push level to every <sim-checklist> on the page so per-level
  //    state swaps with the toggle.
  for (const cl of document.querySelectorAll('sim-checklist')) {
    cl.setAttribute('level', level);
  }
}
```

### Task 2.3 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean, lint clean, **150 tests** still passing (no test changes in this commit), build green.

**Manual visual check (recommended):**

```bash
open examples/topic-page/index.html
```

Verify in the browser:

- The Learning intentions / success criteria section renders. LI col is unchanged. SC col shows kicker + title + checklist (3 checkboxes, "0 of 3 checked" progress indicator on the right, textarea below, 3 buttons).
- Tick a checkbox → progress updates. Reload → check persists.
- Type in the textarea → reload → text persists.
- Flip the HL toggle in the sticky header → checkbox states + textarea content swap to the per-level state. Flip back → SL state restored.
- Click "📄 Download .md" → browser downloads `s1.5-gas-laws-sl-reflection.md` (or `-hl-`). Open it: contains the topic header, level, date, `[x]`/`[ ]` checklist, and (if textarea has text) `## My reflection` section.
- Click "🖨 Save as PDF" → native print dialog opens. The print preview shows ONLY the reflection block — no top strip, no sticky header, no sim, no other sections. Cancel or save; the page returns to normal.
- Click "Reset" → confirmation prompt. Confirming clears all checks and the textarea. Cancel does nothing.
- DevTools → Application → Local Storage → confirm key `aisc-simengine:checklist:s1.5-gas-laws:sl` (or `:hl`) exists with the correct shape.
- Tweaks panel (right side, ⚙ button) and the data card (left side, click any pill) still work and don't conflict with the checklist.

If anything is off, pause and report.

Stage exactly:

- `examples/topic-page/index.html`

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(examples): topic-page replaces static success-criteria with <sim-checklist>

The success-criteria column (.ib-lisc__col--sc) on the Gas Laws topic
page now uses <sim-checklist> in place of its static <ul>. Students
can tick items, write a free-text reflection, and export their work
as .md (one-click download) or PDF (via window.print()).

The kicker + title stay in place (visual symmetry with the LI col).
<sim-checklist> renders without its own label header in this layout
(no label attribute), so the visible heading remains the existing
"Success criteria" kicker + "I can…" title.

The inline <script>'s applyLevel function now pushes the new level
to every <sim-checklist> on the page via setAttribute('level', ...),
so the HL/SL toggle in the sticky header swaps the checklist's
per-level state in addition to the existing sim + variant-content
swaps.

State persists to localStorage at:
  aisc-simengine:checklist:s1.5-gas-laws:sl
  aisc-simengine:checklist:s1.5-gas-laws:hl

The smoke test (examples/vanilla-html/index.html) is unchanged —
it doesn't have a LISC section.

Phase 10A commit 2 of 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 3 — `docs: phase 10A — interactive success-checklist + export`

### Task 3.1 — Update `CHANGELOG.md`

**File:** `CHANGELOG.md`

Find the existing `### Phase 9 — <sim-data-card> slide-out side panel` section. After its end (which includes its "Known follow-ups" list) and BEFORE the `### Notes` footer, insert:

```markdown
### Phase 10A — Interactive success-criteria checklist + export

Three commits introducing `<sim-checklist>` — a generic interactive checklist web component. The Gas Laws topic page's static success-criteria column becomes interactive: students tick items, write a free-text reflection, and export their work as `.md` (one-click download) or PDF (via `window.print()`).

- `feat(core)`: `<sim-checklist>` custom element (component + tests + side-effect import + print stylesheet)
- `feat(examples)`: topic-page replaces static success-criteria with `<sim-checklist>`
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 143 → **150** (+7 net, all in `packages/core/tests/sim-checklist.test.js`).

**Public surface added (`@TBD/simengine`):**

- New custom element `<sim-checklist topic="..." level="..." label="...">` with slotted `<li>` API. Auto-defined as a side effect of importing the core package.
- Three new events (bubbles + composed): `checklist-changed`, `checklist-exported`, `checklist-reset`.
- Imperative API on the element instance: `getState()`, `exportMarkdown(triggerDownload?)`, `exportPDF()`.
- Print stylesheet rules for `body.printing-reflection` and `#print-reflection-output` in `components.css` — used by `exportPDF()` to print the reflection without the rest of the page.

**Persistence:** localStorage key `aisc-simengine:checklist:<topic>:<level>` (separate state per level).

**Known follow-ups (deferred to Phase 10B):**

- `<sim-text-response>` for bell ringer + exit ticket interactivity.
- `<sim-practice-question>` with answer-reveal-and-compare flow.
- `<sim-reflection-export>` aggregator that pulls state from all interactive components on the page into a single portfolio export. Phase 10A's export pipeline is the foundation; 10B refactors export OUT of the checklist into the aggregator.

**Other deferred polish (still queued):**

- Mobile/tablet responsive tweaks for the checklist on narrow viewports.
- Whole-topic-page print stylesheet (spec §12 polish — distinct from the reflection-only print added in 10A).
- Animated check transitions; fancy progress bar.
- The two follow-up tasks from step 6 — `<sim-engine>` private API to public; reinstate `<slot>` in `<sim-coachmark>`.
```

### Task 3.2 — Update `docs/architecture.md`

**File:** `docs/architecture.md`

Find the existing `## Phase 9 — <sim-data-card> slide-out side panel` section. After its end (the "What ships vs what's deferred" table), append:

```markdown
## Phase 10A — Interactive success-criteria checklist + export

A new `<sim-checklist>` custom element makes the topic page's success-criteria column interactive. Students tick items, write a free-text reflection, and export their work as `.md` or PDF. State persists per-topic-per-level via localStorage.

### Architecture

- One `<sim-checklist>` per use site. The topic page mounts one inside the existing `.ib-lisc__col--sc` column (kicker + title preserved; the static `<ul>` becomes a `<sim-checklist>` with slotted `<li>` items).
- Slot-based item API: page authors include plain `<li>` elements as children. The component reads them at upgrade, captures `textContent`, clears the host's light DOM, and renders interactive checkbox-rows in shadow DOM.
- Per-topic-per-level localStorage key: `aisc-simengine:checklist:<topic>:<level>`. State JSON: `{ checkedItems: number[], freeText: string }`.
- Auto-save on check toggle (immediate); on textarea input (300ms debounce). The `level` attribute change force-flushes the pending textarea save to the OLD key before switching, preventing a race where mid-debounce typing is lost.
- All DOM rendered via `createElement` + `textContent`. No `.innerHTML` anywhere.

### Export pipeline

**Markdown** — one-click download. The component generates a markdown string (topic title, level, date, `[x]`/`[ ]` checklist items, optional `## My reflection` section if the textarea has content), wraps it in a `Blob`, creates a temporary `<a download="<topic>-<level>-reflection.md">`, programmatically clicks it, and revokes the object URL on the next tick.

**PDF** — via the browser's native print dialog. The component synthesizes a `#print-reflection-output` element in `document.body` (the same element is reused across exports via `replaceWith`), adds `body.printing-reflection`, and calls `window.print()`. The `@media print` rules in global `components.css` hide everything except `#print-reflection-output` while `body.printing-reflection` is set. An `afterprint` listener (registered on `window` in `connectedCallback`) clears the body class when the dialog closes — regardless of whether the user printed or canceled.

This print pipeline is **reflection-only**. The whole-topic-page print stylesheet remains the deferred §12 polish item.

### Topic-page integration

The Gas Laws topic page's `applyLevel(level)` inline function (added in step 8) gains a fourth step: push the new level to every `<sim-checklist>` element via `setAttribute('level', ...)`. The HL/SL toggle in the sticky header now swaps:

1. The variant-content blocks (existing).
2. The sim's `level` attribute (existing).
3. The HL toggle's checked state (existing).
4. **The checklist's per-level state.** (Phase 10A.)

### What ships vs what's deferred

| Concern                                             | Status                                    |
| --------------------------------------------------- | ----------------------------------------- |
| Generic `<sim-checklist>` with slotted `<li>`s      | Shipped                                   |
| Per-topic-per-level localStorage                    | Shipped                                   |
| Free-text reflection textarea (debounced auto-save) | Shipped                                   |
| .md download                                        | Shipped                                   |
| Save as PDF (reflection-only via `window.print()`)  | Shipped                                   |
| Reset button with confirm                           | Shipped                                   |
| Bell ringer / practice / exit ticket interactivity  | Deferred to Phase 10B                     |
| `<sim-reflection-export>` portfolio aggregator      | Deferred to Phase 10B                     |
| Whole-topic-page print stylesheet                   | Deferred to spec §12 polish               |
| Mobile/tablet responsive tweaks                     | Deferred (polish phase)                   |
| Animated check transitions, fancy progress bar      | Deferred                                  |
| `<sim-engine>` public API → public                  | Deferred (still on step-6 follow-up list) |
| `<slot>` reinstatement in `<sim-coachmark>`         | Deferred (still on step-6 follow-up list) |
```

### Task 3.3 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean (markdown gets prettier-formatted), lint clean, **150 tests** still passing, build green.

Stage exactly:

- `CHANGELOG.md`
- `docs/architecture.md`

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
docs: phase 10A — interactive success-checklist + export

Records phase 10A in CHANGELOG (under [Unreleased]) covering the
3-commit shipment of <sim-checklist>: the new component itself, the
topic-page integration, and this docs entry.

Adds a "## Phase 10A — Interactive success-criteria checklist +
export" section to docs/architecture.md covering: the singleton-per-
use-site model, slot-based <li> API, per-topic-per-level
localStorage, the .md + PDF export pipeline (the reflection-only
print stylesheet vs the deferred §12 whole-page polish), and the
applyLevel integration with the existing topic-page HL/SL toggle.

Phase 10A commit 3 of 3. Phase 10A complete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Final verification

After commit 3 lands, run the final pipeline once more:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean (no new warnings beyond the pre-existing 6)
- **150 tests passing** across both packages (was 143; +7 net)
- build green; bundle delta should be ≤ +3 kB IIFE

Manual visual verification — open `examples/topic-page/index.html` in a real browser and run through the exit-criteria checklist from the design doc:

1. Checklist renders in the SC col with kicker, title, 3 checkboxes, "0 of 3 checked" progress, textarea, 3 buttons. ✓
2. Toggle a checkbox → progress updates. Reload → check persists. ✓
3. Type → reload → text persists. ✓
4. Flip HL/SL → checks + textarea swap to per-level state. ✓
5. Download .md → file with the right markdown. ✓
6. Save as PDF → print dialog with reflection only. ✓
7. Reset → confirm prompt, then clears state. ✓
8. localStorage key visible at `aisc-simengine:checklist:s1.5-gas-laws:sl` (or `:hl`). ✓
9. Tweaks panel + data card + checklist all coexist without interference. ✓

Push the branch and open the PR:

```bash
git push -u origin phase-10a-success-checklist
gh pr create --base main --head phase-10a-success-checklist \
  --title "Phase 10A: <sim-checklist> interactive success-criteria + export" \
  --body "[generated body]"
```

Phase 10A complete.

## Phase 10A exit criteria (from design doc)

1. `pnpm install` clean.
2. `pnpm lint` clean (no new warnings).
3. `pnpm test` — **150 tests** passing (was 143).
4. `pnpm build` produces ESM + IIFE bundles. Bundle delta ≤ +3 kB IIFE.
5. `examples/topic-page/index.html` (after `pnpm build`) opens in a browser and shows the behaviors enumerated in the manual visual verification section above.
6. CI green on PR; merged to `main`.
