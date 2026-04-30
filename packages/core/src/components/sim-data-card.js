/**
 * <sim-data-card ref="..."> — popover with the full data entry view.
 *
 * Typically rendered as a child of <sim-data-pill> (toggled hidden).
 * Self-contained: looks up its data via getValue + getSource. Provides
 * a "Copy citation" button (writes to clipboard) and an optional
 * "View source" link when getSource(...).url is present.
 *
 * Focus-trap modal-like behavior via foundation a11y trapFocus helper.
 */
import { getValue, getSource } from '@TBD/simengine-data';
import { trapFocus, restoreFocusTo } from '../engine/a11y.js';

const HOST_STYLES = `
  :host { display: block; }
  :host([hidden]) { display: none; }
  .sim-data-card {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 100;
    width: 320px;
    background: var(--ib-white, #fff);
    border: 1px solid var(--ib-ink-200, #ddd);
    border-radius: var(--r-md, 6px);
    box-shadow: var(--el-2, 0 4px 12px rgba(0,0,0,0.15));
    padding: var(--sp-4, 16px);
    font-family: var(--font-sans, sans-serif);
  }
  .sim-data-card__head {
    display: flex;
    align-items: center;
    gap: var(--sp-2, 8px);
    margin-bottom: var(--sp-3, 12px);
  }
  .sim-data-card__symbol {
    font-family: var(--font-mono, monospace);
    font-weight: 700;
    font-size: 1.1em;
    /* Pedagogically chosen teal — see commit 1 rationale. */
    color: #2a9d8f;
  }
  .sim-data-card__name { flex: 1; font-weight: 600; }
  .sim-data-card__close {
    background: transparent;
    border: none;
    font-size: 1.4em;
    cursor: pointer;
    line-height: 1;
    padding: 0 4px;
  }
  .sim-data-card__value {
    margin: var(--sp-3, 12px) 0;
    font-family: var(--font-mono, monospace);
  }
  .sim-data-card__number { font-size: 1.4em; font-weight: 600; }
  .sim-data-card__unit { color: var(--ib-ink-500, #6b7280); margin-left: 0.5em; }
  .sim-data-card__description {
    font-size: 0.9em;
    color: var(--ib-ink-700, #374151);
    margin: var(--sp-3, 12px) 0;
  }
  .sim-data-card__source {
    font-size: 0.85em;
    color: var(--ib-ink-500, #4b5563);
    border-top: 1px dashed var(--ib-ink-200, #ddd);
    padding-top: var(--sp-3, 12px);
    margin-top: var(--sp-3, 12px);
  }
  .sim-data-card__actions {
    display: flex;
    gap: var(--sp-2, 8px);
    margin-top: var(--sp-3, 12px);
  }
  .sim-btn {
    padding: 6px 12px;
    border: 1px solid var(--ib-ink-300, #c9cdd6);
    border-radius: 4px;
    background: var(--ib-white, #fff);
    cursor: pointer;
    font-size: 0.9em;
    text-decoration: none;
    color: inherit;
  }
  .sim-btn:hover { background: var(--ib-ink-100, #f4f4f4); }
`;

const sheet = new CSSStyleSheet();
sheet.replaceSync(HOST_STYLES);

class SimDataCardElement extends HTMLElement {
  static get observedAttributes() {
    return ['ref', 'hidden'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._render();
    if (!this.hidden) this._activate();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._initialized) return;
    if (name === 'hidden') {
      if (newValue === null) this._activate();
      else this._deactivate();
    } else if (name === 'ref') {
      this._render();
      // Re-arm focus trap if we're still visible after the re-render.
      if (!this.hidden) this._activate();
    }
  }

  _render() {
    // Tear down any active state from a previous render (e.g. ref changed
    // while card was visible) so we don't leak listeners or stale refs.
    this._deactivate();
    this._cardEl = null;
    this._closeBtn = null;
    const ref = this.getAttribute('ref');
    const data = getValue(ref);
    const source = data ? getSource(data.source) : null;
    const root = this.shadowRoot;
    root.replaceChildren();
    if (!data) {
      const errEl = document.createElement('div');
      errEl.className = 'sim-data-card';
      errEl.textContent = `Unknown data ref: ${ref}`;
      root.appendChild(errEl);
      console.error(`<sim-data-card>: unknown ref "${ref}"`);
      return;
    }

    const card = document.createElement('div');
    card.className = 'sim-data-card';
    card.setAttribute('role', 'dialog');

    const head = document.createElement('div');
    head.className = 'sim-data-card__head';
    const symbol = document.createElement('span');
    symbol.className = 'sim-data-card__symbol';
    symbol.textContent = data.symbol || ref;
    const name = document.createElement('span');
    name.className = 'sim-data-card__name';
    name.textContent = data.name || ref;
    const close = document.createElement('button');
    close.className = 'sim-data-card__close';
    close.setAttribute('aria-label', 'Close');
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', () => this._dismiss());
    head.append(symbol, name, close);

    const valueRow = document.createElement('div');
    valueRow.className = 'sim-data-card__value';
    const num = document.createElement('span');
    num.className = 'sim-data-card__number';
    num.textContent = String(data.value);
    const unit = document.createElement('span');
    unit.className = 'sim-data-card__unit';
    unit.textContent = data.unit;
    valueRow.append(num, unit);

    let description = null;
    if (data.description) {
      description = document.createElement('div');
      description.className = 'sim-data-card__description';
      description.textContent = data.description;
    }

    const sourceEl = document.createElement('div');
    sourceEl.className = 'sim-data-card__source';
    if (source) {
      sourceEl.append(
        Object.assign(document.createElement('strong'), { textContent: 'Source: ' }),
        document.createTextNode(source.label),
        ...(source.section ? [document.createTextNode(', ' + source.section)] : []),
        document.createElement('br'),
        document.createTextNode(source.license)
      );
    } else {
      sourceEl.textContent = 'Source unknown.';
    }

    const actions = document.createElement('div');
    actions.className = 'sim-data-card__actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'sim-btn';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy citation';
    copyBtn.addEventListener('click', () => this._copyCitation(data, source));
    actions.appendChild(copyBtn);
    if (source && source.url) {
      const viewLink = document.createElement('a');
      viewLink.className = 'sim-btn';
      viewLink.href = source.url;
      viewLink.target = '_blank';
      viewLink.rel = 'noopener';
      viewLink.textContent = 'View source';
      actions.appendChild(viewLink);
    }

    card.append(head, valueRow);
    if (description) card.appendChild(description);
    card.append(sourceEl, actions);
    root.appendChild(card);

    this._cardEl = card;
    this._closeBtn = close;
  }

  _copyCitation(data, source) {
    if (!navigator.clipboard) return;
    const sourceLabel = source ? source.label : 'unknown source';
    const citation = `${data.symbol || ''} = ${data.value} ${data.unit} (${sourceLabel})`;
    navigator.clipboard.writeText(citation).catch(() => {
      // Graceful fallback — clipboard write may fail in restricted contexts
    });
  }

  _activate() {
    this._previouslyFocused = document.activeElement;
    if (this._cardEl) {
      this._trap = trapFocus(this._cardEl);
      if (this._closeBtn) this._closeBtn.focus();
    }
    this._escapeHandler = (e) => {
      if (e.key === 'Escape') this._dismiss();
    };
    document.addEventListener('keydown', this._escapeHandler);
  }

  _deactivate() {
    if (this._trap) this._trap.release();
    this._trap = null;
    if (this._escapeHandler) document.removeEventListener('keydown', this._escapeHandler);
    this._escapeHandler = null;
    if (this._previouslyFocused) restoreFocusTo(this._previouslyFocused);
    this._previouslyFocused = null;
  }

  _dismiss() {
    this.hidden = true;
    this.dispatchEvent(
      new CustomEvent('data-card-closed', {
        detail: { ref: this.getAttribute('ref') },
        bubbles: true,
        composed: true,
      })
    );
  }

  disconnectedCallback() {
    this._deactivate();
    // Allow re-render if the element is moved/reattached.
    this._initialized = false;
  }
}

if (!customElements.get('sim-data-card')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-data-card')) {
      customElements.define('sim-data-card', SimDataCardElement);
    }
  });
}
