/* attention overlay for the about page.
 * data is precomputed by scripts/precompute_attention.py;
 * this file only fetches sparse per-layer JSON and highlights the tokens
 * the hovered token attends to (rows of the causal matrix: past tokens).
 * highlight depth encodes attention weight.
 * everything is a no-op until the user hovers a token. */
(() => {
  const root = document.getElementById("attn-root");
  if (!root) return;
  if (window.matchMedia("(hover: none)").matches) return; // touch devices

  const toks = root.querySelectorAll(".tok");
  if (!toks.length) return; // precompute has not run -> stay silent

  const THRESH = 0.06; // normalized [0,1]; connections below this are hidden
  const LS_ENABLED = "attn.enabled";
  const LS_LAYER = "attn.layer";

  const state = {
    enabled: localStorage.getItem(LS_ENABLED) !== "off",
    layer: 0,
    meta: null,
    cache: new Map(), // layer -> Promise<data>
    current: null, // hovered token id
  };

  /* ---------- controls ---------- */
  const box = document.createElement("div");
  box.id = "attn-controls";
  box.innerHTML =
    '<span class="seg">[ attn: </span><button id="attn-toggle" type="button"></button>' +
    '<span class="seg"> | layer: </span><button id="attn-dec" type="button">-</button>' +
    '<span class="val" id="attn-lname"></span>' +
    '<button id="attn-inc" type="button">+</button><span class="seg"> ]</span>';
  document.body.appendChild(box);
  const toggleBtn = box.querySelector("#attn-toggle");
  const lname = box.querySelector("#attn-lname");

  function renderControls() {
    toggleBtn.textContent = state.enabled ? "on" : "off";
    toggleBtn.setAttribute("aria-pressed", String(state.enabled));
    lname.textContent = String(state.layer).padStart(2, "0");
  }

  toggleBtn.addEventListener("click", () => {
    state.enabled = !state.enabled;
    localStorage.setItem(LS_ENABLED, state.enabled ? "on" : "off");
    if (!state.enabled) clearAll();
    renderControls();
  });
  box.querySelector("#attn-dec").addEventListener("click", () => setLayer(state.layer - 1));
  box.querySelector("#attn-inc").addEventListener("click", () => setLayer(state.layer + 1));

  function setLayer(i) {
    if (!state.meta) return;
    state.layer = Math.max(0, Math.min(state.meta.layers - 1, i));
    localStorage.setItem(LS_LAYER, String(state.layer));
    renderControls();
    if (state.current !== null && state.enabled) render();
  }

  /* ---------- data ---------- */
  function layerData(i) {
    if (!state.cache.has(i)) {
      state.cache.set(
        i,
        fetch(`/assets/attention/layer-${String(i).padStart(2, "0")}.json`).then((r) =>
          r.ok ? r.json() : Promise.reject(r.status)
        )
      );
    }
    return state.cache.get(i);
  }

  /* ---------- hover ---------- */
  function spansOf(tid) {
    return root.querySelectorAll(`.tok[data-t="${tid}"]`);
  }

  function clearLinked() {
    root.querySelectorAll(".tok.linked").forEach((el) => {
      el.classList.remove("linked");
      el.style.backgroundColor = "";
    });
  }

  function clearAll() {
    clearLinked();
    root.querySelectorAll(".tok.hover").forEach((el) => el.classList.remove("hover"));
    state.current = null;
  }

  async function render() {
    const tid = state.current;
    if (tid === null || !state.enabled) return;
    let data;
    try {
      data = await layerData(state.layer);
    } catch {
      return;
    }
    if (state.current !== tid) return; // hover moved while fetching

    clearLinked();
    spansOf(tid).forEach((el) => el.classList.add("hover"));

    // data.top[tid] = this token's row: the past tokens it attends to
    for (const [t, q] of data.top[tid] || []) {
      const w = q / 255;
      if (w < THRESH) continue;
      const alpha = (0.04 + 0.24 * w).toFixed(3); // depth encodes weight
      spansOf(t).forEach((el) => {
        el.classList.add("linked");
        el.style.backgroundColor = `rgba(38, 38, 36, ${alpha})`;
      });
    }
  }

  root.addEventListener("mouseover", (e) => {
    if (!state.enabled) return;
    const el = e.target.closest(".tok");
    if (!el) return;
    const tid = Number(el.dataset.t);
    if (tid === state.current) return;
    clearAll();
    state.current = tid;
    render();
  });

  root.addEventListener("mouseout", (e) => {
    const el = e.target.closest(".tok");
    if (!el) return;
    const next = e.relatedTarget && e.relatedTarget.closest
      ? e.relatedTarget.closest(".tok")
      : null;
    if (next && Number(next.dataset.t) === state.current) return;
    clearAll();
  });

  /* ---------- boot ---------- */
  fetch("/assets/attention/meta.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((meta) => {
      if (!meta || meta.wrapped !== toks.length) {
        console.info(
          `[attn] disabled: token mismatch (dom=${toks.length}, data=${meta && meta.wrapped}). re-run scripts/precompute_attention.py`
        );
        box.remove();
        return;
      }
      state.meta = meta;
      const savedRaw = localStorage.getItem(LS_LAYER);
      const saved = savedRaw === null ? NaN : Number(savedRaw);
      state.layer = Number.isInteger(saved)
        ? Math.max(0, Math.min(meta.layers - 1, saved))
        : Math.min(6, meta.layers - 1);
      renderControls();
      layerData(state.layer); // warm the cache for the first hover
    })
    .catch(() => {
      console.info("[attn] disabled: no precomputed data");
      box.remove();
    });
})();
