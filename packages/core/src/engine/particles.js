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
