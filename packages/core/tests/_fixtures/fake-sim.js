/**
 * Test-only sim module. Implements the registry contract with deterministic,
 * side-effect-free behavior so we can verify the `<sim-engine>` shell wires
 * state, recorder, attributes, and events correctly without depending on real
 * physics.
 */

export const fakeSimCalls = {
  init: 0,
  step: 0,
  render: 0,
  derived: 0,
  validateTrial: 0,
};

export function resetFakeSimCalls() {
  fakeSimCalls.init = 0;
  fakeSimCalls.step = 0;
  fakeSimCalls.render = 0;
  fakeSimCalls.derived = 0;
  fakeSimCalls.validateTrial = 0;
}

const fakeSim = {
  id: 'fake-sim',
  syllabus: ['TEST.0'],

  init(host) {
    fakeSimCalls.init += 1;
    host._fakeHostRef = host;
  },

  step(_dt) {
    fakeSimCalls.step += 1;
  },

  render(_ctx) {
    fakeSimCalls.render += 1;
  },

  controls: [
    { kind: 'slider', key: 'T', label: 'Temperature', min: 0, max: 1000, value: 298 },
    { kind: 'slider', key: 'V', label: 'Volume', min: 0.1, max: 50, value: 6.4 },
  ],

  scenarios: [
    { id: 'cold', label: 'Cold', values: { T: 100 } },
    { id: 'hot', label: 'Hot', values: { T: 500 } },
  ],

  derived(state) {
    fakeSimCalls.derived += 1;
    return { sum: (state.T ?? 0) + (state.V ?? 0) };
  },

  validateTrial(state) {
    fakeSimCalls.validateTrial += 1;
    const valid = state.T > 0;
    return { valid, message: valid ? '' : 'T must be positive' };
  },
};

export default fakeSim;
