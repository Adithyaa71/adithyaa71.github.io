/* app.js — shared behaviour outside the pinned story: smooth scroll, nav,
   reveals, magnetic buttons, tilt + spotlight, marquee, copy. */
(() => {
  const root = document.documentElement;
  const reduce = !!window.AU_RM;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);

  const copy = document.querySelector('.copy');
  if (copy && navigator.clipboard) {
    copy.addEventListener('click', () => navigator.clipboard.writeText(copy.dataset.copy).then(() => {
      const was = copy.textContent;
      copy.textContent = 'Copied ✓'; copy.classList.add('is-done');
      setTimeout(() => { copy.textContent = was; copy.classList.remove('is-done'); }, 1800);
    }));
  }

  if (!hasGSAP) { root.classList.remove('motion'); root.classList.add('no-gsap'); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* smooth scroll: Lenis drives the wheel, GSAP's ticker drives Lenis */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.95 });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const go = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.8 }) : scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 && document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    // the walkthrough's own hero is chapter zero; "#story" means chapter one
    if (id === '#story' && window.__storyBegin) go(window.__storyBegin());
    else go(el.getBoundingClientRect().top + scrollY - (id === '#top' ? 0 : 70));
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  /* nav: away on the way down, back on the way up; progress hairline */
  const nav = document.getElementById('nav');
  const bar = nav.querySelector('.nav__progress i');
  let last = 0;
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => {
    const y = self.scroll();
    if (y > last + 4 && y > 260) nav.classList.add('is-hidden'); else if (y < last - 4 || y < 260) nav.classList.remove('is-hidden');
    last = y; bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
  } });
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  if (reduce) return;

  /* reveals below the story */
  gsap.utils.toArray('[data-split]').forEach((h) => gsap.to(h.querySelectorAll('.ln > span'),
    { y: 0, yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: h, start: 'top 82%', once: true } }));
  gsap.utils.toArray('.systems .eyebrow, .contact .eyebrow, .contact__row, .contact__alt').forEach((el) =>
    gsap.from(el, { y: 24, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 100%', once: true } }));
  gsap.from('.repos li', { y: 40, opacity: 0, duration: 1.6, ease: 'springSoft', stagger: 0.1,
    scrollTrigger: { trigger: '.repos', start: 'top 85%', once: true } });

  if (fine) {
    // magnetic: the button is on a spring anchored at its rest position. Pull it, let go, it snaps back and wobbles.
    const live = [];
    const P = window.Phys;
    gsap.utils.toArray('.magnetic').forEach((el) => {
      const sx = new P.Spring({ stiffness: 260, damping: 14 }), sy = new P.Spring({ stiffness: 260, damping: 14 });   // ζ ≈ 0.43
      el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); sx.target = (e.clientX - r.left - r.width / 2) * 0.3; sy.target = (e.clientY - r.top - r.height / 2) * 0.4; });
      el.addEventListener('pointerleave', () => { sx.target = 0; sy.target = 0; });
      live.push((s) => { if (sx.resting && sy.resting) return; sx.step(s); sy.step(s); el.style.translate = `${sx.x.toFixed(2)}px ${sy.x.toFixed(2)}px`; });
    });
    gsap.utils.toArray('.tilt').forEach((el) => {
      const rx = new P.Spring({ stiffness: 160, damping: 16 }), ry = new P.Spring({ stiffness: 160, damping: 16 });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
        ry.target = (px - 0.5) * 10; rx.target = -(py - 0.5) * 10;
      });
      el.addEventListener('pointerleave', () => { rx.target = 0; ry.target = 0; });
      live.push((s) => { if (rx.resting && ry.resting) return; rx.step(s); ry.step(s); el.style.rotate = 'none';
        el.style.transform = `perspective(900px) rotateX(${rx.x.toFixed(3)}deg) rotateY(${ry.x.toFixed(3)}deg)`; });
    });
    gsap.ticker.add((t, dt) => { const s = dt / 1000; live.forEach((f) => f(s)); });
  }

  /* marquee: constant drift, sped up and reversed by scroll velocity */
  const row = document.querySelector('[data-marq]');
  if (row) {
    row.innerHTML += row.innerHTML;
    let x = 0;
    const speed = new window.Phys.Spring({ stiffness: 40, damping: 12, value: -0.045 });
    gsap.ticker.add((t, dt) => {
      const v = lenis ? lenis.velocity : 0;
      speed.target = -0.045 - Math.max(-0.6, Math.min(0.6, v * 0.012));
      speed.step(dt / 1000);
      x += speed.x * dt;
      const half = row.scrollWidth / 2;
      if (x <= -half) x += half; if (x > 0) x -= half;
      row.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    });
  }
})();
