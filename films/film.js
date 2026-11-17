/* film.js: shared harness for the portfolio films.
   A scene draws into a 1000×620 logical box. The harness maps that box into a "stage" rect
   that differs for landscape and portrait, so one scene renders both. Every frame is a pure
   function of the frame number (motion-demo-studio contract). */
(function () {
  const q = new URLSearchParams(location.search);
  const P = {
    bg: '#0E0F11', bg2: '#16181C', line: 'rgba(236,232,223,.08)', line2: 'rgba(236,232,223,.16)',
    bone: '#ECE8DF', dim: 'rgba(236,232,223,.55)', faint: 'rgba(236,232,223,.28)',
    sig: '#FFD12E', cyan: '#5FD3E6', red: '#FF5A4E', green: '#7BE495',
  };
  const S = (f, start, preset = 'smooth', o = {}) => M.spring(f, { start, preset, ...o });   // 0 → 1 on a real spring
  const iv = (f, a, b) => M.clamp((f - a) / (b - a));
  const ss = (x) => x * x * (3 - 2 * x);
  function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  function txt(c, s, x, y, { size = 14, font = 'IBM Plex Mono', weight = 400, color = P.bone, align = 'left', base = 'alphabetic', alpha = 1 } = {}) {
    c.save(); c.globalAlpha = M.clamp(c.globalAlpha * alpha); size *= window.FILM_TK || 1; c.font = `${weight} ${size}px "${font}"`; c.fillStyle = color; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); c.restore();
  }

  window.Film = function ({ frames, stage, draw, bg }) {
    const portrait = q.get('o') === 'p' || window.FILM_O === 'p';
    const W = portrait ? 720 : 1600, H = portrait ? 1280 : 900;
    window.composition = { width: W, height: H, fps: 30, durationFrames: frames };
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; (document.body || document.documentElement).appendChild(cv);
    const c = cv.getContext('2d');
    const st = (portrait ? stage.p : stage.l);                      // {x,y,w} in px; height follows the 1000×620 box
    const k = st.w / 1000;
    window.FILM_TK = portrait ? 1.34 : 1.16;                         // type reads at real size: bigger than the layout box alone gives
    window.renderFrame = async (f) => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = P.bg; c.fillRect(0, 0, W, H);
      if (bg) bg(c, f, W, H, P);
      c.save(); c.translate(st.x, st.y); c.scale(k, k);
      draw(c, f, { P, S, iv, ss, rr, txt, portrait });
      c.restore();
      // film grain, seeded per frame: same frame, same pixels
      const rnd = M.seeded(Math.floor(f) * 7919 + 13);
      c.fillStyle = 'rgba(236,232,223,.025)';
      for (let i = 0; i < 900; i++) c.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    };
    window.compositionReady = Promise.all(['400 14px "IBM Plex Mono"', '500 14px "IBM Plex Mono"', '500 14px "IBM Plex Sans"', '600 14px "IBM Plex Sans"', '800 40px "Big Shoulders Display"', '900 40px "Big Shoulders Display"']
      .map((f) => document.fonts.load(f))).then(() => document.fonts.ready);
    // canvas alpha ignores out-of-range values instead of clamping them; clamp every assignment
    const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'globalAlpha');
    Object.defineProperty(c, 'globalAlpha', { get() { return d.get.call(this); }, set(v) { d.set.call(this, Math.min(1, Math.max(0, v))); } });
  };
  window.FilmUtil = { P, S, iv, ss, rr, txt };
})();
