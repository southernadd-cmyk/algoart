# Oil V2 V4 — experimental brush/efficiency work

This is an **isolated development branch** based on the current live Oil V1.
Nothing in the default renderer or material routing is changed.

## Changes
- Reuses the existing tested V2 source-linked oil adapter.
- Replaces V3's same-length hairline overprints with **16–36 actual tapered pigment/height contact ribbons** (nominally ~30 on broad strokes), each with a different lift length and different start, coherent with the source stroke direction.
- Batches all extra filaments into three pigment/height path draws per brush. There are no 30 independent canvas draw calls.
- Caches brush pressure per frame, so the expensive pressure waveform is evaluated once for each sample instead of once per sample per tuft twice.
- Keeps broad Oil V1 colour-body contacts and reduces round impasto bulges as in the experimental V2 baseline.

## Quality/performance gate
The GitHub Action renders **four actual ALGO/ART images** for organic, rects, network and burst, both portrait and landscape, in colour. It saves a baseline V1 PNG, V2 PNG, macro brush-tip lab before/after, and raw timings per image.
Treat first-run times as indicative, *not* definitive benchmark medians. Inspect whether 16–36 independent tips are actually visible at output scale, and reject the experiment if any seed loses its palette, focal hierarchy, negative space, or geometry.

Next steps: compare true pixel/crop differences; run warmed median repeated timings; profile duplicate composition captures; only integrate after visual and regression tests succeed. Do not release or change gallery routing from this branch.


## First GitHub Actions results — 16 October 2026

Run: https://github.com/southernadd-cmyk/algoart/actions/runs/38901658332

| Source mode / layout | Oil V1 (ms) | Oil V2 V4 (ms) | V2 overhead |
|---|---:|---:|---:|
| Organic, landscape | 573.2 | 696.6 | +21.5% |
| Rectangles, portrait | 471.9 | 541.0 | +14.6% |
| Network, landscape | 358.3 | 399.4 | +11.5% |
| Burst, portrait | 383.6 | 492.6 | +28.4% |

Job status: **success**. The actual-browser four-configuration captures and brush labs are in the oil-v2-v4-real-renderer artifact. Bristle statistics reported: 6460/2085/3470/2993 filaments, respectively.

These are **cold, single-run timings** (indicative, not controlled benchmark medians). Quality of deposited tips is **not yet visually accepted**. Regression scope has not been fully assessed. Do not merge to main.

**Next engineering gate:** Review macro crops and actual paintings. Measure warmed repeated median/p95; profile broad contact rasterisation and full-canvas height shading. Target visible differentiated bristles with a <=15% time increase over V1 before considering release.
