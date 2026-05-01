/**
 * <sim-data-pill ref="..."> — clickable inline data value (thin click-to-emit).
 *
 * Looks up the ref via @TBD/simengine-data's getValue(). On click, dispatches
 * a `data-pill-clicked` CustomEvent with detail { ref }; a singleton
 * <sim-data-card> elsewhere in the page listens and slides in with the data.
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

    button.addEventListener('click', (e) => {
      // Stop propagation so the singleton <sim-data-card>'s outside-click
      // handler (which listens on document) doesn't see this event and
      // trigger a close. (The card's handler also defends with a
      // composedPath check for <sim-data-pill>; this is belt-and-suspenders.)
      e.stopPropagation();
      this.dispatchEvent(
        new CustomEvent('data-pill-clicked', {
          detail: { ref },
          bubbles: true,
          composed: true,
        })
      );
    });

    root.appendChild(button);
  }

  disconnectedCallback() {
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
