/**
 * <sim-glossary-term ref="..."> — inline EAL glossary tooltip.
 *
 * Slot brings in the visible underlined text. On hover (200ms delay)
 * or focus, tooltip appears with full definition. Click pins/unpins
 * (toggle). Escape closes pinned. role="tooltip" + aria-describedby
 * link the term to the tooltip.
 *
 * Unknown ref renders text plain (no underline) + console.warn.
 */
import { getGlossaryTerm } from '@TBD/simengine-data';

let _idCounter = 0;
function nextId() {
  return `sim-gt-${++_idCounter}`;
}

const HOST_STYLES = `
  :host { display: inline; }
  .sim-glossary-term {
    position: relative;
    border-bottom: 1px dotted var(--ib-ink-400, #6b7280);
    cursor: help;
    outline: none;
  }
  .sim-glossary-term:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 2px #5b9dff);
    border-radius: 2px;
  }
  .sim-glossary-term__tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    max-width: 280px;
    padding: var(--sp-3, 12px);
    background: var(--ib-navy-900, #0d1833);
    color: var(--ib-white, #fff);
    border-radius: var(--r-md, 6px);
    font-size: var(--fs-14, 13px);
    line-height: 1.5;
    box-shadow: var(--el-2, 0 4px 12px rgba(0,0,0,0.15));
    z-index: 100;
    text-align: left;
  }
  .sim-glossary-term__tooltip[hidden] { display: none; }
  .sim-glossary-term__term {
    display: block;
    font-weight: 600;
    margin-bottom: var(--sp-1, 4px);
    /* Pedagogically chosen teal — see commit 1 rationale. */
    color: #80d8c5;
  }
  .sim-glossary-term__tooltip::after {
    content: '';
    position: absolute;
    top: 100%; left: 50%; transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--ib-navy-900, #0d1833);
  }
  .sim-glossary-term--missing { border-bottom: none; cursor: text; }
`;

const sheet = new CSSStyleSheet();
sheet.replaceSync(HOST_STYLES);

class SimGlossaryTermElement extends HTMLElement {
  static get observedAttributes() {
    return ['ref'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    this._pinned = false;
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._render();
  }

  disconnectedCallback() {
    // Allow re-render if the element is moved/reattached.
    this._initialized = false;
  }

  _render() {
    const ref = this.getAttribute('ref');
    const entry = getGlossaryTerm(ref);
    const root = this.shadowRoot;
    root.replaceChildren();

    if (!entry) {
      const wrap = document.createElement('span');
      wrap.className = 'sim-glossary-term sim-glossary-term--missing';
      const slot = document.createElement('slot');
      wrap.appendChild(slot);
      root.appendChild(wrap);
      console.warn(`<sim-glossary-term>: unknown ref "${ref}"`);
      return;
    }

    const tooltipId = nextId();
    const wrap = document.createElement('span');
    wrap.className = 'sim-glossary-term';
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-describedby', tooltipId);

    const slot = document.createElement('slot');
    wrap.appendChild(slot);

    const tooltip = document.createElement('span');
    tooltip.className = 'sim-glossary-term__tooltip';
    tooltip.id = tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;

    const termEl = document.createElement('span');
    termEl.className = 'sim-glossary-term__term';
    termEl.textContent = entry.term;
    const defEl = document.createElement('span');
    defEl.className = 'sim-glossary-term__definition';
    defEl.textContent = entry.definition;
    tooltip.append(termEl, defEl);

    let hoverTimer = null;
    wrap.addEventListener('mouseenter', () => {
      if (this._pinned) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        tooltip.hidden = false;
      }, 200);
    });
    wrap.addEventListener('mouseleave', () => {
      if (this._pinned) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      tooltip.hidden = true;
    });

    wrap.addEventListener('focus', () => {
      if (!this._pinned) tooltip.hidden = false;
    });
    wrap.addEventListener('blur', () => {
      if (!this._pinned) tooltip.hidden = true;
    });

    wrap.addEventListener('click', () => {
      this._pinned = !this._pinned;
      tooltip.hidden = !this._pinned;
    });

    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._pinned) {
        this._pinned = false;
        tooltip.hidden = true;
      }
    });

    wrap.append(tooltip);
    root.appendChild(wrap);
  }
}

if (!customElements.get('sim-glossary-term')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-glossary-term')) {
      customElements.define('sim-glossary-term', SimGlossaryTermElement);
    }
  });
}
