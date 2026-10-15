# V5k — physical field edges and experimental Tissue atmosphere

**Draft experiment. NOT merged, released, or used for gallery/social publishing.**

## Source geometry is still the authority

The mathematical interpretation is V5i, with V5j's bounded local pigment selection.
No source guide IDs, source SVG paths, selected field contours, field occupancy, seeds,
negative-space reservations, or colour-source records were changed.

V5k changes **only material handling**:

1. `js/v5k-material-adapters.js` adds `physicalEdgePath`, which samples the
   actual source-field boundary at physical detail scales and retreats slightly
   inward with seeded multiscale variation. The Oil material uses larger dry-edge
   erosion (~13.3 source pixels maximum parameter) and Tissue uses smaller
   torn-paper variation (~7.1); none of it is a new field or Voronoi polygon.
   The V4e contact brush still tracks real source guide directions.
2. Tissue V7's diffuse atmosphere is addressed at the originating code in
   `js/oil-material.js`, not with a whitening layer or a screen filter:
   the experimental mode narrows and reduces the original broad paint planes
   and wide translucent ribbons, preserving their seeded RNG decisions.
   The `A.tissueV5kReduceAtmosphere` flag is set temporarily, with try/finally
   restoration, **only** when an interpreted Tissue composition actually
   contains the connected source-owned fields. The standard V7 material and
   plain V5c golden rectangles remain unchanged.
3. `tests/v5k-physical-edges.mjs` renders the real system (four engines ×
   Oil/Tissue × Faithful/V5j/V5k), plus source/pigment geometry plans, preserving
   the exact source-geometry and Faithful image hashes. It checks occupied field
   interiors, stable pixels, and exterior paper-colour deviation separately.

## CI evidence

[Passing GitHub Actions run 38786715461](https://github.com/southernadd-cmyk/algoart/actions/runs/38786715461) |
[Complete V5k browser-generated artwork and metadata](https://github.com/southernadd-cmyk/algoart/actions/runs/38786715461/artifacts/11997123746).

| Engine | Visible source fields | Oil altered pixels from V5j | Tissue altered pixels from V5j | Original phi-cell output |
| --- | ---: | ---: | ---: | --- |
| Growth Systems | 6 | 2,920 | 39,258 | n/a |
| Golden Trajectories | 4 | 2,789 | 35,393 | n/a |
| Constructed Forms | 5 | 2,132 | 49,941 | n/a |
| Recursive Divisions | Original V5c | 0 | 0 | pixel-identical |

Sampled actual occupied interiors remain pigmented: Oil 88.2%, 85.6%, 81.2%
(Growth / Trajectories / Constructed); Tissue 99.0%, 97.7%, 98.3%.
The stronger physical erosion reduces Oil painted interior somewhat compared
with V5j; this trade-off is measured, not hidden.

## Exterior pigment (mean summed per-pixel RGB absolute deviation from cream)

| Engine | V5j Tissue | V5k Tissue | Assessment |
| --- | ---: | ---: | --- |
| Growth | 35.12 | 34.23 | Slightly cleaner |
| Trajectories | 31.61 | 32.68 | Slightly darker; exposed underlying pigment |
| Constructed | 47.12 | 47.31 | Essentially unchanged |

This is NOT evidence that the inherited original Tissue aura is eliminated.
Suppressing pale ribbons can expose darker original source strokes, as
the Trajectories case demonstrates. Testing similarity to the old faithful
wash incorrectly penalises removal of bloom; tests therefore compare actual
paper pigment and guard material regressions instead of assuming one
global direction for all engine/source palettes.

## Visual review and decision

The contact sheet shows a detectable but fairly restrained physical edge
difference; Oil's big triangular filled hulls still read as hard geometric
cutouts at reduced display scale. Tissue retains visible spray-like soft
pigment around many of the main forms, especially Golden Trajectories and
Constructed Forms. Growth Tissue is a little tighter and narrower.
V5k successfully implements a reproducible geometry-preserving edge
experiment, but it does **not** yet fulfil a convincing painterly edge or
fully fix tissue bloom.

**Decision: keep V5k in experimental DRAFT status. No deployment.**
Further iterations should derive material contact/tearing from *local source
guide direction and edge structure* without enlarging the connected fields
or erasing their negative space.
