import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerSim, clearRegistry } from '../src/sims/registry.js';
import fakeSim, { fakeSimCalls, resetFakeSimCalls } from './_fixtures/fake-sim.js';
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

describe('<sim-engine> — rAF loop', () => {
  beforeEach(() => {
    clearRegistry();
    registerSim(fakeSim);
    resetFakeSimCalls();
    document.body.replaceChildren();
  });

  it('starts a rAF loop on connect that calls sim.step on each tick', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    mountSimEngine({ sim: 'fake-sim' });
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(fakeSimCalls.step).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('pause() stops further sim.step calls; play() resumes', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const el = mountSimEngine({ sim: 'fake-sim' });
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    const before = fakeSimCalls.step;
    el.pause();
    vi.advanceTimersByTime(100);
    expect(fakeSimCalls.step).toBe(before);
    el.play();
    vi.advanceTimersByTime(50);
    expect(fakeSimCalls.step).toBeGreaterThan(before);
    vi.useRealTimers();
  });

  it('disconnectedCallback stops the rAF loop', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const el = mountSimEngine({ sim: 'fake-sim' });
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    const before = fakeSimCalls.step;
    el.remove();
    vi.advanceTimersByTime(100);
    expect(fakeSimCalls.step).toBe(before);
    vi.useRealTimers();
  });

  it('prefers-reduced-motion disables the rAF loop', async () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({
      matches: q.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const el = mountSimEngine({ sim: 'fake-sim' });
    await Promise.resolve();
    // Wait one event loop tick — if the loop is running, it would have called step by now.
    await new Promise((r) => setTimeout(r, 20));
    expect(fakeSimCalls.step).toBe(0);
    expect(el._rafHandle).toBeNull();
    matchMediaSpy.mockRestore();
  });
});
