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

## Actual V5c test run and visual review — 15 October 2026

[Refined/passing V5c GitHub Actions run 38738703090](https://github.com/southernadd-cmyk/algoart/actions/runs/38738703090) produced **18 genuine ALGO/ART renderer PNGs** (3 engines × Oil/Tissue × Faithful/V5b/V5c), an A/B/C comparison contact sheet and machine-readable territory/lineage plans.

The first V5c render passed tests but made Oil colour planes muddy by **averaging unrelated source hues**. This was corrected in the refined pass: territory colours are now selected from **locally concentrated original source pigments** and mixed only within a coherent colour family. Vivid pink, green and purple from the source seed are preserved, rather than brown/grey mixtures.

| Tested source | Candidate semantic cells | Painted | Framed/unfilled | Reserved excluded | Result |
|---|---:|---:|---:|---:|---|
| Recursive Divisions | 7 | **3** | **4** | **2** | Genuine φ-cell colour planes |
| Growth Systems | 0 | 0 | 0 | 0 | V5b directional-gesture fallback, unchanged |
| Golden Trajectories | 0 | 0 | 0 | 0 | V5b directional-gesture fallback, unchanged |

The source plan for Recursive Divisions preserves 1 original reserved void. Each of the 7 retained semantic territories has its exact original cell contour, source-lineage IDs and a seed-coherent pigment colour. All six historical Faithful test images remain pixel-identical, all six V5c rendered images are deterministic, and the two materials receive the same territory and gesture plan.

Real pixel changes from the matched faithful output (scale .40, count of pixels above the test RGB-difference threshold):

| Engine | Oil V5c | Tissue V5c |
|---|---:|---:|
| Growth | 22,160 | 3,771 |
| Recursive Divisions | **94,255** | **17,242** |
| Golden Trajectories | 13,316 | 2,339 |

These are difference counts, **not artistic quality scores**. In the rectilinear case, the effect is substantially larger than V5b (Oil 5,995; Tissue 1,281). The large difference comes from interpreting actual large source-subdivision interiors as colour planes, rather than widening isolated source strokes.

### Human visual verdict

**V5c makes a substantial compositional improvement for Recursive Divisions.** The Oil image has three deliberately painted colour planes rather than only an outline drawing. Other rectangles remain open, and the source's bright palette is legible. The Tissue image visibly places layered coloured sheets into the same planned cells, but the extra paper treatment is still weaker and visually less compelling than the Oil treatment.

**Limitations remain significant.** Rectangular Oil planes can appear too neat or acrylic-like; they need smarter bristle-blocking and mass variation in the material adapter. Tissue’s large sheets sometimes read as dark translucent panels rather than torn, fibrous paper. Critically, the Growth and Trajectories cases are identical to V5b’s region strategy: their generators lack rectangular `guide.cells`, so V5c intentionally did **not fabricate enclosed territories** from arbitrary curved marks. The shared architecture now supports semantic cell plans, but full eight-engine semantic interpretation is **not complete**.

**Decision: HOLD, leave draft PR #92 unmerged/unreleased.** The next extension should use the explicit source-guide semantics (organic roots/segments, spiral centres/arms, constructed forms, etc.) to identify coherent focal masses and deliberately open areas, instead of pretending all curved paths surround paintable interiors. Independently improve Tissue's cut-paper representation, preserving V7 output by default. Do not integrate Watercolour/Marker or enable the mode live until the shared interpretation genuinely generalises.
