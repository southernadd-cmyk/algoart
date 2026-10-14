# Watercolour V2 — wet-edge wash experiment

**Status:** visual experiment. Do **not** release, merge to `main`, change the material selector or add this to daily social/gallery publishing until visually approved.

## Reference and comparison

Use `watercolour-wet-edge-preview.html` from a local static server. It renders **the same V8 marker geometry and ink kit** into two canvases with the same seed/settings/orientation:

1. Left: frozen, production **Tissue & Graphite V6** through `A.renderOil(...,6)`.
2. Right: **wet-edge watercolour** using a temporary, locally scoped substitution of the material function with `A.watercolourMaterialExperiment`, restoring the original in `finally`.

The new renderer is cloned from V6, not a change to it. The public `index.html`, `app.js`, exports, share URLs and publishing workflows are untouched.

## What's different in this experiment

- **Wet pigment accumulation:** torn, seed-deterministic ribbon boundaries get a single feathered, clipped pigment rim with seeded, uneven pooling. The edge holds more colour than the pale interior, but avoids the three concentric outlines that read as CAD geometry.
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

## V2c/V2d — paper-driven fluid diffusion (13 October 2026)

The V2b feathered edge still looked too much like stacked translucent ribbons,
particularly on Recursive Divisions. We therefore added a **seed-deterministic
paper-flow pass** to the isolated experiment only:

1. Recover the actual painted RGB as three optical pigment densities (Beer–Lambert-inspired), retaining seed-selected hues and multiply-darkened overlaps.
2. Warp wash boundaries gently with two smoothly varying fibre/wetness scales. This roughens otherwise uniformly straight edges; it is not a global blurred filter.
3. Exchange pigment locally through multiple 4-neighbour capillary passes with symmetric, anisotropic transport driven by the paper's absorbency and moisture.
4. Deposit more pigment into absorbent paper valleys and granular tooth. Unpainted pixels return to exactly the standard `#f5f0e6` paper.
5. Seed up to four small clear-water backruns inside already-painted areas (lightened irregular centres, slight pigment rings). Their positions depend on existing V8 paths, not random new focal shapes.

The V2d pass increases edge displacement and pigment granulation relative to the initially too-subtle V2c prototype; the visual result is distinctly more wavy, diffused and paper-bound, especially in geometric modes. Compare the four rendered pairs in the [successful CI image artifact](https://github.com/southernadd-cmyk/algoart/actions/runs/38466869493). Both a repeated wet-render and a fresh production V6 replay are pixel-identical for their respective same-seed outputs.

This is still a visual experiment: currently it can soften structured geometry more than desired. Evaluate the image at normal viewing size **and** export-scale detail before considering a third Material option. No change is authorised for production, current V6, gallery, social, or historic links.

## V2N — wet-mask pigment transport (14 October 2026)

**Draft experiment only. Not a release.** V2M's final-composite pigment boundary
could outline dry marks and treated a newly added optical-density band as if it
were transported paint. V2N tests a different mechanism:

1. Mirror each genuine wet/damp filled ribbon into a same-resolution alpha mask,
   preserving its seeded irregular contour without consuming extra RNG.
   Exclude dry details and narrow line strokes.
2. Build the two-pass inward chamfer distance field from this wet-wash mask,
   not from the final composited pigment colours.
3. Shift existing RGB optical pigment densities incrementally toward the drying
   front along descending distance gradients. Each transfer subtracts from
   one pixel and adds exactly the same amount to a neighbouring pixel.
4. Modulate pooling coherently using paper tooth, fibre direction, formation,
   and smooth seeded flow fields; bank width varies approximately 3–10 px
   with gaps rather than one uniformly dark contour.
5. Apply the normal capillary-flow granulation and wash rendering afterward.
   No additive dark stroke, global blur, new geometry, or fresh pigment
   is invented at the rim. Subsequent dry drawing remains outside this pass.

Check `paperFlow.wetMaskPixels`, `transferPixels`, `donorPixels`,
`edgeBankPixels`, and `conservationError`. The browser test asserts
same-seed replay and archival V6 pixel identity. Fixed-seed comparisons
are intended to be judged against retained V2L and V2M Actions artifacts,
not against random replacement seeds.

**Do not claim visual success from numerical checks alone.** At normal size
inspect pale-wash edges, sample 06 for rings/halos, thin stroke junctions,
and overall colour balance before authorising any release.

## V2O — edge variety, feather refinement, pale hero preservation (14 October 2026)

**Status: draft experiment; V2N is the comparison baseline at commit
`213374309c2679e1156de0e799160fd20f8a6b7f`, with eight fixed-seed PNGs
from Actions run `38588604167`. Do not merge, publish or alter the material selector.**

The V2N review preferred the narrow, discontinuous drying marks to V2M's
heavy rims. V2O deliberately avoids changing composition, seed or palette:

1. Each filled wash independently chooses a **soft wet-in-wet edge ~28% of
   the time** through a separately seeded hash (no changes to the existing
   geometry/colour RNG sequence). Remaining damp/wet shapes keep V2N's
   conservative tide-line movement. Deferred dry strokes remain crisp.
2. Captured true wash geometry is mirrored into a *second*, selected-soft
   alpha mask at the same raster resolution. A three-pixel boundary zone
   receives three additional mild, symmetric pigment diffusion passes.
   The conservation regression verifies no pigment is invented here.
   V2N's tide-line redistribution is suppressed at these soft boundaries.
3. The torn-contour micro-variation has seed-deterministic, non-uniform
   sampling spacing and less high-frequency oscillation. This addresses
   regularly spaced tick/hair-like whiskers without extra drawn geometry.
4. Only pale, early hero forms (luma >159, first 22 existing paths) receive
   a small opacity floor/boost if damp or wet, helping maintain the
   intentional φ hierarchy without an artificial outline.

Metrics: `softWashCount/areaWashCount`, `paleFormBoosts`,
`softMaskPixels`, `softBoundaryPixels`, `softFluxPixels`,
`softConservationError`, and V2N's conserved edge-bank metrics.
Automated browser checks validate determinism and historical V6 isolation.
Workflow produces eight **exact V2N-matched seeds** plus eight fresh V2O
random studies and four V6/V2O pairs.

**Visual acceptance**: no repeated hair-like ticks; soft and hard borders
coexist; the bright forms in burst/field retain legibility; V2N's appealing
narrow tide-lines are still present elsewhere. Reject if V2O looks uniformly
fuzzy, loses structure, or makes the whole sheet appreciably muddier.

## V2P — paper-fibre edge polish (14 October 2026)

**Status:** isolated draft visual experiment, NOT a release. Preserve approved
V2O baseline at commit `cf0df2f00d2ff74b44da4a375103c62b8df943ba`.
Its eight matched-seed studies are in Actions run `38594738739`.

Based on review of V2O: wet-in-wet edge variety, pale focal-form protection and
V2N-conserved pigment are worth keeping. The two remaining edge artefacts were
short *parallel hairs* on burst outlines and perfectly smooth dry block edges
in Recursive Divisions.

V2P replaces the periodic sine contour oscillation with continuous seeded
paper-fibre variation. It samples the **existing watercolour paper field** and
three smoothly correlated, non-repeating scales (around 5/10/24 px). Sampling
spacing itself varies from ~2.7–5.1 px. Occasional absorbent pockets cause
projections in the *original fill boundary*, never detached drawn hairs or
new composition geometry. Dry linework is capped at 1.25 logical pixels
of displacement; soft wet-in-wet and ordinary damp/wet washes keep separate
limits (1.55 and 2.30px, respectively). Source curves, material seed RNG,
opacity, pigmented wash interiors, palettes and framing are not changed.

The same shape polygon is sent to pigment and both wet/soft mask canvases, so
edge transport still sees the actual rendered boundary. Automated tests
verify `edgeTexture.samples`, `drySamples` and displacement bounds alongside
V2O water/pigment conservation, determinism and V6 reproduction.

**Visual acceptance:** compare all eight V2O/V2P pairs at natural size,
zoom in on the lower-left grey burst polygon and the straight grey
Recursive Divisions bars, and reject if the new texture looks jagged,
loss of hard edges, or any new optical outlines. No release unless reviewed.
