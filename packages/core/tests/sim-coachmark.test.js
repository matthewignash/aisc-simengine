import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/components/sim-coachmark.js';
import '../src/components/sim-engine.js';

describe('<sim-coachmark>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('renders with content and positions itself when anchor exists', async () => {
    const target = document.createElement('div');
    target.id = 'target';
    target.style.position = 'absolute';
    target.style.top = '100px';
    target.style.left = '50px';
    target.style.width = '40px';
    target.style.height = '40px';
    document.body.appendChild(target);

    const cm = document.createElement('sim-coachmark');
    cm.id = 'first-slider';
    cm.setAttribute('anchor', '#target');
    cm.textContent = 'Drag this to change temperature.';
    document.body.appendChild(cm);
    await Promise.resolve();
    await Promise.resolve();

    const root = cm.shadowRoot;
    const card = root.querySelector('.sim-coachmark');
    expect(card).not.toBeNull();
    expect(root.querySelector('.sim-coachmark__content').textContent).toContain(
      'Drag this to change temperature'
    );
    expect(card.style.top).toBeTruthy();
    expect(card.style.left).toBeTruthy();
  });

  it('Got it button dismisses, sets localStorage, and emits coachmark-shown', async () => {
    const target = document.createElement('div');
    target.id = 't';
    document.body.appendChild(target);
    const cm = document.createElement('sim-coachmark');
    cm.id = 'first-slider';
    cm.setAttribute('anchor', '#t');
    cm.textContent = 'Hint';
    document.body.appendChild(cm);
    await Promise.resolve();
    await Promise.resolve();
    const events = [];
    document.body.addEventListener('coachmark-shown', (e) => events.push(e.detail));
    cm.shadowRoot.querySelector('.sim-coachmark__dismiss').click();
    expect(cm.style.display).toBe('none');
    expect(localStorage.getItem('aisc-simengine:coachmark:dismissed:first-slider')).toBe('1');
    expect(events).toEqual([{ id: 'first-slider', dismissed: true }]);
  });

  it('Escape dismisses while focused', async () => {
    const target = document.createElement('div');
    target.id = 't2';
    document.body.appendChild(target);
    const cm = document.createElement('sim-coachmark');
    cm.id = 'cm-esc';
    cm.setAttribute('anchor', '#t2');
    cm.textContent = 'Hint';
    document.body.appendChild(cm);
    await Promise.resolve();
    await Promise.resolve();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cm.style.display).toBe('none');
  });

  it('mount with prior dismissal in localStorage renders no coachmark', async () => {
    localStorage.setItem('aisc-simengine:coachmark:dismissed:cm-prev', '1');
    const target = document.createElement('div');
    target.id = 't3';
    document.body.appendChild(target);
    const cm = document.createElement('sim-coachmark');
    cm.id = 'cm-prev';
    cm.setAttribute('anchor', '#t3');
    cm.textContent = 'Hint';
    document.body.appendChild(cm);
    await Promise.resolve();
    await Promise.resolve();
    expect(cm.style.display).toBe('none');
    expect(cm.shadowRoot.querySelector('.sim-coachmark')).toBeNull();
  });

  it('sim-engine.dismissCoachmark(id) dismisses the matching coachmark', async () => {
    const { registerSim, clearRegistry } = await import('../src/sims/registry.js');
    const fakeSim = {
      id: 'fake-test-sim',
      syllabus: ['T'],
      init(host) {
        const coachmark = document.createElement('sim-coachmark');
        coachmark.id = 'cm-host-dismiss';
        coachmark.setAttribute('anchor', '.sim-canvas__stage');
        coachmark.textContent = 'Hint';
        host.shadowRoot.appendChild(coachmark);
      },
      controls: [],
      scenarios: [],
    };
    clearRegistry();
    registerSim(fakeSim);
    const sim = document.createElement('sim-engine');
    sim.setAttribute('sim', 'fake-test-sim');
    document.body.appendChild(sim);
    await Promise.resolve();
    await Promise.resolve();
    sim.dismissCoachmark('cm-host-dismiss');
    expect(localStorage.getItem('aisc-simengine:coachmark:dismissed:cm-host-dismiss')).toBe('1');
  });

  it('PROBE: happy-dom propagates slotted text through textContent reads (re-tested with the current happy-dom version)', async () => {
    // Define a tiny throwaway component that uses a real <slot>. The
    // <sim-coachmark> tests read shadow content via element.textContent, so
    // the practically-relevant question is whether textContent on a shadow
    // wrapper containing a <slot> includes the projected light-DOM text.
    //
    // Outcome on happy-dom 15.11.7: PARTIAL SUPPORT. slot.assignedNodes({
    // flatten: true }) DOES return the projected text node correctly
    // (modern API works), but reading .textContent on the wrapper that
    // CONTAINS the <slot> still returns '' — slot composition is not
    // reflected in textContent traversal. This means we CANNOT reinstate
    // <slot> in <sim-coachmark> without breaking the existing tests that
    // read via .textContent. The textContent workaround stays.
    //
    // The assertion below documents the broken state: textContent on a
    // wrapper containing a <slot> with projected children returns ''. When
    // happy-dom fixes this, the assertion will start FAILING, alerting
    // future readers that the bug is fixed and slot reinstatement is now
    // safe.
    class SlotProbe extends HTMLElement {
      connectedCallback() {
        const root = this.attachShadow({ mode: 'open' });
        const wrapper = document.createElement('div');
        wrapper.id = 'wrap';
        const slot = document.createElement('slot');
        wrapper.appendChild(slot);
        root.appendChild(wrapper);
      }
    }
    if (!customElements.get('slot-probe-happy-dom')) {
      customElements.define('slot-probe-happy-dom', SlotProbe);
    }
    const el = document.createElement('slot-probe-happy-dom');
    el.textContent = 'hello world';
    document.body.appendChild(el);
    await Promise.resolve();
    await Promise.resolve();
    const wrap = el.shadowRoot.querySelector('#wrap');
    // .textContent on the shadow wrapper does NOT traverse the slot to
    // include projected light-DOM text in happy-dom 15.11.7 — this is the
    // practical behavior that blocks slot reinstatement.
    expect(wrap.textContent).toBe('');
  });
});
