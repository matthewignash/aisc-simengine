# Phase 10A v2 — Side-Panel Checklist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship `<sim-checklist>` as a slide-out side panel from the left, mutually exclusive with `<sim-data-card>`. Replace the topic page's static success-criteria column markup with a static `<ul>` plus a "📝 Reflect" trigger button that opens the panel.

**Architecture:** New custom element in `packages/core/src/components/sim-checklist.js` (this branch starts from post-PR-#6 main, so phase 10A v1's inline `sim-checklist.js` does NOT exist yet — commit 1 creates the panel-mode component from scratch). Same slot-based `<li>` API, same persistence + export pipelines as v1, but with `position: fixed` panel CSS, `[data-open]` toggle, mutual-exclusion via `panel-opened` events on `document`. `<sim-data-card>` (already in main from PR #6) gains paired event dispatch + listener for the mutual exclusion. Topic page reverts the LISC SC col to a static `<ul>` and adds a Reflect button + `<sim-checklist>` sibling element.

**Tech Stack:** Vanilla JS (ES2022, ESM), Vitest + happy-dom, JSDoc-driven types. No new dependencies.

**Companion design doc:** `docs/plans/2026-05-01-phase10a-v2-side-panel-checklist-design.md` (read for "why" decisions).

**Repo state at start:**

- `main` includes phase 9 (PR #6 merged). Baseline: **143 tests** (137 core + 6 data).
- Phase 10A v1's PR #7 is closed unmerged before or during this work; v1 design + plan docs remain in main as historical record.
- `packages/core/src/components/sim-checklist.js` does NOT exist on this branch's start point.
- `packages/core/src/components/sim-data-card.js` exists and reflects phase 9's singleton refactor.

**Standards (carried from prior phases):**

- TDD red-green cycles. Tests first; see them fail; then implement.
- Conventional commits.
- No git config edits — env vars per commit (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`).
- No `git add -A`. Specify files by name.
- No push between commits — controller pushes once at end of phase 10A v2.
- Work in a worktree at `.worktrees/phase-10a-v2-side-panel/` on branch `phase-10a-v2-side-panel`.
- All synthesized DOM via `createElement` + `textContent`. **No `.innerHTML`.**

---

## Commit 1 — `feat(core): <sim-checklist> custom element — slide-out side panel`

The largest commit: new component file + 11 tests + side-effect import + print stylesheet additions to `components.css`. Creates `sim-checklist.js` from scratch on a branch where it doesn't exist yet.

### Task 1.1 — Write the failing test suite (RED)

**File:** `packages/core/tests/sim-checklist.test.js` (NEW)

Create with this exact content:

```js
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
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-checklist.test.js 2>&1 | tail -10
```

Expected: All 11 tests fail with `Failed to resolve import '../src/components/sim-checklist.js'`. RED witnessed.

### Task 1.2 — Implement the component (GREEN)

**File:** `packages/core/src/components/sim-checklist.js` (NEW)

Create with this exact content:

```js
/**
 * <sim-checklist topic="..." level="..." label="..."> — slide-out side-panel checklist.
 *
 * Reads slotted <li> items at upgrade and renders them as interactive checkbox
 * rows in shadow DOM. State + an optional free-text reflection textarea persist
 * to localStorage keyed by topic + level. Three action buttons:
 *   - 📄 Download .md  → one-click markdown download
 *   - 🖨 Save as PDF   → window.print() into a synthesized print block
 *   - Reset            → window.confirm() prompt; clears state + storage
 *
 * Layout: position: fixed; top: 80px; left: 16px; width: 320px. Slides in
 * from the left edge of the viewport via the [data-open] attribute. Same
 * pattern as <sim-data-card> (phase 9) and <sim-tweaks-panel> (step 6).
 *
 * Mutual exclusion with <sim-data-card>: when this panel opens, it dispatches
 * a `panel-opened` CustomEvent on document. Sibling panels listen for this
 * and close themselves if they were open.
 *
 * Events (bubbles + composed):
 *   - panel-opened: { source: this } — fires on open
 *   - panel-closed: { source: this } — fires on close
 *   - checklist-changed: { topic, level, checkedCount, total, freeText }
 *   - checklist-exported: { topic, level, format: 'md' | 'pdf' }
 *   - checklist-reset: { topic, level }
 *
 * Imperative API:
 *   - open() / close() — explicit panel lifecycle (sets/removes data-open)
 *   - getState() → { topic, level, checkedItems: number[], freeText: string }
 *   - exportMarkdown(triggerDownload?) → string
 *   - exportPDF() → triggers window.print()
 *
 * DOM-safety: all rendering uses createElement + textContent. No .innerHTML.
 */

import { trapFocus, restoreFocusTo } from '../engine/a11y.js';

const HOST_STYLES = `
  :host {
    position: fixed;
    top: 80px;
    left: 16px;
    width: 320px;
    z-index: 100;
    /* Hidden state: slid off-screen-left + visibility:hidden so inputs aren't
       reachable via Tab. Visibility transition delayed to wait for the
       slide-out to complete (matches tweaks-panel + data-card). */
    transform: translateX(-120%);
    visibility: hidden;
    transition: transform 0.18s ease, visibility 0s linear 0.18s;
    font-family: var(--font-sans, sans-serif);
  }
  :host([data-open]) {
    transform: translateX(0);
    visibility: visible;
    transition: transform 0.18s ease, visibility 0s linear 0s;
  }
  .sim-checklist {
    width: 100%;
    background: var(--ib-white, #fff);
    border: 1px solid var(--ib-ink-200, #ddd);
    border-radius: var(--r-md, 8px);
    box-shadow: var(--el-3, 0 8px 24px rgba(11, 34, 101, 0.18));
    padding: var(--sp-4, 16px);
    max-height: calc(100vh - 96px);
    overflow-y: auto;
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
  .sim-checklist__close {
    background: transparent;
    border: none;
    font-size: 1.4em;
    cursor: pointer;
    line-height: 1;
    padding: 0 4px;
    margin-left: var(--sp-2, 8px);
    color: var(--ib-ink-700, #374151);
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
    return ['data-open', 'level', 'label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    this._items = [];
    this._state = { checkedItems: [], freeText: '' };
    this._textareaDebounce = null;
    this._previouslyFocused = null;
    this._trap = null;
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;

    // Capture slotted <li> textContent into items[]. happy-dom doesn't
    // support :scope, so use Array.from(this.children).filter — equivalent
    // to ":scope > li" semantics in real browsers.
    const listItems = Array.from(this.children).filter((c) => c.tagName === 'LI');
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

    // Mutual exclusion: listen for sibling panels opening. Close ourselves
    // if a different source signaled open while we're [data-open].
    this._panelOpenedHandler = (e) => {
      if (e.detail?.source !== this && this.hasAttribute('data-open')) {
        this.close();
      }
    };
    document.addEventListener('panel-opened', this._panelOpenedHandler);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._initialized) return;
    if (name === 'data-open') {
      const isOpen = newValue !== null;
      const wasOpen = oldValue !== null;
      if (isOpen && !wasOpen) this._activate();
      else if (!isOpen && wasOpen) this._deactivate();
    } else if (name === 'level' && oldValue !== newValue) {
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
    if (this._panelOpenedHandler) {
      document.removeEventListener('panel-opened', this._panelOpenedHandler);
      this._panelOpenedHandler = null;
    }
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._trap) {
      this._trap.release();
      this._trap = null;
    }
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
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sim-checklist__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());
    head.appendChild(closeBtn);

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
    this._closeBtn = closeBtn;
    this._wrap = wrap;
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

  // ── Panel lifecycle ─────────────────────────────────────

  /**
   * Open the panel. Idempotent — calling open() while already open is a no-op.
   */
  open() {
    if (this.hasAttribute('data-open')) return;
    this.setAttribute('data-open', '');
  }

  /**
   * Close the panel. Idempotent — calling close() while already closed is a no-op.
   */
  close() {
    if (!this.hasAttribute('data-open')) return;
    this.removeAttribute('data-open');
  }

  _activate() {
    this._previouslyFocused = document.activeElement;

    if (this._wrap) {
      this._trap = trapFocus(this._wrap);
      if (this._closeBtn) this._closeBtn.focus();
    }

    this._escapeHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._escapeHandler);

    // Outside-click closes — but skip clicks on a <sim-data-pill> (those have
    // their own data-card flow; the page-level Reflect button calls
    // e.stopPropagation() so we never see its clicks).
    this._outsideClickHandler = (e) => {
      if (e.composedPath().includes(this)) return;
      const onPill = e
        .composedPath()
        .some((el) => el && el.tagName && el.tagName.toLowerCase() === 'sim-data-pill');
      if (onPill) return;
      this.close();
    };
    document.addEventListener('click', this._outsideClickHandler);

    this.dispatchEvent(
      new CustomEvent('panel-opened', {
        detail: { source: this },
        bubbles: true,
        composed: true,
      })
    );
  }

  _deactivate() {
    if (this._trap) {
      this._trap.release();
      this._trap = null;
    }
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._previouslyFocused) {
      restoreFocusTo(this._previouslyFocused);
      this._previouslyFocused = null;
    }
    this.dispatchEvent(
      new CustomEvent('panel-closed', {
        detail: { source: this },
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

Expected: **11 tests passed.** If any fail, investigate. The test patterns mirror those that worked in PR #7's v1 (the data flow + persistence + export tests are nearly identical), plus 4 new panel-lifecycle tests modeled on phase 9's data-card tests.

### Task 1.3 — Append print stylesheet to global `components.css`

**File:** `packages/core/src/styles/components.css`

Append this block at the END of the file:

```css
/* Phase 10A v2: Reflection-only print stylesheet for <sim-checklist> exportPDF.
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

### Task 1.4 — Add side-effect import to `packages/core/src/index.js`

**File:** `packages/core/src/index.js`

Find the existing `import './components/sim-coachmark.js';` line. Add immediately after:

```js
import './components/sim-checklist.js';
```

### Task 1.5 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean (the existing 6 pre-existing warnings carry; no new ones)
- **154 tests** passing across both packages: core 148 (was 137; +11 new in `sim-checklist.test.js`) + data 6 = 154
- build green; bundle delta ≤ +12 kB IIFE (similar to v1 since the component code is similar size)

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
feat(core): <sim-checklist> custom element — slide-out side panel

New custom element for interactive checklists, designed primarily for
the topic page's success-criteria column reflection use case.

Layout: position: fixed; top: 80px; left: 16px; width: 320px. Slides
in from the LEFT edge of the viewport via the [data-open] attribute.
Same pattern as <sim-data-card> (phase 9) and <sim-tweaks-panel>
(step 6).

Mutual exclusion with <sim-data-card> (the other left-side panel) is
wired in commit 2 of this phase. This commit emits the panel-opened
CustomEvent on _activate; the listener for sibling close lands here
too (so the data-card's commit-2 emit will close this panel).

Slot-based <li> API:
  <sim-checklist topic="..." level="..." label="...">
    <li>Criterion 1</li>
    <li>Criterion 2</li>
  </sim-checklist>

State persists per-topic-per-level to localStorage at:
  aisc-simengine:checklist:<topic>:<level>

Three action buttons inside the panel:
  - 📄 Download .md  → one-click markdown download via Blob + <a download>
  - 🖨 Save as PDF   → window.print() into a synthesized print block;
                       @media print rules in components.css hide
                       everything else during the print dialog
  - Reset            → window.confirm() prompt; clears state + storage

× close button in __head; Escape closes; outside-click closes
(skipping clicks on <sim-data-pill> elements so the data-card's own
flow takes over).

Events emitted (bubbles + composed):
  - panel-opened: { source: this } — for sibling mutual exclusion
  - panel-closed: { source: this }
  - checklist-changed: { topic, level, checkedCount, total, freeText }
  - checklist-exported: { topic, level, format: 'md' | 'pdf' }
  - checklist-reset: { topic, level }

Imperative API: open(), close(), getState(), exportMarkdown(triggerDownload?),
exportPDF().

DOM safety: all rendering uses createElement + textContent. No .innerHTML
anywhere — matches the codebase's existing convention from step 6.

Subtle behaviors:
  - Textarea has a 300ms debounce. Level attribute change force-flushes
    the pending save to the OLD key BEFORE switching to the new key.
  - localStorage write/read failures wrapped in try/catch — graceful
    degradation in private mode / restricted contexts.
  - afterprint listener (registered on window) clears
    body.printing-reflection on print-dialog close, regardless of
    whether the user printed or canceled.
  - happy-dom doesn't support :scope, so slotted-<li> capture uses
    Array.from(this.children).filter — equivalent in real browsers.

Print stylesheet (~25 lines) appended to components.css with the
@media print rules and the #print-reflection-output element styling.

11 new tests; auto-defined as a side effect of importing the package
(import order placed after sim-coachmark.js).

Phase 10A v2 commit 1 of 4. Supersedes the inline implementation
attempted in PR #7 (unmerged).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 2 — `feat(core): <sim-data-card> mutual exclusion via panel-opened events`

The data-card already has a singleton-style panel lifecycle from phase 9 (`_activate`/`_deactivate`/`_dismiss`). This commit adds two pieces:

1. Dispatch `panel-opened` on `_activate` (so `<sim-checklist>`'s document listener can close).
2. Listen for `panel-opened` on `document` in `connectedCallback` (so the data-card closes when the checklist opens). Cleanup in `disconnectedCallback`.

Plus one new test in `sim-data-card.test.js` for the cross-panel close behavior.

### Task 2.1 — Write the failing test (RED)

**File:** `packages/core/tests/sim-data-card.test.js`

Append this new test at the end of the existing `describe` block (after the existing 9 tests):

```js
it('closes when a sibling panel-opened event fires from a non-self source', async () => {
  const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
  pills[0].shadowRoot.querySelector('button').click();
  await Promise.resolve();
  expect(card.hasAttribute('data-open')).toBe(true);

  // Simulate a different panel opening — dispatch synthetic event with a
  // different source.
  const fakeSource = document.createElement('div');
  document.body.appendChild(fakeSource);
  document.dispatchEvent(
    new CustomEvent('panel-opened', {
      detail: { source: fakeSource },
      bubbles: true,
    })
  );
  expect(card.hasAttribute('data-open')).toBe(false);
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-data-card.test.js -t 'sibling panel-opened' 2>&1 | tail -10
```

Expected: the new test FAILS because the data-card doesn't currently listen for `panel-opened` events. RED witnessed.

### Task 2.2 — Modify `sim-data-card.js` for mutual exclusion (GREEN)

**File:** `packages/core/src/components/sim-data-card.js`

Three modifications to the existing component (which currently only has the singleton listener for `data-pill-clicked` from phase 9):

**Modification A: in `connectedCallback`, register the `panel-opened` listener.**

Find the line that registers the pill-clicked listener:

```js
this._pillClickHandler = (e) => this._onPillClicked(e);
document.addEventListener('data-pill-clicked', this._pillClickHandler);
```

Add immediately after, inside the same `connectedCallback`:

```js
// Mutual exclusion: listen for sibling panels opening. Close ourselves
// if a different source signaled open while we're [data-open].
this._panelOpenedHandler = (e) => {
  if (e.detail?.source !== this && this.hasAttribute('data-open')) {
    this._dismiss();
  }
};
document.addEventListener('panel-opened', this._panelOpenedHandler);
```

**Modification B: in `_activate`, dispatch `panel-opened`.**

Find the `_activate` method body. At the end of it (after the existing trap + Escape + outside-click setup), add:

```js
// Mutual exclusion: announce that we're open.
this.dispatchEvent(
  new CustomEvent('panel-opened', {
    detail: { source: this },
    bubbles: true,
    composed: true,
  })
);
```

**Modification C: in `disconnectedCallback`, remove the `panel-opened` listener.**

Find the existing `disconnectedCallback`. After the existing `_pillClickHandler` cleanup, add:

```js
if (this._panelOpenedHandler) {
  document.removeEventListener('panel-opened', this._panelOpenedHandler);
  this._panelOpenedHandler = null;
}
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-data-card.test.js 2>&1 | tail -10
```

Expected: **10 tests passed** (the 9 existing + the new one). If any fail, investigate.

### Task 2.3 — Verify full pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean
- **155 tests** total: core 149 (148 + 1 new in sim-data-card) + data 6 = 155
- build green

Stage exactly:

- `packages/core/src/components/sim-data-card.js`
- `packages/core/tests/sim-data-card.test.js`

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(core): <sim-data-card> mutual exclusion via panel-opened events

Two paired changes to the data-card singleton (the left-side panel
from phase 9):

  1. _activate now dispatches panel-opened CustomEvent
     ({ source: this }, bubbles + composed) — so other left-side
     panels (<sim-checklist> from commit 1) can close themselves
     when this card opens.
  2. connectedCallback now registers a document listener for
     panel-opened. If the source is a different element AND the
     card is [data-open], call _dismiss(). Cleanup in
     disconnectedCallback.

Both pieces wire the mutual-exclusion contract that <sim-checklist>
also implements: opening either panel slides the other out
simultaneously. The right-side <sim-tweaks-panel> is unaffected.

+1 new test: 'closes when a sibling panel-opened event fires from
a non-self source'. The 9 existing data-card tests continue to pass.

Phase 10A v2 commit 2 of 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 3 — `feat(examples): topic-page success-criteria reverts to static + adds Reflect side panel`

Three coordinated changes to `examples/topic-page/index.html`:

1. Revert the LISC SC col's `<ul>` to a static bulleted list (matches LI col).
2. Add a `<button id="reflect-button">📝 Reflect on these criteria</button>` below the static list.
3. Add a `<sim-checklist>` element as a sibling of `.sim-wrap` (after it, like `<sim-data-card>` and `<sim-tweaks-panel>`) with the three slotted `<li>` items.
4. Wire the Reflect button via inline `<script>` to call `toggleAttribute('data-open')` on the checklist, with `e.stopPropagation()` to prevent the checklist's own outside-click handler from re-closing it.

### Task 3.1 — Revert SC col to static bulleted list

**File:** `examples/topic-page/index.html`

The current SC col looks like (post-PR-#6, no inline `<sim-checklist>` in main):

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

The `<ul>` is what was static in main pre-phase-10A. We add the Reflect button immediately after the `</ul>`:

```html
<div class="ib-lisc__col ib-lisc__col--sc">
  <div class="ib-lisc__kicker">Success criteria</div>
  <h3 class="ib-lisc__title">I can…</h3>
  <ul class="ib-lisc__list">
    <li>Describe what happens to P when V halves at constant T and n.</li>
    <li>Calculate P, V, T, or n given the other three quantities.</li>
    <li>Explain the shape of a P–V graph at constant temperature and label its axes.</li>
  </ul>
  <button
    id="reflect-button"
    class="ib-btn ib-btn--ghost"
    style="margin-top: var(--sp-3, 12px); align-self: flex-start"
  >
    📝 Reflect on these criteria
  </button>
</div>
```

(The inline `style` is page-author scoped — keeps the button compact and aligned to the left of the col flex stack.)

### Task 3.2 — Add `<sim-checklist>` as a sibling of `.sim-wrap`

Find the closing `</div>` of `.sim-wrap` (the main content container). Find where the `<sim-data-card>` and `<sim-tweaks-panel>` siblings live (placed after `.sim-wrap` per the phase-9 / step-6 conventions).

Add immediately after `<sim-data-card></sim-data-card>` (the singleton card from phase 9):

```html
<sim-checklist topic="s1.5-gas-laws" level="sl" label="Success criteria">
  <li>Describe what happens to P when V halves at constant T and n.</li>
  <li>Calculate P, V, T, or n given the other three quantities.</li>
  <li>Explain the shape of a P–V graph at constant temperature and label its axes.</li>
</sim-checklist>
```

The `<li>` items match the static list inside the LISC SC col exactly (same text, same order — the component captures these at upgrade and renders them in shadow DOM).

### Task 3.3 — Wire the Reflect button + propagate level

In the existing inline `<script>` block at the bottom of the file, find the `applyLevel(level)` function and add a 5th step (before the closing `}`) that pushes the level to `<sim-checklist>` elements (matches the existing pattern of pushing to the sim and the toggle):

```js
// 5. Push level to every <sim-checklist> on the page so per-level state
//    swaps with the toggle.
for (const cl of document.querySelectorAll('sim-checklist')) {
  cl.setAttribute('level', level);
}
```

Then, in the same `<script>` block, find where the `tweaks-button` click is wired:

```js
document.getElementById('tweaks-button').addEventListener('click', () => {
  document.querySelector('sim-tweaks-panel').toggleAttribute('data-open');
});
```

Add immediately after, the analogous Reflect button wiring:

```js
document.getElementById('reflect-button').addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelector('sim-checklist').toggleAttribute('data-open');
});
```

Note `e.stopPropagation()` — prevents the checklist's outside-click handler from firing on the same click and immediately re-closing.

### Task 3.4 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean, lint clean, **155 tests** still passing, build green.

**Manual visual check (recommended):**

```bash
open examples/topic-page/index.html
```

Verify in the browser:

- LISC SC column shows: kicker + title + static `<ul>` of 3 criteria + "📝 Reflect on these criteria" button below.
- Click Reflect → `<sim-checklist>` slides in from the **left** with header (label "Success criteria" + progress + close ×), 3 checkboxes, reflection textarea, 3 action buttons.
- Click Reflect again → panel slides out (toggle).
- Click × close button → slides out.
- Click outside the panel → slides out.
- Press Escape → slides out.
- Tick checkboxes; reload → state persists.
- Type in textarea; reload → text persists.
- Flip HL/SL toggle → checks + textarea swap to per-level state.
- Click Download .md → file downloads.
- Click Save as PDF → print dialog with reflection only.
- **Mutual exclusion:** open the checklist; click any data pill (in lede or equation panel) → data-card slides in from the left AND checklist slides out simultaneously. Reverse: open a data-card via pill click; click Reflect button → checklist slides in AND data-card slides out.
- Tweaks panel (right side, ⚙ button) coexists with either left-side panel without overlap.

Stage exactly:

- `examples/topic-page/index.html`

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(examples): topic-page success-criteria reverts to static + adds Reflect side panel

Three coordinated changes to examples/topic-page/index.html for the
phase 10A v2 side-panel UX:

  1. The LISC SC col's <ul> stays as a clean static bulleted list
     (matches the LI col). No inline checkboxes, no inline progress
     indicator. The kicker + title + bulleted list provide the same
     visual symmetry the page had before phase 10A.
  2. Add a "📝 Reflect on these criteria" button below the static
     <ul> in the SC col. Class ib-btn ib-btn--ghost; inline style
     for compact margin + alignment.
  3. Add a <sim-checklist topic="s1.5-gas-laws" level="sl"
     label="Success criteria"> as a sibling of .sim-wrap (placed
     after <sim-data-card>) with the three slotted <li>s matching
     the static list.

Inline <script> changes:
  - applyLevel(level) gains a step 5: push the new level to every
    <sim-checklist> on the page via setAttribute('level', ...).
  - Wire the reflect-button click to toggleAttribute('data-open')
    on the <sim-checklist>, with e.stopPropagation() to prevent
    the panel's outside-click handler from re-closing.

State persists to localStorage at:
  aisc-simengine:checklist:s1.5-gas-laws:sl
  aisc-simengine:checklist:s1.5-gas-laws:hl

The smoke test (examples/vanilla-html/index.html) is unchanged —
it doesn't have a LISC section.

Phase 10A v2 commit 3 of 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 4 — `docs: phase 10A v2 — side-panel checklist (supersedes inline)`

### Task 4.1 — Update CHANGELOG.md

**File:** `CHANGELOG.md`

Find the existing `### Phase 9 — <sim-data-card> slide-out side panel` section. After its end (which includes its "Known follow-ups" list) and BEFORE the `### Notes` footer, insert:

```markdown
### Phase 10A v2 — Side-panel checklist + reflection export

Four commits introducing `<sim-checklist>` as a slide-out side panel from the left, mutually exclusive with `<sim-data-card>`. The Gas Laws topic page's static success-criteria column gets a "📝 Reflect on these criteria" button that opens the panel containing interactive checkboxes + a free-text reflection textarea + .md / PDF export.

This phase **supersedes phase 10A v1 (PR #7)**, which shipped an inline-replacement implementation. After live review, the user preferred the side-panel UX from phase 9 (`<sim-data-card>`) over the inline replacement of the LISC SC column. PR #7 was closed unmerged; v1 design + plan docs remain in main as a historical record of the iteration.

- `feat(core)`: `<sim-checklist>` custom element — slide-out side panel
- `feat(core)`: `<sim-data-card>` mutual exclusion via panel-opened events
- `feat(examples)`: topic-page success-criteria reverts to static + adds Reflect side panel
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** +12 net (11 new in `sim-checklist.test.js` + 1 new in `sim-data-card.test.js`).

**Public surface added (`@TBD/simengine`):**

- New custom element `<sim-checklist topic="..." level="..." label="...">` with slotted `<li>` API. Auto-defined as a side effect of importing the core package.
- Five events (bubbles + composed): `panel-opened`, `panel-closed`, `checklist-changed`, `checklist-exported`, `checklist-reset`.
- Imperative API on the element instance: `open()`, `close()`, `getState()`, `exportMarkdown(triggerDownload?)`, `exportPDF()`.
- New mutual-exclusion contract: `<sim-data-card>` and `<sim-checklist>` listen for `panel-opened` on `document` and close themselves if the source is a different element. Same contract is available to any future left-side panel.
- Print stylesheet rules for `body.printing-reflection` + `#print-reflection-output` in `components.css` — used by `<sim-checklist>.exportPDF()` to print the reflection without the rest of the page.

**Persistence:** localStorage key `aisc-simengine:checklist:<topic>:<level>` (separate state per level).

**Known follow-ups (deferred to Phase 10B):**

- `<sim-text-response>` for bell ringer + exit ticket interactivity.
- `<sim-practice-question>` with answer-reveal-and-compare flow.
- `<sim-reflection-export>` aggregator that pulls state from all interactive components on the page into a single portfolio export. Phase 10A v2's export pipeline becomes the foundation; 10B refactors export OUT of the checklist into the aggregator.

**Other deferred polish (still queued):**

- Mobile/tablet responsive tweaks for the side panel.
- Whole-topic-page print stylesheet (spec §12 polish — distinct from the reflection-only print added here).
- Animated check transitions; fancier progress bar.
- More sophisticated mutual-exclusion choreography (e.g., wait for sibling slide-out to complete before sliding in — current runs both transitions concurrently).
- The two follow-up tasks from step 6 — `<sim-engine>` private API to public; reinstate `<slot>` in `<sim-coachmark>`.
```

### Task 4.2 — Update docs/architecture.md

**File:** `docs/architecture.md`

Find the existing `## Phase 9 — <sim-data-card> slide-out side panel` section. After its end, append:

```markdown
## Phase 10A v2 — Side-panel checklist + reflection export

A `<sim-checklist>` custom element ships as a slide-out side panel from the left, mutually exclusive with `<sim-data-card>`. The topic page gains a "📝 Reflect on these criteria" button below the static LISC success-criteria list; clicking it opens the panel.

**Supersedes phase 10A v1** (PR #7, unmerged): v1 shipped an inline-replacement implementation. After live review, the user preferred the side-panel UX. v1's design + plan docs remain in main as historical record.

### Architecture

- One `<sim-checklist>` per use site. Topic page mounts one as a sibling of `.sim-wrap` (alongside `<sim-data-card>` and `<sim-tweaks-panel>`).
- Slot-based item API: page authors include plain `<li>` elements as children. The component reads them at upgrade, captures `textContent`, clears the host's light DOM, and renders interactive checkbox-rows in shadow DOM.
- Per-topic-per-level localStorage key: `aisc-simengine:checklist:<topic>:<level>`. JSON shape: `{ checkedItems: number[], freeText: string }`.
- Auto-save on check toggle (immediate); on textarea input (300ms debounce). The `level` attribute change force-flushes the pending textarea save to the OLD key before switching, preventing a race where mid-debounce typing is lost.
- Position: `position: fixed; top: 80px; left: 16px; width: 320px; z-index: 100`. Slides in via `[data-open]` attribute. Same pattern as `<sim-data-card>` (phase 9) and `<sim-tweaks-panel>` (step 6).

### Mutual exclusion

`<sim-data-card>` and `<sim-checklist>` are both left-side panels. Mutual-exclusion contract:

- On `_activate` (data-card) / `_activate` (checklist), each dispatches `panel-opened` CustomEvent on `document` with `detail: { source: this }`, `bubbles: true, composed: true`.
- Each component's `connectedCallback` registers a document listener for `panel-opened`. If the source is a different element AND the listening panel has `[data-open]`, the listener calls `_dismiss()` (data-card) or `close()` (checklist).
- Both panels' CSS slide transitions (180ms) run concurrently — the user sees one panel slide out as the other slides in.
- Cleanup in `disconnectedCallback` removes the listener.

This contract is open for any future left-side panel to participate in. The right-side `<sim-tweaks-panel>` is unaffected.

### Export pipeline

Same as v1 (the export logic was preserved across the redesign):

- **Markdown** — one-click download. Generates `# topic — Reflection` + level + date + `[x]`/`[ ]` checklist + optional `## My reflection`. `Blob` + `URL.createObjectURL` + temporary `<a download>` + click + revoke.
- **PDF** — synthesizes a `#print-reflection-output` element in `document.body` (reused via `replaceWith` across exports), adds `body.printing-reflection`, calls `window.print()`. The `@media print` rules in global `components.css` hide everything except `#print-reflection-output` while `body.printing-reflection` is set. An `afterprint` listener (registered on `window` in `connectedCallback`) clears the body class when the dialog closes.

This pipeline is **reflection-only**. Whole-topic-page print stylesheet remains the deferred §12 polish item.

### Topic-page integration

The Gas Laws topic page's `applyLevel(level)` inline function now has 5 steps:

1. Flip every `[data-variant]` block (existing, step 8).
2. Mirror level to the sim (existing).
3. Mirror to the HL toggle's checked state (existing).
4. Push level to every `<sim-engine>` (n/a — only one sim per page; no-op for this topic).
5. **Push level to every `<sim-checklist>`** so per-level state swaps with the toggle. (Phase 10A v2.)

The Reflect button's click handler calls `e.stopPropagation()` to prevent the checklist's outside-click handler from immediately re-closing. The button toggles via `toggleAttribute('data-open')` so a second click closes.

### What ships vs what's deferred

| Concern                                                 | Status                                    |
| ------------------------------------------------------- | ----------------------------------------- |
| `<sim-checklist>` as slide-out side panel from the left | Shipped                                   |
| Slot-based `<li>` API                                   | Shipped                                   |
| Per-topic-per-level localStorage                        | Shipped                                   |
| Free-text reflection textarea (debounced auto-save)     | Shipped                                   |
| .md download                                            | Shipped                                   |
| Save as PDF (reflection-only via `window.print()`)      | Shipped                                   |
| Reset button with confirm                               | Shipped                                   |
| Mutual exclusion with `<sim-data-card>`                 | Shipped                                   |
| Bell ringer / practice / exit ticket interactivity      | Deferred to Phase 10B                     |
| `<sim-reflection-export>` portfolio aggregator          | Deferred to Phase 10B                     |
| Whole-topic-page print stylesheet                       | Deferred to spec §12 polish               |
| Mobile/tablet responsive tweaks                         | Deferred (polish phase)                   |
| Animated check transitions, fancier progress bar        | Deferred                                  |
| More sophisticated mutual-exclusion choreography        | Deferred                                  |
| `<sim-engine>` private API → public                     | Deferred (still on step-6 follow-up list) |
| `<slot>` reinstatement in `<sim-coachmark>`             | Deferred (still on step-6 follow-up list) |
```

### Task 4.3 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean, lint clean, **155 tests** still passing, build green.

Stage exactly:

- `CHANGELOG.md`
- `docs/architecture.md`

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
docs: phase 10A v2 — side-panel checklist (supersedes inline)

Records phase 10A v2 in CHANGELOG (under [Unreleased]) covering all
4 commits: the new <sim-checklist> as a slide-out side panel, the
<sim-data-card> mutual-exclusion additions, the topic-page
integration, and this docs entry.

Notes the supersession: phase 10A v1 (PR #7) shipped an inline
implementation that was rejected during live review in favor of
the side-panel UX. v1 design + plan docs stay in main as a
historical record of the iteration.

Adds a "## Phase 10A v2" section to docs/architecture.md covering:
the side-panel architecture, slot-based <li> API, per-topic-per-
level localStorage, the panel-opened mutual-exclusion contract,
the .md + PDF export pipeline (preserved from v1), and the
applyLevel integration with the existing topic-page HL/SL toggle.

Phase 10A v2 commit 4 of 4. Phase 10A v2 complete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Final verification

After commit 4 lands, run the final pipeline once more:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean (no new warnings)
- **155 tests passing** across both packages
- build green; bundle delta documented in PR description

Manual visual verification — open `examples/topic-page/index.html` in a real browser and run through the exit-criteria checklist from the design doc. Pay special attention to:

- The mutual-exclusion choreography (open one left-side panel, then trigger the other; both transitions should run concurrently and look smooth).
- Focus restoration — after closing the checklist via × / Escape / outside-click, focus should return to the Reflect button.

Push the branch, close PR #7 unmerged, and open PR #8:

```bash
git push -u origin phase-10a-v2-side-panel
gh pr close 7 -c 'Superseded by PR #<new>: design pivoted from inline to side-panel UX after live review.'
gh pr create --base main --head phase-10a-v2-side-panel \
  --title "Phase 10A v2: <sim-checklist> slide-out side panel (supersedes PR #7)" \
  --body "[generated body]"
```

Phase 10A v2 complete.

## Phase 10A v2 exit criteria (from design doc)

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — **155 tests** passing (was 143 from main with PR #6 merged).
4. `pnpm build` clean. Bundle delta documented in PR description (≤+12 kB IIFE expected).
5. `examples/topic-page/index.html` (after `pnpm build`) opens in a browser and shows the behaviors enumerated in the manual visual verification section above.
6. CI green on PR #8; merged to `main`.
7. PR #7 closed unmerged with a reference to PR #8 as the supersession.
