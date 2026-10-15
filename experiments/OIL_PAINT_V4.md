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
