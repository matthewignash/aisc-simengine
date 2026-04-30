/**
 * <sim-coachmark id="..." anchor="..."> — contextual hint popover.
 *
 * Anchored to a CSS-selector-resolved element. The selector is resolved
 * against the coachmark's own root (Document or enclosing ShadowRoot) so
 * the coachmark works whether mounted in light DOM or inside a sim's
 * shadow DOM.
 *
 * Hint text is currently composed by copying the host's textContent into
 * the shadow content (slot semantics are deferred to a follow-up — see
 * sweep — because happy-dom 15.x does not propagate slotted text through
 * .textContent reads, breaking unit tests). For plain-text usage the
 * user-visible result is identical to true slot composition; HTML inside
 * the host element is currently flattened.
 *
 * "Got it" button dismisses; Escape dismisses; emits coachmark-shown
 * with detail { id, dismissed: true } on dismissal. Persists dismissal
 * in localStorage keyed by id; mounting with prior dismissal renders
 * nothing.
 */

const HOST_STYLES = `
  :host { display: block; }
  :host([hidden]) { display: none; }
  .sim-coachmark {
    position: absolute;
    width: 240px;
    padding: var(--sp-4, 16px);
    background: var(--ib-navy-900, #0d1833);
    color: var(--ib-white, #fff);
    border-radius: var(--r-md, 6px);
    box-shadow: var(--el-2, 0 4px 12px rgba(0,0,0,0.25));
    font-family: var(--font-sans, sans-serif);
    font-size: var(--fs-14, 13px);
    line-height: 1.5;
    z-index: 150;
  }
  .sim-coachmark__arrow {
    position: absolute;
    top: 100%; left: 24px;
    border: 8px solid transparent;
    border-top-color: var(--ib-navy-900, #0d1833);
  }
  .sim-coachmark__content { margin-bottom: var(--sp-3, 12px); }
  .sim-coachmark__dismiss {
    /* Pedagogically chosen teal — see commit 1 rationale. */
    background: #2a9d8f;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
  }
  .sim-coachmark__dismiss:hover { filter: brightness(1.1); }
`;

const sheet = new CSSStyleSheet();
sheet.replaceSync(HOST_STYLES);

class SimCoachmarkElement extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;

    if (this._isDismissed()) {
      this.style.display = 'none';
      return;
    }

    queueMicrotask(() => this._render());
  }

  _isDismissed() {
    try {
      return localStorage.getItem(this._storageKey()) === '1';
    } catch (e) {
      return false;
    }
  }

  _storageKey() {
    return `aisc-simengine:coachmark:dismissed:${this.id}`;
  }

  _render() {
    const root = this.shadowRoot;
    const anchorSelector = this.getAttribute('anchor');
    // The coachmark may be mounted inside a sim's shadow root; query from the
    // nearest root (Document or ShadowRoot) so the anchor selector resolves
    // in the same scope as the coachmark itself.
    const scope = /** @type {Document | ShadowRoot} */ (this.getRootNode());
    const anchor = anchorSelector ? scope.querySelector(anchorSelector) : null;
    if (!anchor) {
      console.warn(`<sim-coachmark>: anchor "${anchorSelector}" not found`);
      return;
    }

    const card = document.createElement('div');
    card.className = 'sim-coachmark';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'coachmark-content');

    const arrow = document.createElement('div');
    arrow.className = 'sim-coachmark__arrow';
    arrow.setAttribute('aria-hidden', 'true');

    const content = document.createElement('div');
    content.className = 'sim-coachmark__content';
    content.id = 'coachmark-content';
    // Mirror the host's text into the shadow content div. (A <slot> would be
    // the natural shadow-DOM idiom, but happy-dom 15's slot composition does
    // not project text through textContent reads in tests, so we copy directly.
    // Real browsers see the same text either way.)
    content.textContent = this.textContent;

    const dismiss = document.createElement('button');
    dismiss.className = 'sim-coachmark__dismiss';
    dismiss.type = 'button';
    dismiss.textContent = 'Got it';
    dismiss.addEventListener('click', () => this.dismiss());

    card.append(arrow, content, dismiss);
    root.appendChild(card);

    const rect = anchor.getBoundingClientRect();
    card.style.top = `${rect.top - card.offsetHeight - 12 + window.scrollY}px`;
    card.style.left = `${rect.left + window.scrollX}px`;

    this._escapeHandler = (e) => {
      if (e.key === 'Escape') this.dismiss();
    };
    document.addEventListener('keydown', this._escapeHandler);

    dismiss.focus();
  }

  dismiss() {
    this.style.display = 'none';
    try {
      localStorage.setItem(this._storageKey(), '1');
    } catch (e) {
      // localStorage unavailable — graceful no-op
    }
    this.dispatchEvent(
      new CustomEvent('coachmark-shown', {
        detail: { id: this.id, dismissed: true },
        bubbles: true,
        composed: true,
      })
    );
  }

  disconnectedCallback() {
    if (this._escapeHandler) document.removeEventListener('keydown', this._escapeHandler);
    this._escapeHandler = null;
    // Allow re-render if the element is moved/reattached.
    this._initialized = false;
  }
}

if (!customElements.get('sim-coachmark')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-coachmark')) {
      customElements.define('sim-coachmark', SimCoachmarkElement);
    }
  });
}
