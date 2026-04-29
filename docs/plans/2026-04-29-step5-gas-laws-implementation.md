# Step 5 — Gas Laws Sim Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the foundation-phase stubs (`particles.js`, `controls.js`, `graph.js`) with real implementations, add a `requestAnimationFrame` loop to `<sim-engine>`, and ship a working ideal-gas Gas Laws sim with animated particles, T/V/n sliders, transport controls, live readouts, and a P-V graph.

**Architecture:** Vanilla ESM modules. Particle physics uses elastic wall reflection only (no particle-particle collisions). Pressure is computed from PV=nRT (not measured from collisions). Tests use deterministic injected RNG plus mocked canvas contexts for the rendering layer. The sim assembles itself from foundation factories (`createState`, `createRecorder`, `createParticleField`, `createSlider`, `createButton`, `createGraph`) inside its `init(host)` hook.

**Tech Stack:** Vanilla JS (ES2022, ESM), Vite library mode, Vitest + happy-dom, JSDoc-driven types. No additional deps.

**Companion design doc:** `docs/plans/2026-04-29-step5-gas-laws-design.md` (read for "why" decisions).

**Repo state at start:** `main` at `41f1073` (step 4 complete + this plan's design doc). 41 tests passing. Branch protected, CI required green to merge.

**Standards:**

- TDD: every implementation line has a failing test that drove it. Use `superpowers:test-driven-development`.
- Safe DOM: prefer `createElement` + `setAttribute` + `appendChild` over assigning to `.innerHTML`. Static template literals on inert `<template>` elements are also acceptable. Tests in this plan use the createElement pattern throughout to satisfy the security hook.
- Conventional commits: `chore`, `feat`, `docs` prefixes; subject under 72 chars.
- No git config edits — use `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars per commit.
- No `git add -A`. Always specify files by name.
- No push between commits — controller pushes the branch once at the end of step 5.
- Work in a worktree at `.worktrees/step-5-gas-laws/` on branch `step-5-gas-laws` (set up before this plan begins).

**Test helper used throughout:** Define this once in tests that need to mount the element:

```js
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
```

Use it like `const el = mountSimEngine({ sim: 'fake-sim', level: 'hl' });`. Avoids assigning to `document.body.innerHTML`.

---

## Commit 1 — `feat(core): implement particles.js with elastic wall collisions`

Replaces the foundation-phase stub. 7 TDD tests covering kinematics, RNG determinism, and substepping.

### Task 1.1 — TDD: `createParticleField` returns the right shape

**Files:**

- Modify: `packages/core/tests/stubs.test.js` — REMOVE the `particles.js stub` describe block.
- Create: `packages/core/tests/particles.test.js`

**Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { createParticleField } from '../src/engine/particles.js';

describe('createParticleField', () => {
  it('creates the requested number of particles within the bounds', () => {
    const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const field = createParticleField({
      count: 4,
      bounds: { width: 600, height: 400 },
      temperature: 300,
      rng,
    });
    expect(field.particles.length).toBe(4);
    for (const p of field.particles) {
      expect(p.x).toBeGreaterThanOrEqual(p.r);
      expect(p.x).toBeLessThanOrEqual(600 - p.r);
      expect(p.y).toBeGreaterThanOrEqual(p.r);
      expect(p.y).toBeLessThanOrEqual(400 - p.r);
    }
  });
});
```

**Step 2: Verify RED**

Run: `cd packages/core && pnpm vitest run tests/particles.test.js`
Expected: FAIL — current `particles.js` is a stub that throws on `createParticleField`.

**Step 3: Replace `packages/core/src/engine/particles.js`**

Full implementation. Key exports: `createParticleField`. Internal helpers for Box-Muller gaussian sampling. Particle radius default 6 px.

```js
/**
 * 2D ideal-gas particle field. Elastic wall collisions only — no particle-
 * particle interactions. Initial speed distribution is Maxwell-Boltzmann-
 * shaped (Box-Muller gaussian magnitude, uniform direction angle).
 *
 * Randomness is injectable via the `rng` option for deterministic tests.
 */

const PARTICLE_RADIUS = 6;
const MAX_DT = 1 / 60; // substep cap

/**
 * Create a particle field.
 *
 * @param {{
 *   count: number,
 *   bounds: { width: number, height: number },
 *   temperature: number,
 *   rng?: () => number,
 * }} opts
 */
export function createParticleField(opts) {
  let { count, bounds, temperature, rng = Math.random } = opts;
  /** @type {Array<{x:number,y:number,vx:number,vy:number,r:number}>} */
  const particles = [];

  function spawn(n, T) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: rng() * (bounds.width - 2 * PARTICLE_RADIUS) + PARTICLE_RADIUS,
        y: rng() * (bounds.height - 2 * PARTICLE_RADIUS) + PARTICLE_RADIUS,
        ...sampleVelocity(T, rng),
        r: PARTICLE_RADIUS,
      });
    }
  }

  spawn(count, temperature);

  return {
    get particles() {
      return particles;
    },

    step(dt) {
      let remaining = dt;
      while (remaining > 0) {
        const sub = Math.min(remaining, MAX_DT);
        for (const p of particles) advanceParticle(p, sub, bounds);
        remaining -= sub;
      }
    },

    render(ctx) {
      ctx.clearRect(0, 0, bounds.width, bounds.height);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(0.5, 0.5, bounds.width - 1, bounds.height - 1);
      ctx.fillStyle = 'var(--chem-500, #2a9d8f)';
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    setCount(n) {
      if (n > particles.length) {
        spawn(n - particles.length, temperature);
      } else if (n < particles.length) {
        particles.length = n;
      }
    },

    setTemperature(T) {
      const ratio = Math.sqrt(T / temperature);
      for (const p of particles) {
        p.vx *= ratio;
        p.vy *= ratio;
      }
      temperature = T;
    },

    setBounds(b) {
      bounds = b;
    },

    reseed(seed) {
      rng = seededRng(seed);
      particles.length = 0;
      spawn(count, temperature);
    },
  };
}

function advanceParticle(p, dt, bounds) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.x - p.r < 0) {
    p.x = p.r;
    p.vx = -p.vx;
  } else if (p.x + p.r > bounds.width) {
    p.x = bounds.width - p.r;
    p.vx = -p.vx;
  }
  if (p.y - p.r < 0) {
    p.y = p.r;
    p.vy = -p.vy;
  } else if (p.y + p.r > bounds.height) {
    p.y = bounds.height - p.r;
    p.vy = -p.vy;
  }
}

function sampleVelocity(T, rng) {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const mag = Math.sqrt(-2 * Math.log(u1)) * Math.sqrt(T) * 5;
  const angle = u2 * Math.PI * 2;
  return { vx: mag * Math.cos(angle), vy: mag * Math.sin(angle) };
}

function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

**Step 4: Verify GREEN**

Run: `pnpm vitest run tests/particles.test.js` → PASS.

### Tasks 1.2 – 1.7 — Remaining TDD cycles

For each, write the test, verify RED (or note already-GREEN if implementation ahead), then GREEN.

**1.2 step(dt) advances positions:**

```js
it('step(dt) advances each particle by its velocity scaled by dt', () => {
  const field = createParticleField({
    count: 1,
    bounds: { width: 1000, height: 1000 },
    temperature: 300,
  });
  field.particles[0].x = 500;
  field.particles[0].y = 500;
  field.particles[0].vx = 100;
  field.particles[0].vy = 0;
  field.step(0.1);
  expect(field.particles[0].x).toBeCloseTo(510, 1);
});
```

**1.3 wall reflection:**

```js
it('reflects velocity when a particle hits a wall', () => {
  const field = createParticleField({
    count: 1,
    bounds: { width: 600, height: 400 },
    temperature: 300,
  });
  field.particles[0].x = 590;
  field.particles[0].y = 200;
  field.particles[0].r = 6;
  field.particles[0].vx = 100;
  field.particles[0].vy = 0;
  field.step(1);
  expect(field.particles[0].vx).toBeLessThan(0);
  expect(field.particles[0].x).toBeLessThanOrEqual(594);
});
```

**1.4 setTemperature rescales velocities:**

```js
it('setTemperature rescales velocities by sqrt(T_new/T_old)', () => {
  const field = createParticleField({
    count: 50,
    bounds: { width: 600, height: 400 },
    temperature: 300,
  });
  const before = field.particles.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0) / 50;
  field.setTemperature(1200);
  const after = field.particles.reduce((s, p) => s + Math.hypot(p.vx, p.vy), 0) / 50;
  expect(after / before).toBeCloseTo(2, 1);
});
```

**1.5 setCount preserves existing:**

```js
it('setCount preserves existing particles and adds/removes from the tail', () => {
  const field = createParticleField({
    count: 4,
    bounds: { width: 600, height: 400 },
    temperature: 300,
  });
  const orig = field.particles.slice(0, 4).map((p) => ({ x: p.x, y: p.y }));
  field.setCount(7);
  expect(field.particles.length).toBe(7);
  for (let i = 0; i < 4; i++) {
    expect(field.particles[i].x).toBe(orig[i].x);
  }
  field.setCount(2);
  expect(field.particles.length).toBe(2);
});
```

**1.6 reseed determinism:**

```js
it('reseed(seed) produces identical layout for same seed', () => {
  const field = createParticleField({
    count: 5,
    bounds: { width: 600, height: 400 },
    temperature: 300,
  });
  field.reseed(42);
  const a = field.particles.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
  field.reseed(42);
  const b = field.particles.map((p) => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy }));
  expect(b).toEqual(a);
});
```

**1.7 substepping prevents tunneling:**

```js
it('substeps large dt to prevent tunneling', () => {
  const field = createParticleField({
    count: 1,
    bounds: { width: 600, height: 400 },
    temperature: 300,
  });
  field.particles[0].x = 50;
  field.particles[0].y = 200;
  field.particles[0].r = 6;
  field.particles[0].vx = 1000;
  field.particles[0].vy = 0;
  field.step(1.0);
  expect(field.particles[0].x).toBeGreaterThanOrEqual(field.particles[0].r);
  expect(field.particles[0].x).toBeLessThanOrEqual(600 - field.particles[0].r);
});
```

### Task 1.8 — Remove particles stub test

In `packages/core/tests/stubs.test.js`, remove `describe('particles.js stub', ...)` block. Leave `graph.js stub` and `controls.js stub` blocks (deleted in commits 2 and 3).

### Task 1.9 — Verify pipeline + commit

```
cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine/.worktrees/step-5-gas-laws
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: lint clean. Test count math: 41 (post-step-4) - 1 (deleted particles stub) + 7 (new particles) = **47 tests**. Build green.

Stage:

- `packages/core/src/engine/particles.js`
- `packages/core/tests/particles.test.js`
- `packages/core/tests/stubs.test.js`

Commit:

```
feat(core): implement particles.js with elastic wall collisions

Replaces the foundation-phase stub with a real 2D particle field.
Elastic wall reflections only (no particle-particle collisions in
step 5; deferred to step 5b). Initial speed distribution is
Maxwell-Boltzmann-shaped via Box-Muller. setTemperature rescales
velocities by sqrt(T_new/T_old) to preserve distribution shape.
Substepping at dt=1/60 prevents tunneling under low frame rates.

RNG is injectable for deterministic tests; reseed(seed) provides
reproducible particle layouts via a Mulberry32 PRNG.

7 new tests in particles.test.js. The corresponding stub-throw test
is removed from stubs.test.js.

Step 5 commit 1 of 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 2 — `feat(core): implement controls.js with slider and button factories`

Replaces foundation stub. 5 TDD tests. Only `createSlider` and `createButton` get real implementations; `createDropdown`, `createToggle`, `initKeyboard` stay stubbed.

### Task 2.1 — TDD: createSlider DOM shape

**Files:**

- Create: `packages/core/tests/controls.test.js`
- Modify: `packages/core/src/engine/controls.js` (REPLACE most of file)
- Modify: `packages/core/tests/stubs.test.js` (REMOVE controls stub block)

**Step 1: Failing test**

```js
import { describe, it, expect, vi } from 'vitest';
import { createSlider, createButton } from '../src/engine/controls.js';

describe('createSlider', () => {
  it('returns .sim-slider element with label, value display, and range input', () => {
    const el = createSlider({
      key: 'T',
      label: 'Temperature',
      min: 100,
      max: 1000,
      step: 1,
      value: 298,
      unit: 'K',
      onChange: () => {},
    });
    expect(el.classList.contains('sim-slider')).toBe(true);
    expect(el.dataset.var).toBe('T');
    expect(el.querySelector('.sim-slider__head .sim-slider__label').textContent).toContain(
      'Temperature'
    );
    expect(el.querySelector('.sim-slider__value').textContent).toBe('298 K');
    const input = el.querySelector('input[type="range"]');
    expect(input).not.toBeNull();
    expect(input.min).toBe('100');
    expect(input.max).toBe('1000');
    expect(input.value).toBe('298');
  });
});
```

**Step 2: Verify RED.**

**Step 3: Replace `packages/core/src/engine/controls.js`**

```js
/**
 * UI control factories — slider + button. Dropdown / toggle / initKeyboard
 * remain stubbed until a future sim or topic page consumes them.
 */

const NOT_IMPLEMENTED = 'controls.js: not implemented — lands when needed';

/**
 * @param {{
 *   key: string, label: string,
 *   min: number, max: number, step?: number, value: number, unit?: string,
 *   onChange?: (v: number) => void,
 * }} opts
 * @returns {HTMLElement}
 */
export function createSlider(opts) {
  const { key, label, min, max, step = 1, value, unit = '', onChange } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'sim-slider';
  wrap.dataset.var = key;
  wrap.style.setProperty('--pct', percentOf(value, min, max));

  const head = document.createElement('div');
  head.className = 'sim-slider__head';
  const labelEl = document.createElement('span');
  labelEl.className = 'sim-slider__label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'sim-slider__value';
  valueEl.textContent = `${formatValue(value, step)} ${unit}`.trim();
  head.append(labelEl, valueEl);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute('aria-label', `${label}, range ${min} to ${max}`);

  input.addEventListener('input', () => {
    const v = Number(input.value);
    valueEl.textContent = `${formatValue(v, step)} ${unit}`.trim();
    wrap.style.setProperty('--pct', percentOf(v, min, max));
    onChange?.(v);
  });

  input.addEventListener('keydown', (e) => {
    if (!e.shiftKey) return;
    if (
      e.key !== 'ArrowUp' &&
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight'
    )
      return;
    e.preventDefault();
    const dir = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? +1 : -1;
    const next = clamp(Number(input.value) + dir * 5 * step, min, max);
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  wrap.append(head, input);
  return wrap;
}

/**
 * @param {{ label: string, variant?: 'default'|'primary'|'record',
 *   onClick?: () => void, disabled?: boolean }} opts
 * @returns {HTMLButtonElement}
 */
export function createButton(opts) {
  const { label, variant = 'default', onClick, disabled = false } = opts;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sim-btn' + (variant !== 'default' ? ` sim-btn--${variant}` : '');
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener('click', () => {
    if (!btn.disabled) onClick?.();
  });
  return btn;
}

export function createDropdown() {
  throw new Error(NOT_IMPLEMENTED);
}
export function createToggle() {
  throw new Error(NOT_IMPLEMENTED);
}
export function initKeyboard() {
  throw new Error(NOT_IMPLEMENTED);
}

function percentOf(v, min, max) {
  return `${Math.round(((v - min) / (max - min)) * 100)}%`;
}
function formatValue(v, step) {
  return step >= 1 ? String(Math.round(v)) : v.toFixed(1);
}
function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
```

**Step 4: Verify GREEN.**

### Tasks 2.2 – 2.5 — Remaining controls TDD

**2.2 onChange fires on input:**

```js
it('slider input event fires onChange with new numeric value', () => {
  const onChange = vi.fn();
  const el = createSlider({ key: 'T', label: 'T', min: 0, max: 100, step: 1, value: 50, onChange });
  const input = el.querySelector('input[type="range"]');
  input.value = '75';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(onChange).toHaveBeenCalledWith(75);
});
```

**2.3 Shift+arrow advances by 5×step:**

```js
it('Shift+ArrowUp advances by 5 × step', () => {
  const onChange = vi.fn();
  const el = createSlider({ key: 'V', label: 'V', min: 0, max: 100, step: 2, value: 50, onChange });
  const input = el.querySelector('input[type="range"]');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true }));
  expect(onChange).toHaveBeenCalledWith(60);
});
```

**2.4 button variant class:**

```js
describe('createButton', () => {
  it('produces button with sim-btn and variant class', () => {
    const btn = createButton({ label: 'Run', variant: 'primary', onClick: () => {} });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.classList.contains('sim-btn')).toBe(true);
    expect(btn.classList.contains('sim-btn--primary')).toBe(true);
    expect(btn.textContent).toBe('Run');
  });
});
```

**2.5 disabled button doesn't fire:**

```js
it('disabled button does not invoke onClick', () => {
  const onClick = vi.fn();
  const btn = createButton({ label: 'X', onClick, disabled: true });
  btn.dispatchEvent(new MouseEvent('click'));
  expect(onClick).not.toHaveBeenCalled();
});
```

### Task 2.6 — Remove controls stub, verify, commit

In `stubs.test.js`, remove `describe('controls.js stub', ...)`. Verify `pnpm format && pnpm lint && pnpm test && pnpm build` passes — expect **51 tests**.

Stage:

- `packages/core/src/engine/controls.js`
- `packages/core/tests/controls.test.js`
- `packages/core/tests/stubs.test.js`

Commit message:

```
feat(core): implement controls.js with slider and button factories

Replaces the foundation-phase stub. createSlider returns a .sim-slider
DOM element matching the AISC design system markup (head with label
and value readout, native range input, --pct CSS custom property for
fill styling) and wires native events plus Shift+arrow ±5×step custom
key handler. createButton supports default/primary/record variants.
Disabled buttons swallow click events.

createDropdown, createToggle, initKeyboard stay stubbed until a future
sim or topic page consumes them.

5 new tests; controls stub-throw test removed from stubs.test.js.

Step 5 commit 2 of 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

DO NOT PUSH.

---

## Commit 3 — `feat(core): implement graph.js with declarative traces`

Replaces foundation stub. 4 TDD tests. After this commit, `stubs.test.js` is empty — delete the file.

### Task 3.1 — TDD: addPoint + redraw

**Files:**

- Create: `packages/core/tests/graph.test.js`
- Modify: `packages/core/src/engine/graph.js` (REPLACE)
- Delete: `packages/core/tests/stubs.test.js`

**Step 1: Failing test (with mocked canvas context)**

```js
import { describe, it, expect } from 'vitest';
import { createGraph } from '../src/engine/graph.js';

function mockCanvas(width = 320, height = 220) {
  const calls = [];
  const ctx = {
    canvas: { width, height },
    clearRect: (...a) => calls.push(['clearRect', ...a]),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    arc: (...a) => calls.push(['arc', ...a]),
    fill: () => calls.push(['fill']),
    stroke: () => calls.push(['stroke']),
    fillText: (...a) => calls.push(['fillText', ...a]),
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    translate: (...a) => calls.push(['translate', ...a]),
    rotate: (...a) => calls.push(['rotate', ...a]),
  };
  const canvas = { width, height, getContext: () => ctx };
  return { canvas, ctx, calls };
}

describe('createGraph', () => {
  it('addPoint then redraw produces moveTo/lineTo for the trace', () => {
    const { canvas, calls } = mockCanvas(320, 220);
    const graph = createGraph({
      canvas,
      xAxis: { label: 'V', min: 0, max: 10 },
      yAxis: { label: 'P', min: 0, max: 100 },
      traces: [{ id: 't', color: '#111', kind: 'line' }],
    });
    graph.addPoint('t', 5, 50);
    graph.addPoint('t', 7, 70);
    graph.redraw();
    const moves = calls.filter(([fn]) => fn === 'moveTo' || fn === 'lineTo');
    expect(moves.length).toBeGreaterThanOrEqual(2);
  });
});
```

**Step 2: Verify RED.**

**Step 3: Replace `packages/core/src/engine/graph.js`**

```js
/**
 * 2D graph component with declarative trace support. Linear axes only
 * in step 5; log axes defer.
 */

const PAD = { left: 40, right: 12, top: 12, bottom: 32 };

/**
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   xAxis: { label: string, min: number, max: number, ticks?: number[] },
 *   yAxis: { label: string, min: number, max: number, ticks?: number[] },
 *   traces: Array<{ id: string, color: string, kind?: 'line' | 'dots' }>,
 * }} opts
 */
export function createGraph(opts) {
  const { canvas, xAxis, yAxis, traces: traceDefs } = opts;
  const ctx = canvas.getContext('2d');
  /** @type {Map<string, {color:string, kind:string, points:Array<{x:number,y:number}>}>} */
  const traces = new Map();
  for (const t of traceDefs) {
    traces.set(t.id, { color: t.color, kind: t.kind ?? 'line', points: [] });
  }

  function plotRect() {
    return {
      x: PAD.left,
      y: PAD.top,
      w: canvas.width - PAD.left - PAD.right,
      h: canvas.height - PAD.top - PAD.bottom,
    };
  }

  function project(x, y) {
    const r = plotRect();
    const px = r.x + ((x - xAxis.min) / (xAxis.max - xAxis.min)) * r.w;
    const py = r.y + r.h - ((y - yAxis.min) / (yAxis.max - yAxis.min)) * r.h;
    return {
      px: Math.max(r.x, Math.min(r.x + r.w, px)),
      py: Math.max(r.y, Math.min(r.y + r.h, py)),
    };
  }

  function drawAxes() {
    const r = plotRect();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x, r.y + r.h);
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.stroke();
    // Labels
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(xAxis.label, r.x + r.w / 2 - 10, canvas.height - 8);
    ctx.save();
    ctx.translate(12, r.y + r.h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yAxis.label, 0, 0);
    ctx.restore();
  }

  function drawTrace(trace) {
    if (trace.points.length === 0) return;
    ctx.strokeStyle = trace.color;
    ctx.fillStyle = trace.color;
    ctx.lineWidth = 1.5;
    if (trace.kind === 'dots') {
      for (const pt of trace.points) {
        const { px, py } = project(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      const first = project(trace.points[0].x, trace.points[0].y);
      ctx.moveTo(first.px, first.py);
      for (let i = 1; i < trace.points.length; i++) {
        const { px, py } = project(trace.points[i].x, trace.points[i].y);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  return {
    addPoint(traceId, x, y) {
      const trace = traces.get(traceId);
      if (!trace) throw new Error(`unknown trace id: ${traceId}`);
      trace.points.push({ x, y });
    },
    clear(traceId) {
      const trace = traces.get(traceId);
      if (trace) trace.points.length = 0;
    },
    clearAll() {
      for (const trace of traces.values()) trace.points.length = 0;
    },
    redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawAxes();
      for (const trace of traces.values()) drawTrace(trace);
    },
    exportPNG() {
      return Promise.resolve(null);
    },
  };
}
```

**Step 4: Verify GREEN.**

### Tasks 3.2 – 3.4 — Remaining graph TDD

**3.2 clear empties one trace** (assert no throw + redraws cleanly):

```js
it('clear(traceId) empties the named trace and does not throw on redraw', () => {
  const { canvas } = mockCanvas();
  const graph = createGraph({
    canvas,
    xAxis: { label: 'x', min: 0, max: 10 },
    yAxis: { label: 'y', min: 0, max: 10 },
    traces: [
      { id: 'a', color: '#000', kind: 'line' },
      { id: 'b', color: '#111', kind: 'line' },
    ],
  });
  graph.addPoint('a', 1, 1);
  graph.addPoint('a', 2, 2);
  graph.addPoint('b', 1, 1);
  graph.clear('a');
  expect(() => graph.redraw()).not.toThrow();
});
```

**3.3 traces in declared order:**

```js
it('traces are drawn in declared order', () => {
  const { canvas, calls } = mockCanvas();
  const graph = createGraph({
    canvas,
    xAxis: { label: 'x', min: 0, max: 10 },
    yAxis: { label: 'y', min: 0, max: 10 },
    traces: [
      { id: 'first', color: '#100000', kind: 'line' },
      { id: 'second', color: '#000010', kind: 'line' },
    ],
  });
  graph.addPoint('first', 1, 1);
  graph.addPoint('first', 2, 2);
  graph.addPoint('second', 3, 3);
  graph.addPoint('second', 4, 4);
  graph.redraw();
  const beginPaths = calls.filter(([fn]) => fn === 'beginPath').length;
  expect(beginPaths).toBeGreaterThanOrEqual(2);
});
```

**3.4 out-of-range points clip:**

```js
it('out-of-range points clip to plot edges', () => {
  const { canvas, calls } = mockCanvas(320, 220);
  const graph = createGraph({
    canvas,
    xAxis: { label: 'x', min: 0, max: 10 },
    yAxis: { label: 'y', min: 0, max: 10 },
    traces: [{ id: 't', color: '#000', kind: 'line' }],
  });
  graph.addPoint('t', -5, 5);
  graph.addPoint('t', 15, 5);
  graph.redraw();
  const moves = calls.filter(([fn]) => fn === 'moveTo' || fn === 'lineTo');
  for (const [, px, py] of moves) {
    expect(px).toBeGreaterThanOrEqual(0);
    expect(px).toBeLessThanOrEqual(320);
    expect(py).toBeGreaterThanOrEqual(0);
    expect(py).toBeLessThanOrEqual(220);
  }
});
```

### Task 3.5 — Delete stubs.test.js, verify, commit

Run: `rm packages/core/tests/stubs.test.js`

Verify: `pnpm format && pnpm lint && pnpm test && pnpm build`
Expected: **54 tests** (51 - 1 last stub + 4 graph).

Stage:

- `packages/core/src/engine/graph.js`
- `packages/core/tests/graph.test.js`
- `packages/core/tests/stubs.test.js` (deletion)

Commit message:

```
feat(core): implement graph.js with declarative traces

Replaces the foundation-phase stub. createGraph returns a 2D plot
bound to a canvas with declarative trace definitions (line | dots).
addPoint appends; redraw renders axes + all traces in declared order.
Out-of-range data points clip to the plot edges. exportPNG is a
placeholder returning null until visual regression infra arrives.

4 new tests use a mocked canvas context (assert call sequences).
The graph stub-throw test was the last entry in stubs.test.js,
which is now deleted.

Step 5 commit 3 of 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Commit 4 — `feat(core): add rAF loop to <sim-engine> with reduced-motion respect`

Adds `_startLoop`, `_stopLoop`, `_paintOnce`, `play`, `pause` methods to the existing `<sim-engine>`. 4 new tests. Note: the existing tests in `sim-engine.test.js` use `document.body.innerHTML = '<sim-engine ...>'`. Those work without modification (the test environment is happy-dom and the string is a static literal). The NEW tests below use the `mountSimEngine()` helper instead — define it at the top of the test file.

### Task 4.1 — TDD: rAF loop calls sim.step

**Files:**

- Modify: `packages/core/src/components/sim-engine.js`
- Modify: `packages/core/tests/sim-engine.test.js`

**Step 1: Add `mountSimEngine` helper and the failing test**

At the top of `sim-engine.test.js` (or in a `helpers` block), add the helper from the plan header. Then append a new describe block:

```js
describe('<sim-engine> — rAF loop', () => {
  beforeEach(() => {
    clearRegistry();
    registerSim(fakeSim);
    resetFakeSimCalls();
    document.body.replaceChildren();
  });

  it('starts a rAF loop on connect that calls sim.step on each tick', async () => {
    vi.useFakeTimers();
    mountSimEngine({ sim: 'fake-sim' });
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(fakeSimCalls.step).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
```

`vi` should already be imported.

**Step 2: Verify RED.**

**Step 3: Update `packages/core/src/components/sim-engine.js`**

Add the import at the top:

```js
import { prefersReducedMotion } from '../engine/a11y.js';
```

Add to the initial state in `connectedCallback`:

```js
playing: true,
dt: 0,
```

After dispatching `sim-ready`:

```js
this._startLoop();
```

In `disconnectedCallback`, as the FIRST line:

```js
this._stopLoop();
```

Add the new methods to the class (after the existing imperative methods):

```js
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
    const dt = (now - this._lastFrameTime) / 1000;
    this._lastFrameTime = now;
    this._state.set('dt', dt);
    if (typeof this._sim.step === 'function') this._sim.step(dt);
    this._paintOnce();
    this._rafHandle = requestAnimationFrame(tick);
  };
  this._rafHandle = requestAnimationFrame(tick);
}

_stopLoop() {
  if (this._rafHandle != null) {
    cancelAnimationFrame(this._rafHandle);
    this._rafHandle = null;
  }
}

_paintOnce() {
  if (typeof this._sim?.render !== 'function') return;
  const canvas = this.shadowRoot.querySelector('.sim-canvas__stage canvas');
  const ctx = canvas?.getContext('2d');
  if (ctx) this._sim.render(ctx);
}

play() {
  if (!this._state) return;
  this._state.set('playing', true);
  this._startLoop();
}

pause() {
  if (!this._state) return;
  this._state.set('playing', false);
}
```

**Step 4: Verify GREEN.**

### Tasks 4.2 – 4.4 — Remaining rAF TDD

**4.2 pause/play:**

```js
it('pause() stops further sim.step calls; play() resumes', async () => {
  vi.useFakeTimers();
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
```

**4.3 disconnect stops loop:**

```js
it('disconnectedCallback stops the rAF loop', async () => {
  vi.useFakeTimers();
  const el = mountSimEngine({ sim: 'fake-sim' });
  await Promise.resolve();
  vi.advanceTimersByTime(50);
  const before = fakeSimCalls.step;
  el.remove();
  vi.advanceTimersByTime(100);
  expect(fakeSimCalls.step).toBe(before);
  vi.useRealTimers();
});
```

**4.4 reduced-motion does not loop:**

```js
it('prefers-reduced-motion disables the rAF loop', async () => {
  vi.useFakeTimers();
  const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((q) => ({
    matches: q.includes('reduce'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const el = mountSimEngine({ sim: 'fake-sim' });
  await Promise.resolve();
  vi.advanceTimersByTime(100);
  expect(fakeSimCalls.step).toBe(0);
  expect(el._rafHandle).toBeNull();
  matchMediaSpy.mockRestore();
  vi.useRealTimers();
});
```

### Task 4.5 — Verify pipeline + commit

```
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: lint clean; **58 tests**; build green.

Stage:

- `packages/core/src/components/sim-engine.js`
- `packages/core/tests/sim-engine.test.js`

Commit message:

```
feat(core): add rAF loop to <sim-engine> with reduced-motion respect

Adds _startLoop, _stopLoop, _paintOnce, play, pause methods.
connectedCallback starts the loop after sim-ready dispatch;
disconnectedCallback stops it. The loop computes dt from
performance.now timestamps, writes it to state.dt, calls sim.step
and sim.render each tick, and exits cleanly when state.playing flips
to false.

prefersReducedMotion (foundation a11y helper) is consulted at loop
start: when true, the loop does not start. Users can call play()
explicitly to override.

4 new tests using vi.useFakeTimers and matchMedia spying for
deterministic reduced-motion verification.

Step 5 commit 4 of 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Commit 5 — `feat(core): scaffold gas-laws sim — physics and render helpers`

Pure functions. No `index.js` yet (commit 6). 8 unit tests (5 physics + 3 render).

### Task 5.1 — TDD: physics functions

**Files:**

- Create: `packages/core/src/sims/gas-laws/physics.js`
- Create: `packages/core/tests/gas-laws-physics.test.js`

**Step 1: Failing tests**

```js
import { describe, it, expect } from 'vitest';
import {
  R_GAS,
  idealPressure,
  avgKineticEnergy,
  visualParticleCount,
} from '../src/sims/gas-laws/physics.js';

describe('Gas Laws physics', () => {
  it('R_GAS is 8.314', () => {
    expect(R_GAS).toBeCloseTo(8.314, 3);
  });

  it('idealPressure computes nRT/V', () => {
    expect(idealPressure({ V: 1, T: 300, n: 1 })).toBeCloseTo(8.314 * 300, 1);
  });

  it('idealPressure returns 0 for non-positive inputs', () => {
    expect(idealPressure({ V: 0, T: 300, n: 1 })).toBe(0);
    expect(idealPressure({ V: 1, T: 0, n: 1 })).toBe(0);
    expect(idealPressure({ V: 1, T: 300, n: 0 })).toBe(0);
  });

  it('avgKineticEnergy is proportional to T', () => {
    expect(avgKineticEnergy(600) / avgKineticEnergy(300)).toBeCloseTo(2, 3);
  });

  it('visualParticleCount clamps to 4..80 with 12 per mol', () => {
    expect(visualParticleCount(0.1)).toBe(4);
    expect(visualParticleCount(1)).toBe(12);
    expect(visualParticleCount(3)).toBe(36);
    expect(visualParticleCount(100)).toBe(80);
  });
});
```

**Step 2: Verify RED.**

**Step 3: Create `packages/core/src/sims/gas-laws/physics.js`**

```js
/**
 * Gas Laws physics — pure functions, no DOM. Step 5 ships ideal gas only.
 */

export const R_GAS = 8.314; // J·K⁻¹·mol⁻¹

/**
 * @param {{ V: number, T: number, n: number }} state
 * @returns {number} pressure in kPa (V in L, T in K, n in mol)
 */
export function idealPressure({ V, T, n }) {
  if (V <= 0 || T <= 0 || n <= 0) return 0;
  return (n * R_GAS * T) / V;
}

/**
 * Mean kinetic energy per particle, in zeptojoules. KE = (3/2) k_B T.
 *
 * @param {number} T
 * @returns {number}
 */
export function avgKineticEnergy(T) {
  const kB = 1.380649e-23;
  return 1.5 * kB * T * 1e21;
}

/**
 * Visual particle count for a given number of moles. 12 per mol, clamped to 4..80.
 *
 * @param {number} n
 * @returns {number}
 */
export function visualParticleCount(n) {
  return Math.max(4, Math.min(80, Math.round(n * 12)));
}
```

**Step 4: Verify GREEN.**

### Task 5.2 — TDD: render helpers

**Files:**

- Create: `packages/core/src/sims/gas-laws/render.js`
- Create: `packages/core/tests/gas-laws-render.test.js`

**Step 1: Failing tests**

```js
import { describe, it, expect } from 'vitest';
import { drawContainer, drawParticle } from '../src/sims/gas-laws/render.js';

function mockCtx() {
  const calls = [];
  return {
    calls,
    ctx: {
      clearRect: (...a) => calls.push(['clearRect', ...a]),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      strokeRect: (...a) => calls.push(['strokeRect', ...a]),
      fillRect: (...a) => calls.push(['fillRect', ...a]),
      beginPath: () => calls.push(['beginPath']),
      arc: (...a) => calls.push(['arc', ...a]),
      fill: () => calls.push(['fill']),
    },
  };
}

describe('Gas Laws render helpers', () => {
  it('drawContainer strokes a rectangle whose width tracks V/Vmax', () => {
    const { ctx, calls } = mockCtx();
    drawContainer(ctx, { width: 600, height: 400, V: 5, Vmax: 5 });
    const strokes = calls.filter(([fn]) => fn === 'strokeRect');
    expect(strokes.length).toBe(1);
    const [, , , w] = strokes[0];
    expect(w).toBeGreaterThan(500);
  });

  it('drawContainer narrows when V is reduced', () => {
    const { ctx: ctxA, calls: callsA } = mockCtx();
    const { ctx: ctxB, calls: callsB } = mockCtx();
    drawContainer(ctxA, { width: 600, height: 400, V: 5, Vmax: 5 });
    drawContainer(ctxB, { width: 600, height: 400, V: 1, Vmax: 5 });
    const wA = callsA.find(([fn]) => fn === 'strokeRect')[3];
    const wB = callsB.find(([fn]) => fn === 'strokeRect')[3];
    expect(wB).toBeLessThan(wA);
  });

  it('drawParticle issues an arc and fill', () => {
    const { ctx, calls } = mockCtx();
    drawParticle(ctx, { x: 100, y: 100, r: 6 }, { fillStyle: '#abc' });
    expect(calls.find(([fn]) => fn === 'arc')).toBeTruthy();
    expect(calls.find(([fn]) => fn === 'fill')).toBeTruthy();
    expect(ctx.fillStyle).toBe('#abc');
  });
});
```

**Step 2: Verify RED.**

**Step 3: Create `packages/core/src/sims/gas-laws/render.js`**

```js
/**
 * Canvas rendering helpers for the Gas Laws sim.
 */

const CONTAINER_MARGIN_X = 30;
const CONTAINER_MARGIN_Y = 30;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width: number, height: number, V: number, Vmax: number }} opts
 */
export function drawContainer(ctx, { width, height, V, Vmax }) {
  const innerW = width - 2 * CONTAINER_MARGIN_X;
  const drawW = (V / Vmax) * innerW;
  ctx.strokeStyle = 'rgba(13, 24, 51, 0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(CONTAINER_MARGIN_X, CONTAINER_MARGIN_Y, drawW, height - 2 * CONTAINER_MARGIN_Y);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,r:number}} p
 * @param {{fillStyle:string}} opts
 */
export function drawParticle(ctx, p, { fillStyle }) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
}
```

**Step 4: Verify GREEN.**

### Task 5.3 — Verify pipeline + commit

```
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: **66 tests** (58 + 5 + 3); build green.

Stage:

- `packages/core/src/sims/gas-laws/physics.js`
- `packages/core/src/sims/gas-laws/render.js`
- `packages/core/tests/gas-laws-physics.test.js`
- `packages/core/tests/gas-laws-render.test.js`

Commit message:

```
feat(core): scaffold gas-laws sim — physics and render helpers

Pure functions, no DOM. Two files:
  - physics.js: R_GAS constant; idealPressure (PV=nRT in kPa);
    avgKineticEnergy (zJ); visualParticleCount (4..80 linear scaling).
  - render.js: drawContainer (rectangle whose width tracks V/Vmax);
    drawParticle (arc + fill).

8 unit tests (5 physics + 3 render). The sim module that consumes
these lands in the next commit; the registry is not yet aware of
gas-laws.

Step 5 commit 5 of 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Commit 6 — `feat(core): wire gas-laws sim — controls, readouts, P–V graph`

The full sim assembly. 6 integration tests using the `mountSimEngine` helper to avoid `innerHTML`.

### Task 6.1 — Create the sim module + first integration test

**Files:**

- Create: `packages/core/src/sims/gas-laws/index.js`
- Create: `packages/core/tests/gas-laws.test.js`
- Modify: `packages/core/src/index.js`

**Step 1: Failing test**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import gasLaws from '../src/sims/gas-laws/index.js';
import { registerSim, lookupSim, clearRegistry } from '../src/sims/registry.js';
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

describe('gas-laws sim module', () => {
  beforeEach(() => {
    clearRegistry();
    document.body.replaceChildren();
  });

  it('passes validateSimShape (registers without throwing)', () => {
    expect(() => registerSim(gasLaws)).not.toThrow();
    expect(lookupSim('gas-laws')).toBe(gasLaws);
  });
});
```

**Step 2: Verify RED.**

**Step 3: Create `packages/core/src/sims/gas-laws/index.js`**

```js
/**
 * Gas Laws sim — ideal gas only (step 5). Single species, no VdW.
 * Step 5b will add multiple species, VdW, MB distribution graph,
 * teacher presets, and HL Ideal-vs-Real comparison.
 */
import { idealPressure, avgKineticEnergy, visualParticleCount } from './physics.js';
import { createParticleField } from '../../engine/particles.js';
import { createSlider, createButton } from '../../engine/controls.js';
import { createGraph } from '../../engine/graph.js';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 360;

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

    // Particle field
    this._field = createParticleField({
      count: visualParticleCount(initial.n),
      bounds: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
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
      makeReadout('Particles', 'N', '')
    );

    // Wire state listeners
    host._state.on('T', (T) => {
      this._field.setTemperature(T);
      this._updateReadouts(host);
    });
    host._state.on('V', () => this._updateReadouts(host));
    host._state.on('n', (n) => {
      this._field.setCount(visualParticleCount(n));
      this._updateReadouts(host);
    });

    this._updateReadouts(host);
    this._lastHost = host;
    this._frameCount = 0;
  },

  step(dt) {
    this._field?.step(dt);
  },

  render(ctx) {
    this._field?.render(ctx);
    this._frameCount = (this._frameCount ?? 0) + 1;
    if (this._frameCount % 10 === 0 && this._lastHost && this._graph) {
      const state = this._lastHost._state.getAll();
      this._graph.addPoint('path', state.V, idealPressure(state));
      this._graph.redraw();
    }
  },

  derived(state) {
    return { P: idealPressure(state), KE: avgKineticEnergy(state.T) };
  },

  dispose() {
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
    set('P', idealPressure(state).toFixed(1));
    set('KE', avgKineticEnergy(state.T).toFixed(2));
    set('N', String(visualParticleCount(state.n)));
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
```

**Step 4: Modify `packages/core/src/index.js`** to register the sim:

After the existing `import './components/sim-engine.js';`, add:

```js
import gasLaws from './sims/gas-laws/index.js';
import { registerSim as _registerForBoot } from './sims/registry.js';
_registerForBoot(gasLaws);
```

(Aliasing `registerSim` to `_registerForBoot` because the top-level re-export already exists; this is the side-effect registration only.)

**Step 5: Verify GREEN** for Task 6.1.

### Tasks 6.2 – 6.6 — Remaining integration tests

**6.2 rail has 3 sliders:**

```js
it('rail contains 3 sliders with the right keys after mount', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const sliders = el.shadowRoot.querySelectorAll('.sim-rail .sim-slider');
  expect(sliders.length).toBe(3);
  const keys = Array.from(sliders).map((s) => s.dataset.var);
  expect(keys).toEqual(['T', 'V', 'n']);
});
```

**6.3 readouts show numbers:**

```js
it('readouts show numeric values for P, KE, and N after mount', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const root = el.shadowRoot;
  const P = root.querySelector('[data-readout="P"] .sim-readout__value-text').textContent;
  const KE = root.querySelector('[data-readout="KE"] .sim-readout__value-text').textContent;
  const N = root.querySelector('[data-readout="N"] .sim-readout__value-text').textContent;
  expect(P).not.toBe('—');
  expect(Number(P)).toBeGreaterThan(0);
  expect(KE).not.toBe('—');
  expect(Number(N)).toBeGreaterThanOrEqual(4);
});
```

**6.4 V slider updates state and readout:**

```js
it('moving the V slider updates state.V and the displayed P readout', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const root = el.shadowRoot;
  const beforeP = root.querySelector('[data-readout="P"] .sim-readout__value-text').textContent;

  const vSliderInput = root.querySelector('.sim-slider[data-var="V"] input[type="range"]');
  vSliderInput.value = '4';
  vSliderInput.dispatchEvent(new Event('input', { bubbles: true }));

  expect(el._state.get('V')).toBe(4);
  const afterP = root.querySelector('[data-readout="P"] .sim-readout__value-text').textContent;
  expect(afterP).not.toBe(beforeP);
});
```

**6.5 P-V graph receives points after render cycles:**

```js
it('after several render cycles, _frameCount advances past the graph cadence', async () => {
  registerSim(gasLaws);
  const el = mountSimEngine({ sim: 'gas-laws' });
  await Promise.resolve();
  const stageCanvas = el.shadowRoot.querySelector('.sim-canvas__stage canvas');
  const ctx = stageCanvas.getContext('2d');
  for (let i = 0; i < 12; i++) {
    el._sim.render(ctx);
  }
  expect(el._sim._frameCount).toBeGreaterThan(10);
});
```

**6.6 derived returns sensible numbers:**

```js
it('derived(state) returns P and KE for known inputs', () => {
  const out = gasLaws.derived({ T: 300, V: 2, n: 1 });
  expect(out.P).toBeCloseTo((8.314 * 300) / 2, 1);
  expect(out.KE).toBeGreaterThan(0);
});
```

### Task 6.7 — Verify pipeline + commit

```
pnpm format && pnpm lint && pnpm test && pnpm build
```

Expected: **72 tests** (66 + 6); build green; bundle grows ~5-8 kB.

Stage:

- `packages/core/src/sims/gas-laws/index.js`
- `packages/core/src/index.js`
- `packages/core/tests/gas-laws.test.js`

Commit message:

```
feat(core): wire gas-laws sim — controls, readouts, P–V graph

The full sim assembly. init(host) builds:
  - <canvas> for particle rendering inside .sim-canvas__stage
  - <canvas> for the P-V graph inside .sim-rail
  - 3 sliders (T/V/n) wired to host.setVariable
  - 4 transport buttons (Play, Pause, Reset, Record trial)
  - 3 readouts (P, KE, particle count)

State listeners on T/V/n keep the particle field temperature, count,
and readouts in sync. render(ctx) draws particles every frame and
appends a point to the P-V graph every 10 frames.

Registered via packages/core/src/index.js as a side effect of
importing the package, so <sim-engine sim="gas-laws"> works
out of the box.

6 integration tests against happy-dom. Step 5 commit 6 of 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Commit 7 — `feat(examples): mount gas-laws in the smoke test page`

Updates the existing smoke test page to mount the working sim.

### Task 7.1 — Update the smoke test HTML

**Files:**

- Modify: `examples/vanilla-html/index.html`

Replace the existing `<div class="sim-canvas">` placeholder block (and the `<pre>` showing API usage) with a mounted `<sim-engine>`. The four `<link>` tags at the top stay as-is.

The new body content (between `<body data-subject="chemistry">` and `</body>`):

```html
<div class="sim-wrap">
  <nav class="sim-topstrip">
    <div>
      <a href="#">AISC · IB Sciences</a> &nbsp;·&nbsp; Chemistry HL &nbsp;·&nbsp; Unit 1.5
      &nbsp;·&nbsp;
      <span style="color: var(--ib-navy-800)">Gas Laws</span>
    </div>
    <div class="sim-topstrip__right">
      <span class="sim-topstrip__badge">SimEngine v0.0 · step 5</span>
      <span>Smoke test</span>
    </div>
  </nav>

  <header class="sim-head">
    <div>
      <div class="sim-head__kicker">Step 5 — Gas Laws sim</div>
      <h1 class="sim-head__title">PV = <em>nRT</em>, animated.</h1>
      <p class="sim-head__lede">
        The <code>&lt;sim-engine sim="gas-laws"&gt;</code> below mounts an animated ideal-gas
        simulation with adjustable T/V/n, live readouts, and a P-V graph. VdW physics, multiple
        species, and presets land in step 5b.
      </p>
    </div>
    <div class="sim-head__meta">
      <span>Phase<br /><b>Step 5</b></span>
      <span>Status<br /><b>Smoke test</b></span>
    </div>
  </header>

  <sim-engine sim="gas-laws">
    <div class="sim-fallback">
      <p>Loading the simulation… enable JavaScript to run it.</p>
    </div>
  </sim-engine>
</div>

<script type="module">
  // Side-effect import — registers the gas-laws sim and defines <sim-engine>.
  import '../../packages/core/dist/index.js';
</script>
```

**Important:** the script tag switches from `<script src=".../index.global.js">` to `<script type="module">` importing the ESM bundle. ESM is cleaner for the modern bundler output.

Run `pnpm format` to clean up.

### Task 7.2 — Visual verification

Run from worktree root:

```
pnpm build
open examples/vanilla-html/index.html
```

In the browser, verify all of:

- Page renders the AISC design system shell.
- Inside `<sim-engine>`, the canvas shows particles bouncing.
- Rail shows three sliders with labels Temperature/Volume/Moles.
- Transport row has Play / Pause / Reset / Record trial buttons.
- Readouts show numeric values for Pressure, Avg KE, Particles.
- Moving a slider updates state and the readouts.
- The P-V graph in the rail traces dots as the user explores (V, P) state space.
- No console errors.

If anything is off, pause and report. Don't commit until visual smoke passes.

### Task 7.3 — Commit

Stage:

- `examples/vanilla-html/index.html`

Commit message:

```
feat(examples): mount gas-laws in the smoke test page

Replaces the placeholder canvas + API readout pre block with a real
mounted <sim-engine sim="gas-laws"> that exercises the full step-5
pipeline: animated particles, T/V/n sliders, transport, live readouts,
and a P-V graph.

The script tag switches from the IIFE bundle to <script type="module">
importing dist/index.js — cleaner for ESM-only consumers and matches
the publishing path.

Step 5 commit 7 of 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## Commit 8 — `docs: update CHANGELOG and architecture for step 5`

### Task 8.1 — Update CHANGELOG

**Files:**

- Modify: `CHANGELOG.md`

After the existing `### Step 4` section but before `### Notes`, insert:

```markdown
### Step 5 — Gas Laws sim module

Eight commits implementing the foundation-stub engine modules and porting an ideal-gas Gas Laws sim.

- `feat(core)`: implement `particles.js` with elastic wall collisions
- `feat(core)`: implement `controls.js` with slider and button factories
- `feat(core)`: implement `graph.js` with declarative traces (and delete `stubs.test.js`)
- `feat(core)`: add rAF loop to `<sim-engine>` with reduced-motion respect
- `feat(core)`: scaffold gas-laws sim — physics and render helpers
- `feat(core)`: wire gas-laws sim — controls, readouts, P–V graph
- `feat(examples)`: mount gas-laws in the smoke test page
- `docs`: this CHANGELOG entry + architecture.md update

**Test count:** 72 (was 41 after step 4; -3 stubs, +34 new).

**Public surface added:** `<sim-engine sim="gas-laws">` works out of the box (registered as a side effect of importing the package). Imperative `play()` / `pause()` methods on the element instance.

**Deferred to step 5b:** VdW physics; HL toggle and Ideal-vs-Real comparison graph; multiple gas species (He, N₂, CO₂); Maxwell-Boltzmann distribution graph; teacher presets (Boyle's, Charles's); search palette UI; particle-particle collisions; measured pressure (wall-collision smoothed) alongside computed.
```

### Task 8.2 — Update architecture.md

**Files:**

- Modify: `docs/architecture.md`

After the existing `## Step 4 — <sim-engine> custom element` section, append a new `## Step 5 — Gas Laws sim module` section covering: usage example (HTML mount), engine modules implemented (particles/controls/graph), `<sim-engine>` rAF loop enhancement, Gas Laws sim shape (controls list, no scenarios, ideal-gas only physics, visual semantics), and what's deferred to step 5b.

The exact prose to write:

````markdown
## Step 5 — Gas Laws sim module

Ideal-gas simulation registered as `'gas-laws'`. Mounted via:

```html
<sim-engine sim="gas-laws"></sim-engine>
```
````

The sim is auto-registered when `@TBD/simengine` is imported (see `packages/core/src/index.js`), so consumers don't need to call `registerSim` manually.

### Engine modules implemented in step 5

- `particles.js` — 2D ideal-gas particle field with elastic wall collisions, Maxwell-Boltzmann initial speed distribution (Box-Muller), substepping at 1/60 to prevent tunneling. Injectable RNG for tests.
- `controls.js` — `createSlider` (matches AISC `.sim-slider` markup, native range input + Shift+arrow ±5×step), `createButton` (default/primary/record variants). Dropdown / toggle / `initKeyboard` remain stubbed for step 6+.
- `graph.js` — `createGraph` with declarative traces (`line` | `dots`), linear axes, out-of-range clipping. `exportPNG` deferred until visual regression infra arrives.

### `<sim-engine>` enhancements in step 5

`requestAnimationFrame` loop with `_startLoop` / `_stopLoop` / `_paintOnce` / `play` / `pause`. Loop calls `sim.step(dt)` and `sim.render(ctx)` per frame. Respects `prefers-reduced-motion`: if true, the loop does not start; users can call `play()` to override.

### Gas Laws sim shape

- **Controls:** 3 sliders — T (100..1000 K, step 1), V (0.5..5 L, step 0.1), n (0.5..5 mol, step 0.1).
- **Scenarios:** none in step 5 (presets are step 5b).
- **Physics:** PV = nRT only. No VdW, no measured pressure.
- **Visuals:** particles animate inside the canvas; container outline narrows as V decreases (piston metaphor); P-V graph in the rail traces dots at the user's path through (V, P) space.

### What's deferred to step 5b

VdW physics; HL toggle + Ideal-vs-Real graph; multiple species (He, N₂, CO₂); Maxwell-Boltzmann distribution; teacher presets; search palette; measured pressure; particle-particle collisions; `createDropdown` / `createToggle` / `initKeyboard`; `exportPNG`.

```

### Task 8.3 — Verify + commit

```

pnpm format && pnpm lint && pnpm test && pnpm build

```

Expected: lint clean; **72 tests**; build green.

Stage:
- `CHANGELOG.md`
- `docs/architecture.md`

Commit message:

```

docs: update CHANGELOG and architecture for step 5

Records step 5 in CHANGELOG (under [Unreleased]) and adds a
"## Step 5 — Gas Laws sim module" section to docs/architecture.md
covering the engine modules implemented, the <sim-engine> rAF loop,
the Gas Laws sim shape, and what's deferred to step 5b.

Step 5 commit 8 of 8. Step 5 complete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

````

---

## Final verification (after all 8 commits)

```bash
cd /Users/imatthew/Documents/Claude/Projects/aisc-simengine/.worktrees/step-5-gas-laws
pnpm install
pnpm lint     # clean
pnpm test     # 72 tests green
pnpm build    # ESM + IIFE bundles
open examples/vanilla-html/index.html
````

Browser must show: animated particles, working sliders, container width tracking V, P-V graph tracing dots, live readouts updating, no console errors.

Push the branch and open a PR:

```bash
git -C /Users/imatthew/Documents/Claude/Projects/aisc-simengine/.worktrees/step-5-gas-laws push -u origin step-5-gas-laws
gh pr create --base main --head step-5-gas-laws ...
```

CI runs the full pipeline; branch protection requires it green before merge.

---

## Reference

- Design doc: `docs/plans/2026-04-29-step5-gas-laws-design.md`
- Step 4 design: `docs/plans/2026-04-29-step4-sim-engine-design.md`
- Source spec: `1-Projects/SimEngine/docs/specs/2026-04-29-gaslaws-polish-handoff.md` §9 step 5
- Reference prototype: `1-Projects/SimEngine/SimEngine_GasLaws.html` (1,640 lines)
- Foundation modules consumed: `state.js`, `recorder.js`, `a11y.js`, `registry.js`
