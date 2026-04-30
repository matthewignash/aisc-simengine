/**
 * Gas Laws sim — ideal gas only (step 5). Single species, no VdW.
 * Step 5b will add multiple species, VdW, MB distribution graph,
 * teacher presets, and HL Ideal-vs-Real comparison.
 */
import {
  idealPressure,
  avgKineticEnergy,
  visualParticleCount,
  vdWPressure,
  speedHistogram,
  maxwellBoltzmann2D,
} from './physics.js';
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

  scenarios: [
    {
      id: 'boyle',
      label: "Boyle's Law (isothermal)",
      description: 'Constant T = 300 K. Vary V and watch P change inversely.',
      values: { T: 300, V: 2, n: 3, species: 'ideal' },
    },
    {
      id: 'charles',
      label: "Charles's Law (isobaric)",
      description: 'Hold V constant. Vary T and watch P scale linearly.',
      values: { T: 200, V: 2, n: 3, species: 'ideal' },
    },
    {
      id: 'idealVsReal',
      label: 'Ideal vs Real (HL)',
      description: 'High-pressure CO₂ — observe deviation from PV = nRT.',
      values: { T: 150, V: 0.8, n: 8, species: 'co2', level: 'hl' },
      requiresHL: true,
    },
  ],

  tweaks: [
    {
      id: 'showHLGraph',
      label: 'Show Ideal-vs-Real graph (HL)',
      stateKey: 'level',
      on: 'hl',
      off: 'sl',
      asAttribute: true,
    },
    {
      id: 'showMBGraph',
      label: 'Show Maxwell-Boltzmann graph',
      stateKey: 'showMBGraph',
      on: true,
      off: false,
    },
  ],

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

    // Preset dropdown at the top of the rail.
    const presetDropdown = createDropdown({
      key: 'preset',
      label: 'Scenario',
      options: [
        { value: '', label: '— custom —' },
        ...this.scenarios.map((s) => ({ value: s.id, label: s.label })),
      ],
      value: '',
      onChange: (id) => {
        if (!id) return;
        const preset = this.scenarios.find((s) => s.id === id);
        if (!preset) return;
        // If the preset declares a level, write it as an attribute (mirrors back
        // into state via attributeChangedCallback). Other values use setVariable.
        const valuesWithoutLevel = { ...preset.values };
        if ('level' in valuesWithoutLevel) {
          host.setAttribute('level', valuesWithoutLevel.level);
          delete valuesWithoutLevel.level;
        }
        for (const [k, v] of Object.entries(valuesWithoutLevel)) {
          host.setVariable(k, v);
        }
      },
    });
    rail.appendChild(presetDropdown);

    // Species selector — sits next to the preset dropdown so the two
    // "set the scenario" controls live together at the top of the rail.
    if (host._state.get('species') === undefined) host._state.set('species', 'ideal');
    const speciesDropdown = createDropdown({
      key: 'species',
      label: 'Gas',
      options: SPECIES_OPTIONS,
      value: host._state.get('species'),
      onChange: (v) => host.setVariable('species', v),
    });
    rail.appendChild(speciesDropdown);

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

    // HL-only Ideal-vs-Real graph — always built, visibility gated on level.
    const hlGraphCanvas = document.createElement('canvas');
    hlGraphCanvas.width = 320;
    hlGraphCanvas.height = 220;
    hlGraphCanvas.setAttribute('aria-label', 'Ideal vs Real pressure comparison');
    const hlContainer = document.createElement('div');
    hlContainer.dataset.hlOnly = 'true';
    hlContainer.style.display = host._state.get('level') === 'hl' ? '' : 'none';
    hlContainer.appendChild(hlGraphCanvas);
    rail.appendChild(hlContainer);

    this._hlContainer = hlContainer;
    this._hlGraph = createGraph({
      canvas: hlGraphCanvas,
      xAxis: { label: 'V / L', min: 0, max: 5.5 },
      yAxis: { label: 'P / kPa', min: 0, max: 15000 },
      traces: [
        { id: 'ideal', color: 'rgb(38, 70, 83)', kind: 'line' },
        { id: 'real', color: 'rgb(231, 111, 81)', kind: 'line' },
      ],
    });

    // Maxwell-Boltzmann distribution graph — always visible.
    const mbCanvas = document.createElement('canvas');
    mbCanvas.width = 320;
    mbCanvas.height = 220;
    mbCanvas.setAttribute('aria-label', 'Maxwell-Boltzmann speed distribution');
    rail.appendChild(mbCanvas);

    this._mbGraph = createGraph({
      canvas: mbCanvas,
      xAxis: { label: 'speed', min: 0, max: 200 },
      yAxis: { label: 'P(v)', min: 0, max: 0.05 },
      traces: [
        { id: 'observed', color: 'rgba(42, 157, 143, 0.7)', kind: 'dots' },
        { id: 'theory', color: 'rgb(231, 111, 81)', kind: 'line' },
      ],
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
        if (host._state.get('level') === 'hl') this._redrawHLGraph(host);
      })
    );
    this._unsubs.push(
      host._state.on('V', (V) => {
        this._field.setBounds(boundsForVolume(V));
        this._updateReadouts(host);
        if (host._state.get('level') === 'hl') this._redrawHLGraph(host);
      })
    );
    this._unsubs.push(
      host._state.on('n', (n) => {
        this._field.setCount(visualParticleCount(n));
        this._updateReadouts(host);
        if (host._state.get('level') === 'hl') this._redrawHLGraph(host);
      })
    );
    this._unsubs.push(
      host._state.on('species', () => {
        this._updateReadouts(host);
        if (host._state.get('level') === 'hl') this._redrawHLGraph(host);
      })
    );
    this._unsubs.push(
      host._state.on('level', (level) => {
        this._hlContainer.style.display = level === 'hl' ? '' : 'none';
        if (level === 'hl') this._redrawHLGraph(host);
      })
    );

    if (host._state.get('showMBGraph') === undefined) host._state.set('showMBGraph', true);
    this._unsubs.push(
      host._state.on('showMBGraph', (show) => {
        if (mbCanvas) mbCanvas.style.display = show ? '' : 'none';
      })
    );

    this._pressureFn = (state) => {
      const sp = SPECIES[state.species ?? 'ideal'];
      if (sp.a === 0 && sp.b === 0) return idealPressure(state);
      return vdWPressure({ ...state, a: sp.a, b: sp.b });
    };
    this._updateReadouts(host);
    this._redrawHLGraph(host);
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
    if (this._frameCount % 15 === 0 && this._mbGraph && this._field && this._lastHost) {
      const speeds = this._field.getSpeeds();
      const T = this._lastHost._state.get('T');
      this._mbGraph.clearAll();
      const hist = speedHistogram(speeds, 200);
      const theory = maxwellBoltzmann2D(T, 200);
      for (const pt of hist) this._mbGraph.addPoint('observed', pt.x, pt.y);
      for (const pt of theory) this._mbGraph.addPoint('theory', pt.x, pt.y);
      this._mbGraph.redraw();
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
    this._hlGraph = null;
    this._hlContainer = null;
    this._mbGraph = null;
    this._lastHost = null;
  },

  _redrawHLGraph(host) {
    if (!this._hlGraph) return;
    const state = host._state.getAll();
    const sp = SPECIES[state.species ?? 'ideal'];
    this._hlGraph.clearAll();
    for (let V = 0.1; V <= 5.5 + 1e-9; V += 0.1) {
      this._hlGraph.addPoint('ideal', V, idealPressure({ V, T: state.T, n: state.n }));
      const real = vdWPressure({ V, T: state.T, n: state.n, a: sp.a, b: sp.b });
      if (Number.isFinite(real) && real >= 0) this._hlGraph.addPoint('real', V, real);
    }
    this._hlGraph.redraw();
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
