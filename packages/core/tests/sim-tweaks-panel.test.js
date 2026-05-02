import { describe, it, expect, beforeEach } from 'vitest';
import { registerSim, clearRegistry } from '../src/sims/registry.js';
import gasLaws from '../src/sims/gas-laws/index.js';
import '../src/components/sim-engine.js';
import '../src/components/sim-tweaks-panel.js';

function mountSimEngine(attrs = {}) {
  const el = document.createElement('sim-engine');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, String(v));
  }
  document.body.appendChild(el);
  return el;
}

describe('<sim-tweaks-panel>', () => {
  beforeEach(() => {
    clearRegistry();
    registerSim(gasLaws);
    document.body.replaceChildren();
  });

  it('renders one .sim-switch per declared tweak from the referenced sim-engine', async () => {
    const sim = mountSimEngine({ sim: 'gas-laws', id: 'sim' });
    await Promise.resolve();
    const panel = document.createElement('sim-tweaks-panel');
    panel.setAttribute('for', 'sim');
    document.body.appendChild(panel);
    await Promise.resolve();
    const switches = panel.shadowRoot.querySelectorAll('.sim-switch');
    expect(switches.length).toBe(2); // gas-laws declares 2 tweaks
    const ids = Array.from(switches).map((s) => s.querySelector('input').dataset.tweakId);
    expect(ids).toEqual(['showHLGraph', 'showMBGraph']);
  });

  it('toggling a non-attribute tweak writes to state', async () => {
    const sim = mountSimEngine({ sim: 'gas-laws', id: 'sim' });
    await Promise.resolve();
    const panel = document.createElement('sim-tweaks-panel');
    panel.setAttribute('for', 'sim');
    document.body.appendChild(panel);
    await Promise.resolve();
    const mbInput = panel.shadowRoot.querySelector('input[data-tweak-id="showMBGraph"]');
    expect(sim._state.get('showMBGraph')).toBe(true); // default
    mbInput.checked = false;
    mbInput.dispatchEvent(new Event('change'));
    expect(sim._state.get('showMBGraph')).toBe(false);
  });

  it('toggling an asAttribute tweak (level) writes via setAttribute', async () => {
    const sim = mountSimEngine({ sim: 'gas-laws', id: 'sim', level: 'sl' });
    await Promise.resolve();
    const panel = document.createElement('sim-tweaks-panel');
    panel.setAttribute('for', 'sim');
    document.body.appendChild(panel);
    await Promise.resolve();
    const hlInput = panel.shadowRoot.querySelector('input[data-tweak-id="showHLGraph"]');
    expect(hlInput.checked).toBe(false); // sl by default
    hlInput.checked = true;
    hlInput.dispatchEvent(new Event('change'));
    expect(sim.getAttribute('level')).toBe('hl');
  });

  it('close button removes data-open and emits tweaks-panel-closed', async () => {
    const sim = mountSimEngine({ sim: 'gas-laws', id: 'sim' });
    await Promise.resolve();
    const panel = document.createElement('sim-tweaks-panel');
    panel.setAttribute('for', 'sim');
    panel.setAttribute('data-open', '');
    document.body.appendChild(panel);
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('tweaks-panel-closed', () => events.push(true));
    panel.shadowRoot.querySelector('.sim-tweaks__close').click();
    expect(panel.hasAttribute('data-open')).toBe(false);
    expect(events.length).toBe(1);
  });

  it('switches sync when state changes externally (e.g. HL toggle outside the panel)', async () => {
    const sim = mountSimEngine({ sim: 'gas-laws', id: 'sim', level: 'sl' });
    await Promise.resolve();
    const panel = document.createElement('sim-tweaks-panel');
    panel.setAttribute('for', 'sim');
    document.body.appendChild(panel);
    await Promise.resolve();
    const hlInput = panel.shadowRoot.querySelector('input[data-tweak-id="showHLGraph"]');
    expect(hlInput.checked).toBe(false);
    // External: flip the level attribute on the sim (as the smoke test's HL switch does).
    sim.setAttribute('level', 'hl');
    expect(hlInput.checked).toBe(true);
  });

  it('HOST_STYLES includes a max-width: 720px @media block that shrinks the panel in place', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(
      path.join(here, '../src/components/sim-tweaks-panel.js'),
      'utf-8'
    );
    const m = src.match(/@media\s*\(\s*max-width:\s*720px\s*\)\s*\{([\s\S]*?)\}\s*\}/);
    expect(m).not.toBeNull();
    const block = m[1];
    expect(block).toContain('width: calc(100vw - 32px)');
    expect(block).toContain('max-width: 320px');
  });
});
