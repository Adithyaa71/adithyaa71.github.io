/* story.js — four systems, as case studies.
   One window, held in place, walks through real source files from the four repos.
   Beside it, one card at a time: the measured fact or the decision that file is about.
   Scroll is the playhead — scroll back and everything rewinds. */
(() => {
  const story = document.querySelector('.story');
  if (!story) return;
  const q = (s) => story.querySelector(s);
  const qa = (s) => [...story.querySelectorAll(s)];
  const chaps = qa('.chap');

  const stills = () => {
    q('.stills').innerHTML = chaps.map((c) =>
      `<div class="still"><p class="no">${c.querySelector('.chap__no').textContent.trim()}</p><h3>${c.querySelector('h2').textContent}</h3><p>${c.querySelector('p:not(.chap__no):not(.facts)').textContent}</p></div>`).join('');
  };
  if (window.AU_RM || !window.gsap || !window.ScrollTrigger) { stills(); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* ── a small syntax highlighter for the real source in the window.
        Line-based, with state for Python docstrings. Text is re-escaped on output. */
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const RULES = {
    rust: /(\/\/.*$)|("(?:\\.|[^"\\])*")|(#\[[^\]]*\])|\b(pub|fn|let|mut|for|in|if|else|return|const|struct|enum|use|impl|self|Self|match|as|where|loop|while|mod|crate|true|false)\b|\b([a-z_][a-z0-9_]*!)|\b([A-Z][A-Za-z0-9_]*)\b|\b(\d[\d_]*(?:\.\d+)?)\b|\b([a-z_][a-z0-9_]*)(?=\s*\()/g,
    python: /(#.*$)|("""|''')|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[\w.]+)|\b(def|return|if|else|elif|try|except|raise|class|import|from|as|for|in|not|and|or|None|True|False|with|lambda|pass)\b|\b([A-Z][A-Za-z0-9_]*)\b|\b(\d+(?:\.\d+)?)\b|\b([a-z_][a-z0-9_]*)(?=\s*\()/g,
    json: /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g,
  };
  const CLS = {
    rust: [null, 'c', 's', 'at', 'k', 'm', 'ty', 'n', 'f'],
    python: [null, 'c', 'doc', 's', 'at', 'k', 'ty', 'n', 'f'],
    json: [null, 'key', 's', 'k', 'n'],
  };
  const paint = (text, lang, st) => {
    if (lang === 'markdown') {
      if (/^#{1,6} /.test(text)) return `<span class="h">${esc(text)}</span>`;
      return `<span class="c">${esc(text)}</span>`;
    }
    const re = RULES[lang]; if (!re) return esc(text);
    let out = '', last = 0, m;
    // inside a Python docstring: everything up to the closing quotes is docstring
    if (st.doc) {
      const end = text.indexOf(st.doc);
      if (end < 0) return `<span class="doc">${esc(text)}</span>`;
      out = `<span class="doc">${esc(text.slice(0, end + 3))}</span>`; last = end + 3; st.doc = null;
    }
    re.lastIndex = last;
    while ((m = re.exec(text))) {
      const g = m.slice(1).findIndex((x) => x !== undefined) + 1;
      let cls = CLS[lang][g];
      out += esc(text.slice(last, m.index));
      if (cls === 'doc') {                                  // an opening """ — find its close on this line
        const close = text.indexOf(m[0], m.index + 3);
        if (close < 0) { out += `<span class="doc">${esc(text.slice(m.index))}</span>`; st.doc = m[0]; return out; }
        out += `<span class="doc">${esc(text.slice(m.index, close + 3))}</span>`; last = close + 3; re.lastIndex = last; continue;
      }
      if (lang === 'rust' && cls === 'c' && m[0].startsWith('///')) cls = 'c dc';
      out += `<span class="${cls}">${esc(m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(text.slice(last));
  };
  qa('pre.code').forEach((pre) => {
    // lines are blocks; the newlines between them would each render as an extra blank line
    [...pre.childNodes].forEach((n) => { if (n.nodeType === 3 && !n.textContent.trim()) n.remove(); });
    const lang = pre.dataset.lang, st = { doc: null };
    pre.querySelectorAll('.ln').forEach((ln) => {
      if (ln.classList.contains('fold')) return;
      const num = ln.querySelector('i');
      const text = ln.textContent.slice(num.textContent.length);
      if (st.doc || /^\s*(\/\/|#|"""|''')/.test(text)) ln.classList.add('cm');
      ln.innerHTML = `<i>${num.textContent}</i>${paint(text, lang, st)}`
        .replace(/\*\*([^*<]+)\*\*/g, '<span class="mdm">**</span><b class="mdb">$1</b><span class="mdm">**</span>');
    });
  });

  /* ── one-time DOM prep */
  chaps.forEach((c) => {
    const h = c.querySelector('h2');
    h.innerHTML = h.textContent.trim().split(/\s+/).map((w) => `<span class="w"><span>${w}</span></span>`).join(' ');
  });

  const stage = q('.stage'), win = q('.win');
  // the routing box must sit above the 3D canvas (which sits above the window so the space can spill out);
  // a transformed window is its own stacking context, so the box moves up to the stage
  const route = q('.space__route');
  if (route) { route.classList.add('route--stage'); stage.appendChild(route); }
  const pane = (k) => q(`[data-pane="${k}"]`);
  const sc = (k) => q(`[data-sc="${k}"]`);
  const app = q('[data-app]'), cmd = q('[data-cmd]'), meta = q('[data-meta]');
  const clock = q('[data-clock]'), rail = qa('.rail i'), depth = q('.win-depth');
  const wideMQ = matchMedia('(min-width: 901px) and (min-aspect-ratio: 4/5)');
  const wide = () => wideMQ.matches;

  /* ── the timeline, in units. END spans ~14 screens of scroll. */
  const END = 150;
  const CHIN = [6, 48, 74, 104, 130];                    // when each chapter's headline arrives
  const SC = [[10, 46], [47, 72], [73, 102], [103, 128], [129, 142]];
  const NAME = ['kratos', 'bluee-harness', 'snarevec', 'nyx-nvim', 'how I work'];
  // which pane is in the window, from when — drives the title bar, so it rewinds exactly
  const PANES = [[0, 'term'], [10.6, 'k1'], [22.6, 'k2'], [34.6, 'k3'], [48.6, 'b1'], [60.6, 'b2'], [74.6, 'space'], [90.6, 's2'],
                 [104.6, 'n2']];

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'springSettle', duration: 1.6 } });
  const chapIn = (i, at) => {
    const c = chaps[i];
    tl.set(c, { autoAlpha: 1 }, at)
      .fromTo(c.querySelectorAll('h2 .w > span'), { yPercent: 118, rotate: 5 }, { yPercent: 0, rotate: 0, duration: 2.2, ease: 'springSoft', stagger: 0.08 }, at)
      .fromTo(c.querySelectorAll('.chap__no, p:not(.chap__no), .src'), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 1.8, ease: 'springSettle', stagger: 0.16 }, at + 0.3);
  };
  const chapOut = (i, at) => tl.to(chaps[i], { autoAlpha: 0, y: -36, duration: 1.4, ease: 'gravity' }, at).set(chaps[i], { y: 0 }, at + 1.5);
  const breathe = (at) => tl.to(win, { keyframes: [{ scale: 0.986, duration: 0.7, ease: 'gravity' }, { scale: 1, duration: 1.4, ease: 'springLand' }] }, at);
  const swap = (from, to, at) => {
    breathe(at - 0.2);
    tl.to(pane(from), { autoAlpha: 0, y: -12, duration: 1, ease: 'gravity' }, at)
      .fromTo(pane(to), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1.6, ease: 'springSettle' }, at + 0.9);
  };
  const cardIn = (k, at) => tl.fromTo(sc(k), { autoAlpha: 0, x: -90, z: -160, rotationY: 12 },
    { autoAlpha: 1, x: 0, z: 0, rotationY: 0, duration: 2.6, ease: 'springLand' }, at);
  const cardOut = (k, at) => tl.to(sc(k), { autoAlpha: 0, x: 36, z: -80, rotationY: -8, duration: 1.3, ease: 'gravity' }, at);
  // light each highlighted line in turn — the window points at what the card is about
  const lightLines = (k, at, gap = 1.2) => qa(`[data-pane="${k}"] .ln[data-h]`).forEach((ln, i) =>
    tl.fromTo(ln, { '--hl': 0 }, { '--hl': 1, duration: 1.4, ease: 'springSettle' }, at + i * gap));      // CSS variable: paint only, one line
  const rows = (sel, at, each = 0.45) => tl.fromTo(qa(sel), { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: 1.4, ease: 'springSoft', stagger: each }, at);
  const pose = (at, ry, rx = 1.5) => tl.to(win, { rotationY: ry, rotationX: rx, duration: 5, ease: 'springHeavy' }, at);
  const glow = (k, at) => tl.to('.glow', { opacity: (i, el) => (el.classList.contains('glow--' + k) ? 1 : 0), duration: 4, ease: 'springHeavy' }, at);

  const build = () => {
    const heroPose = () => (wide()
      ? { x: stage.clientWidth * 0.3, y: 0, scale: 0.9, rotationY: -4, rotationX: 1.5 }
      : { x: 0, y: stage.clientHeight * 0.5, scale: 0.88, rotationY: -12, rotationX: 14 });
    gsap.set(win, { transformPerspective: 1600 });
    const wpx = () => stage.style.setProperty('--wpx', win.offsetWidth + 'px');
    wpx(); addEventListener('resize', wpx);

    // ── intro: the window waits in a 3D pose, turns to face you, locks
    tl.fromTo(win, { x: () => heroPose().x, y: () => heroPose().y, scale: () => heroPose().scale, rotationY: () => heroPose().rotationY, rotationX: () => heroPose().rotationX },
                   { x: 0, y: 0, scale: 1, rotationY: 0, rotationX: 0, duration: 9.6, ease: 'springHeavy' }, 0)
      .to('.intro', { y: -70, autoAlpha: 0, duration: 3.2, ease: 'gravity' }, 1.8)
      .to('.scrollcue', { autoAlpha: 0, duration: 1.4 }, 0.6);
    qa('.chip').forEach((c, i) => tl.to(c, { x: (i % 2 ? 1 : -1) * 90, y: (i < 2 ? -1 : 1) * 50, z: '+=180', autoAlpha: 0, duration: 3, ease: 'gravity' }, 0.6 + i * 0.25));
    chapIn(0, 6);

    // ── 01 kratos
    swap('term', 'k1', 9.8);
    pose(10, 1.2, 0.6);
    lightLines('k1', 13.4, 2.2);
    cardIn('k1', 12);
    tl.fromTo(qa('[data-sc="k1"] .bm'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, stagger: 0.35 }, 12.8)
      .fromTo(qa('[data-sc="k1"] .bm i'), { scaleX: 0 }, { scaleX: 1, duration: 2, ease: 'springLand', stagger: 0.35 }, 13);
    cardOut('k1', 21.4);
    swap('k1', 'k2', 21.8);
    cardIn('k2', 24);
    lightLines('k2', 25.2, 1.1);
    tl.fromTo(qa('[data-sc="k2"] .why__row'), { autoAlpha: 0, x: 10, '--g': 0 }, { autoAlpha: 1, x: 0, '--g': 1, duration: 2, ease: 'springLand', stagger: 0.9 }, 26.2)
      .fromTo(qa('[data-sc="k2"] .why__row em'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, stagger: 0.9 }, 28.6);
    cardOut('k2', 33.4);
    swap('k2', 'k3', 33.8);
    cardIn('k3', 36);
    lightLines('k3', 37, 1.3);
    tl.fromTo(qa('[data-sc="k3"] .drift i'), { scaleX: 0 }, { scaleX: 1, duration: 2, ease: 'springLand', stagger: 0.8 }, 37.4);
    cardOut('k3', 46.4);
    glow('rust', 6);

    // ── 02 bluee-harness
    chapOut(0, 47); chapIn(1, 48);
    pose(47, -1.2, 0.6);
    const winW = () => win.offsetWidth, sideW = () => q('.side').offsetWidth;
    const FRAME = '.win, .win-shadow, .keylight';
    tl.to(FRAME, { x: () => (wide() ? sideW() + 26 : 0), duration: 4.2, ease: 'springHeavy' }, 46.6)
      .to('.side', { x: () => (wide() ? -(winW() + 26) : 0), duration: 4.2, ease: 'springHeavy' }, 46.6)
      .to(FRAME, { x: 0, duration: 3.4, ease: 'springHeavy' }, 72.4)
      .to('.side', { x: 0, duration: 3.4, ease: 'springHeavy' }, 72.4);
    swap('k3', 'b1', 47.8);
    tl.fromTo(qa('[data-pane="b1"] .ln'), { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 1.2, ease: 'springSoft', stagger: 0.75 }, 49.2);
    cardIn('b1', 50.4);
    rows('[data-sc="b1"] .ly', 51.2, 0.7);
    cardOut('b1', 59.4);
    swap('b1', 'b2', 59.8);
    cardIn('b2', 62);
    lightLines('b2', 62.6, 1.2);
    rows('[data-sc="b2"] .math', 62.8, 0.6);
    const mm = { a: 0, r: 0 }, mA = q('[data-mcount]'), mR = q('[data-mres]');
    tl.to(mm, { a: 100000, duration: 2.4, ease: 'springSettle', onUpdate: () => { mA.textContent = Math.round(mm.a).toLocaleString('en-US'); } }, 63)
      .to(mm, { r: 153.6, duration: 2.2, ease: 'springSettle', onUpdate: () => { mR.textContent = mm.r.toFixed(1) + ' MB'; } }, 65.4);
    cardOut('b2', 72.4);
    glow('blue', 47);

    // ── 03 snarevec: the space leaves the window, then the code that keeps it honest
    chapOut(1, 73); chapIn(2, 74);
    pose(73, -3, 2);
    swap('b2', 'space', 73.8);
    tl.fromTo(win, { '--wa': 1 }, { '--wa': 0.1, duration: 3, ease: 'springSettle' }, 74.6)
      .to(win, { '--wa': 1, duration: 2, ease: 'springSettle' }, 88.8);
    tl.fromTo('#space, .space-labels', { autoAlpha: 0 }, { autoAlpha: 1, duration: 3, ease: 'springSettle' }, 75)
      .fromTo('.space__route', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 2.2, ease: 'springSoft' }, 80)
      .to('#space, .space-labels, .space__route', { autoAlpha: 0, duration: 2, ease: 'gravity' }, 88.6);
    const sp = { p: 0 };
    tl.to(sp, { p: 1, duration: 14, ease: 'none', onUpdate: () => window.SpaceViz && window.SpaceViz.setProgress(sp.p) }, 75);
    cardIn('s1', 78);
    rows('[data-sc="s1"] .ix', 78.8, 0.6);
    cardOut('s1', 88.4);
    swap('space', 's2', 89.8);
    cardIn('s2', 92);
    lightLines('s2', 92.6, 0.7);
    rows('[data-sc="s2"] .probe, [data-sc="s2"] .sc__honest', 93, 1.1);
    cardOut('s2', 102.4);
    glow('green', 73);

    // ── 04 nyx-nvim: the client API, then go-to-definition over MCP
    chapOut(2, 103); chapIn(3, 104);
    pose(103, 1.2, 0.6);
    const centreX = () => (wide() ? (stage.clientWidth - winW()) / 2 : 0);
    tl.to(FRAME, { x: centreX, y: () => (wide() ? -54 : 0), duration: 4.2, ease: 'springHeavy' }, 102.8);
    swap('s2', 'n2', 103.8);
    lightLines('n2', 106, 1.4);
    tl.fromTo(sc('n2'), { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 2.4, ease: 'springLand' }, 107.2)
      .fromTo(qa('[data-sc="n2"] .ct'), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 1.8, ease: 'springSoft', stagger: 0.7 }, 107.8)
      .to(sc('n2'), { autoAlpha: 0, y: 30, duration: 1.3, ease: 'gravity' }, 127.4);
    glow('blue', 103);

    // ── 05 how I work
    chapOut(3, 129); chapIn(4, 130);
    pose(129, 0, 0);
    tl.to('.win, .win-depth, .win-shadow, .keylight', { autoAlpha: 0, y: 40, scale: 0.94, duration: 2.2, ease: 'gravity' }, 129.2)
      .fromTo('.principles', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 130.6)
      .fromTo(qa('.principles li'), { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 2.4, ease: 'springSoft', stagger: 1.1 }, 130.8)
      .fromTo(qa('.limits > *'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 2, ease: 'springSettle', stagger: 0.6 }, 136);
    glow('rust', 129);
    tl.to({}, { duration: 0.01 }, END);
  };

  /* ── everything that can't be tweened, derived from the playhead (so it rewinds exactly) */
  let lastS = -2, lastP = '';
  const hud = () => {
    const t = tl.time();
    if (depth.style.transform !== win.style.transform) depth.style.transform = win.style.transform;
    let s = -1;
    for (let i = 0; i < CHIN.length; i++) if (t >= CHIN[i]) s = i;
    if (s !== lastS) {
      lastS = s;
      clock.innerHTML = s < 0 ? '<b>00</b><span class="t-dim">/ 05 · scroll to begin</span>'
        : `<b>${String(s + 1).padStart(2, '0')}</b><span class="t-dim">/ 05 · ${NAME[s]}</span>`;
    }
    let pk = 'term';
    for (const [at, k] of PANES) if (t >= at) pk = k;
    if (pk !== lastP) {
      lastP = pk;
      const p = pane(pk);
      app.textContent = p.dataset.app; cmd.textContent = p.dataset.file;
      meta.textContent = p.dataset.meta || (pk === 'space' ? '● searching' : pk === 'b1' ? '● tail -f' : '● reading');
    }
    rail.forEach((r, i) => {
      const v = gsap.utils.clamp(0, 1, (t - SC[i][0]) / (SC[i][1] - SC[i][0])).toFixed(2);
      if (r.__p !== v) { r.__p = v; r.style.setProperty('--p', v); }
    });
  };
  tl.eventCallback('onUpdate', hud);

  /* ── page-load intro (time-based, before any scroll) */
  const intro = () => {
    gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 })
      .from('.intro .ln > span', { yPercent: 108, duration: 1.5, stagger: 0.11 })
      .to('.mark path', { strokeDashoffset: 0, duration: 1.2, ease: 'power3.inOut' }, 0.8)
      .from('.intro .eyebrow, .intro__sub, .intro__cta > *, .intro__facts li', { y: 22, autoAlpha: 0, duration: 1.2, stagger: 0.06 }, 0.35)
      .from(win, { autoAlpha: 0, duration: 1.8, ease: 'power2.out' }, 0.25)
      .from('.t-first', { autoAlpha: 0, duration: 0.8 }, 1.1)
      .fromTo(qa('.pane--term .t-row'), { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out', stagger: 0.16 }, 1.6)
      .from('.hud, .scrollcue', { autoAlpha: 0, duration: 1 }, 1.4);

  };

  /* The stage is a physical object. Two inputs push on it:
       · the pointer — it turns a few degrees toward you;
       · scroll velocity — it has inertia, so a hard scroll tips it back and drags it,
         and it springs home when you stop. No easing curve anywhere: just F = −kx − cv. */
  const physics = () => {
    const P = window.Phys; if (!P) return;
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const rx = new P.Spring({ stiffness: 90, damping: 13, mass: 1.2 });   // ζ ≈ 0.63: it sways, once
    const ry = new P.Spring({ stiffness: 90, damping: 13, mass: 1.2 });
    const ty = new P.Spring({ stiffness: 120, damping: 15, mass: 1.2 });
    let px = 0, py = 0;
    if (fine) addEventListener('pointermove', (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; }, { passive: true });
    let t = 0;
    gsap.ticker.add((time, dt) => {
      const s = dt / 1000; t += s;
      const v = window.__lenis ? window.__lenis.velocity : 0;           // px per frame, signed
      const kick = Math.max(-1, Math.min(1, v / 40));                     // saturates: a fling is a fling
      rx.target = -py * 3.2 + kick * 5.5;                                 // scroll down → top tips away
      ry.target = px * 4.5;
      ty.target = -kick * 16 + Math.sin(t * 1.35) * 4;                    // inertia + a slow breath
      rx.step(s); ry.step(s); ty.step(s);
      stage.style.transform = `perspective(1800px) translate3d(0,${ty.x.toFixed(2)}px,0) rotateX(${rx.x.toFixed(3)}deg) rotateY(${ry.x.toFixed(3)}deg)`;
    });
    // orbit chips respond by depth: nearer ones move further, like real parallax
    const chips = qa('.chip').map((el) => ({ el, z: parseFloat(el.style.getPropertyValue('--z')) || 0,
      sx: new P.Spring({ stiffness: 70, damping: 9 }), sy: new P.Spring({ stiffness: 70, damping: 9 }) }));
    gsap.ticker.add((time, dt) => {
      const s = dt / 1000;
      chips.forEach((c) => {
        c.sx.target = px * c.z * 0.18; c.sy.target = py * c.z * 0.12;
        c.sx.step(s); c.sy.step(s);
        c.el.style.translate = `${c.sx.x.toFixed(2)}px ${c.sy.x.toFixed(2)}px`;   // separate from the timeline's transform
      });
    });
  };

  const start = () => {
    build();
    const st = ScrollTrigger.create({
      trigger: story, start: 'top top', end: 'bottom bottom', scrub: 1, animation: tl, invalidateOnRefresh: true,
      // after invalidate, a timeline at the same time isn't re-rendered; nudge it so t=0 states draw again
      onRefresh: () => { const t = tl.time(); tl.time(t + 0.001, true); tl.time(t, true); hud(); },
    });
    window.__storyBegin = () => st.start + (st.end - st.start) * (10.4 / END);
    window.__storyEND = END;
    physics();
    intro();
    hud();
  };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(start);
})();
