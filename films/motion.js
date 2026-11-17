// motion.js — frame-based motion helpers. Every function is pure: same input, same output.
// Load in a composition with <script src="motion.js"></script>; everything is on window.M.
(function (root) {
  const PRESETS = {
    snappy: { stiffness: 300, damping: 30, mass: 1 },
    smooth: { stiffness: 170, damping: 26, mass: 1 },
    gentle: { stiffness: 120, damping: 20, mass: 1 },
    bouncy: { stiffness: 200, damping: 12, mass: 1 },
  };

  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, p) => a + (b - a) * p;

  // Closed-form damped spring, 0 → 1, at time t seconds. No integration, no state.
  function springProgress(t, { stiffness, damping, mass }) {
    if (t <= 0) return 0;
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    if (zeta === 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - s);
    const r2 = -w0 * (zeta + s);
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  }

  // spring(frame, { start, fps, preset | stiffness/damping/mass, from, to })
  // start: the frame the motion begins. Returns the value at `frame`.
  function spring(frame, opts = {}) {
    const { start = 0, fps = 30, from = 0, to = 1, preset = 'smooth' } = opts;
    const cfg = { ...PRESETS[preset], ...pick(opts, ['stiffness', 'damping', 'mass']) };
    return lerp(from, to, springProgress((frame - start) / fps, cfg));
  }

  // Frames until a spring stays within 0.5% of rest — use it to plan holds and cuts.
  function settleFrames(opts = {}) {
    const fps = opts.fps || 30;
    for (let f = 1; f < fps * 10; f++) {
      let settled = true;
      for (let g = f; g < f + fps / 2; g++) {
        if (Math.abs(1 - spring(g, { ...opts, start: 0, from: 0, to: 1 })) > 0.005) { settled = false; break; }
      }
      if (settled) return f;
    }
    return fps * 10;
  }

  // Piecewise-linear map, clamped at both ends: interpolate(f, [0, 30], [0, 100]).
  function interpolate(x, input, output) {
    if (x <= input[0]) return output[0];
    for (let i = 1; i < input.length; i++) {
      if (x <= input[i]) {
        const p = (x - input[i - 1]) / (input[i] - input[i - 1]);
        return lerp(output[i - 1], output[i], p);
      }
    }
    return output[output.length - 1];
  }

  // Start frame of item i in a staggered group.
  const stagger = (start, i, gap = 3) => start + i * gap;

  // Beat grid. beat(n, bpm, fps) → frame of beat n (0-based). Pick bpm so this is whole.
  const beat = (n, bpm = 120, fps = 30) => Math.round((n * 60 * fps) / bpm);
  const bar = (n, bpm = 120, fps = 30, beatsPerBar = 4) => beat(n * beatsPerBar, bpm, fps);

  // Characters of `text` visible at `frame` when typing at `cps` characters/second.
  function typed(text, frame, { start = 0, fps = 30, cps = 28 } = {}) {
    const n = Math.floor((Math.max(0, frame - start) * cps) / fps);
    return text.slice(0, n);
  }

  // Integer counter from `from` to `to` over [start, end] frames, eased.
  function count(frame, { start, end, from = 0, to }) {
    const p = interpolate(frame, [start, end], [0, 1]);
    return Math.round(lerp(from, to, 1 - Math.pow(1 - p, 3)));
  }

  // Seeded random, for "random" layouts that must be identical on every render.
  function seeded(seed) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }

  // Common enter: translate + opacity driven by one spring. Returns a CSS-ready object.
  function enter(frame, { start, fps = 30, dy = 40, dx = 0, scaleFrom = 1, preset = 'smooth' }) {
    const p = spring(frame, { start, fps, preset });
    return {
      opacity: String(clamp(p * 1.4)),
      transform: `translate(${Math.round(dx * (1 - p))}px, ${Math.round(dy * (1 - p))}px) scale(${lerp(scaleFrom, 1, p)})`,
    };
  }

  function apply(el, style) {
    for (const k in style) el.style[k] = style[k];
  }

  function pick(o, keys) {
    const r = {};
    for (const k of keys) if (o[k] !== undefined) r[k] = o[k];
    return r;
  }

  const M = { PRESETS, clamp, lerp, springProgress, spring, settleFrames, interpolate, stagger, beat, bar, typed, count, seeded, enter, apply };
  if (typeof module !== 'undefined') module.exports = M;
  root.M = M;
})(typeof window !== 'undefined' ? window : globalThis);
