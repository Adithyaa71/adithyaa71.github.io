/* stack.js · scroll-scrubbed build of the stack diagram. */
(function () {
  'use strict';
  var gsap = window.gsap, ST = window.ScrollTrigger;
  var sec = document.getElementById('stack');
  if (!gsap || !ST || !sec) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ST);

  function build(svg, stage) {
    var q = function (s, el) { return Array.prototype.slice.call((el || svg).querySelectorAll(s)); };
    var agent = svg.querySelector('.stk-agent');
    var edges = q('.stk-edge'), labels = q('.stk-elabel'), nodes = q('.stk-node > g'), dots = q('.stk-dot');
    var lens = edges.map(function (e) { return e.getTotalLength(); });
    var texts = labels.map(function (l) { return l.textContent; });

    gsap.set(agent, { opacity: 0, scale: 0.85, transformOrigin: '50% 50%' });
    nodes.forEach(function (n) { gsap.set(n, { opacity: 0, scale: 0.85, transformOrigin: '50% 50%' }); });
    edges.forEach(function (e, i) { gsap.set(e, { strokeDasharray: lens[i], strokeDashoffset: lens[i] }); });
    labels.forEach(function (l) { l.textContent = ''; });
    gsap.set(dots, { opacity: 0 });

    var tl = gsap.timeline({ defaults: { ease: 'none' } });
    tl.to(agent, { opacity: 1, scale: 1, duration: 1 }, 0);
    var STEP = 1.6;
    edges.forEach(function (e, i) {
      var t0 = 1 + i * STEP;
      tl.to(e, { strokeDashoffset: 0, duration: 0.9 }, t0);
      tl.to(nodes[i], { opacity: 1, scale: 1, duration: 0.6 }, t0 + 0.9);
      var st = { n: 0 }, last = 0, full = texts[i];
      tl.to(st, { n: full.length, duration: 0.7, onUpdate: function () {
        var c = Math.round(st.n);
        if (c !== last) { last = c; labels[i].textContent = full.slice(0, c); }
      } }, t0 + 0.9);
    });
    var t1 = 1 + edges.length * STEP + 0.2;
    dots.forEach(function (d, i) {
      var st = { p: 0 }, lx = -1, ly = -1, vis = 0;
      tl.to(st, { p: 1, duration: 1.4, onUpdate: function () {
        var p = st.p, v = p > 0 && p < 1 ? 1 : 0;
        if (v !== vis) { vis = v; d.style.opacity = v; }
        if (!v) return;
        var pt = edges[i].getPointAtLength(p * lens[i]);
        var x = Math.round(pt.x * 10) / 10, y = Math.round(pt.y * 10) / 10;
        if (x !== lx) { lx = x; d.setAttribute('cx', x); }
        if (y !== ly) { ly = y; d.setAttribute('cy', y); }
      } }, t1 + i * 0.45);
    });
    tl.to({}, { duration: 0.6 });

    var stt = ST.create({
      trigger: stage, start: 'top top', end: '+=150%', pin: true, anticipatePin: 1, scrub: 0.6, animation: tl, invalidateOnRefresh: true
    });
    return function () {
      stt.kill(); tl.kill();
      labels.forEach(function (l, i) { l.textContent = texts[i]; });
      gsap.set([agent].concat(nodes, edges, dots), { clearProps: 'all' });
    };
  }

  var mm = gsap.matchMedia();
  mm.add('(min-width: 761px)', function () {
    return build(sec.querySelector('.stk-svg--wide'), sec.querySelector('.stk-stage'));
  });
  mm.add('(max-width: 760px)', function () {
    return build(sec.querySelector('.stk-svg--tall'), sec.querySelector('.stk-stage'));
  });
})();
