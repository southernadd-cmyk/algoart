# ALGO/ART Oil Paint V4 — Brush Laboratory

**State:** experimental only; branch `experiment/oil-paint-v4-brush-lab`. Do not release, change the live material picker, or modify historical renderer output. The frozen V3c branch remains the comparator.

## Goal

Before attempting V5 shared composition interpretation, prove that a *single*
brush leaves believable physically varied oil marks. Avoid additional random
texture filters, repeated square/pixel tips, and full-canvas fluid simulation.

## V4 implementation

- A new independent `js/oil-paint-v4.js` renderer based on the established
  source recorder and φ framing. V1, V2, V3 and V3c files are unchanged.
- Smooth interpolated **brush contact at spacing relative to brush width**.
  The path geometry is Catmull-Rom interpolated between the source points.
- A deterministic **continuous pressure function** controls width,
  footprint shape, taper and loading, rather than selecting a new independent
  on/off contact event for every path point.
- Four materially distinguishable profiles: rounded **filbert**,
  **flat**, broken-contact **dry bristle**, and broad **palette knife**.
  Pigment silhouettes and heightmap deposits use exactly the same paths.
- Subpixel curved contact edges, irregular bristle distribution, tapered tip,
  connected deposits and correlated rather than checkerboard texture.
- Independent brush lab: **4 profiles × 4 diagnostic gestures** (straight,
  curved sweep, short/lift, diagonal), at 100% plus 200% nearest-neighbour
  detail. Four original-source engine diagnostic crops are also generated.
- Sixteen matched seed studies with V3c reference images, manifest and
  timing/paint-height statistics.

## Acceptance

1. A single opaque stroke convincingly looks like a loaded oil-brush deposit
   at both normal scale and 100% detail—not a comb, raster grid or smooth ink.
2. All four brushes have *visibly different contact behaviour*, not merely
   different alpha or decorative groove count. Dry bristle has coherent
   lifted passages, knife has sharp broader mass, filbert tapers naturally.
3. At the short-stroke, curved-stroke and crossing test cards, pressure is
   continuously varying and relief follows the coloured paint footprint.
4. Sixteen full paintings preserve seed/source geometry, colour hierarchy,
   φ composition and intentional negative spaces, with an improvement in
   oil impression compared with frozen V3c.
5. Historical materials pass existing tests, deterministic repeat is
   byte-identical, and desktop/mobile memory/runtime cost is reported.

**Visual gate:** meaningful improvement at normal size; do not conflate
successful CI and beautiful oil painting. If the laboratory fails, fix brush
contact *before* attempting the V5 shared planner.

## Research and next step

Ideas informed by the Krita Bristle and Colour Smudge brush engine
documentation, libmypaint's continuous dab positioning, and the existing
ALGO/ART V1–V3c studies. Implementation is original Canvas2D logic; it
does not use AI image generation.

After the first GitHub Actions run, record the actual measured performance,
a straight comparative verdict, any remaining square/pixel artifacts and
precise V4b brush adjustments. Do not modify V5 to incorporate oil-specific
pressure, paint reservoirs or physical material properties.

## Actual V4a and V4b review — 15 October 2026

GitHub Actions runs:
- **V4a**, [38696510409](https://github.com/southernadd-cmyk/algoart/actions/runs/38696510409): passed. First 4×4 brush laboratory and 16 V4a composition images, with frozen V3c baselines. This is the original V4 brush experiment artifact.
- **V4b**, [38697219256](https://github.com/southernadd-cmyk/algoart/actions/runs/38697219256): passed. Revised brush contact with correlated irregular paint edges, patch-like loaded paint and shorter bristle trails. The comparator filenames are corrected to identify V3c accurately.

V4b produces **16 images using the original 16 seeds**, 16 source-matched V3c references,
the real brush test sheet and 100% / 200% tip details. **1,662 source paint paths**
across the 16 studies remain retained. The four profiles are genuinely used:
**1,006 filbert, 346 flat, 249 dry-bristle and 61 knife paths** across the set.
Mean V4b drawing time was **208.2 ms** versus **182.7 ms** for the paired V3c
baseline (CI Chromium, 0.7 rendering scale; **~14% slower**). Maximum height
saturation fraction was **0.00053**, so the old four-unit paint-ceiling issue
has not reappeared.

### Visual verdict

**V4a:** passes physics/determinism, but the diagnostic sheet exposes very
regular smooth ribbons, apparent parallel interior filaments and clean cut
tips. Technically stable, visually insufficient.

**V4b:** local irregular paint islands and broken bristle trails produce
more sculpted and varied tips on the real four-profile lab sheet. The dry
profile is particularly distinct; the knife pass produces broader masses.
However, outlines are still often too clean and flat for real oil deposits.
At normal artwork size the original ALGO/ART long lines still dominate;
the 16 compositions have only a modest difference versus V4a/V3c.

**Decision: HOLD.** Neither V4a nor V4b meets the human visual gate for
convincing oils. Do not merge, expose Oil in the live material selector,
send to daily galleries/social, or begin treating the shared V5 planner
as a fix for underdeveloped brush physics. V4b is the current experimental
baseline and is preserved separately from V3c.

### Recommended targeted V4c

1. Test more credible *multi-hair tip contact*: an irregular clustered,
   splitting brush edge rather than a solid vector body plus interior
   bands. The actual contact footprint must carry both pigment and height.
2. Give strokes a visible **loaded-to-depleted paint transition**, including
   local paint gathering at side edges, heel and toe; vary transferred mass,
   not simply alpha opacity.
3. Move beyond universally lit, homogeneous surfaces by tying constrained
   highlights and shadows to meaningful paint ridges, not added grain.
4. Review **only the diagnostic single strokes and contact crossings first**.
   Make one convincingly oily stroke at 100% and gallery size before expanding
   to another 16 full compositions.

V5 will remain a **shared, optional material-agnostic composition
interpretation planner** when its time comes; V4's brush physics stays oil-only.
