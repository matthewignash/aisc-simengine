import { describe, it, expect, beforeEach } from 'vitest';
import { registerSim, clearRegistry } from '../src/sims/registry.js';
import fakeSim from './_fixtures/fake-sim.js';
import '../src/components/sim-engine.js';

describe('<sim-engine> — shell scaffolding', () => {
  beforeEach(() => {
    clearRegistry();
    registerSim(fakeSim);
    document.body.innerHTML = '';
  });

  it('mounts with adopted stylesheets on the shadow root', () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    const el = document.querySelector('sim-engine');
    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot.adoptedStyleSheets.length).toBeGreaterThan(0);
  });

  it('renders the shell skeleton (.sim-main, .sim-canvas, .sim-rail, .sim-transport) into the shadow root', () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    const root = document.querySelector('sim-engine').shadowRoot;
    expect(root.querySelector('.sim-main')).not.toBe(null);
    expect(root.querySelector('.sim-canvas')).not.toBe(null);
    expect(root.querySelector('.sim-rail')).not.toBe(null);
    expect(root.querySelector('.sim-transport')).not.toBe(null);
  });
});
