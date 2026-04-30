/**
 * <sim-data-pill ref="..."> — clickable inline data value.
 *
 * Looks up the ref via @TBD/simengine-data's getValue(). On click,
 * toggles a child <sim-data-card> (also in shadow DOM). Outside-click
 * and Escape close. Emits `data-pill-clicked` with detail { ref }.
 *
 * Unknown ref renders an inline error marker and console.errors.
 */
import { getValue } from '@TBD/simengine-data';

const HOST_STYLES = `
  :host { display: inline; }
  .sim-data-pill {
    display: inline-flex;
    gap: 4px;
    padding: 1px 8px;
    border: 1px solid var(--ib-ink-200, #ddd);
    border-radius: 4px;
    background: var(--ib-white, #fff);
    font-family: var(--font-mono, monospace);
    font-size: 0.95em;
    cursor: pointer;
  }
  .sim-data-pill:hover { background: var(--ib-ink-100, #f4f4f4); }
  .sim-data-pill:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 2px #5b9dff);
  }
  .sim-data-pill--missing {
    border-color: crimson;
    color: crimson;
  }
  .sim-data-pill__value { font-weight: 600; }
  .sim-data-pill__unit { color: var(--ib-ink-500, #6b7280); }
`;

const sheet = new CSSStyleSheet();
sheet.replaceSync(HOST_STYLES);

class SimDataPillElement extends HTMLElement {
  static get observedAttributes() {
    return ['ref'];
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
  }

  _render() {
    const ref = this.getAttribute('ref');
    const data = getValue(ref);
    const root = this.shadowRoot;
    root.replaceChildren();
    if (!data) {
      const span = document.createElement('span');
      span.className = 'sim-data-pill sim-data-pill--missing';
      span.textContent = `[missing: ${ref}]`;
      root.appendChild(span);
      console.error(`<sim-data-pill>: unknown ref "${ref}"`);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sim-data-pill';
    button.setAttribute(
      'aria-label',
      `${data.name || data.symbol || ref}: ${data.value} ${data.unit}. Click to view source.`
    );
    const valueEl = document.createElement('span');
    valueEl.className = 'sim-data-pill__value';
    valueEl.textContent = String(data.value);
    const unitEl = document.createElement('span');
    unitEl.className = 'sim-data-pill__unit';
    unitEl.textContent = data.unit;
    button.append(valueEl, unitEl);

    // Child card, hidden by default
    const card = document.createElement('sim-data-card');
    card.setAttribute('ref', ref);
    card.hidden = true;
    this._card = card;

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this._card.hidden = !this._card.hidden;
      this.dispatchEvent(
        new CustomEvent('data-pill-clicked', {
          detail: { ref },
          bubbles: true,
          composed: true,
        })
      );
    });

    // Outside click closes
    this._docClickHandler = (e) => {
      if (!this.contains(e.target) && !e.composedPath().includes(this)) {
        this._card.hidden = true;
      }
    };
    document.addEventListener('click', this._docClickHandler);

    // Escape closes
    this._keyHandler = (e) => {
      if (e.key === 'Escape') this._card.hidden = true;
    };
    document.addEventListener('keydown', this._keyHandler);

    root.append(button, card);
  }

  disconnectedCallback() {
    if (this._docClickHandler) document.removeEventListener('click', this._docClickHandler);
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    this._docClickHandler = null;
    this._keyHandler = null;
    this._card = null;
    // Allow re-render if the element is moved/reattached.
    this._initialized = false;
  }
}

if (!customElements.get('sim-data-pill')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-data-pill')) {
      customElements.define('sim-data-pill', SimDataPillElement);
    }
  });
}
