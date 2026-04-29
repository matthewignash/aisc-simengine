import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerSim, clearRegistry } from '../src/sims/registry.js';
import fakeSim, { fakeSimCalls, resetFakeSimCalls } from './_fixtures/fake-sim.js';
import '../src/components/sim-engine.js';

describe('<sim-engine> — shell scaffolding', () => {
  beforeEach(() => {
    clearRegistry();
    registerSim(fakeSim);
    resetFakeSimCalls();
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
    expect(root.querySelector('.sim-canvas').parentElement).toBe(root.querySelector('.sim-main'));
    expect(root.querySelector('slot[name="exit-ticket"]')).not.toBe(null);
  });

  it('calls sim.init exactly once and emits sim-ready when mounted with a known sim id', async () => {
    const events = [];
    document.body.addEventListener('sim-ready', (e) => events.push(e), { once: true });
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    await Promise.resolve();
    expect(fakeSimCalls.init).toBe(1);
    expect(events.length).toBe(1);
  });

  it('renders an error in the shadow root when the sim id is unknown, and does not throw', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      document.body.innerHTML = '<sim-engine sim="does-not-exist"></sim-engine>';
    }).not.toThrow();
    const stage = document
      .querySelector('sim-engine')
      .shadowRoot.querySelector('.sim-canvas__stage');
    expect(stage.textContent).toMatch(/unknown sim id/i);
    expect(stage.getAttribute('role')).toBe('alert');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('reflects the level attribute into state and emits level-changed when toggled', async () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim" level="sl"></sim-engine>';
    const el = document.querySelector('sim-engine');
    await Promise.resolve();
    expect(el._state.get('level')).toBe('sl');

    const events = [];
    el.addEventListener('level-changed', (e) => events.push(e.detail));
    el.setAttribute('level', 'hl');

    expect(el._state.get('level')).toBe('hl');
    expect(events).toEqual([{ from: 'sl', to: 'hl' }]);
  });

  it('reflects the teacher-view boolean attribute into state', async () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    const el = document.querySelector('sim-engine');
    await Promise.resolve();
    expect(el._state.get('teacherView')).toBe(false);
    el.setAttribute('teacher-view', '');
    expect(el._state.get('teacherView')).toBe(true);
    el.removeAttribute('teacher-view');
    expect(el._state.get('teacherView')).toBe(false);
  });

  it('setVariable(key, value) updates state and notifies listeners', async () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    const el = document.querySelector('sim-engine');
    await Promise.resolve();
    const calls = [];
    el._state.on('T', (v) => calls.push(v));
    el.setVariable('T', 350);
    expect(el._state.get('T')).toBe(350);
    expect(calls).toEqual([350]);
  });

  it('recordTrial() appends a row to the recorder and emits trial-recorded with values + derived', async () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    const el = document.querySelector('sim-engine');
    await Promise.resolve();
    el.setVariable('T', 350);
    el.setVariable('V', 8);

    const events = [];
    el.addEventListener('trial-recorded', (e) => events.push(e.detail));
    el.recordTrial();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      trialNum: 1,
      values: { T: 350, V: 8 },
      derived: { sum: 358 },
    });
  });

  it('exportCSV() returns a CSV reflecting all recorded trials', async () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    const el = document.querySelector('sim-engine');
    await Promise.resolve();

    el.setVariable('T', 298);
    el.setVariable('V', 6.4);
    el.recordTrial();

    el.setVariable('T', 350);
    el.recordTrial();

    expect(el.exportCSV()).toBe('T,V\r\n298,6.4\r\n350,6.4\r\n');
  });

  it('scenario(id) applies the preset values from the sim module', async () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    const el = document.querySelector('sim-engine');
    await Promise.resolve();
    el.scenario('cold');
    expect(el._state.get('T')).toBe(100);
    el.scenario('hot');
    expect(el._state.get('T')).toBe(500);
  });

  it('reset() restores initial state and starts a fresh recorder run', async () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim" level="hl"></sim-engine>';
    const el = document.querySelector('sim-engine');
    await Promise.resolve();
    el.setVariable('T', 999);
    el.recordTrial();
    expect(el.exportCSV().split('\r\n').filter(Boolean)).toHaveLength(2);

    el.reset();
    expect(el._state.get('level')).toBe('hl');
    expect(el._state.get('T')).toBeUndefined();
    expect(el.exportCSV()).toBe('T,V\r\n');
  });

  it('disconnectedCallback stops the recorder so subsequent record() calls are no-ops', async () => {
    document.body.innerHTML = '<sim-engine sim="fake-sim"></sim-engine>';
    const el = document.querySelector('sim-engine');
    await Promise.resolve();
    el.recordTrial();
    expect(el.exportCSV().split('\r\n').filter(Boolean)).toHaveLength(2);

    el.remove();
    el._recorder.record();
    expect(el._recorder.snapshot()).toHaveLength(1);
  });
});
