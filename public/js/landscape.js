/* side-gutter loss-landscape contours.
 * charcoal isolines over a slow-drifting scalar field;
 * only paints outside the centered .wrap column.
 * click in a gutter: a small light climbs +∇ with a short momentum wake. */
(() => {
  const MIN_SIDE = 72; // px of side gutter required to show anything
  const LEVELS = 28;
  const CELL = 9; // marching-squares cell size (css px)
  const FADE = 56; // soft fade into the content column
  const ALPHA = 0.11; // base stroke opacity — denser lines, softer each
  const PERIOD = 52000; // ms for one full morph cycle

  // climbing light + wake (click reveal)
  const TRAIL_STEP = 0.003; // integration step (normalized)
  const TRAIL_SPEED = 0.055; // low-|∇| gain: speed ≈ this · |∇z|
  const TRAIL_GRAD_REF = 1.8; // soft roll-off scale; high |∇| grows slower
  const TRAIL_SPEED_MAX = 0.11; // safety cap (normalized / sec)
  const TRAIL_STOP = 0.04; // fade / stop before peak (avoids noisy tip)
  const TRAIL_ALIGN = 0.2; // reject direction flips near criticals
  const TRAIL_DIE = 480; // ms fade-out once near peak
  const TRAIL_WAKE_MIN = 0.009; // wake length at low momentum (normalized)
  const TRAIL_WAKE_MAX = 0.035; // wake length at high momentum — keep short
  const TRAIL_DOT = 2.2; // head radius (css px)
  const TRAIL_ALPHA = 0.45;
  const TRAIL_WAKE_WIDTH = 1.35;

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
  let lastNow = 0;
  const staticMode = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** @type {{ nx: number, ny: number, dying: number, mom: number, hist: number[] }[]} */
  const trails = [];

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

  function grad(nx, ny, t) {
    const h = 0.0015;
    const gx = (field(nx + h, ny, t) - field(nx - h, ny, t)) / (2 * h);
    const gy = (field(nx, ny + h, t) - field(nx, ny - h, t)) / (2 * h);
    return [gx, gy];
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

  function inGutter(x) {
    return x < wrapLeft - 4 || x > wrapRight + 4;
  }

  /** Integrate along ±∇ from (nx0,ny0) up to maxDist. Returns [nx,ny,...] excluding start. */
  function integrateAlong(nx0, ny0, t, sign, maxDist) {
    const out = [];
    let nx = nx0;
    let ny = ny0;
    let traveled = 0;
    let zPrev = field(nx, ny, t);
    let prevUx = 0;
    let prevUy = 0;
    let hasDir = false;
    const maxSteps = Math.ceil(maxDist / TRAIL_STEP) + 2;

    for (let i = 0; i < maxSteps && traveled < maxDist; i++) {
      const [gx, gy] = grad(nx, ny, t);
      const mag = Math.hypot(gx, gy);
      if (mag < TRAIL_STOP) break;

      const ux = gx / mag;
      const uy = gy / mag;
      if (hasDir && ux * prevUx + uy * prevUy < TRAIL_ALIGN) break;

      const step = Math.min(TRAIL_STEP, maxDist - traveled);
      const nxNext = nx + sign * ux * step;
      const nyNext = ny + sign * uy * step;
      if (nxNext < 0.01 || nxNext > 0.99 || nyNext < 0.01 || nyNext > 0.99) break;

      const z = field(nxNext, nyNext, t);
      if (sign < 0 && z >= zPrev - 1e-7) break;
      if (sign > 0 && z <= zPrev + 1e-7) break;

      nx = nxNext;
      ny = nyNext;
      zPrev = z;
      prevUx = ux;
      prevUy = uy;
      hasDir = true;
      traveled += step;
      out.push(nx, ny);
    }
    return out;
  }

  /** Advance uphill (+∇) by `dist`. Returns new pos, or null if near peak. */
  function stepUphill(nx, ny, t, dist) {
    if (dist <= 0) return { nx, ny };
    const [gx0, gy0] = grad(nx, ny, t);
    if (Math.hypot(gx0, gy0) < TRAIL_STOP) return null;
    const path = integrateAlong(nx, ny, t, 1, dist);
    if (!path.length) return null;
    const i = path.length - 2;
    const nx2 = path[i];
    const ny2 = path[i + 1];
    // refuse the last steps into the critical neighborhood
    const [gx1, gy1] = grad(nx2, ny2, t);
    if (Math.hypot(gx1, gy1) < TRAIL_STOP) return null;
    return { nx: nx2, ny: ny2 };
  }

  /** Keep only the newest arc of hist whose length ≤ maxLen (normalized). */
  function trimWake(hist, maxLen) {
    const n = hist.length / 2;
    if (n < 2) return;
    let len = 0;
    let cut = 0;
    for (let i = n - 1; i > 0; i--) {
      len += Math.hypot(hist[i * 2] - hist[(i - 1) * 2], hist[i * 2 + 1] - hist[(i - 1) * 2 + 1]);
      if (len > maxLen) {
        cut = i;
        break;
      }
    }
    if (cut > 0) hist.splice(0, cut * 2);
  }

  function spawnTrail(clientX, clientY) {
    if (!inGutter(clientX)) return;
    if (wrapLeft < MIN_SIDE && W - wrapRight < MIN_SIDE) return;
    const nx = clientX / W;
    const ny = clientY / H;
    if (nx <= 0 || nx >= 1 || ny <= 0 || ny >= 1) return;
    trails.push({ nx, ny, dying: 0, mom: 0, hist: [nx, ny] });
    while (trails.length > 4) trails.shift();
  }

  function drawTrails(now, t, dt) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let i = trails.length - 1; i >= 0; i--) {
      const tr = trails[i];

      if (!tr.dying) {
        const [gx, gy] = grad(tr.nx, tr.ny, t);
        const mag = Math.hypot(gx, gy);
        // low |∇| ≈ linear; high |∇| soft-saturates so peaks climb slower
        const speed = Math.min(
          (TRAIL_SPEED * mag) / Math.sqrt(1 + (mag / TRAIL_GRAD_REF) * (mag / TRAIL_GRAD_REF)),
          TRAIL_SPEED_MAX
        );
        // momentum: smoothed speed → drives wake length
        tr.mom += (speed - tr.mom) * Math.min(1, dt * 8);
        const dist = speed * dt;
        const next = stepUphill(tr.nx, tr.ny, t, dist);
        if (!next) {
          tr.dying = now;
        } else {
          tr.nx = next.nx;
          tr.ny = next.ny;
          tr.hist.push(tr.nx, tr.ny);
        }
      } else {
        tr.mom *= Math.max(0, 1 - dt * 4);
      }

      const wakeLen =
        TRAIL_WAKE_MIN +
        (TRAIL_WAKE_MAX - TRAIL_WAKE_MIN) * Math.min(1, tr.mom / TRAIL_SPEED_MAX);
      trimWake(tr.hist, wakeLen);

      let base = TRAIL_ALPHA;
      if (tr.dying) {
        const u = (now - tr.dying) / TRAIL_DIE;
        if (u >= 1) {
          trails.splice(i, 1);
          continue;
        }
        base *= 1 - u;
      }

      const hist = tr.hist;
      const n = hist.length / 2;

      // wake: oldest → newest, fade toward the tail
      if (n >= 2) {
        ctx.lineWidth = TRAIL_WAKE_WIDTH;
        for (let k = 0; k < n - 1; k++) {
          const x0 = hist[k * 2] * W;
          const y0 = hist[k * 2 + 1] * H;
          const x1 = hist[k * 2 + 2] * W;
          const y1 = hist[k * 2 + 3] * H;
          const side = Math.min(sideAlpha(x0), sideAlpha(x1));
          if (side < 0.05) continue;
          const along = (k + 0.5) / (n - 1); // 0 = tail, 1 = head
          const a = base * 0.55 * along * along * side;
          if (a < 0.01) continue;
          ctx.strokeStyle = `rgba(38, 38, 36, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      }

      // head: charcoal point
      const hx = tr.nx * W;
      const hy = tr.ny * H;
      const side = sideAlpha(hx);
      if (side >= 0.05) {
        ctx.beginPath();
        ctx.arc(hx, hy, TRAIL_DOT, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(38, 38, 36, ${(base * side).toFixed(3)})`;
        ctx.fill();
      }
    }
  }

  function draw(t, now, dt) {
    ctx.clearRect(0, 0, W, H);
    if (wrapLeft < MIN_SIDE && W - wrapRight < MIN_SIDE) {
      drawTrails(now, t, dt);
      return;
    }

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

    drawTrails(now, t, dt);
  }

  function frame(now) {
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
    lastNow = now;
    draw(now - t0, now, dt);
    if (!staticMode || trails.length) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      lastNow = 0;
    }
  }

  function start() {
    resize();
    cancelAnimationFrame(raf);
    t0 = performance.now();
    lastNow = 0;
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    resize();
  });

  // click in gutter → climbing light with wake (canvas is pointer-events: none)
  window.addEventListener(
    "click",
    (e) => {
      if (staticMode) return;
      if (e.button !== undefined && e.button !== 0) return;
      spawnTrail(e.clientX, e.clientY);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    true
  );

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      measure();
    });
  }

  start();
})();
