(function () {
  'use strict';
  var sec = document.getElementById('skills');
  var gsap = window.gsap;
  if (!sec || !gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(window.ScrollTrigger);

  var rows = Array.prototype.slice.call(sec.querySelectorAll('[data-sk-row]'));
  if (!rows.length) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var soft = 'power3.out';
  try {
    if (gsap.parseEase('springSoft')) soft = 'springSoft';
    if (gsap.parseEase('springSettle')) settle = 'springSettle';
  } catch (e) {}

  var inners = rows.map(function (r) { return r.querySelector('.sk__in'); });
  var FULL = 1, DIM = 0.6;

  // (1) rise on entry
  rows.forEach(function (row) {
    gsap.fromTo(row, { y: 40, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.1, ease: soft,
      scrollTrigger: { trigger: row, start: 'top 90%', once: true }
    });
  });

  // (2) scroll focus: nearest row to viewport centre is full, the rest dim
  var cur = -1, state = inners.map(function () { return -1; });
  function focus() {
    var mid = window.innerHeight / 2, best = 0, bd = Infinity;
    for (var i = 0; i < rows.length; i++) {
      var b = rows[i].getBoundingClientRect();
      var d = Math.abs(b.top + b.height / 2 - mid);
      if (d < bd) { bd = d; best = i; }
    }
    if (best === cur) return;
    cur = best;
    for (var j = 0; j < inners.length; j++) {
      var v = j === best ? FULL : DIM;
      if (state[j] === v) continue;
      state[j] = v;
      gsap.to(inners[j], { opacity: v, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
    }
  }
  gsap.set(inners, { opacity: DIM });
  window.ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: 'bottom top',
    onUpdate: focus, onRefresh: focus, onToggle: focus
  });
  focus();

  // (3) hover: evidence links slide on a spring (pointer devices only)
  var Phys = window.Phys;
  if (Phys && Phys.Spring && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var active = [], running = false, last = 0;
    var tick = function () {
      var now = performance.now(), dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      for (var i = active.length - 1; i >= 0; i--) {
        var a = active[i];
        a.sp.step(dt);
        var x = a.sp.resting ? a.sp.target : a.sp.x;
        if (x !== a.x) { a.x = x; a.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)'; }
        if (a.sp.resting) { a.on = false; active.splice(i, 1); }
      }
      if (!active.length) { gsap.ticker.remove(tick); running = false; }
    };
    var kick = function (a, target) {
      a.sp.target = target;
      if (!a.on) { a.on = true; active.push(a); }
      if (!running) { running = true; last = performance.now(); gsap.ticker.add(tick); }
    };
    rows.forEach(function (row) {
      var el = row.querySelector('[data-sk-ev]');
      if (!el) return;
      var a = { el: el, sp: new Phys.Spring({ stiffness: 170, damping: 19, mass: 1, value: 0 }), x: 0, on: false };
      row.addEventListener('pointerenter', function () { kick(a, 6); });
      row.addEventListener('pointerleave', function () { kick(a, 0); });
    });
  }
})();
