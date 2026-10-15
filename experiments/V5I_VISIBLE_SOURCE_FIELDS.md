# ALGO/ART V5i — visible source-derived colour fields

**Experiment only, no merge/deploy. Faithful, rectangles and original material renderers are unchanged.**

## What changed since V5h

V5h corrected the provenance problem by deriving fields from real V5d territories, but its large pairwise convex hulls repeatedly obscured each other. **Four guide-pair records did not equal four readable colour masses.**

V5i starts with recorded geometry rather than cutting up any finished mask:

- Growth: relationships are drawn from the original `guide.segments` with branch and depth (V5d painted territories).
- Golden Trajectories: recorded `guide.points`, ordered by arm and local progression. Instead of covering a huge hull, each pair can produce *two directed source-owned regions*, reaching toward the other guide by **φ⁻²** (about 0.382) from their respective original contours; central negative space is intentional.
- Constructed Forms: the actual `guide.items` with their positions, size, rotation and focal tier; also uses source-owned directed connections by φ⁻² to prevent the hero object's hull swallowing supporting forms.
- Recursive Divisions: existing V5c exact φ cells are unchanged.

The selection is visibility-aware **without changing candidate geometry**: compare *occupied interior cells* of each legitimate source pair, and reject a pair if painting it would hide an existing field or leave insufficient unpainted interior for the new one. All candidates retain their exact guide pair IDs, SVG source indices and locally sourced pigments. The region outlines are drawn from the already-recorded guides, not from a Voronoi/puzzle mask or a random set of boundaries.

A separate flat **numbered** geometry preview makes the discrepancy between field IDs and actual visually exposed regions inspectable. These numbers are diagnostics only, not drawn into the material images.

## Actual test: 15 October 2026

[Passed run #38778480902](https://github.com/southernadd-cmyk/algoart/actions/runs/38778480902), with V5e/f/g/h frozen regression suites and the V5i real browser comparison.

| Source engine | V5h recorded relationships | V5i actually visible fields | Changed Oil pixels vs V5h | Changed Tissue pixels vs V5h |
|---|---:|---:|---:|---:|
| Growth Systems | 8 | **6** | 23,935 | 24,949 |
| Golden Trajectories | 5 | **4** | 17,891 | 12,807 |
| Constructed Forms | 7 | **5** | 12,218 | 11,495 |
| Recursive Divisions | Original φ cells | unchanged | **0** | **0** |

Tests verify determinism, actual four-connected raster occupancy, each area linked to two exact guide records, 4+ fields whose exposed fractions are **at least 65% each**, measured 2D painted interior, and pixel-identical historical Recursive Divisions. The Oil interior coverage by sampled occupied cells is 94.6% Growth / 95.7% Trajectories / 89.8% Constructed; Tissue 99.8% / 99.8% / 99.3%.

## Visual review status: still experimental

The contact sheet shows the large V5g mega-masks replaced by geometry-owned sections with negative space. There is clearly more separation in Spiral and Constructed Forms. The original source palette is often tightly related (warm/orange/yellow), so even fields that are 65% exposed can *read* as a fewer colour groups. Oil's regular loaded-bristle bands and Tissue's opaque polygonal cuts also still need material-specific refinement. The material physics isn't the focus of V5i, so **do not claim completed painterly fidelity** or deploy. The numbered flat-plan screenshot is for reviewing this distinction; 4+ mathematically visible is not a guarantee that a viewer can immediately count 4+ coloured masses.

Source `js/composition-guide-fields-v5i.js`; browser test `tests/v5i-visible-source-fields.mjs`. Real compare contact sheet at `v5e-results/v5i/v5i-guide-fields-comparison.jpg` in workflow artifact. All original V5e/f/g/h files remain frozen.
