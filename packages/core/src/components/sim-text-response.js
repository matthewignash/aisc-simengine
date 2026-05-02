/**
 * <sim-text-response topic="..." level="..." id="..." section="..." label="...">
 *
 * Inline textarea bound to a prompt. State persists per-instance to localStorage:
 *   aisc-simengine:textresponse:<topic>:<level>:<id>
 *
 * Renders shadow DOM:
 *   - prompt heading (from `label`)
 *   - <textarea> with debounced (300 ms) auto-save
 *   - char-count footer (aria-live="polite")
 *
 * Public API: getState(), clear(), focus()
 * Events (bubbles + composed): text-response-changed
 *
 * No panel. Inline-only.
 */

const HOST_STYLES = `
  :host {
    display: block;
    font-family: var(--font-sans, sans-serif);
  }
  .sim-text-response__prompt {
    margin: 0 0 var(--sp-2, 8px);
    font-weight: 500;
  }
  .sim-text-response__textarea {
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
  .sim-text-response__textarea:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 2px #5b9dff);
  }
  .sim-text-response__count {
    display: block;
    margin-top: var(--sp-1, 4px);
    font-family: var(--font-mono, monospace);
    font-size: var(--fs-13, 13px);
    color: var(--ib-ink-500, #6b7280);
  }
  @media print {
    .sim-text-response__textarea,
    .sim-text-response__count {
      display: none;
    }
    .sim-text-response__prompt {
      font-weight: 500;
    }
  }
`;

const sheet = new CSSStyleSheet();
sheet.replaceSync(HOST_STYLES);

const STORAGE_PREFIX = 'aisc-simengine:textresponse';
const DEBOUNCE_MS = 300;

class SimTextResponseElement extends HTMLElement {
  static get observedAttributes() {
    return ['level', 'label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    this._state = { value: '' };
    this._debounce = null;
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._render();
    this._loadState();
    this._applyStateToDOM();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._initialized) return;
    if (name === 'level' && oldValue !== newValue) {
      this._flushSave(oldValue);
      this._loadState();
      this._applyStateToDOM();
    } else if (name === 'label' && oldValue !== newValue) {
      const promptEl = this.shadowRoot.querySelector('.sim-text-response__prompt');
      if (promptEl) promptEl.textContent = newValue || '';
      const textarea = this.shadowRoot.querySelector('.sim-text-response__textarea');
      if (textarea) textarea.setAttribute('aria-label', newValue || '');
    }
  }

  disconnectedCallback() {
    if (this._debounce) {
      clearTimeout(this._debounce);
      this._debounce = null;
      this._saveState();
    }
    this._initialized = false;
  }

  _render() {
    const root = this.shadowRoot;
    root.replaceChildren();

    const wrap = document.createElement('div');
    wrap.className = 'sim-text-response';

    const labelText = this.getAttribute('label') || '';
    const prompt = document.createElement('p');
    prompt.className = 'sim-text-response__prompt';
    prompt.textContent = labelText;
    wrap.appendChild(prompt);

    const textarea = document.createElement('textarea');
    textarea.className = 'sim-text-response__textarea';
    textarea.setAttribute('aria-label', labelText);
    textarea.addEventListener('input', (e) => this._onInput(e.target.value));
    wrap.appendChild(textarea);

    const count = document.createElement('span');
    count.className = 'sim-text-response__count';
    count.setAttribute('aria-live', 'polite');
    count.setAttribute('aria-atomic', 'true');
    count.textContent = '0 chars';
    wrap.appendChild(count);

    root.appendChild(wrap);

    this._textarea = textarea;
    this._count = count;
  }

  _storageKey(level) {
    const lvl =
      level !== undefined && level !== null ? level : this.getAttribute('level') || 'default';
    const topic = this.getAttribute('topic') || 'default';
    const id = this.id || 'default';
    return `${STORAGE_PREFIX}:${topic}:${lvl}:${id}`;
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        this._state = { value: typeof parsed.value === 'string' ? parsed.value : '' };
        return;
      }
    } catch {
      // localStorage unavailable / parse failure — fall through
    }
    this._state = { value: '' };
  }

  _saveState(level) {
    try {
      localStorage.setItem(this._storageKey(level), JSON.stringify(this._state));
    } catch {
      // localStorage unavailable — graceful no-op
    }
  }

  _applyStateToDOM() {
    if (this._textarea) this._textarea.value = this._state.value;
    this._updateCount();
  }

  _updateCount() {
    if (this._count) {
      this._count.textContent = `${this._state.value.length} chars`;
    }
  }

  _onInput(value) {
    this._state.value = value;
    this._updateCount();
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      this._saveState();
      this._dispatchChanged();
      this._debounce = null;
    }, DEBOUNCE_MS);
  }

  _flushSave(level) {
    if (this._debounce) {
      clearTimeout(this._debounce);
      this._debounce = null;
      this._saveState(level);
    }
  }

  _dispatchChanged() {
    this.dispatchEvent(
      new CustomEvent('text-response-changed', {
        detail: {
          topic: this.getAttribute('topic') || 'default',
          level: this.getAttribute('level') || 'default',
          id: this.id || null,
          section: this.getAttribute('section') || 'misc',
          value: this._state.value,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * @returns {{ value: string }}
   */
  getState() {
    return { value: this._state.value };
  }

  /**
   * Clear the textarea + persisted state.
   */
  clear() {
    if (this._debounce) {
      clearTimeout(this._debounce);
      this._debounce = null;
    }
    this._state = { value: '' };
    try {
      localStorage.removeItem(this._storageKey());
    } catch {
      // localStorage unavailable
    }
    this._applyStateToDOM();
  }

  /**
   * Focus the textarea.
   */
  focus() {
    if (this._textarea) this._textarea.focus();
  }
}

if (!customElements.get('sim-text-response')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-text-response')) {
      customElements.define('sim-text-response', SimTextResponseElement);
    }
  });
}
