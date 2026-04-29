/**
 * Gas Laws sim — ideal gas only (step 5). Single species, no VdW.
 * Step 5b will add multiple species, VdW, MB distribution graph,
 * teacher presets, and HL Ideal-vs-Real comparison.
 */
import { idealPressure, avgKineticEnergy, visualParticleCount, vdWPressure } from './physics.js';
import { createParticleField } from '../../engine/particles.js';
import { createSlider, createButton, createDropdown } from '../../engine/controls.js';
import { createGraph } from '../../engine/graph.js';
import { drawContainer } from './render.js';
import { SPECIES, SPECIES_OPTIONS } from './species.js';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 360;
// Must match drawContainer's margins in render.js so the particle bounds
// align exactly with the visible container outline.
const CONTAINER_MARGIN_X = 30;
const CONTAINER_MARGIN_Y = 30;
const V_MAX = 5; // matches the V slider's max
const INNER_HEIGHT = CANVAS_HEIGHT - 2 * CONTAINER_MARGIN_Y;
const INNER_CANVAS_WIDTH = CANVAS_WIDTH - 2 * CONTAINER_MARGIN_X;

function boundsForVolume(V) {
  return { width: (V / V_MAX) * INNER_CANVAS_WIDTH, height: INNER_HEIGHT };
}

const sim = {
  id: 'gas-laws',
  syllabus: ['S1.5'],

  controls: [
    {
      kind: 'slider',
      key: 'T',
      label: 'Temperature',
      min: 100,
      max: 1000,
      step: 1,
      value: 298,
      unit: 'K',
    },
    {
      kind: 'slider',
      key: 'V',
      label: 'Volume',
      min: 0.5,
      max: 5,
      step: 0.1,
      value: 2,
      unit: 'L',
    },
    {
      kind: 'slider',
      key: 'n',
      label: 'Moles',
      min: 0.5,
      max: 5,
      step: 0.1,
      value: 1,
      unit: 'mol',
    },
  ],

  scenarios: [],

  init(host) {
    const root = host.shadowRoot;
    const stage = root.querySelector('.sim-canvas__stage');
    const rail = root.querySelector('.sim-rail');
    const transport = root.querySelector('.sim-transport');
    const readouts = root.querySelector('.sim-readouts');

    // Particle canvas
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    canvas.setAttribute('aria-label', 'Gas Laws particle simulation');
    stage.appendChild(canvas);

    // Seed control defaults into state if not present
    for (const c of this.controls) {
      if (host._state.get(c.key) === undefined) host._state.set(c.key, c.value);
    }
    const initial = host._state.getAll();

    // Particle field — bounds are container-local (origin at the inner
    // top-left of the container box). The render method translates the
    // canvas before delegating to the field.
    this._field = createParticleField({
      count: visualParticleCount(initial.n),
      bounds: boundsForVolume(initial.V),
      temperature: initial.T,
    });

    // P-V graph
    const graphCanvas = document.createElement('canvas');
    graphCanvas.width = 320;
    graphCanvas.height = 220;
    graphCanvas.setAttribute('aria-label', 'Pressure-Volume graph');
    rail.appendChild(graphCanvas);

    this._graph = createGraph({
      canvas: graphCanvas,
      xAxis: { label: 'V / L', min: 0, max: 5.5 },
      yAxis: { label: 'P / kPa', min: 0, max: 5000 },
      traces: [{ id: 'path', color: 'rgb(42, 157, 143)', kind: 'dots' }],
    });

    // Sliders
    for (const c of this.controls) {
      rail.appendChild(
        createSlider({
          ...c,
          onChange: (v) => host.setVariable(c.key, v),
        })
      );
    }

    // Species selector — append after sliders.
    if (host._state.get('species') === undefined) host._state.set('species', 'ideal');
    const speciesDropdown = createDropdown({
      key: 'species',
      label: 'Gas',
      options: SPECIES_OPTIONS,
      value: host._state.get('species'),
      onChange: (v) => host.setVariable('species', v),
    });
    rail.appendChild(speciesDropdown);

    // Transport buttons
    transport.append(
      createButton({ label: 'Play', variant: 'primary', onClick: () => host.play() }),
      createButton({ label: 'Pause', onClick: () => host.pause() }),
      createButton({ label: 'Reset', onClick: () => host.reset() }),
      createButton({ label: 'Record trial', variant: 'record', onClick: () => host.recordTrial() })
    );

    // Readouts (built via createElement)
    readouts.append(
      makeReadout('Pressure', 'P', 'kPa'),
      makeReadout('Avg KE', 'KE', 'zJ'),
      makeReadout('Particles', 'N', ''),
      makeReadout('Species', 'species', '')
    );

    // Wire state listeners — collect unsubs for dispose to clean up.
    this._unsubs = [];
    this._unsubs.push(
      host._state.on('T', (T) => {
        this._field.setTemperature(T);
        this._updateReadouts(host);
      })
    );
    this._unsubs.push(
      host._state.on('V', (V) => {
        this._field.setBounds(boundsForVolume(V));
        this._updateReadouts(host);
      })
    );
    this._unsubs.push(
      host._state.on('n', (n) => {
        this._field.setCount(visualParticleCount(n));
        this._updateReadouts(host);
      })
    );
    this._unsubs.push(
      host._state.on('species', () => {
        this._updateReadouts(host);
      })
    );

    this._pressureFn = (state) => {
      const sp = SPECIES[state.species ?? 'ideal'];
      if (sp.a === 0 && sp.b === 0) return idealPressure(state);
      return vdWPressure({ ...state, a: sp.a, b: sp.b });
    };
    this._updateReadouts(host);
    this._lastHost = host;
    this._frameCount = 0;
  },

  step(dt) {
    this._field?.step(dt);
  },

  render(ctx) {
    if (ctx) {
      const V = this._lastHost?._state.get('V') ?? V_MAX;
      // Clear full canvas, draw the (V-dependent) container outline, then
      // translate into the inner box and render particles. Translation lets
      // particles.js continue using 0-origin {width, height} bounds while
      // visually appearing inside the container.
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      drawContainer(ctx, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, V, Vmax: V_MAX });
      ctx.save();
      ctx.translate(CONTAINER_MARGIN_X, CONTAINER_MARGIN_Y);
      const sp = SPECIES[this._lastHost?._state.get('species') ?? 'ideal'];
      this._field?.render(ctx, { fillStyle: sp.color });
      ctx.restore();
    }
    this._frameCount = (this._frameCount ?? 0) + 1;
    if (this._frameCount % 10 === 0 && this._lastHost && this._graph) {
      const state = this._lastHost._state.getAll();
      this._graph.addPoint('path', state.V, this._pressureFn(state));
      this._graph.redraw();
    }
  },

  derived(state) {
    const pressureFn = this._pressureFn ?? ((s) => idealPressure(s));
    return { P: pressureFn(state), KE: avgKineticEnergy(state.T) };
  },

  dispose() {
    for (const off of this._unsubs ?? []) off();
    this._unsubs = [];
    this._field = null;
    this._graph = null;
    this._lastHost = null;
  },

  _updateReadouts(host) {
    const root = host.shadowRoot;
    const state = host._state.getAll();
    const set = (key, value) => {
      const node = root.querySelector(`[data-readout="${key}"] .sim-readout__value-text`);
      if (node) node.textContent = value;
    };
    set('P', this._pressureFn(state).toFixed(1));
    set('KE', avgKineticEnergy(state.T).toFixed(2));
    set('N', String(visualParticleCount(state.n)));
    set('species', SPECIES[state.species ?? 'ideal'].label);
  },
};

function makeReadout(label, key, unit) {
  const wrap = document.createElement('div');
  wrap.className = 'sim-readout';
  wrap.dataset.readout = key;
  const labelEl = document.createElement('div');
  labelEl.className = 'sim-readout__label';
  labelEl.textContent = label;
  const valueEl = document.createElement('div');
  valueEl.className = 'sim-readout__value';
  const valueTextEl = document.createElement('span');
  valueTextEl.className = 'sim-readout__value-text';
  valueTextEl.textContent = '—';
  const unitEl = document.createElement('span');
  unitEl.className = 'sim-readout__unit';
  unitEl.textContent = unit ? ` ${unit}` : '';
  valueEl.append(valueTextEl, unitEl);
  wrap.append(labelEl, valueEl);
  return wrap;
}

export default sim;
