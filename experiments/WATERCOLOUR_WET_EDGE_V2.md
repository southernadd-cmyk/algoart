# Watercolour V2 — wet-edge wash experiment

**Status:** visual experiment. Do **not** release, merge to `main`, change the material selector or add this to daily social/gallery publishing until visually approved.

## Reference and comparison

Use `watercolour-wet-edge-preview.html` from a local static server. It renders **the same V8 marker geometry and ink kit** into two canvases with the same seed/settings/orientation:

1. Left: frozen, production **Tissue & Graphite V6** through `A.renderOil(...,6)`.
2. Right: **wet-edge watercolour** using a temporary, locally scoped substitution of the material function with `A.watercolourMaterialExperiment`, restoring the original in `finally`.

The new renderer is cloned from V6, not a change to it. The public `index.html`, `app.js`, exports, share URLs and publishing workflows are untouched.

## What's different in this experiment

- **Wet pigment accumulation:** torn, seed-deterministic ribbon boundaries get 3 nested, clipped pigment bands. Colour is heaviest along the perimeter, tapering towards a pale interior. Avoid a dark stroke/halo outside the wash.
- **Subtractive overlaps:** Canvas `multiply` blending deepens overlapping seeded hues rather than bleaching them.
- **Transparent centres:** low-opacity wash bodies let cream paper show through.
- **Paper granulation:** deterministic fine/coarse grain lifts small amounts of pigment; no unrelated bright strokes.
- **No hard triangular planes, oil relief shading, graphite hatch overlay or separate tissue scraps** in the new watercolour material. It is visually distinct from the archival Tissue & Graphite style.
- **Same composition:** original eight modes and φ geometry from V8, including negative-space reserves, seed palette and both orientations.
- **Fixed paper:** `#f5f0e6` always, irrespective of seed. Only pigment hues change.

These are hypotheses for visual evaluation, **not an assertion that the images already look like genuine watercolour**. Previous unfinished draft PR #51 read as angular collage; do not merge it as the new material.

## Reproduction

```bash
python3 -m http.server 4173
# open http://localhost:4173/experiments/watercolour-wet-edge-preview.html
npm ci
npx playwright install chromium
node tests/watercolour-wet-edge-preview.mjs
```

The test writes four paired browser-rendered PNG studies to `watercolour-wet-edge-previews/` (ignored/uncommitted). Use the same seeds for subsequent iterations. When imagery is approved, integrate as a **third material choice** named Watercolour while preserving all archival Tissue links and exact V6 pixels.

Suggested visual-review questions: Are edges naturally pooled but not outlined? Is the interior still too solid? Do overlaps deepen without becoming mud? Does Recursive Divisions stop resembling a hard collage? Does the fixed cream paper survive? Is the pigment texture detailed enough at full-size export?
