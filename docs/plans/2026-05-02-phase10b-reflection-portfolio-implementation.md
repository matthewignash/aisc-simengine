# Phase 10B — Interactive Reflection Portfolio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship three new interactive components (`<sim-text-response>`, `<sim-practice-question>`, `<sim-reflection-export>`), refactor `<sim-checklist>` to consolidate export into the aggregator, and wire all four into the Gas Laws topic page so a student can complete bell-ringer + practice + exit-ticket activities and export the entire portfolio (markdown or PDF) from one button in the sticky header.

**Architecture:** Each new component is a vanilla custom element with shadow DOM + adopted constructable stylesheet, JSDoc-typed public API, localStorage persistence keyed by `<topic>:<level>:<id>`. The aggregator is a side-panel (LEFT side, joins the existing `panel-opened` mutual-exclusion contract from PR #8) that does a one-time `document.querySelectorAll` for source elements on each open + each export click. State pull, not push.

**Tech Stack:** Vanilla JS (ES2022, ESM), Vitest + happy-dom, JSDoc-driven types, pnpm workspace. No new dependencies.

**Companion design doc:** `docs/plans/2026-05-02-phase10b-reflection-portfolio-design.md` (commit `b5f813d` on main). Read for the "why" decisions.

---

## Repo state at start

- `main` HEAD: post-PR-#8 (Phase 10A v2 merged) + PR #9 (a11y polish) status — see PR #9 review state.
- Baseline tests: **157** (151 core + 6 data) assuming PR #9 merged before phase 10B starts; **155** (149 core + 6 data) if PR #9 still open.
- Worktree path: `.worktrees/phase-10b-reflection-portfolio/` on branch `phase-10b-reflection-portfolio`.
- Design doc reference: `docs/plans/2026-05-02-phase10b-reflection-portfolio-design.md` already on main.
- Implementation plan reference: this file (`docs/plans/2026-05-02-phase10b-reflection-portfolio-implementation.md`) on main.

## Standards (carried from prior phases)

- TDD red-green cycles. Tests first; see them fail; then implement.
- Conventional commits.
- No git config edits. Use env vars on each commit:
  - `GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com"`
  - `GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com"`
- `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer on every commit.
- No `git add -A`. Stage files by name.
- No push between commits — controller pushes once at end of phase 10B.
- All synthesized DOM via `createElement` + `textContent`. **No `.innerHTML`.**
- No emojis in UI labels or commit messages.

---

## Commit 1 — `feat(core): <sim-text-response> + <sim-practice-question>`

Two new inline components. They share patterns (prompt + persisted input + `prefers-reduced-motion` defensive rule + level-swap force-flush). Ship them together.

### Task 1.1 — Write failing tests for `<sim-text-response>` (RED)

**File:** `packages/core/tests/sim-text-response.test.js` (NEW)

Create with this exact content:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/components/sim-text-response.js';

const STORAGE_KEY_BELL1_SL = 'aisc-simengine:textresponse:s1.5-gas-laws:sl:bell-1';

async function mount(opts = {}) {
  const {
    topic = 's1.5-gas-laws',
    level = 'sl',
    id = 'bell-1',
    section = 'bell-ringer',
    label = 'Write the ideal gas equation. Label every symbol.',
  } = opts;
  const el = document.createElement('sim-text-response');
  el.setAttribute('topic', topic);
  el.setAttribute('level', level);
  el.id = id;
  el.setAttribute('section', section);
  if (label) el.setAttribute('label', label);
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  return el;
}

describe('<sim-text-response>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders prompt + textarea + char-count footer', async () => {
    const el = await mount();
    const prompt = el.shadowRoot.querySelector('.sim-text-response__prompt');
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    const count = el.shadowRoot.querySelector('.sim-text-response__count');
    expect(prompt.textContent).toContain('ideal gas equation');
    expect(textarea).toBeTruthy();
    expect(textarea.getAttribute('aria-label')).toContain('ideal gas equation');
    expect(count.textContent).toBe('0 chars');
    expect(count.getAttribute('aria-live')).toBe('polite');
    expect(count.getAttribute('aria-atomic')).toBe('true');
  });

  it('input persists to localStorage (debounced)', async () => {
    const el = await mount();
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    textarea.value = 'PV = nRT';
    textarea.dispatchEvent(new Event('input'));
    expect(localStorage.getItem(STORAGE_KEY_BELL1_SL)).toBeNull();
    vi.advanceTimersByTime(350);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_BELL1_SL));
    expect(stored).toEqual({ value: 'PV = nRT' });
  });

  it('restores from localStorage on mount + updates char-count', async () => {
    localStorage.setItem(STORAGE_KEY_BELL1_SL, JSON.stringify({ value: 'restored value' }));
    const el = await mount();
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    const count = el.shadowRoot.querySelector('.sim-text-response__count');
    expect(textarea.value).toBe('restored value');
    expect(count.textContent).toBe('14 chars');
  });

  it('level swap force-flushes pending debounce to OLD key, then loads NEW', async () => {
    const _STORAGE_KEY_BELL1_HL = 'aisc-simengine:textresponse:s1.5-gas-laws:hl:bell-1';
    localStorage.setItem(_STORAGE_KEY_BELL1_HL, JSON.stringify({ value: 'hl draft' }));
    const el = await mount({ level: 'sl' });
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    textarea.value = 'sl draft mid-debounce';
    textarea.dispatchEvent(new Event('input'));
    // Pending debounce. Now swap level — must flush to SL key, then load HL.
    el.setAttribute('level', 'hl');
    await Promise.resolve();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_BELL1_SL))).toEqual({
      value: 'sl draft mid-debounce',
    });
    expect(textarea.value).toBe('hl draft');
  });

  it('getState() returns { value }', async () => {
    const el = await mount();
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    textarea.value = 'snapshot';
    textarea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(350);
    expect(el.getState()).toEqual({ value: 'snapshot' });
  });

  it('clear() empties state + localStorage', async () => {
    localStorage.setItem(STORAGE_KEY_BELL1_SL, JSON.stringify({ value: 'to be cleared' }));
    const el = await mount();
    expect(el.getState().value).toBe('to be cleared');
    el.clear();
    const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
    expect(textarea.value).toBe('');
    expect(localStorage.getItem(STORAGE_KEY_BELL1_SL)).toBeNull();
    expect(el.getState()).toEqual({ value: '' });
  });

  it('does not crash when localStorage.setItem throws', async () => {
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () {
      throw new Error('QuotaExceededError');
    };
    try {
      const el = await mount();
      const textarea = el.shadowRoot.querySelector('.sim-text-response__textarea');
      textarea.value = 'while broken';
      textarea.dispatchEvent(new Event('input'));
      expect(() => vi.advanceTimersByTime(350)).not.toThrow();
    } finally {
      Storage.prototype.setItem = origSetItem;
    }
  });
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-text-response.test.js 2>&1 | tail -10
```

Expected: all 7 tests fail with `Failed to resolve import '../src/components/sim-text-response.js'`. RED witnessed.

### Task 1.2 — Implement `<sim-text-response>` (GREEN)

**File:** `packages/core/src/components/sim-text-response.js` (NEW)

Create with this exact content:

```js
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
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-text-response.test.js 2>&1 | tail -10
```

Expected: **7 tests passed.**

### Task 1.3 — Add side-effect import for `<sim-text-response>`

**File:** `packages/core/src/index.js`

Find the existing line `import './components/sim-checklist.js';`. Add immediately after:

```js
import './components/sim-text-response.js';
```

(Tasks 1.4–1.7 continue in the appended sections of this plan.)

### Task 1.4 — Write failing tests for `<sim-practice-question>` (RED)

**File:** `packages/core/tests/sim-practice-question.test.js` (NEW)

Create with this exact content:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/components/sim-practice-question.js';

const STORAGE_KEY_P1_SL = 'aisc-simengine:practice:s1.5-gas-laws:sl:practice-1';

async function mount(opts = {}) {
  const {
    topic = 's1.5-gas-laws',
    level = 'sl',
    id = 'practice-1',
    section = 'practice',
    label = 'Calculate the volume occupied by 0.25 mol of an ideal gas at 250 K and 150 kPa.',
    answer = 'V = nRT / P = 3.46 L',
  } = opts;
  const el = document.createElement('sim-practice-question');
  el.setAttribute('topic', topic);
  el.setAttribute('level', level);
  el.id = id;
  el.setAttribute('section', section);
  if (label) el.setAttribute('label', label);
  if (answer !== null) {
    const slot = document.createElement('div');
    slot.slot = 'answer';
    slot.textContent = answer;
    el.appendChild(slot);
  }
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  return el;
}

describe('<sim-practice-question>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('renders prompt + attempt textarea + Show-answer button; reveal block hidden', async () => {
    const el = await mount();
    const prompt = el.shadowRoot.querySelector('.sim-practice__prompt');
    const textarea = el.shadowRoot.querySelector('.sim-practice__textarea');
    const showBtn = el.shadowRoot.querySelector('.sim-practice__show-answer');
    const reveal = el.shadowRoot.querySelector('.sim-practice__reveal');
    expect(prompt.textContent).toContain('volume occupied by 0.25 mol');
    expect(textarea).toBeTruthy();
    expect(showBtn.textContent).toBe('Show answer');
    expect(reveal.hidden).toBe(true);
  });

  it('clicking Show answer reveals slot + 3 rating chips', async () => {
    const el = await mount();
    const showBtn = el.shadowRoot.querySelector('.sim-practice__show-answer');
    showBtn.click();
    const reveal = el.shadowRoot.querySelector('.sim-practice__reveal');
    const chips = el.shadowRoot.querySelectorAll('.sim-practice__chip');
    expect(reveal.hidden).toBe(false);
    expect(showBtn.disabled).toBe(true);
    expect(chips).toHaveLength(3);
    expect(chips[0].dataset.rating).toBe('got-it');
    expect(chips[1].dataset.rating).toBe('after-reveal');
    expect(chips[2].dataset.rating).toBe('confused');
    expect(chips[0].textContent).toBe('Got it');
    expect(chips[1].textContent).toBe('Got it after reveal');
    expect(chips[2].textContent).toBe('Still confused');
  });

  it('clicking a rating chip records state + sets aria-pressed + emits practice-changed', async () => {
    const el = await mount();
    const events = [];
    document.body.addEventListener('practice-changed', (e) => events.push(e.detail));
    el.shadowRoot.querySelector('.sim-practice__show-answer').click();
    const chips = el.shadowRoot.querySelectorAll('.sim-practice__chip');
    chips[1].click();
    expect(chips[0].getAttribute('aria-pressed')).toBe('false');
    expect(chips[1].getAttribute('aria-pressed')).toBe('true');
    expect(chips[2].getAttribute('aria-pressed')).toBe('false');
    expect(el.getState().rating).toBe('after-reveal');
    expect(events.some((e) => e.rating === 'after-reveal')).toBe(true);
  });

  it('attempt + revealed + rating all persist + restore from localStorage', async () => {
    localStorage.setItem(
      STORAGE_KEY_P1_SL,
      JSON.stringify({
        attempt: 'V = (0.25 × 8.314 × 250) / 150000 = 0.00346 m^3',
        revealed: true,
        rating: 'got-it',
      })
    );
    const el = await mount();
    const textarea = el.shadowRoot.querySelector('.sim-practice__textarea');
    const reveal = el.shadowRoot.querySelector('.sim-practice__reveal');
    const showBtn = el.shadowRoot.querySelector('.sim-practice__show-answer');
    const chips = el.shadowRoot.querySelectorAll('.sim-practice__chip');
    expect(textarea.value).toContain('0.00346');
    expect(reveal.hidden).toBe(false);
    expect(showBtn.disabled).toBe(true);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('level swap force-flushes pending debounce to OLD key, then loads NEW', async () => {
    const _STORAGE_KEY_P1_HL = 'aisc-simengine:practice:s1.5-gas-laws:hl:practice-1';
    localStorage.setItem(
      _STORAGE_KEY_P1_HL,
      JSON.stringify({ attempt: 'hl draft', revealed: false, rating: null })
    );
    const el = await mount({ level: 'sl' });
    const textarea = el.shadowRoot.querySelector('.sim-practice__textarea');
    textarea.value = 'sl mid-debounce';
    textarea.dispatchEvent(new Event('input'));
    el.setAttribute('level', 'hl');
    await Promise.resolve();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY_P1_SL))).toEqual({
      attempt: 'sl mid-debounce',
      revealed: false,
      rating: null,
    });
    expect(textarea.value).toBe('hl draft');
  });

  it('getState() returns { attempt, revealed, rating }', async () => {
    const el = await mount();
    el.shadowRoot.querySelector('.sim-practice__show-answer').click();
    el.shadowRoot.querySelectorAll('.sim-practice__chip')[2].click();
    expect(el.getState()).toEqual({ attempt: '', revealed: true, rating: 'confused' });
  });

  it('restoring revealed=true with no [slot=answer] content logs a console warning', async () => {
    localStorage.setItem(
      STORAGE_KEY_P1_SL,
      JSON.stringify({ attempt: '', revealed: true, rating: null })
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await mount({ answer: null });
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-practice-question.test.js 2>&1 | tail -10
```

Expected: all 7 tests fail with `Failed to resolve import '../src/components/sim-practice-question.js'`. RED witnessed.

### Task 1.5 — Implement `<sim-practice-question>` (GREEN)

**File:** `packages/core/src/components/sim-practice-question.js` (NEW)

Create with this exact content:

```js
/**
 * <sim-practice-question topic="..." level="..." id="..." section="..." label="...">
 *   <div slot="answer">...</div>
 * </sim-practice-question>
 *
 * Do-then-reveal practice flow with 3-chip self-rating after reveal.
 *
 * State (persisted to localStorage at aisc-simengine:practice:<topic>:<level>:<id>):
 *   { attempt: string, revealed: boolean, rating: 'got-it' | 'after-reveal' | 'confused' | null }
 *
 * Public API: getState(), clear()
 * Events (bubbles + composed): practice-changed
 */

const HOST_STYLES = `
  :host {
    display: block;
    font-family: var(--font-sans, sans-serif);
  }
  .sim-practice__prompt {
    margin: 0 0 var(--sp-2, 8px);
    font-weight: 500;
  }
  .sim-practice__textarea {
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
  .sim-practice__textarea:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring, 0 0 0 2px #5b9dff);
  }
  .sim-practice__show-answer {
    margin-top: var(--sp-3, 12px);
    padding: 6px 12px;
    border: 1px solid var(--ib-ink-300, #c9cdd6);
    border-radius: 4px;
    background: var(--ib-white, #fff);
    cursor: pointer;
    font-size: var(--fs-14, 14px);
    font-family: inherit;
  }
  .sim-practice__show-answer:hover { background: var(--ib-ink-100, #f4f4f4); }
  .sim-practice__show-answer:disabled { opacity: 0.5; cursor: not-allowed; }
  .sim-practice__reveal {
    margin-top: var(--sp-3, 12px);
    padding: var(--sp-3, 12px);
    border-left: 3px solid var(--ib-navy-600, #2a46a3);
    background: var(--ib-navy-050, #f5f7fc);
  }
  .sim-practice__reveal[hidden] { display: none; }
  .sim-practice__rating {
    display: flex;
    gap: var(--sp-2, 8px);
    margin-top: var(--sp-3, 12px);
    flex-wrap: wrap;
  }
  .sim-practice__chip {
    padding: 4px 10px;
    border: 1px solid var(--ib-ink-300, #c9cdd6);
    border-radius: 999px;
    background: var(--ib-white, #fff);
    cursor: pointer;
    font-size: var(--fs-13, 13px);
    font-family: inherit;
  }
  .sim-practice__chip:hover { background: var(--ib-ink-100, #f4f4f4); }
  .sim-practice__chip[aria-pressed='true'] {
    background: var(--ib-navy-600, #2a46a3);
    color: var(--ib-white, #fff);
    border-color: var(--ib-navy-600, #2a46a3);
  }
`;

const sheet = new CSSStyleSheet();
sheet.replaceSync(HOST_STYLES);

const STORAGE_PREFIX = 'aisc-simengine:practice';
const DEBOUNCE_MS = 300;
const VALID_RATINGS = ['got-it', 'after-reveal', 'confused'];

class SimPracticeQuestionElement extends HTMLElement {
  static get observedAttributes() {
    return ['level', 'label'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    this._state = { attempt: '', revealed: false, rating: null };
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
      const promptEl = this.shadowRoot.querySelector('.sim-practice__prompt');
      if (promptEl) promptEl.textContent = newValue || '';
      const textarea = this.shadowRoot.querySelector('.sim-practice__textarea');
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
    wrap.className = 'sim-practice';

    const labelText = this.getAttribute('label') || '';
    const prompt = document.createElement('p');
    prompt.className = 'sim-practice__prompt';
    prompt.textContent = labelText;
    wrap.appendChild(prompt);

    const textarea = document.createElement('textarea');
    textarea.className = 'sim-practice__textarea';
    textarea.setAttribute('aria-label', labelText);
    textarea.addEventListener('input', (e) => this._onAttemptInput(e.target.value));
    wrap.appendChild(textarea);

    const showBtn = document.createElement('button');
    showBtn.className = 'sim-practice__show-answer';
    showBtn.type = 'button';
    showBtn.textContent = 'Show answer';
    showBtn.addEventListener('click', () => this._onShowAnswer());
    wrap.appendChild(showBtn);

    const reveal = document.createElement('div');
    reveal.className = 'sim-practice__reveal';
    reveal.hidden = true;

    const slot = document.createElement('slot');
    slot.name = 'answer';
    reveal.appendChild(slot);

    const rating = document.createElement('div');
    rating.className = 'sim-practice__rating';
    rating.setAttribute('role', 'group');
    rating.setAttribute('aria-label', 'How did you do?');

    for (const r of VALID_RATINGS) {
      const chip = document.createElement('button');
      chip.className = 'sim-practice__chip';
      chip.type = 'button';
      chip.dataset.rating = r;
      chip.setAttribute('aria-pressed', 'false');
      chip.textContent = this._chipLabel(r);
      chip.addEventListener('click', () => this._onChipClick(r));
      rating.appendChild(chip);
    }

    reveal.appendChild(rating);
    wrap.appendChild(reveal);
    root.appendChild(wrap);

    this._textarea = textarea;
    this._showBtn = showBtn;
    this._reveal = reveal;
    this._rating = rating;
    this._slot = slot;
  }

  _chipLabel(rating) {
    if (rating === 'got-it') return 'Got it';
    if (rating === 'after-reveal') return 'Got it after reveal';
    if (rating === 'confused') return 'Still confused';
    return rating;
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
        this._state = {
          attempt: typeof parsed.attempt === 'string' ? parsed.attempt : '',
          revealed: parsed.revealed === true,
          rating: VALID_RATINGS.includes(parsed.rating) ? parsed.rating : null,
        };
        return;
      }
    } catch {
      // localStorage unavailable / parse failure
    }
    this._state = { attempt: '', revealed: false, rating: null };
  }

  _saveState(level) {
    try {
      localStorage.setItem(this._storageKey(level), JSON.stringify(this._state));
    } catch {
      // localStorage unavailable
    }
  }

  _applyStateToDOM() {
    if (this._textarea) this._textarea.value = this._state.attempt;
    if (this._reveal) this._reveal.hidden = !this._state.revealed;
    if (this._showBtn) this._showBtn.disabled = this._state.revealed;
    if (this._rating) {
      const chips = this._rating.querySelectorAll('.sim-practice__chip');
      chips.forEach((c) => {
        const isActive = c.dataset.rating === this._state.rating;
        c.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    // Mount-order safety: warn if state says revealed but slot has no nodes.
    if (this._state.revealed && this._slot) {
      const slotted = this._slot.assignedElements
        ? this._slot.assignedElements({ flatten: true })
        : [];
      if (slotted.length === 0) {
        console.warn(
          '<sim-practice-question>: state has revealed=true but no [slot="answer"] content present'
        );
      }
    }
  }

  _onAttemptInput(value) {
    this._state.attempt = value;
    if (this._debounce) clearTimeout(this._debounce);
    this._debounce = setTimeout(() => {
      this._saveState();
      this._dispatchChanged();
      this._debounce = null;
    }, DEBOUNCE_MS);
  }

  _onShowAnswer() {
    if (this._state.revealed) return;
    this._state.revealed = true;
    if (this._reveal) this._reveal.hidden = false;
    if (this._showBtn) this._showBtn.disabled = true;
    this._saveState();
    this._dispatchChanged();
  }

  _onChipClick(rating) {
    if (!VALID_RATINGS.includes(rating)) return;
    this._state.rating = rating;
    this._applyStateToDOM();
    this._saveState();
    this._dispatchChanged();
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
      new CustomEvent('practice-changed', {
        detail: {
          topic: this.getAttribute('topic') || 'default',
          level: this.getAttribute('level') || 'default',
          id: this.id || null,
          section: this.getAttribute('section') || 'misc',
          attempt: this._state.attempt,
          revealed: this._state.revealed,
          rating: this._state.rating,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * @returns {{ attempt: string, revealed: boolean, rating: string | null }}
   */
  getState() {
    return {
      attempt: this._state.attempt,
      revealed: this._state.revealed,
      rating: this._state.rating,
    };
  }

  /**
   * Clear attempt + revealed + rating + persisted state.
   */
  clear() {
    if (this._debounce) {
      clearTimeout(this._debounce);
      this._debounce = null;
    }
    this._state = { attempt: '', revealed: false, rating: null };
    try {
      localStorage.removeItem(this._storageKey());
    } catch {
      // localStorage unavailable
    }
    this._applyStateToDOM();
  }
}

if (!customElements.get('sim-practice-question')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-practice-question')) {
      customElements.define('sim-practice-question', SimPracticeQuestionElement);
    }
  });
}
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-practice-question.test.js 2>&1 | tail -10
```

Expected: **7 tests passed.**

### Task 1.6 — Add side-effect import for `<sim-practice-question>`

**File:** `packages/core/src/index.js`

Add immediately after the line you added in Task 1.3 (`import './components/sim-text-response.js';`):

```js
import './components/sim-practice-question.js';
```

### Task 1.7 — Verify pipeline + commit

From the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint: 0 errors, no new warnings (the 6 pre-existing carry)
- **170 tests** total (assumes baseline 157 from main with PR #9 merged): 164 core (151 + 7 + 7 = 165 — adjust expectation if baseline differs) + 6 data. Confirm actual count and report any drift.
- build green; bundle delta ≤ +9 kB IIFE (estimate: ~4 kB per component combined).

Stage exactly these five files:

```bash
git add \
  packages/core/src/components/sim-text-response.js \
  packages/core/src/components/sim-practice-question.js \
  packages/core/src/index.js \
  packages/core/tests/sim-text-response.test.js \
  packages/core/tests/sim-practice-question.test.js
```

Commit with env-var attribution and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(core): <sim-text-response> + <sim-practice-question>

Two new inline custom elements for the topic-page interactive
reflection portfolio (Phase 10B).

<sim-text-response>: bound textarea under a prompt. Used for bell
ringer (3 instances) and exit ticket (3 instances). State persists
per-instance to localStorage at:
  aisc-simengine:textresponse:<topic>:<level>:<id>

<sim-practice-question>: do-then-reveal flow with a 3-chip self-
rating after reveal (Got it / Got it after reveal / Still confused).
Slotted [slot="answer"] carries the model answer markup so the page
author keeps full control. State persists at:
  aisc-simengine:practice:<topic>:<level>:<id>

Both components:
  - Use shadow DOM + adopted constructable stylesheet (singleton
    sheet shared across instances of each tag).
  - Observe `level` for HL/SL state swap. attributeChangedCallback
    force-flushes any pending debounce save to the OLD key BEFORE
    loading the NEW key.
  - Wrap localStorage reads + writes in try/catch — graceful
    degradation in private mode / restricted storage.
  - Use createElement + textContent only. No .innerHTML.
  - Define via queueMicrotask define-guard.

<sim-practice-question> mount-order safety: if a stored state has
revealed=true but [slot="answer"] is empty, the component logs a
console.warn and renders the reveal block with no answer content —
no crash.

14 new tests (7 + 7). Auto-defined as side effects of importing the
core package; import order placed after sim-checklist.js.

Phase 10B commit 1 of 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 2 — `feat(core): <sim-reflection-export> aggregator + <sim-checklist> export refactor`

The aggregator is the new component; the checklist refactor preps the checklist to act purely as a state source for the aggregator. Both pieces ship together to avoid a transitional state where the checklist still has buttons but the aggregator already exists.

### Task 2.1 — Refactor `<sim-checklist>` source (remove buttons + `exportPDF`; extend `getState()`; add `clear()`)

**File:** `packages/core/src/components/sim-checklist.js`

Four edits, each surgical. Locate by anchoring on the surrounding existing code.

**Edit A (in `_render`):** Remove the `mdBtn` creation block. Find:

```js
const actions = document.createElement('div');
actions.className = 'sim-checklist__actions';
const mdBtn = this._makeButton('Download .md', 'download-md', () => this.exportMarkdown(true));
const pdfBtn = this._makeButton('Save as PDF', 'save-pdf', () => this.exportPDF());
const resetBtn = this._makeButton('Reset', 'reset', () => this._onReset(), true);
actions.append(mdBtn, pdfBtn, resetBtn);
```

Note: PR #8 shipped these labels with emoji (`'📄 Download .md'`, `'🖨 Save as PDF'`). They might still have emoji prefixes on the branch. If so, the verbatim text in the file may differ. Either way, both `mdBtn` and `pdfBtn` lines + their inclusion in `actions.append(...)` get deleted.

Replace the whole block with:

```js
const actions = document.createElement('div');
actions.className = 'sim-checklist__actions';
const resetBtn = this._makeButton('Reset', 'reset', () => this._onReset(), true);
actions.append(resetBtn);
```

**Edit B (extend `getState()`):** Find the existing `getState()` method:

```js
  getState() {
    return {
      topic: this.getAttribute('topic') || 'default',
      level: this.getAttribute('level') || 'default',
      checkedItems: this._state.checkedItems.slice(),
      freeText: this._state.freeText,
    };
  }
```

Add `items: this._items.slice()` so the aggregator can render the checklist body in the portfolio markdown without reaching into private state. Replace with:

```js
  getState() {
    return {
      topic: this.getAttribute('topic') || 'default',
      level: this.getAttribute('level') || 'default',
      items: this._items.slice(),
      checkedItems: this._state.checkedItems.slice(),
      freeText: this._state.freeText,
    };
  }
```

**Edit C (add `clear()` method):** The existing `_onReset()` method runs the in-panel Reset button (with `confirm` prompt). The aggregator needs a non-prompting equivalent. Find `_onReset()`:

```js
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
```

Refactor it to extract a `_clearState()` helper, and add a public `clear()` that calls the helper without confirmation. Replace with:

```js
  _clearState() {
    if (this._textareaDebounce) {
      clearTimeout(this._textareaDebounce);
      this._textareaDebounce = null;
    }
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

  _onReset() {
    const confirmed = window.confirm(
      'Clear all checks and reflection text? This cannot be undone.'
    );
    if (!confirmed) return;
    this._clearState();
  }

  /**
   * Clear state + storage + dispatch checklist-reset, no confirmation prompt.
   * Used by <sim-reflection-export>'s "Clear all my work" link.
   */
  clear() {
    this._clearState();
  }
```

**Edit D (remove `exportPDF()`):** Find the existing `exportPDF()` method (a ~20-line block that synthesizes the print block, sets `body.printing-reflection`, calls `window.print()`, etc.) and delete the entire method.

Also delete the `_buildPrintBlock(state)` helper IF it is only used by `exportPDF()` (which is the case in PR #8). The aggregator builds its own print super-block.

**Edit E (JSDoc update on `exportMarkdown`):** Find `exportMarkdown(triggerDownload = false)`. Add an `@internal` JSDoc tag noting that `triggerDownload` is no longer wired to a button but the method remains for the aggregator to call. Replace the JSDoc block above the method with:

```js
/**
 * Generates the markdown representation of the current state. If
 * `triggerDownload` is true, also creates a Blob and triggers a browser
 * file download.
 *
 * Phase 10B: this method is no longer wired to a UI button (the
 * Download .md button was removed from the panel). Kept on the prototype
 * because <sim-reflection-export> may invoke it directly when building
 * the portfolio export.
 *
 * @internal
 * @param {boolean} [triggerDownload]
 * @returns {string}
 */
```

After all five edits, the checklist source no longer renders the .md or PDF buttons, no longer has an `exportPDF()` method, exposes `clear()`, and `getState()` includes `items`.

### Task 2.2 — Update `<sim-checklist>` tests (swap export-button click for direct method call)

**File:** `packages/core/tests/sim-checklist.test.js`

Two edits.

**Edit A — DROP** the existing test `'Download .md generates correct markdown payload'`. It clicks `button[data-action="download-md"]` which no longer exists. Locate and delete the entire `it('Download .md generates...', ...)` block.

**Edit B — ADD** a replacement test exercising `exportMarkdown(false)` directly. Append at the end of the existing `describe` block (after the last existing test):

```js
it('exportMarkdown(false) returns the .md string without triggering download', async () => {
  localStorage.setItem(
    STORAGE_KEY_SL,
    JSON.stringify({
      checkedItems: [0, 2],
      freeText: 'I got stuck on the units.',
    })
  );
  const el = await mount({ items: SAMPLE_ITEMS, open: true });
  const md = el.exportMarkdown(false);
  expect(md).toContain('# s1.5-gas-laws — Reflection');
  expect(md).toContain('**Level:** sl');
  expect(md).toContain('## Success criteria');
  expect(md).toContain('- [x] Describe what happens to P');
  expect(md).toContain('- [ ] Calculate P, V, T, or n');
  expect(md).toContain('- [x] Explain the shape of a P–V graph');
  expect(md).toContain('## My reflection');
  expect(md).toContain('I got stuck on the units.');
});

it('getState() includes items array', async () => {
  const el = await mount({ items: SAMPLE_ITEMS, open: true });
  const state = el.getState();
  expect(Array.isArray(state.items)).toBe(true);
  expect(state.items).toHaveLength(3);
  expect(state.items[0]).toContain('Describe what happens to P');
});

it('clear() empties state without prompting; matches Reset behavior post-confirm', async () => {
  localStorage.setItem(
    STORAGE_KEY_SL,
    JSON.stringify({ checkedItems: [1], freeText: 'some text' })
  );
  const el = await mount({ items: SAMPLE_ITEMS, open: true });
  expect(el.getState().checkedItems).toEqual([1]);
  el.clear();
  expect(el.getState()).toMatchObject({
    items: SAMPLE_ITEMS,
    checkedItems: [],
    freeText: '',
  });
  expect(localStorage.getItem(STORAGE_KEY_SL)).toBeNull();
});
```

Net delta on `sim-checklist.test.js`: -1 (drop md-click) + 3 (add direct .md, getState items, clear) = **+2 tests**.

**Verify intermediate state** before the aggregator lands:

```bash
cd packages/core && pnpm vitest run tests/sim-checklist.test.js 2>&1 | tail -10
```

Expected: **15 tests pass** (12 prior + 3 new − 1 dropped + 1 net change from existing 11 → 12 after a11y polish; verify actual count and adjust expectation if PR #9 baseline differs).

### Task 2.3 — Write failing tests for `<sim-reflection-export>` (RED)

**File:** `packages/core/tests/sim-reflection-export.test.js` (NEW)

Create with this exact content:

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../src/components/sim-reflection-export.js';
import '../src/components/sim-checklist.js';
import '../src/components/sim-text-response.js';
import '../src/components/sim-practice-question.js';

async function mount(opts = {}) {
  const { topic = 's1.5-gas-laws', level = 'sl', open = false } = opts;
  const el = document.createElement('sim-reflection-export');
  el.setAttribute('topic', topic);
  el.setAttribute('level', level);
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  if (open) {
    el.setAttribute('data-open', '');
    await Promise.resolve();
  }
  return el;
}

async function addTextResponse({ id, section, label, value = '' } = {}) {
  const el = document.createElement('sim-text-response');
  el.setAttribute('topic', 's1.5-gas-laws');
  el.setAttribute('level', 'sl');
  el.id = id;
  el.setAttribute('section', section);
  el.setAttribute('label', label);
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  if (value) {
    const ta = el.shadowRoot.querySelector('.sim-text-response__textarea');
    ta.value = value;
    ta.dispatchEvent(new Event('input'));
  }
  return el;
}

async function addChecklist({ items = [], checked = [], freeText = '' } = {}) {
  const el = document.createElement('sim-checklist');
  el.setAttribute('topic', 's1.5-gas-laws');
  el.setAttribute('level', 'sl');
  el.setAttribute('section', 'success-criteria');
  el.setAttribute('label', 'Success criteria');
  for (const text of items) {
    const li = document.createElement('li');
    li.textContent = text;
    el.appendChild(li);
  }
  document.body.appendChild(el);
  await Promise.resolve();
  await Promise.resolve();
  if (checked.length || freeText) {
    const stateKey = `aisc-simengine:checklist:s1.5-gas-laws:sl`;
    localStorage.setItem(stateKey, JSON.stringify({ checkedItems: checked, freeText }));
    // Re-load by toggling level
    el.setAttribute('level', 'hl');
    el.setAttribute('level', 'sl');
    await Promise.resolve();
  }
  return el;
}

describe('<sim-reflection-export>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('panel hidden by default; data-open shows it; close button + Escape close it', async () => {
    const el = await mount();
    expect(el.hasAttribute('data-open')).toBe(false);
    el.setAttribute('data-open', '');
    await Promise.resolve();
    expect(el.hasAttribute('data-open')).toBe(true);

    const closeBtn = el.shadowRoot.querySelector('.sim-reflection-export__close');
    closeBtn.click();
    expect(el.hasAttribute('data-open')).toBe(false);

    el.setAttribute('data-open', '');
    await Promise.resolve();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.hasAttribute('data-open')).toBe(false);
  });

  it('emits panel-opened on open and panel-closed on close', async () => {
    const opened = [];
    const closed = [];
    document.body.addEventListener('panel-opened', (e) => opened.push(e.detail));
    document.body.addEventListener('panel-closed', (e) => closed.push(e.detail));
    const el = await mount({ open: true });
    expect(opened).toHaveLength(1);
    expect(opened[0].source).toBe(el);
    el.removeAttribute('data-open');
    await Promise.resolve();
    expect(closed).toHaveLength(1);
    expect(closed[0].source).toBe(el);
  });

  it('closes when a sibling panel-opened event fires from a different source', async () => {
    const el = await mount({ open: true });
    const fakeSource = document.createElement('div');
    document.body.appendChild(fakeSource);
    document.dispatchEvent(
      new CustomEvent('panel-opened', {
        detail: { source: fakeSource },
        bubbles: true,
      })
    );
    expect(el.hasAttribute('data-open')).toBe(false);
  });

  it('exportMarkdown(false) builds correct portfolio markdown grouped by section in alphabetical order', async () => {
    await addTextResponse({
      id: 'bell-1',
      section: 'bell-ringer',
      label: 'Write the ideal gas equation.',
      value: 'PV = nRT',
    });
    await addTextResponse({
      id: 'exit-1',
      section: 'exit-ticket',
      label: 'What surprised you most?',
      value: '',
    });
    await addChecklist({
      items: ['Describe P-V at constant T.', 'Calculate P from nRT/V.'],
      checked: [0],
      freeText: 'Need more practice.',
    });
    const el = await mount();
    const md = el.exportMarkdown(false);
    expect(md).toContain('# s1.5-gas-laws — Reflection portfolio');
    expect(md).toContain('**Level:** sl');
    // Section order: bell-ringer, exit-ticket, success-criteria (alphabetical)
    const bellIdx = md.indexOf('## Bell ringer');
    const exitIdx = md.indexOf('## Exit ticket');
    const scIdx = md.indexOf('## Success criteria');
    expect(bellIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeGreaterThan(bellIdx);
    expect(scIdx).toBeGreaterThan(exitIdx);
    expect(md).toContain('PV = nRT');
    expect(md).toContain('*no response*');
    expect(md).toContain('- [x] Describe P-V at constant T.');
    expect(md).toContain('- [ ] Calculate P from nRT/V.');
    expect(md).toContain('Need more practice.');
  });

  it('Download .md button triggers Blob download', async () => {
    await addTextResponse({
      id: 'bell-1',
      section: 'bell-ringer',
      label: 'Q1',
      value: 'a',
    });
    const blobs = [];
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn((blob) => {
      blobs.push(blob);
      return 'blob:fake';
    });
    URL.revokeObjectURL = vi.fn();
    try {
      const el = await mount({ open: true });
      const mdBtn = el.shadowRoot.querySelector('button[data-action="download-md"]');
      mdBtn.click();
      expect(blobs).toHaveLength(1);
      const text = await blobs[0].text();
      expect(text).toContain('# s1.5-gas-laws — Reflection portfolio');
    } finally {
      URL.createObjectURL = origCreate;
    }
  });

  it('empty-portfolio guard: no sources -> buttons disabled + empty message', async () => {
    const el = await mount({ open: true });
    const empty = el.shadowRoot.querySelector('.sim-reflection-export__empty');
    const mdBtn = el.shadowRoot.querySelector('button[data-action="download-md"]');
    const pdfBtn = el.shadowRoot.querySelector('button[data-action="save-pdf"]');
    const clearLink = el.shadowRoot.querySelector('button[data-action="clear-all"]');
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain('no reflection components');
    expect(mdBtn.disabled).toBe(true);
    expect(pdfBtn.disabled).toBe(true);
    expect(clearLink.hidden).toBe(true);
  });

  it('preview list renders one row per scanned component with section heading + status badge', async () => {
    await addTextResponse({
      id: 'bell-1',
      section: 'bell-ringer',
      label: 'Q1 prompt',
      value: 'answered',
    });
    await addTextResponse({
      id: 'bell-2',
      section: 'bell-ringer',
      label: 'Q2 prompt',
      value: '',
    });
    const el = await mount({ open: true });
    const sections = el.shadowRoot.querySelectorAll('.sim-reflection-export__section');
    expect(sections).toHaveLength(1);
    const items = el.shadowRoot.querySelectorAll('.sim-reflection-export__item');
    expect(items).toHaveLength(2);
    const badges = el.shadowRoot.querySelectorAll('.sim-reflection-export__badge');
    expect(badges[0].textContent).toBe('answered');
    expect(badges[1].textContent).toBe('empty');
  });

  it('Clear all calls clear() on every scanned source after confirm returns true', async () => {
    const t1 = await addTextResponse({
      id: 'bell-1',
      section: 'bell-ringer',
      label: 'Q1',
      value: 'response1',
    });
    const t2 = await addTextResponse({
      id: 'exit-1',
      section: 'exit-ticket',
      label: 'Q1',
      value: 'response2',
    });
    const cl = await addChecklist({
      items: ['c1'],
      checked: [0],
      freeText: 'free',
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      const el = await mount({ open: true });
      const link = el.shadowRoot.querySelector('button[data-action="clear-all"]');
      link.click();
      expect(t1.getState().value).toBe('');
      expect(t2.getState().value).toBe('');
      expect(cl.getState().checkedItems).toEqual([]);
      expect(cl.getState().freeText).toBe('');
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it('Clear all does nothing when confirm returns false', async () => {
    const t1 = await addTextResponse({
      id: 'bell-1',
      section: 'bell-ringer',
      label: 'Q1',
      value: 'keep',
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    try {
      const el = await mount({ open: true });
      const link = el.shadowRoot.querySelector('button[data-action="clear-all"]');
      link.click();
      expect(t1.getState().value).toBe('keep');
    } finally {
      confirmSpy.mockRestore();
    }
  });
});
```

**Verify RED:**

```bash
cd packages/core && pnpm vitest run tests/sim-reflection-export.test.js 2>&1 | tail -10
```

Expected: all 9 tests fail with `Failed to resolve import '../src/components/sim-reflection-export.js'`.

### Task 2.4 — Implement `<sim-reflection-export>` (GREEN)

**File:** `packages/core/src/components/sim-reflection-export.js` (NEW)

Create with this exact content:

```js
/**
 * <sim-reflection-export topic="..." level="...">
 *
 * Page-wide aggregator side panel. Pulls state from every interactive
 * reflection component on the page (sim-checklist, sim-text-response,
 * sim-practice-question) into one .md or PDF portfolio export.
 *
 * Layout: position: fixed; top: 80px; left: 16px; width: 320px. Slides in
 * from the LEFT via the [data-open] attribute. Joins the existing
 * panel-opened mutual-exclusion contract from PR #8 (with sim-data-card
 * and sim-checklist).
 *
 * Public API:
 *   open() / close() — explicit panel lifecycle
 *   exportMarkdown(triggerDownload?) -> string — builds + optionally downloads
 *   exportPDF() — synthesizes a #print-reflection-output block + window.print()
 *
 * Events (bubbles + composed):
 *   panel-opened: { source: this }
 *   panel-closed: { source: this }
 *   portfolio-exported: { topic, level, format: 'md' | 'pdf' }
 *
 * State pull, not push: on each open + each export click, the component
 * does one document.querySelectorAll for source elements + maps their
 * getState() returns into a portfolio data structure.
 *
 * DOM safety: all rendering uses createElement + textContent. No .innerHTML.
 */

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
    transition: transform 0.18s ease, visibility 0s linear 0.18s;
    font-family: var(--font-sans, sans-serif);
  }
  :host([data-open]) {
    transform: translateX(0);
    visibility: visible;
    transition: transform 0.18s ease, visibility 0s linear 0s;
  }
  @media (prefers-reduced-motion: reduce) {
    :host, :host([data-open]) { transition: none; }
  }
  .sim-reflection-export {
    width: 100%;
    background: var(--ib-white, #fff);
    border: 1px solid var(--ib-ink-200, #ddd);
    border-radius: var(--r-md, 8px);
    box-shadow: var(--el-3, 0 8px 24px rgba(11, 34, 101, 0.18));
    padding: var(--sp-4, 16px);
    max-height: calc(100vh - 96px);
    overflow-y: auto;
  }
  .sim-reflection-export__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0 0 var(--sp-3, 12px);
  }
  .sim-reflection-export__title {
    margin: 0;
    font-size: var(--fs-18, 18px);
    font-weight: 600;
    color: var(--ib-navy-800, #0b2265);
  }
  .sim-reflection-export__close {
    background: transparent;
    border: none;
    font-size: 1.4em;
    cursor: pointer;
    line-height: 1;
    padding: 0 4px;
    color: var(--ib-ink-700, #374151);
  }
  .sim-reflection-export__desc {
    margin: 0 0 var(--sp-3, 12px);
    font-size: var(--fs-14, 14px);
    color: var(--ib-ink-700, #374151);
  }
  .sim-reflection-export__preview {
    margin-bottom: var(--sp-4, 16px);
  }
  .sim-reflection-export__empty {
    margin: 0;
    font-style: italic;
    color: var(--ib-ink-500, #6b7280);
  }
  .sim-reflection-export__section {
    margin-bottom: var(--sp-3, 12px);
  }
  .sim-reflection-export__section-heading {
    margin: 0 0 var(--sp-1, 4px);
    font-size: var(--fs-13, 13px);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ib-ink-500, #6b7280);
  }
  .sim-reflection-export__items {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .sim-reflection-export__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2, 8px);
    padding: 4px 0;
    font-size: var(--fs-13, 13px);
  }
  .sim-reflection-export__item-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sim-reflection-export__badge {
    flex-shrink: 0;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: var(--fs-12, 12px);
    font-family: var(--font-mono, monospace);
  }
  .sim-reflection-export__badge--answered {
    background: var(--ib-green-050, #e6f4ec);
    color: var(--ib-green-700, #15803d);
  }
  .sim-reflection-export__badge--empty {
    background: var(--ib-ink-100, #f4f4f4);
    color: var(--ib-ink-500, #6b7280);
  }
  .sim-reflection-export__actions {
    display: flex;
    gap: var(--sp-2, 8px);
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
  .sim-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sim-reflection-export__clear {
    display: block;
    margin-top: var(--sp-3, 12px);
    background: transparent;
    border: none;
    color: var(--ib-ink-500, #6b7280);
    font-size: var(--fs-13, 13px);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .sim-reflection-export__clear:hover { color: var(--ib-red-700, #b91c1c); }
`;

const sheet = new CSSStyleSheet();
sheet.replaceSync(HOST_STYLES);

const SOURCE_SELECTOR = 'sim-checklist, sim-text-response, sim-practice-question';
const SECTION_ORDER = ['bell-ringer', 'exit-ticket', 'practice', 'success-criteria', 'misc'];

class SimReflectionExportElement extends HTMLElement {
  static get observedAttributes() {
    return ['data-open'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    this._previouslyFocused = null;
    this._trap = null;
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._render();
    this._afterPrintHandler = () => {
      document.body.classList.remove('printing-reflection');
    };
    window.addEventListener('afterprint', this._afterPrintHandler);
    this._panelOpenedHandler = (e) => {
      if (e.detail?.source !== this && this.hasAttribute('data-open')) {
        this.close();
      }
    };
    document.addEventListener('panel-opened', this._panelOpenedHandler);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._initialized) return;
    if (name === 'data-open') {
      const isOpen = newValue !== null;
      const wasOpen = oldValue !== null;
      if (isOpen && !wasOpen) this._activate();
      else if (!isOpen && wasOpen) this._deactivate();
    }
  }

  disconnectedCallback() {
    if (this._afterPrintHandler) {
      window.removeEventListener('afterprint', this._afterPrintHandler);
      this._afterPrintHandler = null;
    }
    if (this._panelOpenedHandler) {
      document.removeEventListener('panel-opened', this._panelOpenedHandler);
      this._panelOpenedHandler = null;
    }
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._trap) {
      this._trap.release();
      this._trap = null;
    }
    this._initialized = false;
  }

  _render() {
    const root = this.shadowRoot;
    root.replaceChildren();

    const wrap = document.createElement('div');
    wrap.className = 'sim-reflection-export';

    const head = document.createElement('header');
    head.className = 'sim-reflection-export__head';
    const title = document.createElement('h3');
    title.className = 'sim-reflection-export__title';
    title.textContent = 'Save your work';
    head.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sim-reflection-export__close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.type = 'button';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());
    head.appendChild(closeBtn);
    wrap.appendChild(head);

    const desc = document.createElement('p');
    desc.className = 'sim-reflection-export__desc';
    desc.textContent = 'Download a copy of everything you have written on this page.';
    wrap.appendChild(desc);

    const preview = document.createElement('div');
    preview.className = 'sim-reflection-export__preview';
    wrap.appendChild(preview);

    const actions = document.createElement('div');
    actions.className = 'sim-reflection-export__actions';
    const mdBtn = document.createElement('button');
    mdBtn.type = 'button';
    mdBtn.className = 'sim-btn';
    mdBtn.dataset.action = 'download-md';
    mdBtn.textContent = 'Download .md';
    mdBtn.addEventListener('click', () => this.exportMarkdown(true));
    actions.appendChild(mdBtn);
    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.className = 'sim-btn';
    pdfBtn.dataset.action = 'save-pdf';
    pdfBtn.textContent = 'Save as PDF';
    pdfBtn.addEventListener('click', () => this.exportPDF());
    actions.appendChild(pdfBtn);
    wrap.appendChild(actions);

    const clearLink = document.createElement('button');
    clearLink.type = 'button';
    clearLink.className = 'sim-reflection-export__clear';
    clearLink.dataset.action = 'clear-all';
    clearLink.textContent = 'Clear all my work for this topic';
    clearLink.addEventListener('click', () => this._onClearAll());
    wrap.appendChild(clearLink);

    root.appendChild(wrap);

    this._closeBtn = closeBtn;
    this._previewEl = preview;
    this._mdBtn = mdBtn;
    this._pdfBtn = pdfBtn;
    this._clearLink = clearLink;
    this._wrap = wrap;
  }

  _scanSources() {
    const els = document.querySelectorAll(SOURCE_SELECTOR);
    return Array.from(els).map((el) => {
      const tag = el.tagName.toLowerCase();
      const section = el.getAttribute('section') || 'misc';
      const id = el.id || null;
      const label = el.getAttribute('label') || null;
      let state = null;
      try {
        state = typeof el.getState === 'function' ? el.getState() : null;
      } catch (e) {
        console.warn(`<sim-reflection-export>: getState() threw on ${tag}`, e);
        state = null;
      }
      return { tag, section, id, label, state, el };
    });
  }

  _groupBySection(sources) {
    const grouped = new Map();
    for (const s of SECTION_ORDER) grouped.set(s, []);
    for (const src of sources) {
      const sec = SECTION_ORDER.includes(src.section) ? src.section : 'misc';
      grouped.get(sec).push(src);
    }
    return grouped;
  }

  _sectionLabel(name) {
    if (name === 'bell-ringer') return 'Bell ringer';
    if (name === 'exit-ticket') return 'Exit ticket';
    if (name === 'practice') return 'Practice';
    if (name === 'success-criteria') return 'Success criteria';
    return 'Other';
  }

  _isAnswered(src) {
    if (!src.state) return false;
    if (src.tag === 'sim-text-response') {
      return typeof src.state.value === 'string' && src.state.value.trim().length > 0;
    }
    if (src.tag === 'sim-practice-question') {
      return (
        (typeof src.state.attempt === 'string' && src.state.attempt.trim().length > 0) ||
        src.state.revealed === true
      );
    }
    if (src.tag === 'sim-checklist') {
      return (
        (Array.isArray(src.state.checkedItems) && src.state.checkedItems.length > 0) ||
        (typeof src.state.freeText === 'string' && src.state.freeText.trim().length > 0)
      );
    }
    return false;
  }

  _refreshPreview() {
    const sources = this._scanSources();
    this._previewEl.replaceChildren();

    if (sources.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'sim-reflection-export__empty';
      empty.textContent = 'This page has no reflection components yet.';
      this._previewEl.appendChild(empty);
      this._mdBtn.disabled = true;
      this._pdfBtn.disabled = true;
      this._clearLink.hidden = true;
      return;
    }

    this._mdBtn.disabled = false;
    this._pdfBtn.disabled = false;
    this._clearLink.hidden = false;

    const grouped = this._groupBySection(sources);
    for (const sectionName of SECTION_ORDER) {
      const list = grouped.get(sectionName);
      if (!list.length) continue;

      const sectionWrap = document.createElement('div');
      sectionWrap.className = 'sim-reflection-export__section';
      const heading = document.createElement('h4');
      heading.className = 'sim-reflection-export__section-heading';
      heading.textContent = this._sectionLabel(sectionName);
      sectionWrap.appendChild(heading);

      const ul = document.createElement('ul');
      ul.className = 'sim-reflection-export__items';
      for (const src of list) {
        const li = document.createElement('li');
        li.className = 'sim-reflection-export__item';
        const labelText = (src.label || src.id || src.tag).slice(0, 80);
        const labelEl = document.createElement('span');
        labelEl.className = 'sim-reflection-export__item-label';
        labelEl.textContent = labelText;
        li.appendChild(labelEl);
        const badge = document.createElement('span');
        const isAnswered = this._isAnswered(src);
        badge.className = `sim-reflection-export__badge sim-reflection-export__badge--${
          isAnswered ? 'answered' : 'empty'
        }`;
        badge.textContent = isAnswered ? 'answered' : 'empty';
        li.appendChild(badge);
        ul.appendChild(li);
      }
      sectionWrap.appendChild(ul);
      this._previewEl.appendChild(sectionWrap);
    }
  }

  open() {
    if (this.hasAttribute('data-open')) return;
    this.setAttribute('data-open', '');
  }

  close() {
    if (!this.hasAttribute('data-open')) return;
    this.removeAttribute('data-open');
  }

  _activate() {
    this._previouslyFocused = document.activeElement;
    this._refreshPreview();
    if (this._wrap) {
      this._trap = trapFocus(this._wrap);
      if (this._closeBtn) this._closeBtn.focus();
    }
    this._escapeHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._escapeHandler);
    this._outsideClickHandler = (e) => {
      if (e.composedPath().includes(this)) return;
      const onPill = e
        .composedPath()
        .some((el) => el && el.tagName && el.tagName.toLowerCase() === 'sim-data-pill');
      if (onPill) return;
      this.close();
    };
    document.addEventListener('click', this._outsideClickHandler);
    this.dispatchEvent(
      new CustomEvent('panel-opened', {
        detail: { source: this },
        bubbles: true,
        composed: true,
      })
    );
  }

  _deactivate() {
    if (this._trap) {
      this._trap.release();
      this._trap = null;
    }
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }
    if (this._outsideClickHandler) {
      document.removeEventListener('click', this._outsideClickHandler);
      this._outsideClickHandler = null;
    }
    if (this._previouslyFocused) {
      restoreFocusTo(this._previouslyFocused);
      this._previouslyFocused = null;
    }
    this.dispatchEvent(
      new CustomEvent('panel-closed', {
        detail: { source: this },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Build (and optionally download) the portfolio markdown.
   * @param {boolean} [triggerDownload]
   * @returns {string}
   */
  exportMarkdown(triggerDownload = false) {
    const sources = this._scanSources();
    const topic = this.getAttribute('topic') || 'default';
    const level = this.getAttribute('level') || 'default';
    const date = new Date().toISOString().slice(0, 10);

    const lines = [
      `# ${topic} — Reflection portfolio`,
      '',
      `**Level:** ${level} · **Date:** ${date}`,
      '',
    ];

    const grouped = this._groupBySection(sources);
    for (const sectionName of SECTION_ORDER) {
      const list = grouped.get(sectionName);
      if (!list.length) continue;

      lines.push(`## ${this._sectionLabel(sectionName)}`);
      lines.push('');

      for (let i = 0; i < list.length; i++) {
        const src = list[i];
        if (src.tag === 'sim-text-response') {
          lines.push(`**Q${i + 1}.** ${src.label || ''}`);
          lines.push('');
          const v = (src.state?.value || '').trim();
          lines.push(v ? `> ${v.replace(/\n/g, '\n> ')}` : '> *no response*');
          lines.push('');
        } else if (src.tag === 'sim-practice-question') {
          lines.push(`**Q${i + 1}.** ${src.label || ''}`);
          lines.push('');
          const attempt = (src.state?.attempt || '').trim();
          lines.push(
            attempt ? `> Attempt: ${attempt.replace(/\n/g, '\n> ')}` : '> Attempt: *no response*'
          );
          if (src.state?.revealed) {
            const ratingLabel =
              src.state.rating === 'got-it'
                ? 'Got it'
                : src.state.rating === 'after-reveal'
                  ? 'Got it after reveal'
                  : src.state.rating === 'confused'
                    ? 'Still confused'
                    : '*not rated*';
            lines.push('>');
            lines.push(`> Self-rating: ${ratingLabel}`);
          }
          lines.push('');
        } else if (src.tag === 'sim-checklist') {
          const items = Array.isArray(src.state?.items) ? src.state.items : [];
          const checked = src.state?.checkedItems || [];
          for (let j = 0; j < items.length; j++) {
            const mark = checked.includes(j) ? '[x]' : '[ ]';
            lines.push(`- ${mark} ${items[j]}`);
          }
          const free = (src.state?.freeText || '').trim();
          if (free) {
            lines.push('');
            lines.push(`> Reflection: ${free.replace(/\n/g, '\n> ')}`);
          }
          lines.push('');
        }
      }
    }

    const md = lines.join('\n');

    if (triggerDownload) {
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topic}-${level}-portfolio.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
      this.dispatchEvent(
        new CustomEvent('portfolio-exported', {
          detail: { topic, level, format: 'md' },
          bubbles: true,
          composed: true,
        })
      );
    }

    return md;
  }

  /**
   * Synthesize the print super-block and call window.print().
   * The afterprint listener (registered in connectedCallback) clears
   * body.printing-reflection on dialog close.
   */
  exportPDF() {
    const sources = this._scanSources();
    const topic = this.getAttribute('topic') || 'default';
    const level = this.getAttribute('level') || 'default';
    const date = new Date().toISOString().slice(0, 10);

    const block = this._buildPrintBlock(sources, topic, level, date);
    const old = document.getElementById('print-reflection-output');
    if (old) old.replaceWith(block);
    else document.body.appendChild(block);

    document.body.classList.add('printing-reflection');
    window.print();

    this.dispatchEvent(
      new CustomEvent('portfolio-exported', {
        detail: { topic, level, format: 'pdf' },
        bubbles: true,
        composed: true,
      })
    );
  }

  _buildPrintBlock(sources, topic, level, date) {
    const container = document.createElement('div');
    container.id = 'print-reflection-output';
    container.setAttribute('aria-hidden', 'true');

    const h1 = document.createElement('h1');
    h1.textContent = `${topic} — Reflection portfolio`;
    container.appendChild(h1);

    const meta = document.createElement('p');
    meta.className = 'reflection-meta';
    meta.textContent = `Level: ${level} · Date: ${date}`;
    container.appendChild(meta);

    const grouped = this._groupBySection(sources);
    for (const sectionName of SECTION_ORDER) {
      const list = grouped.get(sectionName);
      if (!list.length) continue;

      const h2 = document.createElement('h2');
      h2.textContent = this._sectionLabel(sectionName);
      container.appendChild(h2);

      for (let i = 0; i < list.length; i++) {
        const src = list[i];
        if (src.tag === 'sim-text-response') {
          const qH = document.createElement('p');
          qH.className = 'reflection-q';
          const strong = document.createElement('strong');
          strong.textContent = `Q${i + 1}.`;
          qH.append(strong, ' ', src.label || '');
          container.appendChild(qH);
          const aDiv = document.createElement('div');
          aDiv.className = 'reflection-text';
          const v = (src.state?.value || '').trim();
          aDiv.textContent = v || 'no response';
          container.appendChild(aDiv);
        } else if (src.tag === 'sim-practice-question') {
          const qH = document.createElement('p');
          qH.className = 'reflection-q';
          const strong = document.createElement('strong');
          strong.textContent = `Q${i + 1}.`;
          qH.append(strong, ' ', src.label || '');
          container.appendChild(qH);
          const attempt = (src.state?.attempt || '').trim();
          const aDiv = document.createElement('div');
          aDiv.className = 'reflection-text';
          aDiv.textContent = `Attempt: ${attempt || 'no response'}`;
          container.appendChild(aDiv);
          if (src.state?.revealed) {
            const ratingLabel =
              src.state.rating === 'got-it'
                ? 'Got it'
                : src.state.rating === 'after-reveal'
                  ? 'Got it after reveal'
                  : src.state.rating === 'confused'
                    ? 'Still confused'
                    : 'not rated';
            const r = document.createElement('p');
            r.className = 'reflection-meta';
            r.textContent = `Self-rating: ${ratingLabel}`;
            container.appendChild(r);
          }
        } else if (src.tag === 'sim-checklist') {
          const items = Array.isArray(src.state?.items) ? src.state.items : [];
          const checked = src.state?.checkedItems || [];
          const ul = document.createElement('ul');
          for (let j = 0; j < items.length; j++) {
            const li = document.createElement('li');
            if (checked.includes(j)) li.classList.add('checked');
            li.textContent = items[j];
            ul.appendChild(li);
          }
          container.appendChild(ul);
          const free = (src.state?.freeText || '').trim();
          if (free) {
            const fH = document.createElement('p');
            fH.className = 'reflection-q';
            fH.textContent = 'Reflection:';
            container.appendChild(fH);
            const fDiv = document.createElement('div');
            fDiv.className = 'reflection-text';
            fDiv.textContent = free;
            container.appendChild(fDiv);
          }
        }
      }
    }

    return container;
  }

  _onClearAll() {
    const sources = this._scanSources();
    if (sources.length === 0) return;
    const confirmed = window.confirm('Clear all your work for this topic? This cannot be undone.');
    if (!confirmed) return;
    for (const src of sources) {
      try {
        if (typeof src.el.clear === 'function') {
          src.el.clear();
        }
      } catch (e) {
        console.warn(`<sim-reflection-export>: clear() threw on ${src.tag}`, e);
      }
    }
    this._refreshPreview();
  }
}

if (!customElements.get('sim-reflection-export')) {
  queueMicrotask(() => {
    if (!customElements.get('sim-reflection-export')) {
      customElements.define('sim-reflection-export', SimReflectionExportElement);
    }
  });
}
```

**Verify GREEN:**

```bash
cd packages/core && pnpm vitest run tests/sim-reflection-export.test.js 2>&1 | tail -10
```

Expected: **9 tests passed.**

### Task 2.5 — Add side-effect import for `<sim-reflection-export>`

**File:** `packages/core/src/index.js`

Add immediately after the line you added in Task 1.6 (`import './components/sim-practice-question.js';`):

```js
import './components/sim-reflection-export.js';
```

### Task 2.6 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint: 0 errors, no new warnings
- **181 tests** total (assuming PR #9 baseline 157 + Commit 1 added 14 + Commit 2 net +9 export tests +2 checklist net = 157 + 14 + 9 + 2 = 182; verify and adjust if drift). The plan target is 179; the actual depends on whether the checklist `getState() includes items` and `clear()` tests fold into the existing test count differently. Report the actual count.
- build green; bundle delta ≤ +18 kB IIFE total across both commits.

Stage exactly:

```bash
git add \
  packages/core/src/components/sim-reflection-export.js \
  packages/core/src/components/sim-checklist.js \
  packages/core/src/index.js \
  packages/core/tests/sim-reflection-export.test.js \
  packages/core/tests/sim-checklist.test.js
```

Commit with env-var attribution and this exact message:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(core): <sim-reflection-export> aggregator + <sim-checklist> export refactor

Page-wide aggregator side panel that pulls state from every
interactive reflection component on the page (sim-checklist,
sim-text-response, sim-practice-question) into one .md or PDF
portfolio export.

Layout: position: fixed; top: 80px; left: 16px; width: 320px.
Slides in from the LEFT via [data-open]. Joins the existing
panel-opened mutual-exclusion contract from PR #8 — opening the
aggregator closes any open sim-data-card or sim-checklist, and
vice versa.

State pull, not push: on each open + each export click, the
aggregator does one document.querySelectorAll for source elements
and maps their getState() returns into a portfolio data structure
grouped by `section` attribute. Sections render alphabetically
(bell-ringer, exit-ticket, practice, success-criteria, misc),
DOM-order within each section.

Markdown output:
  # <topic> — Reflection portfolio
  **Level:** ... · **Date:** ...
  ## <Section name>
  **Q1.** prompt
  > student response (or *no response*)

PDF output: synthesizes a #print-reflection-output super-block,
adds body.printing-reflection, calls window.print(). Reuses the
@media print rules already in components.css from Phase 10A v2.

Empty-portfolio guard: if the document scan returns 0 sources,
both export buttons render disabled and the preview list shows
"This page has no reflection components yet."

Clear-all link: window.confirm prompt + calls clear() on every
scanned source. The aggregator never has its own state.

Companion checklist refactor (sim-checklist.js):
  - Removes the Download .md and Save as PDF buttons from the
    panel. The aggregator owns export now.
  - Removes the exportPDF() method (dead code post-refactor).
  - Extends getState() to include `items: string[]` so the
    aggregator can render the checklist body without reaching
    into private state.
  - Adds public clear() method (no confirm prompt) for the
    aggregator's clear-all flow. Existing _onReset() (with prompt)
    still drives the in-panel Reset button.
  - exportMarkdown(triggerDownload) stays on the prototype as an
    @internal API the aggregator may invoke directly.

Test impact:
  - +9 new tests in sim-reflection-export.test.js
  - sim-checklist.test.js: drop the click-the-md-button test;
    add tests for exportMarkdown(false), getState items, clear()
  - net +2 in sim-checklist.test.js, +9 in sim-reflection-export

Public API churn: removing exportPDF() from <sim-checklist> is a
breaking change relative to PR #8. Acceptable here because PR #8
just shipped, no consumer has integrated against it, and the
package scope is @TBD/* (pre-publish). CHANGELOG entry calls it
out clearly.

DOM safety: createElement + textContent only. No .innerHTML
anywhere in the new component.

Phase 10B commit 2 of 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 3 — `feat(examples): topic-page wires bell-ringer + practice + exit-ticket + export panel; drop emoji from Reflect button`

One file: `examples/topic-page/index.html`. Five edits.

### Task 3.1 — Replace bell ringer static `<ol>` with `<sim-text-response>` instances

Find the existing block (around line 62–77):

```html
<!-- 4. Bell ringer -->
<section class="ib-bellringer">
  <h2>Bell ringer</h2>
  <p><strong>5 minutes — from memory:</strong></p>
  <ol>
    <li>Write the ideal gas equation. Label every symbol.</li>
    <li>
      Circle the variable that is <em>inversely</em> proportional to pressure at constant
      temperature and amount of gas.
    </li>
    <li>
      In one sentence, describe what happens to the speed of gas particles when temperature doubles
      at constant volume.
    </li>
  </ol>
</section>
```

Replace the inner `<ol>...</ol>` with three numbered `<li>` wrappers, each containing a `<sim-text-response>`:

```html
<!-- 4. Bell ringer -->
<section class="ib-bellringer">
  <h2>Bell ringer</h2>
  <p><strong>5 minutes — from memory:</strong></p>
  <ol class="ib-bellringer__list">
    <li>
      <sim-text-response
        topic="s1.5-gas-laws"
        level="sl"
        id="bell-1"
        section="bell-ringer"
        label="Write the ideal gas equation. Label every symbol."
      ></sim-text-response>
    </li>
    <li>
      <sim-text-response
        topic="s1.5-gas-laws"
        level="sl"
        id="bell-2"
        section="bell-ringer"
        label="Circle the variable that is inversely proportional to pressure at constant temperature and amount of gas."
      ></sim-text-response>
    </li>
    <li>
      <sim-text-response
        topic="s1.5-gas-laws"
        level="sl"
        id="bell-3"
        section="bell-ringer"
        label="In one sentence, describe what happens to the speed of gas particles when temperature doubles at constant volume."
      ></sim-text-response>
    </li>
  </ol>
</section>
```

(The `<em>inversely</em>` emphasis from the original prose drops to plain text in the `label` attribute. The component's prompt heading is plain — visual emphasis can return when label-rendering grows.)

### Task 3.2 — Replace practice question `<details>` with `<sim-practice-question>`

Find the existing block (around line 268–281):

```html
<!-- 11. Practice question -->
<section class="ib-practice">
  <h2>Practice question</h2>
  <p>
    <strong>Calculate</strong> the volume occupied by 0.25 mol of an ideal gas at 250 K and 150 kPa.
  </p>
  <details class="ib-answer">
    <summary>Show answer</summary>
    <p>
      <code>V = nRT / P = (0.25 × 8.314 × 250) / (150 × 10³) = 3.46 × 10⁻³ m³ ≈ 3.46 L</code>
    </p>
  </details>
</section>
```

Replace the `<p>` prompt + `<details>` reveal with a single `<sim-practice-question>` whose `[slot="answer"]` carries the existing model-answer markup unchanged:

```html
<!-- 11. Practice question -->
<section class="ib-practice">
  <h2>Practice question</h2>
  <sim-practice-question
    topic="s1.5-gas-laws"
    level="sl"
    id="practice-1"
    section="practice"
    label="Calculate the volume occupied by 0.25 mol of an ideal gas at 250 K and 150 kPa."
  >
    <div slot="answer">
      <p>
        <code>V = nRT / P = (0.25 × 8.314 × 250) / (150 × 10³) = 3.46 × 10⁻³ m³ ≈ 3.46 L</code>
      </p>
    </div>
  </sim-practice-question>
</section>
```

### Task 3.3 — Replace exit ticket static `<ol>` with `<sim-text-response>` instances

Find the existing block (around line 317–325):

```html
<!-- 15. Exit ticket -->
<section class="ib-exitticket">
  <h2>Exit ticket</h2>
  <ol>
    <li>What surprised you most about how pressure changes with temperature?</li>
    <li>If you doubled the amount of gas at constant T and V, what happens to P? Why?</li>
    <li>One thing you'd like to understand more clearly:</li>
  </ol>
</section>
```

Replace with:

```html
<!-- 15. Exit ticket -->
<section class="ib-exitticket">
  <h2>Exit ticket</h2>
  <ol class="ib-exitticket__list">
    <li>
      <sim-text-response
        topic="s1.5-gas-laws"
        level="sl"
        id="exit-1"
        section="exit-ticket"
        label="What surprised you most about how pressure changes with temperature?"
      ></sim-text-response>
    </li>
    <li>
      <sim-text-response
        topic="s1.5-gas-laws"
        level="sl"
        id="exit-2"
        section="exit-ticket"
        label="If you doubled the amount of gas at constant T and V, what happens to P? Why?"
      ></sim-text-response>
    </li>
    <li>
      <sim-text-response
        topic="s1.5-gas-laws"
        level="sl"
        id="exit-3"
        section="exit-ticket"
        label="One thing you'd like to understand more clearly."
      ></sim-text-response>
    </li>
  </ol>
</section>
```

### Task 3.4 — Sticky-header export button + `<sim-reflection-export>` element + level propagation + drop emoji from Reflect button

Four sub-edits, all in the same file.

**Sub-edit A — sticky header button.** Find the existing sticky header (section 2 in the topic page, around line 26–41). It currently has the HL/SL toggle and a `tweaks-button`. Locate the `tweaks-button` line:

```html
<button id="tweaks-button" class="ib-btn ib-btn--ghost" aria-label="Open tweaks panel">⚙</button>
```

Add immediately after it (still inside the same flex/header container):

```html
<button id="export-button" class="ib-btn ib-btn--ghost" aria-label="Save your work">
  Save your work
</button>
```

(No emoji per design doc. Class chain matches the existing buttons.)

**Sub-edit B — element placement.** Find the existing block of singleton elements after `</div>` (the close of `.sim-wrap`). It looks like:

```html
<sim-data-card></sim-data-card>
<sim-checklist topic="s1.5-gas-laws" level="sl" label="Success criteria">
  <li>Describe what happens to P when V halves at constant T and n.</li>
  <li>Calculate P, V, T, or n given the other three quantities.</li>
  <li>Explain the shape of a P–V graph at constant temperature and label its axes.</li>
</sim-checklist>
```

Add immediately after the `</sim-checklist>` close tag:

```html
<sim-reflection-export topic="s1.5-gas-laws" level="sl"></sim-reflection-export>
```

**Sub-edit C — `applyLevel(level)` step 6.** Find the existing inline `<script>` block at the bottom of the file. Inside it, find `applyLevel(level)` which currently has 5 numbered steps (per Phase 10A v2). After the closing of step 5 (the `for (const cl of document.querySelectorAll('sim-checklist')) { ... }` loop), add step 6 immediately before the function's closing brace:

```js
// 6. Push level to every interactive reflection component on the page.
for (const el of document.querySelectorAll(
  'sim-text-response, sim-practice-question, sim-reflection-export'
)) {
  el.setAttribute('level', level);
}
```

**Sub-edit D — Reflect button click handler analog for export.** Find the existing Reflect button click handler:

```js
document.getElementById('reflect-button').addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelector('sim-checklist').toggleAttribute('data-open');
});
```

Add immediately after, the analogous Save-your-work button wiring:

```js
document.getElementById('export-button').addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelector('sim-reflection-export').toggleAttribute('data-open');
});
```

`e.stopPropagation()` prevents the export panel's own outside-click handler from re-closing on the same click.

**Sub-edit E — Drop emoji from Reflect button label.** Find the existing Reflect button:

```html
<button
  id="reflect-button"
  class="ib-btn ib-btn--ghost"
  style="margin-top: var(--sp-3, 12px); align-self: flex-start"
>
  📝 Reflect on these criteria
</button>
```

Replace its visible text from `📝 Reflect on these criteria` to `Reflect on these criteria`. The attributes stay unchanged. End result:

```html
<button
  id="reflect-button"
  class="ib-btn ib-btn--ghost"
  style="margin-top: var(--sp-3, 12px); align-self: flex-start"
>
  Reflect on these criteria
</button>
```

### Task 3.5 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean, lint clean, test count unchanged from Commit 2, build green; bundle bytes unchanged (HTML edits only).

**Manual visual check (recommended):**

```bash
open examples/topic-page/index.html
```

Verify in the browser:

- Bell ringer: 3 textareas appear inline; type into one → reload → text persists.
- Practice question: type attempt → click "Show answer" → answer block + 3 chips appear → click a chip → all three pieces persist on reload.
- Exit ticket: 3 textareas, same as bell ringer.
- Sticky header has "Save your work" button (no emoji). Click → panel slides in from the LEFT.
- Inside the export panel: preview list grouped by section (Bell ringer, Exit ticket, Practice, Success criteria) with status badges. Click "Download .md" → portfolio downloads with all 4 sections in alphabetical-by-section, DOM-order-within-section. Click "Save as PDF" → print dialog shows portfolio only.
- Mutual exclusion: opening any of the three left-side panels (data-card via pill click, checklist via Reflect button, export via Save button) closes the other two.
- HL/SL toggle: all components swap to per-level state.
- Tweaks panel (right side, gear icon) coexists with any left-side panel.
- The Reflect button reads "Reflect on these criteria" (no emoji).

Stage exactly:

```bash
git add examples/topic-page/index.html
```

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
feat(examples): topic-page wires bell-ringer + practice + exit-ticket + export panel

Five coordinated edits to examples/topic-page/index.html for the
Phase 10B interactive reflection portfolio:

  1. Bell ringer: replace static <ol><li> prose with three
     <sim-text-response> instances (ids bell-1/2/3, section="bell-ringer").
  2. Practice question: replace the <details> reveal with a single
     <sim-practice-question> whose [slot="answer"] carries the
     existing model-answer markup unchanged.
  3. Exit ticket: replace static <ol><li> prose with three
     <sim-text-response> instances (ids exit-1/2/3,
     section="exit-ticket").
  4. Sticky header gains a "Save your work" button (id="export-button",
     class="ib-btn ib-btn--ghost", no emoji). Wired to toggle the
     <sim-reflection-export> panel's [data-open] with e.stopPropagation()
     to prevent the panel's outside-click handler from re-closing on
     the same click.
  5. <sim-reflection-export> element placed alongside
     <sim-data-card> + <sim-checklist> + <sim-tweaks-panel> after
     .sim-wrap. applyLevel(level) gains step 6 — push the new level
     to every <sim-text-response>, <sim-practice-question>, and
     <sim-reflection-export> on the page so per-level state swaps
     with the toggle.

Cleanup pass: drop the emoji prefix from the existing Reflect
button's visible text. The button now reads "Reflect on these
criteria" (was "📝 Reflect on these criteria"). Topic page is now
emoji-free overall.

State persists per-instance to localStorage at:
  aisc-simengine:textresponse:s1.5-gas-laws:<level>:<id>
  aisc-simengine:practice:s1.5-gas-laws:<level>:<id>
  aisc-simengine:checklist:s1.5-gas-laws:<level>      (unchanged)

Phase 10B commit 3 of 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Commit 4 — `docs: phase 10B — interactive reflection portfolio`

### Task 4.1 — CHANGELOG entry

**File:** `CHANGELOG.md`

Find the existing `### Phase 10A v2 — Side-panel checklist + reflection export` section. After its end (which includes its "Other deferred polish" bullet list) and BEFORE the `### Notes` footer (or wherever the immediately-following section begins), insert:

```markdown
### Phase 10B — Interactive reflection portfolio

Four commits introducing three new interactive components and refactoring `<sim-checklist>` so the topic-page export consolidates into a single side-panel aggregator:

- `feat(core)`: `<sim-text-response>` (inline textarea + persistence) and `<sim-practice-question>` (do-then-reveal with 3-chip self-rating)
- `feat(core)`: `<sim-reflection-export>` aggregator side panel + `<sim-checklist>` export refactor
- `feat(examples)`: topic-page wires bell-ringer + practice + exit-ticket + export panel; drops emoji from Reflect button
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** +22 net (7 + 7 + 9 + (3 added − 1 dropped) on `<sim-checklist>` ).

**Public surface added (`@TBD/simengine`):**

- New custom elements:
  - `<sim-text-response topic level id section label>` — inline persisted textarea
  - `<sim-practice-question topic level id section label>` with `[slot="answer"]` — do-then-reveal + 3-chip self-rating
  - `<sim-reflection-export topic level>` — page-wide portfolio aggregator side panel (LEFT, joins existing mutual-exclusion contract)
- Events (bubbles + composed): `text-response-changed`, `practice-changed`, `portfolio-exported`, plus `panel-opened` / `panel-closed` on the new aggregator.
- Imperative API: `getState()`, `clear()`, `focus()` on text-response; `getState()`, `clear()` on practice; `open()`, `close()`, `exportMarkdown(triggerDownload?)`, `exportPDF()` on the aggregator.

**Public surface changed:**

- `<sim-checklist>.exportPDF()` removed. Per-component PDF synthesis is dead code now that the aggregator owns PDF output. Acceptable breaking change because PR #8 just shipped (no consumers) and the package scope is `@TBD/*` (pre-publish).
- `<sim-checklist>.getState()` extended to include `items: string[]` so the aggregator can render the checklist body without reaching into private state. Additive; existing consumers unaffected.
- `<sim-checklist>.clear()` added (no-confirm public method) for the aggregator's "Clear all my work" link.

**Persistence:**

- `aisc-simengine:textresponse:<topic>:<level>:<id>` — `{ value: string }`
- `aisc-simengine:practice:<topic>:<level>:<id>` — `{ attempt, revealed, rating }`
- `aisc-simengine:checklist:<topic>:<level>` — unchanged

**Topic-page UX touch:** the existing Reflect button drops its emoji prefix. Topic page is now emoji-free overall.

**Known follow-ups (deferred post-10B):**

- Mobile/tablet responsive tweaks for any panel.
- Whole-topic-page print stylesheet (still §12 polish).
- Cross-topic portfolio aggregation (one export covering multiple topic pages).
- Server-side persistence / accounts.
- Animated check transitions; fancier progress / status visualisations.
- The two long-standing step-6 follow-ups (`<sim-engine>` private API → public; reinstate `<slot>` in `<sim-coachmark>`).
```

### Task 4.2 — architecture.md entry

**File:** `docs/architecture.md`

Find the existing `## Phase 10A v2 — Side-panel checklist + reflection export` section. After its end (or wherever the immediately-following section begins, if any), append:

```markdown
## Phase 10B — Interactive reflection portfolio

Three new custom elements complete the topic-page reflection portfolio: `<sim-text-response>` (inline textarea bound to a prompt; used 6× on the Gas Laws page for bell ringer and exit ticket), `<sim-practice-question>` (do-then-reveal flow with 3-chip self-rating; used 1× for the practice question section), and `<sim-reflection-export>` (page-wide aggregator side panel; LEFT side, joins the existing mutual-exclusion contract). The aggregator pulls state from every reflection component on the page on each open and each export click — state pull, not push. `<sim-checklist>` is refactored to expose `clear()` and to include `items` in `getState()`, while shedding its `exportPDF()` method and its in-panel `Download .md` / `Save as PDF` buttons.

### Architecture

- One instance of each new component per use site (topic-page convention; the aggregator is a singleton; text-response and practice-question are inline and instantiated per prompt).
- All three new components store per-instance state to localStorage with the standard `aisc-simengine:<kind>:<topic>:<level>:<id>` key shape.
- Each component observes `level` and force-flushes any pending debounce save to the OLD key BEFORE loading from the NEW key on attribute change. Same race-defense pattern as `<sim-checklist>` from Phase 10A v2.
- The aggregator stores no state of its own — its panel `[data-open]` attribute does not persist across reloads.

### State pull contract

The aggregator's source-of-truth is one `document.querySelectorAll('sim-checklist, sim-text-response, sim-practice-question')` call, performed:

- On every `_activate` (panel open) — to refresh the preview list.
- On every export click — to capture the latest state into the .md or PDF.

Each component exposes a `getState()` method whose return value is the canonical snapshot used for export. No event-bus subscription, no registry pattern. Adding a new reflection component later means: implement `getState()` on the new tag, add it to the aggregator's selector, done.

### Section grouping in the export

`section` attribute (`bell-ringer` / `exit-ticket` / `practice` / `success-criteria` / `misc`) becomes the heading bucket in both the .md and PDF output. Sections render in alphabetical order; within each section, components render in DOM order. Empty values render as `> *no response*` in markdown so blanks are visible to teachers reviewing the export.

### Mutual exclusion contract — three left-side participants

Phase 10A v2's contract: `<sim-data-card>` + `<sim-checklist>` dispatch + listen for `panel-opened` on `document`. Phase 10B adds `<sim-reflection-export>` as the third participant. Three left-side panels, only one open at a time. The contract:

- Each panel dispatches `panel-opened` with `{ source: this }`, bubbles + composed, on `_activate`.
- Each panel's `connectedCallback` registers a document listener for `panel-opened`. If the source is a different element AND the listening panel is `[data-open]`, it closes itself (`_dismiss()` for data-card; `close()` for checklist + export).
- Cleanup in `disconnectedCallback`.

`<sim-tweaks-panel>` (right side) stays independent — left-side-only by convention.

### Topic-page integration

The Gas Laws topic page's `applyLevel(level)` inline function gains a step 6 — push the new level to every `<sim-text-response>`, `<sim-practice-question>`, and `<sim-reflection-export>` on the page. Per-level state swap with the HL/SL toggle works for all six new component instances.

The sticky header gets a third button: "Save your work" (no emoji, ghost style). Wired to toggle the export panel's `[data-open]` with `e.stopPropagation()`. The Reflect button label drops its emoji prefix in the same commit so the topic page is emoji-free overall.

### Export pipeline (consolidated)

Markdown:

1. Aggregator's `exportMarkdown(triggerDownload)` calls `_scanSources()` + `_groupBySection()`.
2. Builds a string with H1 + level/date metadata + H2-per-section + per-component lines (text-response, practice-question, checklist all rendered inline with their own format).
3. If `triggerDownload === true`, creates a `Blob`, `URL.createObjectURL`, temporary `<a download>`, click, revoke.

PDF:

1. `exportPDF()` calls `_scanSources()` + builds a `#print-reflection-output` super-block via `_buildPrintBlock`.
2. Inserts (or `replaceWith`s) into `document.body`.
3. Adds `body.printing-reflection`, calls `window.print()`.
4. Reuses the existing `@media print` rules from `components.css` (added in Phase 10A v2). No new CSS needed.
5. `afterprint` window listener clears `body.printing-reflection` when the dialog closes.

### What ships vs what's deferred

| Concern                                                             | Status                                    |
| ------------------------------------------------------------------- | ----------------------------------------- |
| `<sim-text-response>` inline component                              | Shipped                                   |
| `<sim-practice-question>` do-then-reveal + 3-chip rating            | Shipped                                   |
| `<sim-reflection-export>` page-wide aggregator side panel           | Shipped                                   |
| `<sim-checklist>` export consolidation (refactor)                   | Shipped                                   |
| Per-instance localStorage persistence (text-response, practice)     | Shipped                                   |
| Three-way mutual exclusion (data-card / checklist / export)         | Shipped                                   |
| Section grouping in markdown + PDF (alphabetical, DOM-order within) | Shipped                                   |
| Empty-portfolio guard                                               | Shipped                                   |
| Clear-all (with confirm)                                            | Shipped                                   |
| Topic-page emoji-free pass                                          | Shipped                                   |
| Mobile/tablet responsive panel tweaks                               | Deferred (polish phase)                   |
| Whole-topic-page print stylesheet                                   | Deferred (spec §12 polish)                |
| Cross-topic portfolio aggregator                                    | Deferred (out of scope; possibly never)   |
| Server-side persistence                                             | Deferred (out of scope; possibly never)   |
| Animated check transitions; fancier progress visuals                | Deferred                                  |
| `<sim-engine>` private API → public                                 | Deferred (still on step-6 follow-up list) |
| `<slot>` reinstatement in `<sim-coachmark>`                         | Deferred (still on step-6 follow-up list) |
```

### Task 4.3 — Verify pipeline + commit

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: format clean, lint clean, **179 tests** passing (target — verify and report actual), build green.

Stage exactly:

```bash
git add CHANGELOG.md docs/architecture.md
```

Commit with env-var attribution:

```bash
GIT_AUTHOR_NAME="Matthew Ignash" GIT_AUTHOR_EMAIL="matthew.ignash@gmail.com" \
GIT_COMMITTER_NAME="Matthew Ignash" GIT_COMMITTER_EMAIL="matthew.ignash@gmail.com" \
git commit -m "$(cat <<'EOF'
docs: phase 10B — interactive reflection portfolio

Records phase 10B in CHANGELOG (under [Unreleased]) covering all
4 commits: <sim-text-response> + <sim-practice-question>, the
<sim-reflection-export> aggregator + <sim-checklist> export
refactor, the topic-page integration, and this docs entry.

Notes the public-API churn: <sim-checklist>.exportPDF() removed;
.getState() now includes `items`; .clear() added. All acceptable
because PR #8 just shipped, no consumers exist, and the package
scope is @TBD/*.

Adds a "## Phase 10B" section to docs/architecture.md covering:
the three new component shapes, per-instance localStorage keys,
the state-pull contract via document.querySelectorAll, the
section-grouping rules (alphabetical sections, DOM order within),
the three-way mutual-exclusion contract on the left side, the
consolidated export pipeline (.md + PDF), and the topic-page
integration including the sticky-header Save button + applyLevel
step 6.

Phase 10B commit 4 of 4. Phase 10B complete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

DO NOT PUSH.

---

## Final verification

After commit 4 lands, run the full pipeline once more from the worktree root:

```bash
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected:

- format clean
- lint clean (no new warnings)
- **~179 tests** passing (target; report actual)
- build green; bundle delta documented in PR description

Manual visual verification — open `examples/topic-page/index.html` in a real browser and run through the exit-criteria checklist from the design doc.

Push the branch + open PR:

```bash
git push -u origin phase-10b-reflection-portfolio
gh pr create --base main --head phase-10b-reflection-portfolio \
  --title "Phase 10B: interactive reflection portfolio" \
  --body "[generated body — see prior phase PRs as templates]"
```

Phase 10B complete.

## Phase 10B exit criteria (from design doc)

1. `pnpm install` clean.
2. `pnpm lint` clean.
3. `pnpm test` — all 179 tests passing across both packages (target — verify and report actual).
4. `pnpm build` clean. Bundle delta documented in PR description (≤+18 kB IIFE expected).
5. `examples/topic-page/index.html` (after `pnpm build`) opens in a browser and shows all behaviors enumerated in the design doc's Section 7 exit criteria.
6. CI green on the PR; merged to `main`.
