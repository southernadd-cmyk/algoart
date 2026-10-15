# ALGO/ART V5j — material legibility refinements

**Experiment only. Do not merge/deploy.** The V5i source-guide field geometry is frozen and unchanged. No live gallery or social workflow is affected.

## Problems observed in actual V5i material renders

V5i successfully kept six, four and five genuine source-derived fields visible (Growth, Trajectories, Constructed), but adjacent fields often had similar local pigment colours; Tissue became visually opaque as coloured cutouts, and Oil showed regular rows of bristle dabs. This stage **changes only pigment selection and material physical expression**, not the field-making or source geometry.

## Implemented changes

1. `js/composition-material-v5j.js`: material pigment `paintRgb` and `paintPalette` are separate from the source `rgb` and original `palette`. Candidate colours are source family pigments or modest paper tints / ink shades of those pigments. Deterministic nearest-neighbour optimisation increases contrast **only** when real V5i fields are spatially adjacent. Each candidate stays within RGB Euclidean distance 74 of the source pigment. This is not a new random palette.
2. `js/v5j-material-adapters.js` Oil: keep complete 2D pigment interiors but use the V4e loaded-contact brush along the actual source **branch axes, ordered trajectory axes or placed object orientations**, adding short bridge touches between their real paired guides. Position, drag, width and loading vary stochastically yet deterministically; no square grid or evenly spaced bands.
3. Tissue: .46-opacity source-shaped sheet, with two overlapping translucent physical sheets at .22 and .16 using multiply-darkened overlaps. Sheet edges receive small fibre irregularities rather than an additional opaque polygon or airbrush halo. Only the trial material interpretation is adjusted; the faithful Tissue & Graphite renderer and its baseline remain frozen.
4. `tests/v5j-material-legibility.mjs`: 24 material images (4 source-engine modes × 2 materials × Faithful/V5i/V5j), eight flat source/pigment plan PNGs, a full contact sheet and machine-readable evidence. Confirms unchanged source guide IDs, paths, colours, contours, occupancy and seed, stable output, actual painted interiors and unchanged Recursive Divisions.

## Passing browser evidence, 15 October 2026

[GitHub Actions run #38781789697](https://github.com/southernadd-cmyk/algoart/actions/runs/38781789697) — [full 34.7 MB images/metadata artifact](https://github.com/southernadd-cmyk/algoart/actions/runs/38781789697/artifacts/11995533314).

| Mode | V5i visible fields preserved | Adjacent pigment pairs improved | Oil: sampled mean ΔRGB against faithful V5i→V5j | Tissue: sampled mean ΔRGB against faithful V5i→V5j |
|---|---:|---:|---:|---:|
| Growth | 6 | 4 of 6 | 169.6 → 137.2 | 319.8 → 157.9 |
| Trajectories | 4 | 1 of 4 | 234.4 → 166.4 | 300.1 → 142.3 |
| Constructed | 5 | 6 of 9 | 119.1 → 105.2 | 307.5 → 153.6 |
| Recursive Divisions | Existing V5c | — | **pixel-identical** | **pixel-identical** |

In the same three non-rectangular images, the V5j Oil interior is painted on 93.4%, 95.2%, and 93.7% of sampled occupied field cells; Tissue on 99.5%, 99.4%, and 98.9%. Thus the lighter Tissue is still a filled 2D **area**, not a collection of extended marks. The new Oil source-axis contacts number 137, 100 and 116 respectively; Tissue fields consist of 18, 12 and 15 physical sheets.

## Visual judgement and remaining limits

The result is visibly less heavy in Tissue and the Oil contacts are less repetitive while retaining the source-derived field placement. The existing Oil/Tissue faithful baselines are still visible: the Tissue base itself has soft sprayed/blooming pigment beyond painted areas, and the connected-area hulls can still look rather hard-edged and triangular in Oil. Changing that will require a future geometry-faithful *edge/material* refinement (e.g. breaking up the boundary with physical fibres/brush tips), not arbitrary new planar divisions. Some nearby fields share original pigment families and can continue to read as one colour mass. Neither issue is declared solved.

**Decision:** V5j is a tested, reversible material experiment for visual review; do not release automatically. Compare original same-seed Faithful/V5i/V5j images before any further refinement.
