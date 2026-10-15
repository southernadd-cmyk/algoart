# ALGO/ART V5c — semantic φ territories (experimental)

**Status: draft / do not merge.**
Branch: `experiment/v5c-semantic-territories`

## What V5b demonstrated

V5b proved that the *same* deterministic source-derived V5 plan can drive
distinct Oil and Tissue & Graphite adapters while keeping original Faithful
render bytes unchanged. Its colours and source paths remained reproducible.
But visual review showed that proximity-grown strokes still look like thick
drawings, rather than interpreting **enclosed φ territories**.

## V5c improvement

V5c reads the **real generator metadata** from Recursive Divisions:
`source.meta.guide.cells` — the exact mathematically subdivided leaf
rectangles, complete with their hierarchy/depth, bounding boxes, φ-framed
coordinates and explicit source reserved voids. It does not infer rectangles
from a proximity hallucination. Other engines retain source-linked
directional masses and gesture marks, not invented enclosed objects.

New material-neutral output:
- `territories`: actual cell, original rectangular contour, source
  stroke-lineage indices, source-derived mean colour, hierarchy/depth,
  deterministic ID and semantic role: **painted** or **framed**.
- `protectedVoids`: source-defined reserved empty cells; never reinterpreted
  as coloured areas. Rectangles overlapping those reserved cells are excluded.
- `regions`: local source-linked directional masses, now checked against
  void boundaries; for rectangular mode these become *secondary brush gestures*
  rather than asserting every line is itself a region to fill.
- `gestures` and `accents`: remain separate detailed marks.
- `territoryStats`: count of candidates, painted interior, framed interior
  and excluded voids for acceptance tests.

We deliberately do **not** colour every framed subdivision. Cells without
supporting actual source geometry remain unpainted; a selected subset of
supported interiors receive colour. The original negative-space composition
must remain recognisable, not filled as a coloured checkerboard.

## Material-specific translation of ONE plan

- **Oil**: broad opaque colour-block underpainting constrained to each
  selected φ cell, followed by directional *real* V4e loaded bristle strokes
  inside the cell. The same painted contact contributes colour and relief.
- **Tissue & Graphite**: the corresponding φ cells are expressed as larger
  multiply-overlapped, physically irregular torn tissue sheets. Original
  graphite linework continues to frame and describe the composition.
- **Faithful**: identical existing Oil V4e or Tissue V7 pixels. No production
  material setting, historical URL semantics, or published seed changes.

## Evidence gate

Render matching Growth Systems, Recursive Divisions and Golden Trajectories
seeds in both materials as **Faithful / V5b / V5c** = 18 actual PNGs, a
six-column comparison board and JSON provenance report.

Hard assertions:
1. Planner and final material pixels repeat identically with same source seed.
2. Oil and Tissue share *exact* region and territory plan and source lineage.
3. Faithful renders are pixel-identical to original material versions.
4. Synthetic φ subdivisions create painted and framed choices **and exclude
   actual reserved voids**, with no unsupported source-less painted cells.
5. Real Recursive Divisions has protected empty cell interiors and visible
   territory-based colour planes, without a wholesale blanket colour fill.
6. Existing history tests and renderer lock remain green.

Human visual review still decides whether V5c successfully changes *painted
composition* rather than applying extra decorative areas. Do not advance
Watercolour/Marker integration or editor UI until the shared logic succeeds.
