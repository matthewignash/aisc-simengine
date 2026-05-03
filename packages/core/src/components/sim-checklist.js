/**
 * <sim-checklist topic="..." level="..." label="..."> — slide-out side-panel checklist.
 *
 * Reads slotted <li> items at upgrade and renders them as interactive checkbox
 * rows in shadow DOM. State + an optional free-text reflection textarea persist
 * to localStorage keyed by topic + level. One action button:
 *   - Reset            → window.confirm() prompt; clears state + storage
 *
 * Phase 10B: in-panel export buttons (Download .md / Save as PDF) were
 * removed. Export is owned by <sim-reflection-export>, which scans every
 * source on the page and builds a portfolio-level export. This component
 * still exposes exportMarkdown() (@internal) and getState()/clear() so the
 * aggregator can pull data and the page-level Clear-all link can wipe it.
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
 *   - checklist-exported: { topic, level, format: 'md' } — only when
 *     exportMarkdown(true) is called
 *   - checklist-reset: { topic, level }
 *
 * Imperative API:
 *   - open() / close() — explicit panel lifecycle (sets/removes data-open)
 *   - getState() → { topic, level, items, checkedItems, freeText }
 *   - clear() — clear state + storage with no confirmation prompt
 *   - exportMarkdown(triggerDownload?) → string  (@internal)
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
  @media (prefers-reduced-motion: reduce) {
    :host,
    :host([data-open]) {
      transition: none;
    }
  }
  @media (max-width: 720px) {
    :host {
      width: calc(100vw - 32px);
      max-width: 320px;
    }
  }
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
    progressEl.setAttribute('aria-live', 'polite');
    progressEl.setAttribute('aria-atomic', 'true');
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
    const resetBtn = this._makeButton('Reset', 'reset', () => this._onReset(), true);
    actions.append(resetBtn);

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

  _clearState() {
    if (this._textareaDebounce) {
      clearTimeout(this._textareaDebounce);
      this._textareaDebounce = null;
    }
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

  _onReset() {
    const confirmed = window.confirm(
      'Clear all checks and reflection text? This cannot be undone.'
    );
    if (!confirmed) return;
    this._clearState();
  }

  /**
   * Clear state + storage + dispatch checklist-reset, no confirmation prompt.
   * Used by <sim-reflection-export>'s "Clear all my work" link.
   */
  clear() {
    this._clearState();
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
      items: this._items.slice(),
      checkedItems: this._state.checkedItems.slice(),
      freeText: this._state.freeText,
    };
  }

  /**
   * Generates the markdown representation of the current state. If
   * `triggerDownload` is true, also creates a Blob and triggers a browser
   * file download.
   *
   * Phase 10B: this method is no longer wired to a UI button (the
   * Download .md button was removed from the panel). Kept on the prototype
   * because <sim-reflection-export> may invoke it directly when building
   * the portfolio export.
   *
   * @internal
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
}

if (!customElements.get('sim-checklist')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-checklist')) {
      customElements.define('sim-checklist', SimChecklistElement);
    }
  });
}
