/**
 * <sim-tweaks-panel for="sim-id"> — teacher-facing floating panel.
 *
 * Queries the referenced <sim-engine> for its tweaks: [...] declaration,
 * renders one switch per tweak. Toggles write to state via setVariable
 * or to the host attribute via setAttribute (when tweak.asAttribute is
 * true). Subscribes to state changes so external changes (e.g., HL
 * checkbox above the sim) sync the switches.
 *
 * Hidden by default. Toggle visibility via [data-open] attribute.
 *
 * NOTE (architectural): this component reaches into <sim-engine>'s
 * underscore-prefixed `_sim` and `_state` properties to read the tweaks
 * contract and subscribe to state changes. That coupling is pragmatic
 * for step 6 but should be promoted to a stable public API surface
 * (e.g. `getTweaks()` / `subscribeToState(key, fn)`) before any
 * external consumer ships against `<sim-engine>`. Tracked as a
 * follow-up sweep task.
 */
import componentsCss from '../styles/components.css?inline';

const HOST_STYLES = `
  :host {
    position: fixed;
    top: 80px;
    right: 16px;
    width: 320px;
    background: var(--ib-white, #fff);
    border: 1px solid var(--ib-ink-200, #ddd);
    border-radius: var(--r-md, 6px);
    box-shadow: var(--el-3, 0 8px 24px rgba(0,0,0,0.18));
    transform: translateX(120%);
    /* Hidden state also makes the panel fully inert: visibility:hidden
       removes its inputs from tab order and from the accessibility tree.
       The visibility transition delay (0.18s) waits for the slide-out
       to complete before hiding, so the slide animation reads correctly. */
    visibility: hidden;
    transition: transform 0.18s ease, visibility 0s linear 0.18s;
    z-index: 200;
    font-family: var(--font-sans, sans-serif);
  }
  :host([data-open]) {
    transform: translateX(0);
    visibility: visible;
    transition: transform 0.18s ease, visibility 0s linear 0s;
  }
  .sim-tweaks__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-3, 12px) var(--sp-4, 16px);
    border-bottom: 1px solid var(--ib-ink-200, #ddd);
  }
  .sim-tweaks__title { font-weight: 600; margin: 0; font-size: 1rem; }
  .sim-tweaks__close {
    background: transparent;
    border: none;
    font-size: 1.4em;
    cursor: pointer;
    line-height: 1;
  }
  .sim-tweaks__list {
    list-style: none;
    margin: 0;
    padding: var(--sp-4, 16px);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3, 12px);
  }
`;

const componentsSheet = new CSSStyleSheet();
componentsSheet.replaceSync(componentsCss);

const hostSheet = new CSSStyleSheet();
hostSheet.replaceSync(HOST_STYLES);

class SimTweaksPanelElement extends HTMLElement {
  static get observedAttributes() {
    return ['for'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [hostSheet, componentsSheet];
    this._unsubs = [];
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    queueMicrotask(() => this._render());
  }

  _render() {
    const targetId = this.getAttribute('for');
    const sim = targetId ? document.getElementById(targetId) : null;
    if (!sim) {
      console.warn(`<sim-tweaks-panel>: target "${targetId}" not found`);
      return;
    }
    if (!sim._sim) {
      // Target exists but hasn't run init yet — wait for sim-ready and retry.
      // This handles the case where <sim-tweaks-panel> is parsed before
      // <sim-engine> in the document order.
      sim.addEventListener('sim-ready', () => this._render(), { once: true });
      return;
    }
    const tweaks = sim._sim.tweaks ?? [];
    const root = this.shadowRoot;

    const head = document.createElement('header');
    head.className = 'sim-tweaks__head';
    const title = document.createElement('h3');
    title.className = 'sim-tweaks__title';
    title.textContent = 'Teacher tweaks';
    const close = document.createElement('button');
    close.className = 'sim-tweaks__close';
    close.setAttribute('aria-label', 'Close panel');
    close.type = 'button';
    close.textContent = '×';
    close.addEventListener('click', () => this._close());
    head.append(title, close);

    const list = document.createElement('ul');
    list.className = 'sim-tweaks__list';

    for (const tweak of tweaks) {
      const li = document.createElement('li');
      const label = document.createElement('label');
      label.className = 'sim-switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.tweakId = tweak.id;
      input.checked = sim._state.get(tweak.stateKey) === tweak.on;
      const track = document.createElement('span');
      track.className = 'sim-switch__track';
      track.setAttribute('aria-hidden', 'true');
      const labelText = document.createElement('span');
      labelText.className = 'sim-switch__label';
      labelText.textContent = tweak.label;
      label.append(input, track, labelText);
      li.appendChild(label);
      list.appendChild(li);

      input.addEventListener('change', () => {
        const newValue = input.checked ? tweak.on : tweak.off;
        if (tweak.asAttribute) {
          sim.setAttribute(tweak.stateKey, newValue);
        } else {
          sim.setVariable(tweak.stateKey, newValue);
        }
      });

      this._unsubs.push(
        sim._state.on(tweak.stateKey, (v) => {
          input.checked = v === tweak.on;
        })
      );
    }

    root.append(head, list);

    this._escapeHandler = (e) => {
      if (e.key === 'Escape' && this.hasAttribute('data-open')) this._close();
    };
    document.addEventListener('keydown', this._escapeHandler);
  }

  _close() {
    this.removeAttribute('data-open');
    this.dispatchEvent(new CustomEvent('tweaks-panel-closed', { bubbles: true, composed: true }));
  }

  disconnectedCallback() {
    for (const off of this._unsubs) off();
    this._unsubs = [];
    if (this._escapeHandler) document.removeEventListener('keydown', this._escapeHandler);
    this._escapeHandler = null;
    // Allow re-render if the element is moved/reattached.
    this._initialized = false;
  }
}

if (!customElements.get('sim-tweaks-panel')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-tweaks-panel')) {
      customElements.define('sim-tweaks-panel', SimTweaksPanelElement);
    }
  });
}
