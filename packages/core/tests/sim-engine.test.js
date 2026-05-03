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

  it('clamps dt to 0.1 when the rAF callback fires after a long delay (backgrounded tab)', async () => {
    // Capture the rAF callback so we can invoke it with a controlled `now`.
    const originalRAF = globalThis.requestAnimationFrame;
    let capturedTick = null;
    globalThis.requestAnimationFrame = (fn) => {
      capturedTick = fn;
      return 1; // dummy handle
    };

    try {
      const el = mountSimEngine({ sim: 'fake-sim' });
      await Promise.resolve();
      // _startLoop scheduled the first tick — capturedTick is now the loop's `tick`.
      expect(typeof capturedTick).toBe('function');
      // Manually advance: pretend we backgrounded for 5 seconds and resumed.
      const start = el._lastFrameTime;
      const longLater = start + 5000; // ms — 5 seconds elapsed
      capturedTick(longLater);
      // Without the clamp, state.dt would be ~5.0; with it, exactly 0.1.
      expect(el._state.get('dt')).toBeLessThanOrEqual(0.1);
      expect(el._state.get('dt')).toBeGreaterThan(0); // sanity: dt was actually computed
    } finally {
      globalThis.requestAnimationFrame = originalRAF;
    }
  });

  it('step(dt) calls sim.step(dt) once and paints once', async () => {
    const el = document.createElement('sim-engine');
    el.setAttribute('sim', 'fake-sim');
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();
    // _paintOnce requires a canvas in the stage to invoke sim.render(ctx).
    // happy-dom returns null from getContext('2d'); stub a canvas so _paintOnce
    // can pass a non-null ctx through to sim.render.
    const canvas = document.createElement('canvas');
    canvas.getContext = () => ({});
    el.shadowRoot.querySelector('.sim-canvas__stage').appendChild(canvas);
    // After mount, swap in spies for the sim's step + render
    const stepSpy = vi.fn();
    const renderSpy = vi.fn();
    el._sim = { step: stepSpy, render: renderSpy };
    el.step(0.05);
    expect(stepSpy).toHaveBeenCalledOnce();
    expect(stepSpy).toHaveBeenCalledWith(0.05);
    expect(renderSpy).toHaveBeenCalledOnce();
  });

  it('step() with no argument uses default dt of 1/60', async () => {
    const el = document.createElement('sim-engine');
    el.setAttribute('sim', 'fake-sim');
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();
    // happy-dom returns null from getContext('2d'); stub a canvas so _paintOnce
    // can pass a non-null ctx through to sim.render.
    const canvas = document.createElement('canvas');
    canvas.getContext = () => ({});
    el.shadowRoot.querySelector('.sim-canvas__stage').appendChild(canvas);
    const stepSpy = vi.fn();
    el._sim = { step: stepSpy, render: vi.fn() };
    el.step();
    expect(stepSpy).toHaveBeenCalledWith(1 / 60);
  });

  it('step() works while paused (does not require play state)', async () => {
    const el = document.createElement('sim-engine');
    el.setAttribute('sim', 'fake-sim');
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();
    // happy-dom returns null from getContext('2d'); stub a canvas so _paintOnce
    // can pass a non-null ctx through to sim.render.
    const canvas = document.createElement('canvas');
    canvas.getContext = () => ({});
    el.shadowRoot.querySelector('.sim-canvas__stage').appendChild(canvas);
    el.pause();
    const stepSpy = vi.fn();
    const renderSpy = vi.fn();
    el._sim = { step: stepSpy, render: renderSpy };
    el.step(0.1);
    expect(stepSpy).toHaveBeenCalledOnce();
    expect(renderSpy).toHaveBeenCalledOnce();
  });

  it('redraw() calls sim.render but NOT sim.step', async () => {
    const el = document.createElement('sim-engine');
    el.setAttribute('sim', 'fake-sim');
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();
    // happy-dom returns null from getContext('2d'); stub a canvas so _paintOnce
    // can pass a non-null ctx through to sim.render.
    const canvas = document.createElement('canvas');
    canvas.getContext = () => ({});
    el.shadowRoot.querySelector('.sim-canvas__stage').appendChild(canvas);
    const stepSpy = vi.fn();
    const renderSpy = vi.fn();
    el._sim = { step: stepSpy, render: renderSpy };
    el.redraw();
    expect(stepSpy).not.toHaveBeenCalled();
    expect(renderSpy).toHaveBeenCalledOnce();
  });
});
