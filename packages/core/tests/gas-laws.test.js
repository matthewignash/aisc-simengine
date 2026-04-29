import { describe, it, expect, beforeEach, vi } from 'vitest';
import gasLaws from '../src/sims/gas-laws/index.js';
import { registerSim, lookupSim, clearRegistry } from '../src/sims/registry.js';
import '../src/components/sim-engine.js';

function mountSimEngine(attrs = {}) {
  document.body.replaceChildren();
  const el = document.createElement('sim-engine');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, String(v));
  }
  document.body.appendChild(el);
  return el;
}

describe('gas-laws sim module', () => {
  beforeEach(() => {
    clearRegistry();
    document.body.replaceChildren();
  });

  it('passes validateSimShape (registers without throwing)', () => {
    expect(() => registerSim(gasLaws)).not.toThrow();
    expect(lookupSim('gas-laws')).toBe(gasLaws);
  });

  it('rail contains 3 sliders with the right keys after mount', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    const sliders = el.shadowRoot.querySelectorAll('.sim-rail .sim-slider');
    expect(sliders.length).toBe(3);
    const keys = Array.from(sliders).map((s) => s.dataset.var);
    expect(keys).toEqual(['T', 'V', 'n']);
  });

  it('readouts show numeric values for P, KE, and N after mount', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    const root = el.shadowRoot;
    const P = root.querySelector('[data-readout="P"] .sim-readout__value-text').textContent;
    const KE = root.querySelector('[data-readout="KE"] .sim-readout__value-text').textContent;
    const N = root.querySelector('[data-readout="N"] .sim-readout__value-text').textContent;
    expect(P).not.toBe('—');
    expect(Number(P)).toBeGreaterThan(0);
    expect(KE).not.toBe('—');
    expect(Number(N)).toBeGreaterThanOrEqual(4);
  });

  it('moving the V slider updates state.V and the displayed P readout', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    const root = el.shadowRoot;
    const beforeP = root.querySelector('[data-readout="P"] .sim-readout__value-text').textContent;

    const vSliderInput = root.querySelector('.sim-slider[data-var="V"] input[type="range"]');
    vSliderInput.value = '4';
    vSliderInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(el._state.get('V')).toBe(4);
    const afterP = root.querySelector('[data-readout="P"] .sim-readout__value-text').textContent;
    expect(afterP).not.toBe(beforeP);
  });

  it('after several render cycles, _frameCount advances past the graph cadence', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    const stageCanvas = el.shadowRoot.querySelector('.sim-canvas__stage canvas');
    const ctx = stageCanvas.getContext('2d');
    for (let i = 0; i < 12; i++) {
      el._sim.render(ctx);
    }
    expect(el._sim._frameCount).toBeGreaterThan(10);
  });

  it('derived(state) returns P and KE for known inputs', () => {
    const out = gasLaws.derived({ T: 300, V: 2, n: 1 });
    expect(out.P).toBeCloseTo((8.314 * 300) / 2, 1);
    expect(out.KE).toBeGreaterThan(0);
  });

  it('render(ctx) calls drawContainer (clearRect + strokeRect) before particles', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    const calls = [];
    const ctx = {
      canvas: { width: 600, height: 360 },
      clearRect: (...a) => calls.push(['clearRect', ...a]),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      strokeRect: (...a) => calls.push(['strokeRect', ...a]),
      beginPath: () => calls.push(['beginPath']),
      arc: (...a) => calls.push(['arc', ...a]),
      fill: () => calls.push(['fill']),
      save: () => calls.push(['save']),
      restore: () => calls.push(['restore']),
      translate: (...a) => calls.push(['translate', ...a]),
    };
    el._sim.render(ctx);
    // The sim should have done clearRect, then strokeRect (drawContainer),
    // then translate + arc + fill (particles inside translated frame).
    const clearIdx = calls.findIndex(([fn]) => fn === 'clearRect');
    const strokeIdx = calls.findIndex(([fn]) => fn === 'strokeRect');
    const translateIdx = calls.findIndex(([fn]) => fn === 'translate');
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    expect(strokeIdx).toBeGreaterThan(clearIdx);
    expect(translateIdx).toBeGreaterThan(strokeIdx);
  });

  it('renders a species dropdown in the rail with 4 options, default ideal', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    const dropdown = el.shadowRoot.querySelector('.sim-rail .sim-dropdown[data-var="species"]');
    expect(dropdown).not.toBeNull();
    const select = dropdown.querySelector('select');
    expect(select.options.length).toBe(4);
    expect(select.value).toBe('ideal');
  });

  it('changing species updates state.species', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    const select = el.shadowRoot.querySelector('.sim-dropdown[data-var="species"] select');
    select.value = 'co2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el._state.get('species')).toBe('co2');
  });

  it('readouts include a "Species" entry showing the human label', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    const speciesReadout = el.shadowRoot.querySelector(
      '[data-readout="species"] .sim-readout__value-text'
    );
    expect(speciesReadout.textContent).toBe('Ideal gas');
    // Change species; readout updates.
    el.setVariable('species', 'co2');
    expect(speciesReadout.textContent).toBe('CO₂ · Carbon dioxide');
  });

  it('derived(state) returns VdW pressure for CO₂ (different from ideal)', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    el.setVariable('species', 'co2');
    el.setVariable('V', 2);
    el.setVariable('T', 300);
    el.setVariable('n', 2);
    // At V=2, T=300, n=2 with CO₂: ideal=2494 kPa, real≈2241 kPa
    const idealP = (8.314 * 300 * 2) / 2; // ~2494.2
    const out = el._sim.derived(el._state.getAll());
    expect(out.P).toBeLessThan(idealP); // VdW attraction lowers pressure here
    expect(out.P).toBeGreaterThan(0); // not compressed past nb
  });

  it('removes state listeners on dispose so they do not fire on nulled fields', async () => {
    registerSim(gasLaws);
    const el = mountSimEngine({ sim: 'gas-laws' });
    await Promise.resolve();
    // Capture the state reference; remove the element triggers disconnectedCallback → dispose.
    const state = el._state;
    el.remove();
    // After dispose, _field, _graph, etc. are null. If the dispose left listeners
    // attached, state.set('T', 999) would call this._field.setTemperature on null.
    // The OLD impl uses ?. chains so it doesn't crash, but it ALSO does no work.
    // The fix: dispose collects unsubs and calls them; subsequent set is a true no-op.
    // We assert via the spy below.
    const fakeSimSpy = vi.spyOn(el._sim, '_updateReadouts').mockImplementation(() => {});
    state.set('T', 999);
    state.set('V', 1.0);
    state.set('n', 2.5);
    expect(fakeSimSpy).not.toHaveBeenCalled();
    fakeSimSpy.mockRestore();
  });
});
