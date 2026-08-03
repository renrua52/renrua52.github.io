/* side-gutter loss-landscape contours.
 * charcoal isolines over a slow-drifting scalar field;
 * only paints outside the centered .wrap column. */
(() => {
  const MIN_SIDE = 72; // px of side gutter required to show anything
  const LEVELS = 18;
  const CELL = 10; // marching-squares cell size (css px)
  const FADE = 56; // soft fade into the content column
  const ALPHA = 0.18; // base stroke opacity — denser lines, slightly softer each
  const PERIOD = 52000; // ms for one full morph cycle

  const canvas = document.createElement("canvas");
  canvas.id = "landscape-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");

  const hills = [
    { ax: 0.22, ay: 0.28, amp: 1.1, sig: 0.18, phx: 0.0, phy: 1.2, spd: 0.7 },
    { ax: 0.78, ay: 0.22, amp: 0.95, sig: 0.16, phx: 1.7, phy: 0.4, spd: 0.55 },
    { ax: 0.18, ay: 0.72, amp: 1.0, sig: 0.2, phx: 2.4, phy: 2.1, spd: 0.45 },
    { ax: 0.82, ay: 0.68, amp: 0.9, sig: 0.17, phx: 0.9, phy: 3.0, spd: 0.6 },
    { ax: 0.5, ay: 0.48, amp: 0.7, sig: 0.28, phx: 3.3, phy: 1.5, spd: 0.35 },
    { ax: 0.35, ay: 0.55, amp: -0.55, sig: 0.14, phx: 4.1, phy: 0.8, spd: 0.8 },
    { ax: 0.65, ay: 0.38, amp: -0.5, sig: 0.13, phx: 2.0, phy: 2.6, spd: 0.75 },
  ];

  // edges: 0=top, 1=right, 2=bottom, 3=left
  const SEGMENTS = [
    [],
    [[2, 3]],
    [[1, 2]],
    [[1, 3]],
    [[0, 1]],
    [
      [0, 3],
      [1, 2],
    ],
    [[0, 2]],
    [[0, 3]],
    [[0, 3]],
    [[0, 2]],
    [
      [0, 1],
      [2, 3],
    ],
    [[0, 1]],
    [[1, 3]],
    [[1, 2]],
    [[2, 3]],
    [],
  ];

  let W = 0;
  let H = 0;
  let wrapLeft = 0;
  let wrapRight = 0;
  let dpr = 1;
  let raf = 0;
  let t0 = performance.now();
  const staticMode = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function measure() {
    const wrap = document.querySelector(".wrap");
    const wr = wrap
      ? wrap.getBoundingClientRect()
      : { left: W / 2, right: W / 2 };
    wrapLeft = wr.left;
    wrapRight = wr.right;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measure();
  }

  function field(nx, ny, t) {
    let z = 0;
    const tw = (t / PERIOD) * Math.PI * 2;
    for (const h of hills) {
      const cx = h.ax + 0.06 * Math.sin(tw * h.spd + h.phx);
      const cy = h.ay + 0.05 * Math.cos(tw * h.spd * 0.9 + h.phy);
      const dx = (nx - cx) / h.sig;
      const dy = (ny - cy) / h.sig;
      z += h.amp * Math.exp(-0.5 * (dx * dx + dy * dy));
    }
    z += 0.22 * Math.sin((nx * 3.2 + ny * 1.1) * Math.PI + tw * 0.6);
    z += 0.16 * Math.cos((nx * 1.4 - ny * 2.8) * Math.PI - tw * 0.4);
    return z;
  }

  function edgePoint(edge, x0, y0, x1, y1, v0, v1, v2, v3, level) {
    const lerp = (a, b, va, vb) => {
      const u = (level - va) / (vb - va || 1e-9);
      return a + (b - a) * Math.max(0, Math.min(1, u));
    };
    switch (edge) {
      case 0:
        return [lerp(x0, x1, v0, v1), y0];
      case 1:
        return [x1, lerp(y0, y1, v1, v2)];
      case 2:
        return [lerp(x0, x1, v3, v2), y1];
      case 3:
        return [x0, lerp(y0, y1, v0, v3)];
      default:
        return [x0, y0];
    }
  }

  function sideAlpha(x) {
    if (x >= wrapLeft && x <= wrapRight) return 0;
    if (x < wrapLeft) {
      const d = wrapLeft - x;
      return d >= FADE ? 1 : d / FADE;
    }
    const d = x - wrapRight;
    return d >= FADE ? 1 : d / FADE;
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    if (wrapLeft < MIN_SIDE && W - wrapRight < MIN_SIDE) return;

    const cols = Math.max(2, Math.ceil(W / CELL));
    const rows = Math.max(2, Math.ceil(H / CELL));
    const stride = cols + 1;
    const grid = new Float32Array(stride * (rows + 1));
    let zMin = Infinity;
    let zMax = -Infinity;

    for (let j = 0; j <= rows; j++) {
      const ny = j / rows;
      for (let i = 0; i <= cols; i++) {
        const z = field(i / cols, ny, t);
        grid[j * stride + i] = z;
        if (z < zMin) zMin = z;
        if (z > zMax) zMax = z;
      }
    }
    const span = zMax - zMin || 1;

    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let l = 0; l < LEVELS; l++) {
      const level = zMin + ((l + 0.5) / LEVELS) * span;
      const levelAlpha = ALPHA * (0.55 + 0.45 * (l / (LEVELS - 1)));

      for (let j = 0; j < rows; j++) {
        const y0 = (j / rows) * H;
        const y1 = ((j + 1) / rows) * H;
        for (let i = 0; i < cols; i++) {
          const x0 = (i / cols) * W;
          const x1 = ((i + 1) / cols) * W;

          // skip cells fully inside the content column
          if (x0 >= wrapLeft && x1 <= wrapRight) continue;

          const v0 = grid[j * stride + i];
          const v1 = grid[j * stride + i + 1];
          const v2 = grid[(j + 1) * stride + i + 1];
          const v3 = grid[(j + 1) * stride + i];

          let idx = 0;
          if (v0 > level) idx |= 8;
          if (v1 > level) idx |= 4;
          if (v2 > level) idx |= 2;
          if (v3 > level) idx |= 1;

          const segs = SEGMENTS[idx];
          for (let s = 0; s < segs.length; s++) {
            const [eA, eB] = segs[s];
            const [ax, ay] = edgePoint(eA, x0, y0, x1, y1, v0, v1, v2, v3, level);
            const [bx, by] = edgePoint(eB, x0, y0, x1, y1, v0, v1, v2, v3, level);
            const a = Math.min(sideAlpha(ax), sideAlpha(bx));
            if (a < 0.02) continue;
            ctx.strokeStyle = `rgba(38, 38, 36, ${(levelAlpha * a).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }
    }
  }

  function frame(now) {
    draw(now - t0);
    if (!staticMode) raf = requestAnimationFrame(frame);
  }

  function start() {
    resize();
    cancelAnimationFrame(raf);
    t0 = performance.now();
    if (staticMode) draw(0);
    else raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    resize();
    if (staticMode) draw(0);
  });

  // remeasure after fonts / layout settle
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      measure();
      if (staticMode) draw(0);
    });
  }

  start();
})();
