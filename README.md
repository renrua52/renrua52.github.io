# Zirui Ren's Homepage

Personal academic homepage — [renrua52.github.io](https://renrua52.github.io).
Built with [Astro](https://astro.build), deployed to GitHub Pages via GitHub Actions.

Design: monospace typesetting, charcoal ink on paper white, no cards / shadows /
color blocks. The about page carries an interactive self-attention overlay (see below).

## Develop

```bash
npm install
npm run dev        # local dev server
npm run build      # static build -> dist/
npm run preview    # preview the production build
```

## Content

| what          | where                                            |
| ------------- | ------------------------------------------------ |
| about page    | `src/pages/index.astro`                          |
| blog posts    | synced from [`renrua52/domain`](https://github.com/renrua52/domain) `source/_posts/` where `categories` contains `Science` (`npm run sync:blog`) |
| publications  | `src/data/publications.json`                     |
| cv (pdf; the nav links straight to it) | `public/assets/files/CV_Zirui_Ren.pdf` |
| site metadata | `src/consts.ts`                                  |

Push to `main` — CI builds and deploys automatically.

## The attention overlay (about page)

Hovering a token on the about page highlights the past tokens it attends to
(rows of the causal matrix) — highlight depth encodes attention weight.
Precomputed with a small open-source
LM ([Qwen2.5-0.5B](https://huggingface.co/Qwen/Qwen2.5-0.5B), 24 layers,
CPU-only, no GPU needed). Use the control in the bottom-right corner to switch
layers or toggle the feature.

There is no model in the browser: the pipeline is offline —

1. `scripts/precompute_attention.py` tokenizes the text in `#attn-root` of the
   built `dist/index.html`, runs a single forward pass, and wraps each token in
   a `<span class="tok">`;
2. the attention matrix is sparsified (top-16 per token, ≥ 0.01 head-averaged
   weight) and quantized to uint8, one small JSON per layer, fetched lazily on
   hover;
3. CI re-runs this after every push, so content edits stay in sync. If the
   shipped data ever mismatches the DOM, the feature disables itself silently.

To recompute locally (needs Python ≥ 3.9):

```bash
pip install -r scripts/requirements.txt
npm run build:full   # astro build + precompute
```
