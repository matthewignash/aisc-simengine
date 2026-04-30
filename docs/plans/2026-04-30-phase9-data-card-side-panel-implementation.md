# Phase 9 — Data-Card Side Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `<sim-data-card>` from an inline-anchored absolute popover (which shifts page content) into a singleton fixed slide-out side panel that listens for `data-pill-clicked` events globally and updates content in place when different pills are clicked.

**Architecture:** Component refactor with no new files. `<sim-data-pill>` becomes a thin click-to-emit button (drops its child-card creation, document-level listeners, and toggle logic). `<sim-data-card>` becomes a singleton-style element placed once per page in light DOM; it listens on `document` for `data-pill-clicked` events and slides in from the left via `position: fixed` + `[data-open]` attribute, mirroring the tweaks-panel pattern from step 6. Both example pages add the explicit `<sim-data-card>` sibling element.

**Tech Stack:** Vanilla JS (ES2022, ESM), Vitest + happy-dom, JSDoc-driven types. No new dependencies.

**Companion design doc:** `docs/plans/2026-04-30-phase9-data-card-side-panel-design.md` (read for "why" decisions).

**Repo state at start:** `main` at `4e87873` (step 8 + phase 8a merged via PR #5; this design doc committed). 140 tests passing. Branch protected.

**Standards (carried from prior phases):**

- TDD red-green cycles. For this refactor, write the new test expectations FIRST, see them fail against the current implementation, then refactor the components to make them pass.
- Conventional commits.
- No git config edits — env vars per commit (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`).
- No `git add -A`. Specify files by name.
- No push between commits — controller pushes once at end of phase 9.
- Work in a worktree at `.worktrees/phase-9-data-card-side-panel/` on branch `phase-9-data-card-side-panel`.

---

## Commit 1 — `feat(core): redesign <sim-data-card> as singleton slide-out + <sim-data-pill> emits events`

The biggest commit by far — refactors both components plus both test files together. They're tightly coupled via the new event flow; splitting would leave the pipeline broken between sub-commits.

### Task 1.1 — Rewrite the data-card test suite (RED)

**File:** `packages/core/tests/sim-data-card.test.js` (REPLACE entire contents)

Replace the file with the new singleton-style tests. This is the RED step — the new tests will fail against the current implementation (the current card is per-pill, the new tests expect singleton).

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../src/components/sim-data-pill.js';
import '../src/components/sim-data-card.js';

/**
 * Helper to create the singleton card + pill(s) in document.body, drain
 * microtasks for upgrade, and return references.
 */
async function mount({ pillRefs = ['gas-constant-R'] } = {}) {
  const card = document.createElement('sim-data-card');
  document.body.appendChild(card);
  const pills = pillRefs.map((ref) => {
    const p = document.createElement('sim-data-pill');
    p.setAttribute('ref', ref);
    document.body.appendChild(p);
    return p;
  });
  await Promise.resolve();
  await Promise.resolve();
  return { card, pills };
}

describe('<sim-data-card> (singleton slide-out)', () => {
  let originalClipboardDescriptor;

  beforeEach(() => {
    document.body.replaceChildren();
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  });

  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      delete navigator.clipboard;
    }
  });

  it('renders symbol/name/value/unit/description/source on first pill click', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    const root = card.shadowRoot;
    expect(card.hasAttribute('data-open')).toBe(true);
    expect(root.querySelector('.sim-data-card__symbol').textContent).toBe('R');
    expect(root.querySelector('.sim-data-card__name').textContent).toContain('Molar gas constant');
    expect(root.querySelector('.sim-data-card__number').textContent).toBe('8.314');
    expect(root.querySelector('.sim-data-card__unit').textContent).toBe('J·K⁻¹·mol⁻¹');
    expect(root.querySelector('.sim-data-card__description').textContent).toContain('PV = nRT');
    expect(root.querySelector('.sim-data-card__source').textContent).toContain(
      'IB Chemistry Data Booklet 2025'
    );
  });

  it('clicking the same pill twice toggles open then closed', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    const button = pills[0].shadowRoot.querySelector('button');
    button.click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(true);
    button.click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(false);
  });

  it('clicking a different pill while open swaps content in place', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R', 'boltzmann-kB'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.shadowRoot.querySelector('.sim-data-card__symbol').textContent).toBe('R');
    pills[1].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    // data-open remains set across the swap.
    expect(card.hasAttribute('data-open')).toBe(true);
    expect(card.shadowRoot.querySelector('.sim-data-card__symbol').textContent).toBe('k_B');
  });

  it('close button removes data-open and emits data-card-closed', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('data-card-closed', (e) => events.push(e.detail));
    card.shadowRoot.querySelector('.sim-data-card__close').click();
    expect(card.hasAttribute('data-open')).toBe(false);
    expect(events).toEqual([{ ref: 'gas-constant-R' }]);
  });

  it('Escape key dismisses while card is visible', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(card.hasAttribute('data-open')).toBe(false);
  });

  it('outside click dismisses; click on a different pill swaps (not close-then-reopen)', async () => {
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R', 'boltzmann-kB'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(true);

    // Click on Pill B should swap content; data-open stays set.
    pills[1].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.hasAttribute('data-open')).toBe(true);
    expect(card.shadowRoot.querySelector('.sim-data-card__symbol').textContent).toBe('k_B');

    // A genuine outside click (on body content that is NOT a pill) should dismiss.
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.click();
    expect(card.hasAttribute('data-open')).toBe(false);
  });

  it('Copy citation calls navigator.clipboard.writeText with formatted citation', async () => {
    const writeSpy = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeSpy },
      configurable: true,
    });
    const { card, pills } = await mount({ pillRefs: ['gas-constant-R'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    const copyBtn = card.shadowRoot.querySelectorAll('.sim-btn')[0];
    copyBtn.click();
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('R = 8.314 J·K⁻¹·mol⁻¹'));
  });

  it('View source link is present only when the source has a url', async () => {
    // gas-constant-R sourced from ib-booklet-2025 which has NO url → no link
    const { card, pills } = await mount({
      pillRefs: ['gas-constant-R', 'boltzmann-kB'],
    });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.shadowRoot.querySelector('a.sim-btn')).toBeNull();

    // boltzmann-kB sourced from nist-codata-2018 which HAS a url → link present
    pills[1].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    const link = card.shadowRoot.querySelector('a.sim-btn');
    expect(link).not.toBeNull();
    expect(link.href).toContain('physics.nist.gov');
  });

  it('renders error message and console.errors for an unknown ref', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { card, pills } = await mount({ pillRefs: ['does-not-exist'] });
    pills[0].shadowRoot.querySelector('button').click();
    await Promise.resolve();
    expect(card.shadowRoot.textContent).toContain('Unknown data ref');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-data-card.test.js 2>&1 | tail -20
```

Expected: most tests FAIL because the new tests assume singleton (no parent pill, listens for events globally), but the current card is per-pill child. Specifically the tests that click pills and look for `card.hasAttribute('data-open')` will fail because the current card uses `[hidden]`.

If any test passes against the current implementation, that's surprising — investigate before continuing. (One known case: the unknown-ref test may pass because the current card also handles unknown refs correctly when given a `ref` attribute directly. That's fine.)

### Task 1.2 — Refactor `sim-data-card.js` to singleton-style (GREEN, part 1)

**File:** `packages/core/src/components/sim-data-card.js` (REPLACE entire contents)

Replace with the singleton refactor:

```js
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
  }

  attributeChangedCallback(name, oldValue, newValue) {
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
```

**Note** that `observedAttributes` drops `'hidden'` — visibility is now controlled via `[data-open]` (not an observed attribute; the CSS handles the styling, and the JS sets/removes it directly).

**Don't run tests yet** — the pill is still creating child cards and toggling them via `hidden`, which interferes with the singleton flow. Tests will still fail. Continue to Task 1.3.

### Task 1.3 — Refactor `sim-data-pill.js` to thin click-to-emit (GREEN, part 2)

**File:** `packages/core/src/components/sim-data-pill.js` (REPLACE entire contents)

Replace with the slimmed-down version. The pill keeps its rendering and event-emission, but loses everything related to creating/managing the child card.

```js
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
```

Net change vs. the current file: ~38 lines lighter. Removed: outside-click handler, escape handler, child `<sim-data-card>` creation, `hidden`-toggle logic, `_docClickHandler` / `_keyHandler` / `_card` properties, the disconnectedCallback's listener-cleanup branch.

**Verify the sim-data-card test suite is now GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-data-card.test.js 2>&1 | tail -15
```

Expected: **9/9 tests passing.** If any fail, investigate before proceeding.

Common things to check on failure:

- The "different pill swap" test (#3) depends on `attributeChangedCallback('ref')` triggering a re-render even when the new `ref` is being set programmatically. The implementation does `this.setAttribute('ref', ref)` in `_onPillClicked`; `observedAttributes` includes `'ref'`. Should fire.
- The "outside click on a pill" test (#6) depends on the click reaching the document AND the card's outside-click handler correctly recognizing pills via `composedPath()`. happy-dom's composedPath should include the host element along the path — verify if test fails.
- The clipboard test (#7) uses `Object.defineProperty(navigator, 'clipboard', ...)` — same pattern as step 6 commit 5; should work.

### Task 1.4 — Rewrite the data-pill test suite

**File:** `packages/core/tests/sim-data-pill.test.js` (REPLACE entire contents)

Replace with the new pill tests. These align with the slimmed-down pill behavior:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/components/sim-data-pill.js';

describe('<sim-data-pill>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('renders value and unit from the data table for a known ref', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const root = pill.shadowRoot;
    const valueEl = root.querySelector('.sim-data-pill__value');
    const unitEl = root.querySelector('.sim-data-pill__unit');
    expect(valueEl.textContent).toBe('8.314');
    expect(unitEl.textContent).toBe('J·K⁻¹·mol⁻¹');
  });

  it('renders error marker and console.errors for an unknown ref', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'does-not-exist');
    document.body.appendChild(pill);
    await Promise.resolve();
    const missing = pill.shadowRoot.querySelector('.sim-data-pill--missing');
    expect(missing).not.toBeNull();
    expect(missing.textContent).toContain('does-not-exist');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('emits data-pill-clicked with detail { ref } on click', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('data-pill-clicked', (e) => events.push(e.detail));
    pill.shadowRoot.querySelector('button').click();
    expect(events).toEqual([{ ref: 'gas-constant-R' }]);
  });

  it('re-emits data-pill-clicked on every click (not just the first)', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('data-pill-clicked', (e) => events.push(e.detail));
    const button = pill.shadowRoot.querySelector('button');
    button.click();
    button.click();
    button.click();
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.ref === 'gas-constant-R')).toBe(true);
  });

  it('does NOT register document-level click or keydown listeners', async () => {
    const docAddSpy = vi.spyOn(document, 'addEventListener');
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    // Pill should not add 'click' or 'keydown' listeners directly to document.
    const calls = docAddSpy.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain('click');
    expect(calls).not.toContain('keydown');
    docAddSpy.mockRestore();
  });

  it('button has aria-label with name + value + unit', async () => {
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    const button = pill.shadowRoot.querySelector('button');
    const label = button.getAttribute('aria-label');
    expect(label).toContain('Molar gas constant');
    expect(label).toContain('8.314');
    expect(label).toContain('J·K⁻¹·mol⁻¹');
  });

  it('does NOT create a child sim-data-card in its shadow DOM', async () => {
    // Phase 9 regression test: card lives at page level, not inside pill.
    const pill = document.createElement('sim-data-pill');
    pill.setAttribute('ref', 'gas-constant-R');
    document.body.appendChild(pill);
    await Promise.resolve();
    expect(pill.shadowRoot.querySelector('sim-data-card')).toBeNull();
  });
});
```

### Task 1.5 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean (the existing 6 pre-existing warnings carried from prior phases may persist; that's OK)
- **141 tests** total passing across both packages: 134 → 134 in core (was 134; 7+9 new = 16, 7+6 old = 13 deleted, net +3 → 137? Wait, let me recount.)

Let me recount carefully:

Pre-phase-9 test counts (after step 8 / phase 8a):

- `packages/core/tests/sim-data-pill.test.js`: 7 tests
- `packages/core/tests/sim-data-card.test.js`: 6 tests
- All other core tests: 134 − 7 − 6 = 121 tests
- Data tests: 6

After phase 9:

- `packages/core/tests/sim-data-pill.test.js`: 7 tests (same count, different content)
- `packages/core/tests/sim-data-card.test.js`: 9 tests (+3)
- All other core tests: 121 (unchanged)
- Data: 6 (unchanged)
- Total: 121 + 7 + 9 + 6 = **143 tests**

That's +3 net (was 140 before phase 9, now 143). The design doc said 141; let me update — the actual delta is +3 because I tightened the pill suite to 7 instead of 5. Adjust the exit criteria below to **143**.

- build green (bundle delta ≤ +2 kB IIFE; current is 84.99 kB after phase 8a)

Stage **exactly** these four files:

```bash
git add \
  packages/core/src/components/sim-data-pill.js \
  packages/core/src/components/sim-data-card.js \
  packages/core/tests/sim-data-pill.test.js \
  packages/core/tests/sim-data-card.test.js
```

Commit with **env-var attribution** and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(core): redesign <sim-data-card> as singleton slide-out + <sim-data-pill> emits events

The data-card popover that opens at the pill's location and shifts
surrounding page content is replaced by a singleton fixed slide-out
side panel that listens for data-pill-clicked events globally.

<sim-data-card> changes:
  - position: absolute (vs pill parent) → fixed (vs viewport, top:80px
    left:16px width:320px)
  - [hidden] toggle → [data-open] attribute with transform-based slide
    + visibility transition (matches the tweaks-panel pattern)
  - listens on document for data-pill-clicked CustomEvents
  - tracks _currentRef + _previouslyFocused for swap-in-place UX
  - own document-level outside-click handler (skips clicks on pills)
    and Escape handler
  - max-height: calc(100vh - 96px); overflow-y: auto so long content
    scrolls within the panel
  - box-shadow upgraded from --el-2 to --el-3 (true panel weight)

<sim-data-pill> changes (slimmer):
  - dropped: child <sim-data-card> creation in shadow DOM
  - dropped: document-level outside-click + Escape listeners
  - dropped: hidden-toggle and _docClickHandler/_keyHandler/_card
    properties
  - kept: render value+unit button, aria-label, error marker for
    unknown ref
  - on click: e.stopPropagation() then dispatch data-pill-clicked
    CustomEvent (the only thing it does on click now)

Multi-pill behavior:
  - First pill click: panel slides in with that pill's data
  - Click a different pill while open: content swaps in place
    (no close-then-reopen flicker)
  - Click the same pill again: panel closes (toggle)
  - Outside click: closes (with composedPath check to ignore clicks
    on other pills, which should swap not close)
  - Escape, close button: close

Tests:
  - sim-data-card.test.js fully rewritten for the singleton + event-
    driven model: 6 → 9 tests (+3). New tests cover multi-pill
    swap-in-place, outside-click vs swap regression, content updates.
  - sim-data-pill.test.js rewritten for the slimmed-down pill: 7 → 7
    tests. Two old tests dropped (Escape closes the open card; click-
    outside closes — those are the card's responsibility now). Two new
    tests added (no document-level listeners; no child sim-data-card
    in shadow).

Test count: 140 → 143 (+3).

This phase also resolves the deferred sweep item from step 6 about
"one card open at a time" coordination — singleton naturally does it.

Phase 9 commit 1 of 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 2 — `feat(examples): topic-page + smoke test add singleton <sim-data-card>`

Both example pages currently rely on the pill creating a child card. After commit 1, that's gone — clicking a pill emits an event, but there's no card listening. We add the explicit `<sim-data-card>` element to both pages.

### Task 2.1 — Add `<sim-data-card>` to topic page

**File:** `examples/topic-page/index.html`

Find the `</div>` that closes `<div class="sim-wrap topic-page">` (near the end of the body). Immediately after that closing `</div>` and BEFORE the `<script>` tag, insert:

```html
<!-- Singleton data-card for the page. Listens for data-pill-clicked
         events emitted by any <sim-data-pill> on the page; slides in from
         the left with the clicked pill's data. -->
<sim-data-card></sim-data-card>
```

(The card sits as a sibling of `.sim-wrap` so its `position: fixed` placement is anchored to the viewport without being constrained by `.sim-wrap`'s width cap.)

### Task 2.2 — Add `<sim-data-card>` to smoke test page

**File:** `examples/vanilla-html/index.html`

Find the `</div>` that closes `<div class="sim-wrap">` near the end of the body. Insert the same `<sim-data-card>` element:

```html
<!-- Singleton data-card for the page. Listens for data-pill-clicked
         events emitted by any <sim-data-pill> on the page; slides in from
         the left with the clicked pill's data. -->
<sim-data-card></sim-data-card>
```

(Same sibling-of-`.sim-wrap` placement.)

### Task 2.3 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean, lint clean, **143 tests** still passing (no test changes in this commit), build green.

**Manual visual check (recommended):**

```bash
open examples/topic-page/index.html
```

Verify in the browser:

- Click any data pill → side panel slides in from the left with the pill's data.
- Click a different pill while open → content swaps in place; data-open stays set; no flicker.
- Click the same pill again → panel slides out.
- Click outside the panel (e.g. on a section heading) → panel closes.
- Click on a different pill while open → content swaps (NOT close-then-reopen).
- Escape → closes.
- Close button (×) → closes.
- The page DOES NOT shift content when the panel opens (the whole point of the redesign).
- Tweaks panel (right side) and data card (left side) can both be open simultaneously without overlap.

If anything is off, pause and report.

Stage exactly:

- `examples/topic-page/index.html`
- `examples/vanilla-html/index.html`

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(examples): topic-page + smoke test add singleton <sim-data-card>

Both example pages now declare an explicit <sim-data-card></sim-data-card>
sibling element after .sim-wrap. This is the singleton card that pills
emit events to (per the phase 9 redesign in the previous commit).

Without this element on the page, clicking a pill silently does nothing
visible (the pill emits data-pill-clicked but no listener responds).
The card prints a console.warn-equivalent on first event if missing —
but pages should always include the element.

Sibling-of-.sim-wrap placement so the card's position: fixed is anchored
to the viewport without being constrained by .sim-wrap's width cap.

Phase 9 commit 2 of 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 3 — `docs: phase 9 — data-card side-panel CHANGELOG + architecture`

### Task 3.1 — Update CHANGELOG.md

**File:** `CHANGELOG.md`

Read the current state. Find the existing `### Step 8 — Topic page wrap` section (around line 113). After its end (which currently includes the phase-8a addendum and the "Known follow-ups" list), and BEFORE the `### Notes` footer, insert:

```markdown
### Phase 9 — `<sim-data-card>` slide-out side panel

Three commits refactoring `<sim-data-card>` from an inline-anchored absolute popover (which shifts surrounding page content when it opens) into a singleton fixed slide-out side panel. One card per page; pills emit `data-pill-clicked` events; the card listens globally and updates content in place when different pills are clicked.

- `feat(core)`: redesign `<sim-data-card>` as singleton slide-out + `<sim-data-pill>` emits events
- `feat(examples)`: topic-page + smoke test add singleton `<sim-data-card>`
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 140 → 143 (+3 net). `<sim-data-card>` test file rewritten for the singleton + event-driven model (6 → 9 tests, +3). `<sim-data-pill>` test file rewritten for the slimmed-down pill (7 → 7 tests; 2 old tests dropped, 2 new added).

**Public surface changes (`@TBD/simengine`):**

- `<sim-data-card>` is now a singleton: pages must include exactly one `<sim-data-card></sim-data-card>` element. Visibility is controlled via the `[data-open]` attribute (was `[hidden]`).
- `<sim-data-pill>` no longer creates a child `<sim-data-card>`. Click emits `data-pill-clicked` (existing event); the singleton listens.
- Card position: `position: fixed; top: 80px; left: 16px; width: 320px` (was absolute, anchored to pill).

**Resolved:** the deferred sweep item from step 6 — "Data-pill 'one card open at a time' coordination across multiple pills on a page." With one card per page, only one card can be open.

**Known follow-ups (still deferred):**

- The two follow-up tasks from step 6 — promote `<sim-engine>` private API to public; reinstate `<slot>` in `<sim-coachmark>`.
- Mobile/tablet responsive layout for the card (`top: 80px; left: 16px; width: 320px` may need media queries on narrow viewports).
- Animated content-swap when a different pill is clicked while the card is open (currently the swap is instant — no fade/slide).
- Phase 10's success-criteria interactive checklist with export — its own design phase next.
```

(Don't touch the `### Notes` footer.)

### Task 3.2 — Update architecture.md

**File:** `docs/architecture.md`

Find the existing `## Step 8 — Topic page wrap` section. After its end (the table of deferred work), append:

```markdown
## Phase 9 — `<sim-data-card>` slide-out side panel

A focused refactor of the data-card component, prompted by user feedback after step 8 shipped: the inline-anchored popover shifted surrounding page content when it opened. Phase 9 makes the card a singleton fixed slide-out side panel that does not displace the page.

### Architecture

- One `<sim-data-card>` per page, declared in light DOM as a sibling of the main content wrapper.
- Pills emit `data-pill-clicked` events with `{ ref }`; the card listens globally on `document`.
- Card uses `position: fixed; top: 80px; left: 16px; width: 320px; z-index: 100`. Slides in from the left edge of the viewport via the `[data-open]` attribute (transform + visibility transition, matching the tweaks-panel pattern).
- Content-swap is in-place: clicking a different pill while the card is open re-renders with the new ref without a close-then-reopen animation.
- `_currentRef` and `_previouslyFocused` are tracked on the card; `_currentRef` distinguishes "same pill clicked again" (toggle close) from "different pill" (swap); `_previouslyFocused` updates to the new pill on each swap so close still returns focus to the most recent trigger.

### Two-layer defense for the outside-click vs. pill-click race

When a user clicks Pill B while Pill A's content is showing, BOTH the pill's click handler AND the card's document-level outside-click handler fire (the card sees Pill B as "outside"). Without defense, the doc-click would close the panel just after the swap.

- **Layer 1**: the pill calls `e.stopPropagation()` on its button click — should halt the event before reaching `document`.
- **Layer 2**: the card's outside-click handler additionally walks `e.composedPath()` for any `<sim-data-pill>` element. If found, the click is treated as "into a pill" rather than "outside the card" and is ignored.

Belt-and-suspenders against shadow-DOM event quirks. Verified by the dedicated regression test `outside click dismisses; click on a different pill swaps (not close-then-reopen)`.

### What ships vs what's deferred

| Concern                                                | Status                                    |
| ------------------------------------------------------ | ----------------------------------------- |
| Singleton card per page                                | Shipped                                   |
| Slide from left; coexists with right-side tweaks panel | Shipped                                   |
| Multi-pill swap-in-place                               | Shipped                                   |
| Outside-click ignores pill clicks (regression test)    | Shipped                                   |
| Mobile/tablet responsive layout                        | Deferred (polish phase)                   |
| Animated content-swap                                  | Deferred                                  |
| `<slot>` reinstatement in `<sim-coachmark>`            | Deferred (still on step-6 follow-up list) |
| `<sim-engine>` private API → public                    | Deferred (still on step-6 follow-up list) |
```

### Task 3.3 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean (markdown gets prettier-formatted), lint clean, **143 tests** still passing, build green.

Stage exactly:

- `CHANGELOG.md`
- `docs/architecture.md`

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
docs: phase 9 — data-card side-panel CHANGELOG + architecture

Records phase 9 in CHANGELOG (under [Unreleased]) covering all 3
commits: the singleton refactor of <sim-data-card>, the slimming of
<sim-data-pill>, and the example-page additions.

Adds a "## Phase 9 — <sim-data-card> slide-out side panel" section
to docs/architecture.md covering: the singleton model, the [data-open]
attribute (replacing [hidden]), position: fixed; top:80px left:16px,
multi-pill swap-in-place behavior, and the two-layer defense (pill's
e.stopPropagation + card's composedPath check) against the
outside-click vs. pill-click race.

Phase 9 commit 3 of 3. Phase 9 complete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Final verification

After commit 3 lands, run the final pipeline once more and verify the branch is ready for PR:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean (pre-existing warnings carry; no new ones)
- **143 tests passing** across both packages (was 140; +3 net)
- build green (bundle delta should be ≤ +2 kB IIFE; pre-phase-9 was 84.99 kB)

Manual visual verification — open both example pages and run through the exit criteria:

1. **Topic page**: click any pill → panel slides in from left → content correct → click different pill → swap → close button → restored focus → reload still works.
2. **Smoke test page**: same.
3. **Both panels open simultaneously**: open the data card (left) AND the tweaks panel (right via the ⚙ Tweaks button). Verify they coexist without overlap.

Push the branch and open the PR:

```bash
git push -u origin phase-9-data-card-side-panel
gh pr create --title "Phase 9: <sim-data-card> singleton slide-out side panel" --body "[generated body]"
```

Phase 9 complete.

## Phase 9 exit criteria (from design doc)

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — **143 tests** passing (was 140).
4. `pnpm build` produces ESM + IIFE bundles. Bundle size delta ≤ +2 kB IIFE.
5. `examples/topic-page/index.html` (after `pnpm build`) opens in a browser and shows:
   - Click any data pill → side panel slides in from the **left**.
   - Click a different data pill while panel is open → content swaps in place (no close-then-reopen flicker).
   - Click the same pill twice → panel closes.
   - Click outside the panel → closes.
   - Click on a different pill outside → swaps (NOT close-then-reopen — regression case).
   - Escape key → closes.
   - Close button (×) → closes.
   - Tab from the trigger pill cycles through panel contents (close, copy citation, optional view-source), then wraps back.
   - Focus returns to the triggering pill on close.
   - The panel does NOT push or shift any page content.
6. `examples/vanilla-html/index.html` shows the same behaviors.
7. Tweaks panel (right side) and data card (left side) coexist without overlap.
8. CI green on PR; merged to `main`.
