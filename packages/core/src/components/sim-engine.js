/**
 * `<sim-engine>` — vanilla custom element (no Lit, no framework).
 *
 * Opens an open shadow root and adopts three constructable stylesheets shared
 * as singletons across all instances:
 *   - host display rules (`:host { display: block }`)
 *   - the AISC components.css (buttons, sliders, cards) needed inside the
 *     shadow boundary, where global stylesheets do not pierce
 *   - sim-shell.css — the simulation-portion layout
 *
 * Renders the static shell skeleton (.sim-main, .sim-canvas, .sim-rail,
 * .sim-transport) from a `<template>` via `cloneNode(true)`. The element
 * orchestrates the per-sim module resolved through the global registry.
 *
 * Lifecycle (commit 4):
 *   - connectedCallback: instantiate state from attributes, look up sim from
 *     registry, run sim.init, instantiate the recorder, emit `sim-ready`.
 *   - attributeChangedCallback: reflect reactive attributes into state and
 *     emit `level-changed` when level toggles.
 *   - disconnectedCallback: stop the recorder; call sim.dispose if defined.
 *
 * Imperative API: setVariable, recordTrial, exportCSV, scenario, reset.
 */

import componentsCss from '../styles/components.css?inline';
import simShellCss from '../styles/sim-shell.css?inline';
import { createState } from '../engine/state.js';
import { createRecorder } from '../engine/recorder.js';
import { lookupSim } from '../sims/registry.js';
import { prefersReducedMotion } from '../engine/a11y.js';

const hostSheet = new CSSStyleSheet();
hostSheet.replaceSync(':host { display: block; } :host([hidden]) { display: none; }');

const componentsSheet = new CSSStyleSheet();
componentsSheet.replaceSync(componentsCss);

const simShellSheet = new CSSStyleSheet();
simShellSheet.replaceSync(simShellCss);

const SHELL_TEMPLATE = document.createElement('template');
SHELL_TEMPLATE.innerHTML = `
    <div class="sim-main">
      <div class="sim-canvas">
        <div class="sim-canvas__head"></div>
        <div class="sim-canvas__stage"></div>
        <div class="sim-readouts"></div>
      </div>
      <aside class="sim-rail"></aside>
    </div>
    <div class="sim-transport"></div>
    <slot name="exit-ticket"></slot>
  `;

class SimEngineElement extends HTMLElement {
  static get observedAttributes() {
    return [
      'sim',
      'level',
      'language',
      'difficulty',
      'show-graph',
      'show-exit-ticket',
      'teacher-view',
    ];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [hostSheet, componentsSheet, simShellSheet];
    root.appendChild(SHELL_TEMPLATE.content.cloneNode(true));
  }

  connectedCallback() {
    if (this._initialized) return;
    this._initialized = true;
    this._rafHandle = null;

    this._state = createState({
      level: this.getAttribute('level') ?? 'sl',
      language: this.getAttribute('language') ?? 'default',
      difficulty: this.getAttribute('difficulty') ?? 'standard',
      showGraph: this.hasAttribute('show-graph'),
      showExitTicket: this.hasAttribute('show-exit-ticket'),
      teacherView: this.hasAttribute('teacher-view'),
      playing: true,
      dt: 0,
    });

    const simId = this.getAttribute('sim');
    const simModule = lookupSim(simId);
    if (!simModule) {
      this._renderError(`Unknown sim id: "${simId}"`);
      return;
    }
    this._sim = simModule;
    this._sim.init(this, /* dataLoader */ null);

    this._recorder = createRecorder({
      variables: simModule.controls.map((c) => c.key),
      getState: () => this._state.getAll(),
    });
    this._recorder.startRun();

    this.dispatchEvent(new CustomEvent('sim-ready', { bubbles: true, composed: true }));

    this._startLoop();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._initialized || !this._state) return;
    switch (name) {
      case 'level':
        this._state.set('level', newValue);
        this.dispatchEvent(
          new CustomEvent('level-changed', {
            detail: { from: oldValue, to: newValue },
            bubbles: true,
            composed: true,
          })
        );
        break;
      case 'language':
        this._state.set('language', newValue);
        break;
      case 'difficulty':
        this._state.set('difficulty', newValue);
        break;
      case 'show-graph':
        this._state.set('showGraph', newValue !== null);
        break;
      case 'show-exit-ticket':
        this._state.set('showExitTicket', newValue !== null);
        break;
      case 'teacher-view':
        this._state.set('teacherView', newValue !== null);
        break;
      // 'sim' is intentionally not handled — set once at mount.
    }
  }

  disconnectedCallback() {
    this._stopLoop();
    if (this._recorder) this._recorder.stopRun();
    if (this._sim && typeof this._sim.dispose === 'function') {
      try {
        this._sim.dispose();
      } catch (err) {
        console.error('<sim-engine>: sim.dispose threw', err);
      }
    }
  }

  /**
   * Imperative API: set a state variable by key.
   *
   * @param {string} key
   * @param {unknown} value
   */
  setVariable(key, value) {
    if (!this._state) return;
    this._state.set(key, value);
  }

  /**
   * Record one trial into the recorder. Emits `trial-recorded` with the
   * trial number, the control-key/value snapshot, and any derived fields.
   */
  recordTrial() {
    if (!this._recorder || !this._sim) return;
    this._recorder.record();
    const allState = this._state.getAll();
    const controlKeys = new Set(this._sim.controls.map((c) => c.key));
    const values = {};
    for (const key of Object.keys(allState)) {
      if (controlKeys.has(key)) values[key] = allState[key];
    }
    const derived = typeof this._sim.derived === 'function' ? this._sim.derived(allState) : {};
    const trialNum = this._recorder.snapshot().length;
    this.dispatchEvent(
      new CustomEvent('trial-recorded', {
        detail: { trialNum, values, derived },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Export all recorded trials as an RFC 4180 CSV string.
   *
   * @returns {string}
   */
  exportCSV() {
    if (!this._recorder) return '';
    return this._recorder.toCSV();
  }

  /**
   * Apply a named scenario from the sim module by setting each preset
   * key/value through state. Logs a warning when the id is unknown.
   *
   * @param {string} id
   */
  scenario(id) {
    if (!this._sim || !this._state) return;
    const preset = this._sim.scenarios.find((s) => s.id === id);
    if (!preset) {
      console.warn(`<sim-engine>: scenario "${id}" not found`);
      return;
    }
    for (const [k, v] of Object.entries(preset.values)) {
      this._state.set(k, v);
    }
  }

  /**
   * Reset state to its initial seed and start a fresh recorder run.
   */
  reset() {
    if (this._state) this._state.reset();
    if (this._recorder) this._recorder.startRun();
  }

  /**
   * Dismiss a coachmark by id within the sim's shadow DOM. Also persists
   * the dismissal in localStorage so it doesn't re-show on reload.
   *
   * @param {string} id
   */
  dismissCoachmark(id) {
    const cm = this.shadowRoot?.querySelector(`sim-coachmark[id="${id}"]`);
    if (cm && typeof cm.dismiss === 'function') {
      cm.dismiss();
    } else {
      // Element may not be mounted — still persist the dismissal
      try {
        localStorage.setItem(`aisc-simengine:coachmark:dismissed:${id}`, '1');
      } catch (e) {
        // localStorage unavailable
      }
    }
  }

  /**
   * Start the requestAnimationFrame loop. Each tick reads playing/dt from
   * state, calls sim.step(dt), and paints once via _paintOnce. When a user
   * prefers reduced motion, a single paint is performed and no loop runs.
   * Idempotent: a no-op when a loop is already running.
   */
  _startLoop() {
    if (this._rafHandle != null) return;
    if (prefersReducedMotion()) {
      this._paintOnce();
      return;
    }
    this._lastFrameTime = performance.now();
    const tick = (now) => {
      if (!this._state || !this._state.get('playing')) {
        this._rafHandle = null;
        return;
      }
      const rawDt = (now - this._lastFrameTime) / 1000;
      // Cap at 100ms to handle backgrounded-tab spikes — without this, a tab
      // resumed after seconds of throttling would deliver one giant dt that
      // produces glitched physics. At normal 60fps the typical dt is ~16ms,
      // so the cap is invisible during active operation.
      const dt = Math.min(rawDt, 0.1);
      this._lastFrameTime = now;
      this._state.set('dt', dt);
      if (typeof this._sim?.step === 'function') this._sim.step(dt);
      this._paintOnce();
      this._rafHandle = requestAnimationFrame(tick);
    };
    this._rafHandle = requestAnimationFrame(tick);
  }

  /**
   * Cancel any active rAF tick and clear the handle so _startLoop can later
   * resume the loop.
   */
  _stopLoop() {
    if (this._rafHandle != null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  }

  /**
   * Paint a single frame by passing the stage canvas's 2D context to the
   * sim's render function. No-op when there is no canvas in the stage or
   * the sim does not implement render.
   */
  _paintOnce() {
    if (typeof this._sim?.render !== 'function') return;
    const canvas = this.shadowRoot.querySelector('.sim-canvas__stage canvas');
    const ctx = canvas?.getContext('2d');
    if (ctx) this._sim.render(ctx);
  }

  /**
   * Resume the rAF loop. Sets state.playing to true and (re)starts the loop
   * when no rAF is active.
   */
  play() {
    if (!this._state) return;
    this._state.set('playing', true);
    this._startLoop();
  }

  /**
   * Pause the rAF loop. Flips state.playing to false; the next tick observes
   * this and exits without rescheduling.
   */
  pause() {
    if (!this._state) return;
    this._state.set('playing', false);
  }

  /**
   * Render an inline error message in the shadow stage and log to console.
   *
   * @param {string} message
   */
  _renderError(message) {
    const stage = this.shadowRoot.querySelector('.sim-canvas__stage');
    if (stage) {
      stage.textContent = message;
      stage.setAttribute('role', 'alert');
    }
    console.error(`<sim-engine>: ${message}`);
  }
}

/**
 * Define the custom element on the next microtask, not synchronously at
 * module load. This matters for bundle ordering: when the IIFE bundle runs,
 * sim-engine.js's body executes BEFORE the bundle's later top-level
 * `registerSim(gasLaws)` call. If `customElements.define` ran synchronously
 * during module body, any existing `<sim-engine>` in the DOM would upgrade
 * immediately, run `connectedCallback`, call `lookupSim('gas-laws')`, and
 * find an empty registry — failing with "Unknown sim id".
 *
 * Deferring via `queueMicrotask` ensures all synchronous bundle code
 * (including `registerSim` calls) completes before any DOM-resident
 * `<sim-engine>` elements upgrade. Tests that await `Promise.resolve()`
 * after mounting still see a fully initialized element on the next line,
 * since both microtasks drain in FIFO order.
 */
queueMicrotask(() => {
  if (!customElements.get('sim-engine')) {
    customElements.define('sim-engine', SimEngineElement);
  }
});
