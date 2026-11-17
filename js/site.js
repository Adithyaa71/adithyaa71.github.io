/* site.js · Aditya Ummadi v2
   Scroll drives everything; physics does the rest. Nothing here is a canned easing curve:
   letters and slabs are Matter.js rigid bodies, the films are pre-rendered frames scrubbed by scroll,
   and the springs come from physics.js. Scroll motion stays on under prefers-reduced-motion,
   because scrolling is the visitor's own input; only the idle pulse stops. */
(() => {
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const root = document.documentElement;
  if (!window.gsap || !window.ScrollTrigger) { root.classList.add('ready'); return; }
  gsap.registerPlugin(ScrollTrigger);
  const portrait = () => innerHeight > innerWidth * 1.0;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── smooth scroll, one clock */
  const lenis = window.Lenis ? new Lenis({ lerp: 0.085, smoothWheel: true }) : null;
  if (lenis) {
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    qa('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const t = q(a.getAttribute('href')); if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.6 }); } }));
  }

  /* ── films: frames on a canvas, scrubbed by scroll */
  class Film {
    constructor(sec) {
      this.sec = sec; this.name = sec.dataset.film; this.n = +sec.dataset.frames;
      this.cv = q('canvas', sec); this.c = this.cv.getContext('2d');
      this.caps = qa('.cap', sec).map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out, v: -1 }));
      this.imgs = []; this.cur = -1; this.want = 0; this.o = portrait() ? 'p' : 'l';
      this.size();
    }
    src(i) { return `frames/${this.name}/${this.o}/${String(i).padStart(4, '0')}.webp`; }
    get(i) {
      if (!this.imgs[i]) {
        const im = new Image(); im.decoding = 'async'; im.src = this.src(i); this.imgs[i] = im;
        // decode off the main thread before a frame counts as loaded, so scrubbing never stalls on a decode
        im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { im.__ok = true; if (Math.abs(i - this.want) < 3) this.draw(this.want, true); });
      }
      return this.imgs[i];
    }
    loadAll() {                                  // a 6-wide queue through every frame, first ones first
      if (this.started) return; this.started = true;
      let i = 0; const next = () => { if (i >= this.n) return; const im = this.get(i++); if (im.complete) next(); else im.addEventListener('load', next, { once: true }), im.addEventListener('error', next, { once: true }); };
      for (let k = 0; k < 6; k++) next();
    }
    loaded(i) { const im = this.imgs[i]; return im && im.__ok && im.naturalWidth; }
    size() {
      const dpr = Math.min(devicePixelRatio || 1, 1.6);
      this.cv.width = Math.round(innerWidth * dpr); this.cv.height = Math.round(innerHeight * dpr);
      const o = portrait() ? 'p' : 'l';
      if (o !== this.o) { this.o = o; this.imgs = []; this.started = false; if (this.near) this.loadAll(); }
      this.cur = -1; this.draw(this.want, true);
    }
    draw(i, force) {
      this.want = i;
      if (i === this.cur && !force) return;
      let k = i; while (k >= 0 && !this.loaded(k)) k--;           // nearest frame we already have
      if (k < 0) { k = i; while (k < this.n && !this.loaded(k)) k++; if (k >= this.n) { this.get(i); return; } }
      for (let d = 1; d <= 5; d++) if (i + d < this.n) this.get(i + d);   // look ahead
      const im = this.imgs[k], W = this.cv.width, H = this.cv.height;
      // landscape: cover. portrait: fit the width and sit on the bottom edge, so nothing at the sides is cut
      const s = this.o === 'p' ? W / im.naturalWidth : Math.min(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;   // contain: no film ever crops at an edge
      this.c.fillStyle = '#0E0F11'; this.c.fillRect(0, 0, W, H);
      // portrait frames keep their scene in the lower 53%: lift it to sit just under the caption
      this.c.drawImage(im, (W - w) / 2, this.o === 'p' ? Math.min(H - h, H * 0.34 - 0.45 * h) : (H - h) / 2, w, h);
      this.cur = k === i ? i : -1;
    }
    update(p) {
      const f = Math.min(this.n - 1, Math.round(clamp(p / 0.86) * (this.n - 1)));   // the last 14% holds the final frame
      this.draw(f);
      for (const c of this.caps) {
        const a = (c.a === 0 ? 1 : ss((f - c.a) / 6)) * (c.b >= this.n ? 1 : 1 - ss((f - c.b + 6) / 6));   // the last caption stays through the hold
        const v = Math.round(a * 100) / 100;
        if (v !== c.v) { c.v = v; c.el.style.opacity = v; c.el.style.transform = `translate3d(0,${((1 - v) * 26).toFixed(1)}px,0)`; c.el.style.visibility = v ? 'visible' : 'hidden'; }
      }
    }
  }
  const films = qa('.film').map((sec) => {
    const film = new Film(sec);
    // frames load about two screens ahead and are released two screens behind, so decoded memory stays bounded to ~2 films
    const unload = () => { film.near = false; film.imgs.forEach((im) => { if (im) { im.onload = null; im.src = ''; } }); film.imgs = []; film.started = false; film.cur = -1; };
    ScrollTrigger.create({ trigger: sec, start: 'top 250%', end: 'bottom -150%', onEnter: () => { film.near = true; film.loadAll(); }, onEnterBack: () => { film.near = true; film.loadAll(); }, onLeave: unload, onLeaveBack: unload });
    ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (st) => film.update(st.progress), onRefresh: (st) => film.update(st.progress) });
    film.update(0);
    return film;
  });
  addEventListener('resize', () => films.forEach((f) => f.size()));

  /* ── loader: counts real frames of the first film, then the field splits open on a spring */
  const first = films[0], counter = q('[data-load]');
  first.near = true; first.loadAll();
  const need = 24; let shown = 0, opened = false;
  const open = () => {
    if (opened) return; opened = true;
    gsap.timeline({ onComplete: () => root.classList.add('ready') })
      .to('.loader__n, .loader__k', { autoAlpha: 0, duration: 0.35, ease: 'gravity' })
      .to('.loader__top', { yPercent: -101, duration: 1.1, ease: 'springSoft' }, 0.2)
      .to('.loader__bot', { yPercent: 101, duration: 1.1, ease: 'springSoft' }, 0.2);
    startName();
  };
  const tick = () => {
    let got = 0; for (let i = 0; i < need; i++) if (first.loaded(i)) got++;
    const target = Math.round((got / need) * 100);
    shown += (target - shown) * 0.25; if (target - shown < 0.6) shown = target;
    counter.textContent = String(Math.round(shown)).padStart(3, '0');
    if (Math.round(shown) >= 100) { setTimeout(open, 180); return; }
    requestAnimationFrame(tick);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(tick));
  setTimeout(open, 9000);                                           // a slow network never traps the page

  /* ── S1 · the name is physical */
  function startName() {
    const M = window.Matter, world = q('.me__world');
    if (!M || !world) { root.classList.remove('physics'); return; }
    root.classList.add('physics');
    const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Constraint } = M;
    const eng = Engine.create({ gravity: { x: 0, y: 1.15 } });
    // one line on a wide screen; on a phone, two lines, the top one resting on a ledge only it can touch
    const rows = portrait() ? ['ADITYA', 'UMMADI'] : ['ADITYA UMMADI'];
    if (rows.length > 1) world.classList.add('two');
    let W = innerWidth, H = innerHeight;
    const floorY = H * (portrait() ? 0.55 : 0.6);
    const L = [], extra = [];
    rows.forEach((word, ri) => {
      // lay the letters out once as text, to find each one's slot and size
      const probe = document.createElement('div'); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:0;top:0';
      world.appendChild(probe);
      [...word].forEach((ch) => { const s = document.createElement('span'); s.className = 'l'; s.style.position = 'relative'; s.textContent = ch; probe.appendChild(s); });
      const rects = qa('.l', probe).map((s) => s.getBoundingClientRect());
      probe.remove();
      const total = rects.reduce((a, r) => a + r.width, 0), rowH = rects[0].height * 0.8;
      const baseY = floorY - (rows.length - 1 - ri) * rowH;
      const top = ri < rows.length - 1;
      if (top) extra.push(Bodies.rectangle(W / 2, baseY + 6, W * 0.96, 12, { isStatic: true, collisionFilter: { category: 0x0002, mask: 0x0004 } }));
      let x0 = (W - total) / 2;
      [...word].forEach((ch, i) => {
        const r = rects[i]; const cx = x0 + r.width / 2; x0 += r.width;
        if (ch === ' ') return;
        const el = document.createElement('span'); el.className = 'l'; el.textContent = ch; world.appendChild(el);
        const bw = r.width * 0.72, bh = r.height * 0.74;
        const filt = top ? { category: 0x0004, mask: 0xFFFF & ~0x0008 } : { category: 0x0008, mask: 0xFFFF & ~0x0002 & ~0x0004 };   // each line only meets itself
        const b = Bodies.rectangle(cx, -bh - (i + ri * 6) * 55 - Math.random() * 60, bw, bh, { restitution: 0.24, friction: 0.7, frictionAir: 0.05, density: 0.0018, chamfer: { radius: 3 }, angle: (Math.random() - 0.5) * 0.16, collisionFilter: filt });
        Body.setInertia(b, b.inertia * 6);                              // heavy to tip: letters land upright, but a fling still spins them
        // a soft spring from each letter to its slot: it falls, bounces, can be flung, and finds its place again
        const tie = Constraint.create({ pointA: { x: cx, y: baseY - bh / 2 }, bodyB: b, length: 0, stiffness: 0.02, damping: 0.16 });
        L.push({ el, b, w: r.width, h: r.height, slot: cx, bh, tie, tied: false });
      });
    });
    const floor = Bodies.rectangle(W / 2, floorY + 40, W * 3, 80, { isStatic: true, friction: 0.6 });
    const wallL = Bodies.rectangle(-40, H / 2, 80, H * 4, { isStatic: true });
    const wallR = Bodies.rectangle(W + 40, H / 2, 80, H * 4, { isStatic: true });
    Composite.add(eng.world, [floor, wallL, wallR, ...extra, ...L.map((o) => o.b)]);
    if (fine) {
      const mouse = Mouse.create(world);
      mouse.element.removeEventListener('wheel', mouse.mousewheel); mouse.element.removeEventListener('mousewheel', mouse.mousewheel); mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);
      const mc = MouseConstraint.create(eng, { mouse, constraint: { stiffness: 0.18, damping: 0.08 } });
      Composite.add(eng.world, mc);
    }
    let p = 0, active = true, lastKick = 0;
    ScrollTrigger.create({ trigger: '.me', start: 'top top', end: 'bottom bottom', onUpdate: (st) => { p = st.progress; }, onToggle: (st) => { active = st.isActive || st.progress < 1; } });
    ScrollTrigger.create({ trigger: '.me', start: 'top bottom', end: 'bottom top', onToggle: (st) => { active = st.isActive; } });
    gsap.ticker.add((t, dt) => {
      if (!active) return;
      // the floor tips once you scroll on, and the name slides out of the frame; scroll back and it drops in again
      const tilt = ss((p - 0.3) / 0.38) * 0.55;
      Body.setAngle(floor, tilt); Body.setPosition(floor, { x: W / 2, y: floorY + 40 + tilt * 120 }); extra.forEach((e) => Body.setAngle(e, tilt));
      Body.setPosition(wallR, { x: tilt > 0.02 ? W + 4000 : W + 40, y: H / 2 });
      const v = lenis ? lenis.velocity : 0;
      if (Math.abs(v) > 9 && t - lastKick > 0.35 && p < 0.3) {       // a hard scroll is a shove
        lastKick = t;
        L.forEach((o) => Body.setVelocity(o.b, { x: o.b.velocity.x + (Math.random() - 0.5) * 6, y: o.b.velocity.y - Math.min(14, Math.abs(v) * 0.5) }));
      }
      L.forEach((o) => {                                            // ties hold while the floor is level
        const want = tilt < 0.02;
        if (want !== o.tied) { o.tied = want; if (want) Composite.add(eng.world, o.tie); else Composite.remove(eng.world, o.tie); }
      });
      Engine.update(eng, Math.min(dt, 34));
      L.forEach((o) => {
        if (p < 0.3 && o.b.position.y > H + 400) {                       // lost off-screen: respawn above its slot
          Body.setPosition(o.b, { x: o.slot, y: -o.bh - Math.random() * 300 }); Body.setVelocity(o.b, { x: 0, y: 0 }); Body.setAngle(o.b, (Math.random() - 0.5) * 0.16); Body.setAngularVelocity(o.b, 0);
        }
        const { x, y } = o.b.position;
        o.el.style.transform = `translate3d(${(x - o.w / 2).toFixed(1)}px,${(y - o.h / 2 - o.h * 0.06).toFixed(1)}px,0) rotate(${o.b.angle.toFixed(4)}rad)`;
      });
    });
    gsap.fromTo('.me__intro > *, .me__hint', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'springSoft', stagger: 0.12, delay: 0.9 });
    gsap.to('.me__intro, .me__hint', { autoAlpha: 0, y: -40, ease: 'none', scrollTrigger: { trigger: '.me', start: '30% top', end: '60% top', scrub: true } });
  }

  /* ── S2 · statements, lit word by word */
  const says = qa('.say__s').map((s) => {
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) { const frag = document.createDocumentFragment(); n.textContent.split(/(\s+)/).forEach((t) => { if (!t) return; if (/^\s+$/.test(t)) frag.append(t); else { const w = document.createElement('span'); w.className = 'w'; w.textContent = t; frag.append(w); } }); n.replaceWith(frag); }
      else walk(n);
    });
    walk(s); return { s, w: qa('.w', s) };
  });
  const bar = q('.say__bar i');
  ScrollTrigger.create({ trigger: '.say', start: 'top top', end: 'bottom bottom', onUpdate: (st) => {
    const p = st.progress; bar.style.transform = `scaleX(${p.toFixed(4)})`; bar.parentNode.style.opacity = (1 - ss((p - 0.95) / 0.05)).toFixed(3);
    says.forEach(({ s, w }, i) => {
      const t = p * 3 - i;                                             // 0 → 1 across this statement's third
      const vis = ss(t / 0.08) * (1 - ss((t - 0.9) / 0.1));
      s.style.opacity = vis.toFixed(3);
      s.style.transform = `translate3d(0,${((1 - ss(t / 0.12)) * 40 - ss((t - 0.9) / 0.1) * 40).toFixed(1)}px,0)`;
      const lit = clamp((t - 0.06) / 0.7) * w.length;
      w.forEach((el, j) => { const o = 0.13 + 0.87 * clamp(lit - j); if (el.__o !== o) { el.__o = o; el.style.opacity = o.toFixed(3); } });
    });
  } });

  /* ── S7 · the principles drop, one per stretch of scroll, and stack */
  (() => {
    const M = window.Matter, worldEl = q('.how__world'); if (!M || !worldEl) return;
    const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint } = M;
    const eng = Engine.create({ gravity: { x: 0, y: 1.3 } });
    const slabs = qa('.slab'); let W = innerWidth, H = innerHeight;
    const floor = Bodies.rectangle(W / 2, (portrait() ? H * 0.6 : H - 40) + 40, W * 2, 80, { isStatic: true, friction: 0.8 });   // on a phone the stack stops above the limits text
    const walls = [Bodies.rectangle(-40, H / 2, 80, H * 3, { isStatic: true }), Bodies.rectangle(W + 40, H / 2, 80, H * 3, { isStatic: true })];
    Composite.add(eng.world, [floor, ...walls]);
    const S = slabs.map((el, i) => {
      el.style.visibility = 'hidden'; const r = el.getBoundingClientRect();
      const x = portrait() ? W / 2 + (i % 2 ? 20 : -20) : W * (0.3 + 0.12 * i);
      return { el, w: r.width, h: r.height, x, b: null, i };
    });
    if (fine) {
      const mouse = Mouse.create(worldEl);
      mouse.element.removeEventListener('wheel', mouse.mousewheel); mouse.element.removeEventListener('mousewheel', mouse.mousewheel); mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);
      Composite.add(eng.world, MouseConstraint.create(eng, { mouse, constraint: { stiffness: 0.15, damping: 0.1 } }));
    }
    let p = 0, active = false;
    const lim = q('.limits');
    ScrollTrigger.create({ trigger: '.how', start: 'top top', end: 'bottom bottom', onUpdate: (st) => { p = st.progress; } });
    ScrollTrigger.create({ trigger: '.how', start: 'top bottom', end: 'bottom top', onToggle: (st) => { active = st.isActive; } });
    gsap.ticker.add((t, dt) => {
      if (!active) return;
      S.forEach((o) => {
        const want = p > 0.08 + o.i * 0.16;
        if (want && !o.b) {
          o.b = Bodies.rectangle(o.x, -o.h - 40, o.w, o.h, { restitution: 0.18, friction: 0.7, density: 0.004, chamfer: { radius: 6 }, angle: (o.i % 2 ? 1 : -1) * 0.22 });
          Composite.add(eng.world, o.b); o.el.style.visibility = 'visible';
        } else if (!want && o.b) { Composite.remove(eng.world, o.b); o.b = null; o.el.style.visibility = 'hidden'; }
      });
      Engine.update(eng, Math.min(dt, 34));
      S.forEach((o) => { if (!o.b) return; const { x, y } = o.b.position; o.el.style.transform = `translate3d(${(x - o.w / 2).toFixed(1)}px,${(y - o.h / 2).toFixed(1)}px,0) rotate(${o.b.angle.toFixed(4)}rad)`; });
      const la = ss((p - 0.55) / 0.1); if (lim.__a !== la) { lim.__a = la; lim.style.opacity = la; lim.style.transform = `translate3d(0,${(1 - la) * 30}px,0)`; }
    });
  })();

  /* ── S8 · the index: names slide in with scroll; the film still follows the cursor on a spring */
  qa('.idx__list b').forEach((b, i) => gsap.fromTo(b, { x: (i % 2 ? 1 : -1) * (portrait() ? 36 : 120) }, { x: 0, ease: 'none', scrollTrigger: { trigger: b, start: 'top bottom', end: 'top 88%', scrub: true } }));
  const peek = q('.idx__peek'), pimg = q('.idx__peek img');
  if (fine && peek && window.Phys) {
    const px = new Phys.Spring({ stiffness: 140, damping: 16 }), py = new Phys.Spring({ stiffness: 140, damping: 16 }), pa = new Phys.Spring({ stiffness: 200, damping: 22 });
    let on = false;
    qa('.idx__list a').forEach((a) => {
      a.addEventListener('pointerenter', () => { on = true; pa.target = 1; if (!pimg.src.endsWith(a.dataset.img)) pimg.src = a.dataset.img; });
      a.addEventListener('pointerleave', () => { on = false; pa.target = 0; });
    });
    addEventListener('pointermove', (e) => { px.target = e.clientX + 30; py.target = e.clientY - 120; }, { passive: true });
    gsap.ticker.add((t, dt) => {
      const s = dt / 1000; px.step(s); py.step(s); pa.step(s);
      if (pa.x < 0.002 && !on) { if (peek.style.opacity !== '0') peek.style.opacity = 0; return; }
      const tilt = Math.max(-8, Math.min(8, px.v * 0.004));            // it leans into the motion, like a hanging card
      peek.style.opacity = pa.x.toFixed(3);
      peek.style.transform = `translate3d(${px.x.toFixed(1)}px,${py.x.toFixed(1)}px,0) rotate(${tilt.toFixed(2)}deg) scale(${(0.85 + 0.15 * pa.x).toFixed(3)})`;
    });
  }

  /* ── contact: a magnetic link on a spring, copy-to-clipboard */
  const mail = q('.mail');
  if (fine && window.Phys && mail) {
    const sx = new Phys.Spring({ stiffness: 220, damping: 13 }), sy = new Phys.Spring({ stiffness: 220, damping: 13 });
    mail.addEventListener('pointermove', (e) => { const r = mail.getBoundingClientRect(); sx.target = (e.clientX - r.left - r.width / 2) * 0.18; sy.target = (e.clientY - r.top - r.height / 2) * 0.3; });
    mail.addEventListener('pointerleave', () => { sx.target = 0; sy.target = 0; });
    gsap.ticker.add((t, dt) => { sx.step(dt / 1000); sy.step(dt / 1000); mail.style.transform = `translate3d(${sx.x.toFixed(2)}px,${sy.x.toFixed(2)}px,0)`; });
  }
  qa('[data-copy]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1600); } catch (e) { /* clipboard blocked: the mailto still works */ } }));
  gsap.fromTo('.hi__h, .hi__row, .steps li', { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1.6, ease: 'springSoft', stagger: 0.1, scrollTrigger: { trigger: '.hi', start: 'top 70%' } });

  window.__ready = true;
})();
