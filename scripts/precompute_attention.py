#!/usr/bin/env python3
"""
Precompute self-attention over the about page.

Reads dist/index.html, tokenizes the text inside #attn-root with the
tokenizer of a small open-source LM, runs a single CPU forward pass, and:

  1. wraps every non-whitespace token in <span class="tok" data-t="i">
     (tokens spanning inline element boundaries become multiple spans
     sharing the same data-t)
  2. writes a sparse, top-k, uint8-quantized attention matrix per layer to
     dist/assets/attention/layer-XX.json plus meta.json

Re-run after every content change (done automatically in CI):
    npm run build && python3 scripts/precompute_attention.py
"""

import json
import os
import sys
import datetime
import numpy as np
from bs4 import BeautifulSoup, Comment, Doctype, ProcessingInstruction, CData

# ---------------- config ----------------
# base model, 24 layers, 32k ctx, CPU-friendly.
# MODEL_PATH (a local directory) takes precedence when set — useful when
# huggingface.co is unreachable; download the files once, e.g.:
#   curl -L -o <file> https://hf-mirror.com/Qwen/Qwen2.5-0.5B/resolve/main/<file>
MODEL = os.environ.get("MODEL_PATH") or "Qwen/Qwen2.5-0.5B"
TOP_K = 16                   # max connections kept per token per layer, each direction
MIN_RAW = 0.01               # min head-averaged attention weight to keep
INDEX = os.path.join(os.path.dirname(__file__), "..", "dist", "index.html")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "dist", "assets", "attention")


def collect_text_nodes(root):
    """Text nodes inside #attn-root, in document order, with char ranges in S."""
    nodes = []
    parts = []
    pos = 0
    skip_types = (Comment, Doctype, ProcessingInstruction, CData)
    for node in root.find_all(string=True):
        if isinstance(node, skip_types):
            continue
        parents = list(node.parents)
        if any(p.name in ("script", "style") for p in parents):
            continue
        if any("no-attn" in (p.get("class") or []) for p in parents):
            continue
        text = str(node)
        nodes.append((node, pos, pos + len(text)))
        parts.append(text)
        pos += len(text)
    return nodes, "".join(parts)


def compute_attention(token_ids, n_layers):
    """Single forward pass; per-layer head-averaged attention via hooks."""
    import torch
    from transformers import AutoModelForCausalLM

    model = AutoModelForCausalLM.from_pretrained(
        MODEL, attn_implementation="eager", torch_dtype=torch.float32
    )
    model.config.output_attentions = True
    model.eval()

    attn = {}
    expected = list(range(n_layers))

    def make_hook(i):
        def hook(module, _args, out):
            w = out[1] if isinstance(out, tuple) and len(out) > 1 else None
            if w is None:
                return
            attn[i] = w[0].float().mean(dim=0).cpu().numpy()  # (N, N)

        return hook

    handles = [
        layer.self_attn.register_forward_hook(make_hook(i))
        for i, layer in enumerate(model.model.layers)
    ]
    with torch.no_grad():
        model(input_ids=torch.tensor([token_ids]))
    for h in handles:
        h.remove()

    missing = [i for i in expected if i not in attn]
    if missing:
        raise RuntimeError(f"no attention captured for layers {missing}")
    return attn


def _topk(vec, n):
    """Top-k entries of one row/column, raw > MIN_RAW, quantized to uint8.

    Normalized per token (row or column max = 255): per-layer normalization
    would drown everything below the global attention sink and leave each
    token with a single visible link.
    """
    vmax = float(vec.max())
    if vmax <= 0:
        return []
    cand = np.argpartition(-vec, min(TOP_K, n - 1))[:TOP_K]
    sel = sorted(
        ((int(j), float(vec[j])) for j in cand if vec[j] > MIN_RAW),
        key=lambda x: -x[1],
    )
    return [[j, int(round(min(1.0, v / vmax) * 255))] for j, v in sel]


def sparsify(matrix, n):
    """Zero diagonal, then keep per-row top-k (rows of the causal matrix:
    the past tokens each token attends to)."""
    a = matrix.copy()
    np.fill_diagonal(a, 0.0)
    return [_topk(a[r], n) for r in range(n)]


def main():
    os.chdir(os.path.join(os.path.dirname(__file__), ".."))
    with open(INDEX, encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")
    root = soup.find(id="attn-root")
    if root is None:
        sys.exit("error: #attn-root not found in dist/index.html")

    # idempotency: unwrap previously injected spans
    for sp in root.select("span.tok"):
        sp.unwrap()

    text_nodes, full_text = collect_text_nodes(root)
    print(f"[attn] collected {len(text_nodes)} text nodes, {len(full_text)} chars")

    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(MODEL)
    enc = tokenizer(full_text, add_special_tokens=False, return_offsets_mapping=True)
    token_ids, offsets = enc["input_ids"], enc["offset_mapping"]
    n = len(token_ids)
    print(f"[attn] {n} tokens ({MODEL})")

    print("[attn] forward pass (cpu) ...")
    attn = compute_attention(token_ids, n_layers=24)

    os.makedirs(OUT_DIR, exist_ok=True)
    for i in range(24):
        rows = sparsify(attn[i], n)
        payload = {"layer": i, "n": n, "top": rows}
        with open(os.path.join(OUT_DIR, f"layer-{i:02d}.json"), "w") as f:
            json.dump(payload, f, separators=(",", ":"))

    # ---- span injection (rewritten iteratively over live DOM) ----
    # map char offsets -> tokens, then walk nodes again on the mutated tree
    n_wrapped = 0
    for node, ns, ne in text_nodes:
        overlapping = [
            (max(ts, ns), min(te, ne), t)
            for t, (ts, te) in enumerate(offsets)
            if ts < ne and te > ns
        ]
        if not overlapping:
            continue
        fragments = []
        cursor = ns
        for s, e, t in overlapping:
            if s > cursor:
                fragments.append((cursor, s, None))
            fragments.append((s, e, t))
            cursor = e
        if cursor < ne:
            fragments.append((cursor, ne, None))

        anchor = node
        for s, e, t in fragments:
            frag = full_text[s:e]
            if t is None or not frag.strip():
                new_node = soup.new_string(frag)
            else:
                new_node = soup.new_tag(
                    "span", attrs={"class": "tok", "data-t": str(t)}
                )
                new_node.string = frag
                n_wrapped += 1
            anchor.insert_after(new_node)
            anchor = new_node
        node.extract()

    meta = {
        "model": MODEL,
        "layers": 24,
        "n": n,
        "wrapped": n_wrapped,
        "k": TOP_K,
        "minRaw": MIN_RAW,
        "generated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    with open(os.path.join(OUT_DIR, "meta.json"), "w") as f:
        json.dump(meta, f, indent=2)

    with open(INDEX, "w", encoding="utf-8") as f:
        f.write(str(soup))
    print(f"[attn] wrapped {n_wrapped} token spans; wrote {OUT_DIR}")


if __name__ == "__main__":
    main()
