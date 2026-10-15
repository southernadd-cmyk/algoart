# V5p — edge breakup, source-graph tissue laminations, pigment pooling

**Experiment only. No merge/deployment/gallery/social changes.**

## Invariants

- V5o broad connected fields and V5i semantic-guide selections are **unchanged**.
- Faithful Tissue & Graphite V7 is rendered first at its original settings, with its original attractive bloom, graphite and washes fully preserved.
- All physical fragments are bounded by the already-approved V5o source-owned hull and protected voids. No Voronoi/raster segmentation, invented composition field, extra random region, or new palette family.
- Existing Oil material and Recursive Divisions remain pixel-identical to V5o.
- The material-only details are deterministic from the original field seed.

## Physical stages

1. **V5p1 `edge`**: multiscale torn contour, retreating inward 1.1–16.2 source pixels from the existing V5o hull; discontinuous wet-pigment rim deposits and sparse warm raised fibres; never an external bloom filter.
2. **V5p2 `layers`**: one light broad tissue foundation plus 2–4 separate irregular translucent physical strips, following edges **verified by the same V5o source-guide semantic graph**. Gradual taper and independently displaced fringes distinguish individual torn sheets; multiply blending darkens overlaps.
3. **V5p3 `pooled`**: local subtractive pigment pooling **only** at actual source guides shared by two or more selected guide-linked tissue strips.

Render `A.renderInterpretedV5P(target,settings,scale,{material:'tissue',interpretation:'areas',stage:'edge'|'layers'|'pooled'})`.
The stage option is experimental, not exposed by the live site.

## Browser evidence — 15 October 2026

[Passing GitHub Actions run 38802618907](https://github.com/southernadd-cmyk/algoart/actions/runs/38802618907)
|
[32 genuine renderer PNGs, contact sheet and JSON statistics](https://github.com/southernadd-cmyk/algoart/actions/runs/38802618907/artifacts/12004248686).

| Engine | V5o broad fields | Torn edge deposits | Separate linked sheets | Junction pigment pools | Pixels changed by layers vs edge | Pixels changed by pooling vs layers |
|---|---:|---:|---:|---:|---:|---:|
| Growth Systems | 4 | 309 | 10 | 32 | 13,876 | 1,301 |
| Golden Trajectories | 4 | 235 | 13 | 48 | 10,846 | 1,731 |
| Constructed Forms | 2 | 190 | 7 | 24 | 8,423 | 1,052 |
| Recursive Divisions | 0 | 0 | 0 | 0 | 0 | 0 |

The tests additionally assert:
- byte-identical faithful V7 and V5o Oil;
- exact preserved V5o source fields and source provenance;
- all four original seeds repeat identically;
- no coloured pixels change beyond original broad-field bounding envelopes;
- no changed pixels inside protected negative-space rectangles;
- visible edge / layer / pooling differences;
- physical layers follow source-owned legal guide connections.

## Visual review / remaining limitation

The V5p1 stage visibly lifts the heavy filled polygon effect. V5p2 restores depth through overlapping translucent strips rather than one hard flat mass. V5p3 adds subtler pooling where strips share original source junctions, especially noticeable at larger viewing scales.

**Still HOLD / draft.** Some long connected Growth edges keep a geometric direction at overview scale. The paper/ink is now less opaque, but convincing torn-fibre microstructure and the balance of softness vs overall connected mass should be judged in the actual full-size PNGs. Do not claim this completely solves the material look.
