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

  it('HOST_STYLES includes a max-width: 720px @media block that shrinks the panel in place', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(
      path.join(here, '../src/components/sim-reflection-export.js'),
      'utf-8'
    );
    const m = src.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\}\s*\}/);
    expect(m).not.toBeNull();
    const block = m[1];
    expect(block).toContain('width: calc(100vw - 32px)');
    expect(block).toContain('max-width: 320px');
  });
});
