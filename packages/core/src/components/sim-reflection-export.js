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
  @media (max-width: 720px) {
    :host {
      width: calc(100vw - 32px);
      max-width: 320px;
    }
  }
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
