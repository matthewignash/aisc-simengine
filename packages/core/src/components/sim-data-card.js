/**
 * <sim-data-card ref="..."> — singleton slide-out side panel.
 *
 * Lives in the page's light DOM (one per page). Listens on document for
 * `data-pill-clicked` events; on receive, sets its own `ref` attribute,
 * looks up the data via getValue + getSource, and slides into view from the
 * left edge of the viewport via the [data-open] attribute.
 *
 * Multi-pill behavior:
 *   - First pill click: opens with that pill's data.
 *   - Different pill clicked while open: content swaps in place (no
 *     close-then-reopen flicker).
 *   - Same pill clicked again: closes (toggle).
 *   - Outside-click, Escape, close button: all close.
 *
 * Provides "Copy citation" (writes to clipboard) and an optional "View
 * source" link when getSource(...).url is present. Focus-trap modal-like
 * behavior via foundation a11y trapFocus helper. On close, focus restores
 * to the pill that triggered the open.
 */
import { getValue, getSource } from '@TBD/simengine-data';
import { trapFocus, restoreFocusTo } from '../engine/a11y.js';

const HOST_STYLES = `
  :host {
    position: fixed;
    top: 80px;
    left: 16px;
    width: 320px;
    z-index: 100;
    transform: translateX(-120%);
    visibility: hidden;
    /* Hidden state also makes the panel inert. visibility transition delayed
       to wait for the slide-out to complete before hiding (matches the
       tweaks-panel pattern from step 6 commit 7). */
    transition: transform 0.18s ease, visibility 0s linear 0.18s;
    font-family: var(--font-sans, sans-serif);
  }
  :host([data-open]) {
    transform: translateX(0);
    visibility: visible;
    transition: transform 0.18s ease, visibility 0s linear 0s;
  }
  .sim-data-card {
    width: 100%;
    background: var(--ib-white, #fff);
    border: 1px solid var(--ib-ink-200, #ddd);
    border-radius: var(--r-md, 6px);
    box-shadow: var(--el-3, 0 8px 24px rgba(11, 34, 101, 0.18));
    padding: var(--sp-4, 16px);
    /* Long content scrolls within the panel rather than running off the
       viewport. 96px = 80px top offset + 16px breathing room. */
    max-height: calc(100vh - 96px);
    overflow-y: auto;
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
    return ['ref'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    this._currentRef = null;
    this._previouslyFocused = null;
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;

    // Render initial empty shell (no ref → no data fetch yet).
    this._render();

    // Listen globally for pill clicks anywhere in the document.
    this._pillClickHandler = (e) => this._onPillClicked(e);
    document.addEventListener('data-pill-clicked', this._pillClickHandler);

    // Mutual exclusion: listen for sibling panels opening. Close ourselves
    // if a different source signaled open while we're [data-open].
    this._panelOpenedHandler = (e) => {
      if (e.detail?.source !== this && this.hasAttribute('data-open')) {
        this._dismiss();
      }
    };
    document.addEventListener('panel-opened', this._panelOpenedHandler);
  }

  attributeChangedCallback(name) {
    if (!this._initialized) return;
    if (name === 'ref') {
      this._render();
      // Re-arm focus trap if we're still visible after the re-render
      // (content swap while [data-open] is set).
      if (this.hasAttribute('data-open')) {
        this._deactivate({ skipFocusRestore: true });
        this._activate();
      }
    }
  }

  /** @param {CustomEvent} e */
  _onPillClicked(e) {
    const ref = e.detail?.ref;
    if (!ref) return;

    // Save the triggering pill's host element for focus restoration.
    // composedPath()[0] is the inner button (in pill's shadow); its
    // getRootNode() is the pill's ShadowRoot; .host is the pill element.
    const pillHost = e.composedPath()[0]?.getRootNode()?.host || e.target;

    // Same pill clicked again while open → toggle close.
    if (this.hasAttribute('data-open') && this._currentRef === ref) {
      this._dismiss();
      return;
    }

    // Different ref (or first click): open or swap in place.
    this._previouslyFocused = pillHost;
    this._currentRef = ref;
    this.setAttribute('ref', ref); // triggers attributeChangedCallback → _render

    if (!this.hasAttribute('data-open')) {
      this.setAttribute('data-open', '');
      this._activate();
    }
  }

  _render() {
    // Tear down any active state from a previous render so we don't leak
    // listeners or stale refs. Skip focus restore — the next _activate will
    // re-grab the activeElement appropriately.
    this._deactivate({ skipFocusRestore: true });
    this._cardEl = null;
    this._closeBtn = null;

    const ref = this.getAttribute('ref');
    const root = this.shadowRoot;
    root.replaceChildren();

    if (!ref) {
      // Empty shell — no ref yet, panel is closed; nothing to render.
      return;
    }

    const data = getValue(ref);
    const source = data ? getSource(data.source) : null;

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
    if (this._cardEl) {
      this._trap = trapFocus(this._cardEl);
      if (this._closeBtn) this._closeBtn.focus();
    }

    // Escape closes.
    this._escapeHandler = (e) => {
      if (e.key === 'Escape') this._dismiss();
    };
    document.addEventListener('keydown', this._escapeHandler);

    // Outside-click closes — but a click on a <sim-data-pill> is treated as
    // a swap (the pill emits data-pill-clicked, which the global listener
    // handles), not an outside-click close.
    this._outsideClickHandler = (e) => {
      // Inside the card itself? Not outside.
      if (e.composedPath().includes(this)) return;
      // Click on a pill? Let the pill's own dispatch handle it (swap in place).
      const onPill = e
        .composedPath()
        .some((el) => el && el.tagName && el.tagName.toLowerCase() === 'sim-data-pill');
      if (onPill) return;
      // Genuine outside click.
      this._dismiss();
    };
    document.addEventListener('click', this._outsideClickHandler);

    // Mutual exclusion: announce that we're open.
    this.dispatchEvent(
      new CustomEvent('panel-opened', {
        detail: { source: this },
        bubbles: true,
        composed: true,
      })
    );
  }

  _deactivate({ skipFocusRestore = false } = {}) {
    if (this._trap) this._trap.release();
    this._trap = null;
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
    }
    this._escapeHandler = null;
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
    }
    this._outsideClickHandler = null;
    if (!skipFocusRestore && this._previouslyFocused) {
      restoreFocusTo(this._previouslyFocused);
    }
  }

  _dismiss() {
    const closingRef = this.getAttribute('ref');
    this.removeAttribute('data-open');
    this._deactivate();
    this._currentRef = null;
    this._previouslyFocused = null;
    this.dispatchEvent(
      new CustomEvent('data-card-closed', {
        detail: { ref: closingRef },
        bubbles: true,
        composed: true,
      })
    );
  }

  disconnectedCallback() {
    this._deactivate({ skipFocusRestore: true });
    if (this._pillClickHandler) {
      document.removeEventListener('data-pill-clicked', this._pillClickHandler);
    }
    this._pillClickHandler = null;
    if (this._panelOpenedHandler) {
      document.removeEventListener('panel-opened', this._panelOpenedHandler);
      this._panelOpenedHandler = null;
    }
    this._currentRef = null;
    this._previouslyFocused = null;
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
