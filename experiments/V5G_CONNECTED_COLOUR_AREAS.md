# ALGO/ART V5g — connected colour areas, all materials share geometry

**EXPERIMENTAL: DO NOT DEPLOY / MERGE.**

## Defect corrected

V5e and V5f generated large colour patches but still behaved as enhanced source strokes. Tissue & Graphite revealed the issue as weak brown translucent overlays. This is **not a tissue-specific problem**. The common interpretation plan must produce genuine connected regions *first*.

## Implementation

- `js/composition-connected-v5g.js` wraps (does not modify) frozen V5f.
- Source-supported parent areas from the real ALGO/ART organic / trajectory / constructed guide become a binary occupancy grid. Cells are **filled 2D interiors**, not stroked paths.
- A small morphological closing joins closely related areas and fills gaps between real source guides. Four-neighbour flood fill establishes connected components, then boundary tracing extracts the actual area silhouette.
- Each area carries its real interior grid cells, verified connectivity, physical area, colour families, originating source IDs and protected negative-space metadata.
- Recursive Divisions' V5c φ-rectangles remain untouched.
- `js/v5g-material-adapters.js` renders this one planner as complete occupied regions, not independently widened ribbons or a hazy halo. Oil fills the area then applies V4e loaded bristle contacts; Tissue creates a connected main torn-paper sheet with multiply-darkened independent supporting layers. Previous line/guide overlays are disabled for connected nonrectilinear fields.
- The flat plan view `renderConnectedPlanV5G` shows the geometry with solid colour and no brush/paper tricks.
- `tests/v5g-connected-areas.mjs` compares 4 real engines × Oil/Tissue × Faithful/frozen V5f/V5g (24 source-rendered PNGs), plus four flat-plan PNGs. It verifies flood-fill connectivity, measurable occupied interior, real source provenance, stable deterministic output, and unchanged Recursive Divisions.

## Required acceptance

The connected flat plan must read as areas, not clustered blobs, thickened lines or source strokes. Tissue's physical paper must fill the *inside* of these areas rather than appear as a second brown wash. Oil's filled volume must remain visibly painted, not a hard graphical cutout. Material differences are applied **after** the shared boundaries are approved.

No release until real browser-image tests **and** visual review pass. The historical Faithful material output must remain byte-identical.

Current status: technically passing, visual evaluation complete with material-quality HOLD; draft PR #96, not deployed.

## Browser results — 15 October 2026

**Technical gate PASS, visual/mature-material gate HOLD.**
[Passing source-render CI 38770207009](https://github.com/southernadd-cmyk/algoart/actions/runs/38770207009).
[Download complete artifact 11990822862](https://github.com/southernadd-cmyk/algoart/actions/runs/38770207009/artifacts/11990822862)
contains four material-neutral flat plan images and 24 source-rendered material comparisons (plus historical V5e/f evidence).
The new contact sheet is `v5e-results/v5g/v5g-connected-flat-oil-tissue.jpg`.

| Engine | Connected areas | Filled plan area (source units²) | Oil changed pixels vs V5f | Tissue changed pixels vs V5f | Sampled occupied interior coloured |
|---|---:|---:|---:|---:|---|
| Growth Systems | 2 | 497,520 | 75,028 | 92,118 | Oil 97.7%, Tissue 100% |
| Recursive Divisions | 0 (existing V5c φ-cells retained) | 0 new | 0 | 0 | unchanged |
| Golden Trajectories | 1 | 420,192 | 66,247 | 75,159 | Oil 99.1%, Tissue 100% |
| Constructed Forms | 1 | 124,128 | 23,731 | 23,778 | Oil 95.8%, Tissue 100% |

The original source-linked plans are deterministic. The comparison check
reconstructs each connected component using four-neighbour flood fill and
samples actual occupied *interior* cells, rather than merely counting changed
pixels outside the strokes.

### Significant technical fix in Tissue V7 composition

The original Tissue V7 faithful baseline left canvas context state affecting
the first experimental overlay. V5g's initial test changed pixels but coloured
**zero** sampled interior cells. Resetting the experimental Tissue canvas
presentation context after preserving/reblitting its faithful pixels solved
the problem, increasing connected field coverage to 100%. The reset is
applied **only** to nonrectilinear connected-field mode: doing so for the
existing V5c rectangular interpretation initially caused a regression, so
that is explicitly excluded and its output is pixel-identical again.

### Real visual review — geometry works, material fidelity still needs refinement

The flat-plan column and both material outputs clearly show contiguous
**two-dimensional colour masses** between the source marks. This meets the
central geometric criterion that V5e/f missed. Growth has two sizeable
filled areas; Trajectories has one large connected field; Constructed Forms
has a smaller primary group; Recursive Divisions remains unchanged.

However, the new field boundaries are relatively smooth and graphic. The
Oil paint has rather regular broad-bristle banding in some areas, while the
Tissue overlay can become a highly saturated, near-opaque single-colour cutout
rather than delicate layered tissue. These are real visual limitations,
**not** reasons to return to thin traced line overlays.

**Decision:** V5g is implemented and technically validated; keep PR #96
as DRAFT / do not merge or deploy. Future material fidelity improvements
should retain the filled, connected shared geometry and refine Oil's
pigment mixing and Tissue's translucent layering/edge fibres independently.
