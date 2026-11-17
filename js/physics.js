/* physics.js — real physics for every move on the page.

   1. Spring eases. A damped harmonic oscillator, solved in closed form, used as a GSAP ease.
      Because it is a pure function of progress, a scroll-scrubbed timeline can use it and still
      rewind exactly. Parameters are physical (stiffness, damping, mass), not a bezier someone liked.

   2. Spring. A per-frame integrator for things that respond to input — scroll velocity, the
      pointer, a magnetic button. Semi-implicit Euler at a fixed 240 Hz substep, so the result
      does not depend on the display's refresh rate.

   3. Gravity. Exits accelerate at a constant rate: x = t², which is what falling is. */
(() => {
  // displacement of a spring released from x = 1 at rest, at time t (seconds)
  const response = (t, w0, z) => {
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    }
    if (z === 1) return Math.exp(-w0 * t) * (1 + w0 * t);
    const s = Math.sqrt(z * z - 1), r1 = -w0 * (z - s), r2 = -w0 * (z + s);
    return (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  };
  // how long until it stays within 0.1% of rest — that span becomes progress 0..1
  const settleTime = (w0, z, eps = 0.001) => {
    let last = 0;
    for (let t = 0; t < 12; t += 1 / 240) if (Math.abs(response(t, w0, z)) > eps) last = t;
    return last + 1 / 240;
  };
  const springEase = ({ stiffness = 170, damping = 26, mass = 1 } = {}) => {
    const w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
    const T = settleTime(w0, z);
    return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - response(p * T, w0, z));
  };

  class Spring {
    constructor({ stiffness = 170, damping = 26, mass = 1, value = 0 } = {}) {
      this.k = stiffness; this.c = damping; this.m = mass;
      this.x = value; this.v = 0; this.target = value;
    }
    step(dt) {
      dt = Math.min(dt, 1 / 20);                          // a dropped tab shouldn't fling things
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
      for (let i = 0; i < n; i++) {
        const a = (-this.k * (this.x - this.target) - this.c * this.v) / this.m;
        this.v += a * h; this.x += this.v * h;           // semi-implicit: velocity first
      }
      return this.x;
    }
    get resting() { return Math.abs(this.v) < 1e-3 && Math.abs(this.x - this.target) < 1e-3; }
  }

  // named presets, each a real (stiffness, damping, mass). ζ = damping ratio.
  const PRESETS = {
    settle: { stiffness: 170, damping: 26, mass: 1 },     // ζ ≈ 1.00 — arrives, no overshoot
    soft:   { stiffness: 120, damping: 19, mass: 1 },     // ζ ≈ 0.87 — a hair of overshoot
    land:   { stiffness: 210, damping: 17, mass: 1 },     // ζ ≈ 0.59 — a card that lands and rocks
    heavy:  { stiffness: 60,  damping: 14, mass: 1.4 },   // ζ ≈ 0.76 — the window: mass you can feel
  };

  window.Phys = { response, springEase, Spring, PRESETS };
  if (window.gsap) {
    Object.entries(PRESETS).forEach(([name, p]) => gsap.registerEase('spring' + name[0].toUpperCase() + name.slice(1), springEase(p)));
    gsap.registerEase('gravity', (p) => p * p);           // constant acceleration
  }
})();
