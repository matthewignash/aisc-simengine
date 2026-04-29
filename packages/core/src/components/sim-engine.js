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
 * Note: lifecycle wiring (state, recorder, sim init, attribute handling,
 * events, imperative API) lands in commit 4. This commit is render-only.
 */

import componentsCss from '../styles/components.css?inline';
import simShellCss from '../styles/sim-shell.css?inline';

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
}

if (!customElements.get('sim-engine')) {
  customElements.define('sim-engine', SimEngineElement);
}
