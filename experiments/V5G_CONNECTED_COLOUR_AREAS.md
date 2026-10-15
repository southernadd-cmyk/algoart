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

Current status: implementation on draft PR #96, isolated browser tests pending final results.
