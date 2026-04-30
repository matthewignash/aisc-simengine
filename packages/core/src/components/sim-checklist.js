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
    // Use children-filter (not :scope > li) since happy-dom doesn't support :scope.
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
