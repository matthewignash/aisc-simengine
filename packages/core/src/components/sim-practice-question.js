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
