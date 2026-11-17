/* space.js — chapter 05, drawn inside the window.
   Three embedding spaces as three clusters in real 3D. They never mix. A question
   arrives from the top of the frame, travels into exactly one of them, and its
   nearest neighbours light up while the other two spaces dim.
   Driven by story.js through window.SpaceViz.setProgress(0..1). */
import * as THREE from 'three';

const canvas = document.getElementById('space');
const host = canvas && canvas.parentElement;          // the stage: the space is allowed out of the window
const winEl = document.querySelector('.win');
if (canvas && !window.AU_RM) { try { init(); } catch (e) { console.warn('[space] WebGL unavailable', e); } }

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const g = () => { const u = Math.max(1e-6, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  const CL = [
    { c: new THREE.Vector3(-2.3, 0.9, -0.3), col: new THREE.Color(0x6aa6ff), spread: [0.9, 0.62, 0.75] },   // kb_text
    { c: new THREE.Vector3(2.1, 0.45, -0.5), col: new THREE.Color(0xff8a52), spread: [0.8, 0.72, 0.8] },    // kb_code
    { c: new THREE.Vector3(0.0, -1.55, 0.95), col: new THREE.Color(0x6af0ab), spread: [1.0, 0.52, 0.8] },   // kb_images
  ];
  const PER = 620, N = PER * CL.length;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), cid = new Float32Array(N), hi = new Float32Array(N);
  for (let k = 0; k < CL.length; k++) for (let i = 0; i < PER; i++) {
    const j = k * PER + i;
    pos[j * 3] = CL[k].c.x + g() * CL[k].spread[0] * 0.5;
    pos[j * 3 + 1] = CL[k].c.y + g() * CL[k].spread[1] * 0.5;
    pos[j * 3 + 2] = CL[k].c.z + g() * CL[k].spread[2] * 0.5;
    col[j * 3] = CL[k].col.r; col[j * 3 + 1] = CL[k].col.g; col[j * 3 + 2] = CL[k].col.b;
    size[j] = 3 + r() * 4.5; cid[j] = k;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('cid', new THREE.BufferAttribute(cid, 1));
  geo.setAttribute('hi', new THREE.BufferAttribute(hi, 1));

  const uniforms = { uPR: { value: renderer.getPixelRatio() }, uIn: { value: new THREE.Vector3() }, uDim: { value: new THREE.Vector3(1, 1, 1) }, uH: { value: 600 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `
      attribute float size; attribute float cid; attribute float hi;
      uniform float uPR; uniform float uH; uniform vec3 uIn; uniform vec3 uDim;
      varying vec3 vCol; varying float vA;
      void main(){
        float arrive = cid < .5 ? uIn.x : (cid < 1.5 ? uIn.y : uIn.z);
        float dim    = cid < .5 ? uDim.x : (cid < 1.5 ? uDim.y : uDim.z);
        vec4 mv = modelViewMatrix * vec4(position * mix(1.45, 1.0, arrive), 1.0);
        gl_Position = projectionMatrix * mv;
        // size attenuation scaled to the canvas height, so it reads the same at any window size
        gl_PointSize = size * (1.0 + hi * 2.2) * uPR * (uH / 600.0) * (9.0 / -mv.z) * arrive;
        float fog = smoothstep(17.0, 6.0, -mv.z);
        vCol = mix(color, vec3(1.0), hi * .6);
        vA = arrive * dim * fog * (.62 + hi * .38);
      }`,
    fragmentShader: `
      varying vec3 vCol; varying float vA;
      void main(){
        float d = length(gl_PointCoord - .5);
        float core = smoothstep(.5, .05, d);
        float a = core * core * vA;
        if (a < .008) discard;
        gl_FragColor = vec4(vCol, a);
      }`,
  });
  scene.add(new THREE.Points(geo, mat));

  // a floor grid, so depth has something to be measured against
  const grid = new THREE.GridHelper(14, 28, 0x2a3140, 0x1a1f28);
  grid.position.y = -2.7;
  grid.material.transparent = true; grid.material.opacity = 0;
  scene.add(grid);

  // the question: enters from above, curves into kb_code
  const qStart = new THREE.Vector3(-0.3, 3.4, 1.6);
  const land = new THREE.Vector3(CL[1].c.x - 0.1, CL[1].c.y + 0.12, CL[1].c.z + 0.15);
  const curve = new THREE.QuadraticBezierCurve3(qStart, new THREE.Vector3(1.5, 2.9, 1.0), land);
  const SEG = 90;
  const pathGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(SEG));
  const path = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: 0xfff1e6, transparent: true, opacity: 0 }));
  pathGeo.setDrawRange(0, 0); scene.add(path);

  const qGeo = new THREE.BufferGeometry(); qGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const qMat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uPR: uniforms.uPR, uH: uniforms.uH }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uPR; uniform float uH; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = 34. * uPR * (uH/600.) * (9. / -mv.z); }`,
    fragmentShader: `uniform float uA; void main(){ float d = length(gl_PointCoord - .5); float core = smoothstep(.16,.0,d); float halo = smoothstep(.5,.08,d)*.5; gl_FragColor = vec4(1., .93, .86, (core+halo)*uA); }`,
  });
  scene.add(new THREE.Points(qGeo, qMat));

  // nearest neighbours of the landing point — inside kb_code only
  const nn = [];
  for (let i = PER; i < PER * 2; i++) {
    const dx = pos[i * 3] - land.x, dy = pos[i * 3 + 1] - land.y, dz = pos[i * 3 + 2] - land.z;
    nn.push([dx * dx + dy * dy + dz * dz, i]);
  }
  nn.sort((a, b) => a[0] - b[0]);
  const near = nn.slice(0, 5).map((p) => p[1]);
  // thin lines from the query to its five neighbours
  const nnGeo = new THREE.BufferGeometry();
  const nnPos = new Float32Array(near.length * 6);
  near.forEach((i, k) => { nnPos.set([land.x, land.y, land.z, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], k * 6); });
  nnGeo.setAttribute('position', new THREE.BufferAttribute(nnPos, 3));
  const nnLines = new THREE.LineSegments(nnGeo, new THREE.LineBasicMaterial({ color: 0xffb08a, transparent: true, opacity: 0 }));
  scene.add(nnLines);

  const labels = [...document.querySelectorAll('.space-labels [data-sl]')];
  const anchor = [
    new THREE.Vector3(CL[0].c.x - 0.2, CL[0].c.y + 1.05, CL[0].c.z),
    new THREE.Vector3(CL[1].c.x + 0.25, CL[1].c.y + 1.1, CL[1].c.z),
    new THREE.Vector3(CL[2].c.x + 0.1, CL[2].c.y - 0.95, CL[2].c.z),
  ];

  let P = 0, W = 1, H = 1, running = false;
  const t0 = performance.now();
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const v = new THREE.Vector3();
  const toScreen = (p) => { v.copy(p).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };

  let OX = 0, OY = 0;                                   // canvas offset inside the stage
  const resize = () => {
    W = canvas.clientWidth || 1; H = canvas.clientHeight || 1;
    OX = canvas.offsetLeft; OY = canvas.offsetTop;
    renderer.setSize(W, H, false);
    // put the scene's centre on the window's centre, wherever the window sits in the canvas
    const cx = winEl.offsetLeft + winEl.offsetWidth / 2 - OX, cy = winEl.offsetTop + winEl.offsetHeight / 2 - OY;
    const fw = 2 * Math.max(cx, W - cx), fh = 2 * Math.max(cy, H - cy);
    camera.aspect = fw / fh;
    camera.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, W, H);
    camera.updateProjectionMatrix();
    uniforms.uH.value = fh;
  };
  addEventListener('resize', resize); resize();

  const frame = () => {
    if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
    const t = (performance.now() - t0) / 1000;
    const ang = -0.62 + P * 0.85 + Math.sin(t * 0.17) * 0.05;
    const rad = 10.2 - ss(0, 0.55, P) * 2.2;
    camera.position.set(Math.sin(ang) * rad, 1.4 + Math.sin(t * 0.21) * 0.12 - P * 0.35, Math.cos(ang) * rad);
    camera.lookAt(0, -0.2, 0);

    uniforms.uIn.value.set(ss(0.0, 0.2, P), ss(0.05, 0.25, P), ss(0.1, 0.3, P));
    const focus = ss(0.62, 0.78, P);
    uniforms.uDim.value.set(1 - focus * 0.75, 1, 1 - focus * 0.75);   // dim to 25%, never to nothing
    grid.material.opacity = 0.55 * ss(0.05, 0.3, P);

    const qa = ss(0.36, 0.44, P), travel = ss(0.44, 0.66, P);
    qMat.uniforms.uA.value = qa;
    const qp = curve.getPoint(travel);
    qGeo.attributes.position.setXYZ(0, qp.x, qp.y, qp.z); qGeo.attributes.position.needsUpdate = true;
    pathGeo.setDrawRange(0, Math.round(travel * SEG) + 1);
    path.material.opacity = 0.75 * qa;

    const h = ss(0.66, 0.82, P);
    near.forEach((i, k) => { hi[i] = ss(0, 1, h * 1.5 - k * 0.1); });
    geo.attributes.hi.needsUpdate = true;
    nnLines.material.opacity = 0.65 * h;

    renderer.render(scene, camera);

    labels.forEach((el) => {
      const k = el.dataset.sl;
      let x, y, a;
      if (k === 'q') { [x, y] = toScreen(qp); y -= 30; a = qa * (1 - ss(0.66, 0.74, P)); }
      else {
        [x, y] = toScreen(anchor[+k]);
        a = ss(0.18 + +k * 0.05, 0.32 + +k * 0.05, P) * (k === '1' ? 1 : 1 - focus * 0.6);
      }
      x = Math.min(W - 90, Math.max(90, x)) + OX; y = Math.min(H - 90, Math.max(40, y)) + OY;
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`;
      el.style.opacity = a.toFixed(3);
    });
  };

  // Only animate while the chapter is actually showing. Outside it, nothing renders at all.
  const live = () => P > 0.0001 && P < 0.9999;
  const loop = () => { if (!live()) { running = false; return; } frame(); requestAnimationFrame(loop); };
  window.SpaceViz = { setProgress: (p) => {
    P = p;
    if (live()) { if (!running) { running = true; requestAnimationFrame(loop); } }
    else frame();                                        // settle the end state once, then stop
  } };
}
