/* site.js · v3. Scroll drives the films; springs and rigid bodies do the rest. No canned easing:
   the eases come from physics.js (closed-form damped oscillators), the slabs are Matter.js bodies. */
(() => {
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ss = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  if (!window.gsap || !window.ScrollTrigger) { qa('.hero__h .ln > span, [data-rise]').forEach((e) => { e.style.transform = 'none'; e.style.opacity = 1; }); return; }
  gsap.registerPlugin(ScrollTrigger);
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => innerWidth < 900;
  const ease = (n) => (gsap.parseEase(n) ? n : 'power3.out');

  /* ── smooth scroll, one clock */
  const lenis = window.Lenis ? new Lenis({ lerp: 0.09, smoothWheel: true }) : null;
  if (lenis) {
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    qa('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const t = q(a.getAttribute('href')); if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.6 }); } }));
  }

  /* ── 01 · the intro sets itself on springs */
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => {
    gsap.to('.hero__h .ln > span', { y: 0, yPercent: 0, duration: 1.5, ease: ease('springSoft'), stagger: 0.09, delay: 0.1 });
    gsap.fromTo('.hero .label, .hero__row > *', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: ease('springSoft'), stagger: 0.1, delay: 0.45 });
    gsap.fromTo('.reel__w', { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: 1.6, ease: ease('springLand'), stagger: 0.08, delay: 0.7 });
  });
  qa('[data-rise]').filter((e) => !e.closest('.hero')).forEach((el) => gsap.to(el, { autoAlpha: 1, y: 0, duration: 1.3, ease: ease('springSoft'), scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
  gsap.to('.hero__in', { y: -80, autoAlpha: 0.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* ── frame sources: films are pre-rendered WebP sequences at 2× density */
  const frameUrl = (name, o, i) => `frames/${name}/${o}/${String(i).padStart(4, '0')}.webp`;
  const loadImg = (src, done) => {
    const im = new Image(); im.decoding = 'async'; im.src = src;
    im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { im.__ok = true; done && done(im); });
    return im;
  };

  /* ── the reel: each film loops at 12 fps from a thumbnail cut, while on screen */
  qa('.reel__w').forEach((w) => {
    const name = w.dataset.reel, cv = q('canvas', w), c = cv.getContext('2d');
    const N = +w.dataset.n || 0;
    const imgs = []; let on = false, i = 0, acc = 0, started = false;
    const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 3); cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); if (imgs[i]) draw(imgs[i]); };
    const draw = (im) => { if (im && im.__ok) c.drawImage(im, 0, 0, cv.width, cv.height); };
    size(); addEventListener('resize', size);
    const start = () => { if (started) return; started = true; for (let j = 0; j < N; j++) imgs[j] = loadImg(`frames/${name}/t/${String(j).padStart(3, '0')}.webp`, j === 0 ? draw : null); };
    ScrollTrigger.create({ trigger: w, start: 'top bottom', end: 'bottom top', onToggle: (st) => { on = st.isActive; if (on) start(); } });
    start();
    gsap.ticker.add((t, dt) => {
      if (!on || calm || !N) return;
      acc += dt; if (acc < 1000 / 12) return; acc = 0;
      const nx = (i + 1) % N; if (imgs[nx] && imgs[nx].__ok) { i = nx; draw(imgs[i]); }
    });
    if (fine && window.Phys) {                                         // it lifts toward the pointer, on a spring
      const sx = new Phys.Spring({ stiffness: 180, damping: 16 }), sy = new Phys.Spring({ stiffness: 180, damping: 16 }), sl = new Phys.Spring({ stiffness: 200, damping: 18 });
      w.addEventListener('pointermove', (e) => { const r = w.getBoundingClientRect(); sx.target = ((e.clientX - r.left) / r.width - 0.5) * 8; sy.target = ((e.clientY - r.top) / r.height - 0.5) * 8; sl.target = 1; });
      w.addEventListener('pointerleave', () => { sx.target = sy.target = sl.target = 0; });
      gsap.ticker.add((t, dt) => { const s = dt / 1000; sx.step(s); sy.step(s); sl.step(s); w.style.translate = `${sx.x.toFixed(2)}px ${(sy.x - sl.x * 8).toFixed(2)}px`; });
    }
  });

  /* ── 03 · case studies: each film scrubs with its own stretch of scroll */
  class Film {
    constructor(sec) {
      this.sec = sec; this.name = sec.dataset.film; this.n = +sec.dataset.frames;
      this.cv = q('canvas', sec); this.c = this.cv.getContext('2d'); this.fc = q('[data-fc]', sec); this.rail = q('.case__rail i', sec);
      this.beats = qa('.beat', sec).map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out, v: -1 }));
      this.imgs = []; this.cur = -1; this.want = 0; this.o = narrow() ? 'p' : 'l'; this.size();
    }
    get(i) { if (!this.imgs[i]) this.imgs[i] = loadImg(frameUrl(this.name, this.o, i), () => { if (Math.abs(i - this.want) < 3) this.draw(this.want, true); }); return this.imgs[i]; }
    loadAll() {
      if (this.started) return; this.started = true;
      let i = 0; const next = () => { if (i >= this.n || !this.started) return; const im = this.get(i++); im.addEventListener('load', next, { once: true }); im.addEventListener('error', next, { once: true }); };
      for (let k = 0; k < 6; k++) next();
    }
    unload() { this.imgs.forEach((im) => { if (im) { im.onload = null; im.src = ''; } }); this.imgs = []; this.started = false; this.cur = -1; }
    ok(i) { const im = this.imgs[i]; return im && im.__ok; }
    size() {
      const r = this.cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 3);
      this.cv.width = Math.max(1, Math.round(r.width * d)); this.cv.height = Math.max(1, Math.round(r.height * d));
      const o = narrow() ? 'p' : 'l'; if (o !== this.o) { this.o = o; this.unload(); if (this.near) this.loadAll(); }
      this.cur = -1; this.draw(this.want, true);
    }
    draw(i, force) {
      this.want = i; if (i === this.cur && !force) return;
      let k = i; while (k >= 0 && !this.ok(k)) k--;
      if (k < 0) { this.get(i); return; }
      for (let d = 1; d <= 5; d++) if (i + d < this.n) this.get(i + d);
      this.c.drawImage(this.imgs[k], 0, 0, this.cv.width, this.cv.height);   // the canvas has the frame's aspect: a straight fit
      this.cur = k === i ? i : -1;
    }
    update(p) {
      const f = Math.min(this.n - 1, Math.round(clamp(p / 0.86) * (this.n - 1)));
      this.draw(f);
      if (this.fc) { const t = String(f).padStart(3, '0') + ' / ' + (this.n - 1); if (this.fc.textContent !== t) this.fc.textContent = t; }
      if (this.rail) this.rail.style.transform = `scaleX(${clamp(p / 0.86).toFixed(4)})`;
      for (const b of this.beats) {
        const a = (b.a === 0 ? 1 : ss((f - b.a) / 6)) * (b.b >= this.n ? 1 : 1 - ss((f - b.b + 6) / 6));
        const v = Math.round(a * 100) / 100;
        if (v !== b.v) { b.v = v; b.el.style.opacity = v; b.el.style.visibility = v ? 'visible' : 'hidden'; b.el.style.transform = `translate3d(0,${((1 - v) * 14).toFixed(1)}px,0)`; }
      }
    }
  }
  const films = qa('.case').map((sec) => {
    const film = new Film(sec), card = q('.case__card', sec);
    const unload = () => { film.near = false; film.unload(); };
    ScrollTrigger.create({ trigger: sec, start: 'top 250%', end: 'bottom -150%', onEnter: () => { film.near = true; film.loadAll(); }, onEnterBack: () => { film.near = true; film.loadAll(); }, onLeave: unload, onLeaveBack: unload });
    ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (st) => film.update(st.progress), onRefresh: (st) => film.update(st.progress) });
    // the card's text arrives on springs; the window tilts up into place as the card scrolls in, and the card recedes as the next arrives
    gsap.fromTo(q('.case__spec', sec).children, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: ease('springSoft'), stagger: 0.07, scrollTrigger: { trigger: sec, start: 'top 70%', once: true } });
    gsap.fromTo(q('.win', sec), { y: 80, rotateX: 8, transformPerspective: 1400 }, { y: 0, rotateX: 0, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top top', scrub: true } });
    gsap.to(card, { scale: 0.94, autoAlpha: 0.35, ease: 'none', scrollTrigger: { trigger: sec, start: 'bottom 120%', end: 'bottom top', scrub: true } });
    film.update(0);
    return film;
  });
  addEventListener('resize', () => films.forEach((f) => f.size()));

  /* ── 05 · the principles drop, one per stretch of scroll, and stack (Matter.js rigid bodies) */
  (() => {
    const M = window.Matter, worldEl = q('.how__world'); if (!M || !worldEl) return;
    const { Engine, Bodies, Composite, Mouse, MouseConstraint } = M;
    const eng = Engine.create({ gravity: { x: 0, y: 1.3 } });
    const W = innerWidth, H = innerHeight, floorY = narrow() ? H * 0.74 : H * 0.8;
    Composite.add(eng.world, [Bodies.rectangle(W / 2, floorY + 40, W * 2, 80, { isStatic: true, friction: 0.8 }),
      Bodies.rectangle(-40, H / 2, 80, H * 3, { isStatic: true }), Bodies.rectangle(W + 40, H / 2, 80, H * 3, { isStatic: true })]);
    const S = qa('.slab').map((el, i) => { const r = el.getBoundingClientRect(); return { el, w: r.width, h: r.height, x: narrow() ? W / 2 + (i % 2 ? 18 : -18) : W * (0.38 + 0.09 * i), b: null, i }; });
    if (fine) {
      const mouse = Mouse.create(worldEl);
      ['wheel', 'mousewheel', 'DOMMouseScroll'].forEach((ev) => mouse.element.removeEventListener(ev, mouse.mousewheel));
      Composite.add(eng.world, MouseConstraint.create(eng, { mouse, constraint: { stiffness: 0.15, damping: 0.1 } }));
    }
    let p = 0, active = false; const lim = q('.limits');
    ScrollTrigger.create({ trigger: '.how', start: 'top top', end: 'bottom bottom', onUpdate: (st) => { p = st.progress; } });
    ScrollTrigger.create({ trigger: '.how', start: 'top bottom', end: 'bottom top', onToggle: (st) => { active = st.isActive; } });
    gsap.ticker.add((t, dt) => {
      if (!active) return;
      S.forEach((o) => {
        const want = p > 0.06 + o.i * 0.13;
        if (want && !o.b) { o.b = Bodies.rectangle(o.x, -o.h - 40, o.w, o.h, { restitution: 0.18, friction: 0.7, density: 0.004, chamfer: { radius: 8 }, angle: (o.i % 2 ? 1 : -1) * 0.2 }); Composite.add(eng.world, o.b); o.el.style.visibility = 'visible'; }
        else if (!want && o.b) { Composite.remove(eng.world, o.b); o.b = null; o.el.style.visibility = 'hidden'; }
      });
      Engine.update(eng, Math.min(dt, 34));
      S.forEach((o) => { if (!o.b) return; const { x, y } = o.b.position; o.el.style.transform = `translate3d(${(x - o.w / 2).toFixed(1)}px,${(y - o.h / 2).toFixed(1)}px,0) rotate(${o.b.angle.toFixed(4)}rad)`; });
      const la = ss((p - 0.55) / 0.12); if (lim.__a !== la) { lim.__a = la; lim.style.opacity = la; lim.style.transform = `translate3d(0,${(1 - la) * 26}px,0)`; }
    });
  })();

  /* ── 06 · contact: a magnetic address on a spring; copy */
  const mail = q('.mail');
  if (fine && window.Phys && mail) {
    const sx = new Phys.Spring({ stiffness: 220, damping: 13 }), sy = new Phys.Spring({ stiffness: 220, damping: 13 });
    mail.addEventListener('pointermove', (e) => { const r = mail.getBoundingClientRect(); sx.target = (e.clientX - r.left - r.width / 2) * 0.12; sy.target = (e.clientY - r.top - r.height / 2) * 0.3; });
    mail.addEventListener('pointerleave', () => { sx.target = 0; sy.target = 0; });
    gsap.ticker.add((t, dt) => { sx.step(dt / 1000); sy.step(dt / 1000); mail.style.transform = `translate3d(${sx.x.toFixed(2)}px,${sy.x.toFixed(2)}px,0)`; });
  }
  qa('[data-copy]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy address'), 1600); } catch (e) { /* the mailto link still works */ } }));
  gsap.fromTo('.hi__h, .hi__row, .steps li', { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 1.5, ease: ease('springSoft'), stagger: 0.09, scrollTrigger: { trigger: '.hi', start: 'top 70%', once: true } });

  document.documentElement.classList.add('ready');
  window.__ready = true;
})();
