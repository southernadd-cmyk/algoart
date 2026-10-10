# ALGO/ART — mathematical constants and visual calibration

This document describes a **small, behaviour-preserving audit**, not a
re-tuning exercise. The generator's renderer version, seeds, layout decisions,
score order, and output must remain identical to the pre-refactor engine.

## Two kinds of values

- **Mathematical / φ-derived:** `A.PHI`, `A.INV`, `A.GOLD` in
  `js/phi.js` and their direct uses, including Fibonacci bases for
  `qphi`. These carry the mathematical design language.
- **Artistically tuned:** weights, margins, thresholds, radii, tolerances,
  iteration budgets, and the placement/scoring preferences used to balance
  attractive drawings. They need names and explanations but **should not be
  retroactively described as derived from φ**.
- **Mechanical / display:** pixel dimensions, rendering tolerances,
  iteration counters, line widths and output scaling. These should be
  documented by purpose, not confused with composition mathematics.

A large literal count is not, by itself, evidence of poor output. Replacing
every number with `φ` would be less honest and would alter the artwork.

## First extraction: `LAYOUT_TUNING`

`js/generator.js` groups 24 existing weights and scoring thresholds under
`LAYOUT_TUNING.strategy` and `LAYOUT_TUNING.layout`. Every stored number
and every use stays exactly the same; no ratios, interpolation, or evaluation
order have deliberately been adjusted. This identifies the calibration,
**not** a public or user-editable settings API.

Important non-duplicates:

| Name | Existing value | Actual purpose |
| --- | ---: | --- |
| `strategy.edgeOuterBandLow` / `edgeOuterBandHigh` | .12 / .88 | Outer 12% reward for the dedicated EDGE strategy |
| `layout.edgeOccupancyBandLow` / `edgeOccupancyBandHigh` | .15 / .85 | Wider 15% region for overall layout edge occupancy scoring |
| `strategy.edgeBonusWeight` | 45 | Reward explicitly edge-oriented arrangements |
| `layout.edgeDeviationPenalty` | 65 | Penalise deviations from a target share of marks near an edge |
| `layout.phiCentroidWeight` | 78 | Strength of the **additional** φ-centroid reward in layout selection |

The two edge bands are different scoring definitions; collapsing them into
one constant would be a **behaviour change**. Similarly, a bare `.62` may
be an approximation or a hand-tuned ratio depending on context; do not
globally replace it with `A.INV` without proving the intent and checking
the numerical results.

## Second extraction: shared φ placement helpers

The 11 **artistically calibrated** values in `js/phi.js` are now named in
`PHI_PLACEMENT_TUNING`. The actual mathematical formulas for `A.PHI`,
`A.INV`, `A.GOLD`, Fibonacci quantisation, golden-section cell cuts and
golden-angle stepping have **not** been rewritten.

| Calibration | Preserved value | Meaning |
| --- | ---: | --- |
| `radialIndexOffset` | .65 | Off-centre index for radial point distribution |
| `minimumGoldenAngleFraction` | .74 | Starting golden-angle step, before extra slider pull |
| `radialWidthFraction` / `radialHeightFraction` | .465 / .455 | Independently tuned canvas-relative radial limits |
| `pointBoundaryInsetPx` | 60 | Bounds for random alternative focal positions |
| `pointMaximumJitterPx` | 150 | Maximum φ-target displacement at weak pull |
| `cellsDefaultMarginPx` / `distributedCellsMarginPx` | 42 / 42 | Fallback cell margin versus explicit distributed-point margin; **distinct purposes**, equal historical values |
| `cellsDepthTieBreakWeight` | .002 | Small depth preference during cell subdivision |
| `distributedRandomLow` / `distributedRandomHigh` | .22 / .78 | Sampling interval within golden cells before pull |

The different radial axis fractions and the two cell margins remain
**separate**. Their similar values do not prove that one should be calculated
from the other. Even a mathematically equivalent-looking transformation (such
as replacing `.74` with a function of φ) would produce different floating
point values and could break old artwork.

The pinned equivalence test additionally exercises every shared placement
helper directly across **36** orientation / φ pull / golden-angle / seed
configurations, including the default and explicit cell margins. It compares
helper results and random-number consumption via reproducible output.

## Strict compatibility check

Run `npm run test:tuning-equivalence`. It loads the pinned, original
pre-refactor source at commit `99611b850bd812354701b8fec464a036d9b2c750`
from Git, then compares it against the current engine for **288** combinations:

- Eight composition systems
- Renderer versions V3, V6 and V7
- Landscape and portrait
- Additional φ Pull at 0%, 91% and 100%
- Two independent seeds per case

It compares the SHA-256 digest of the complete recorded drawing-command stream,
the operation count, canvas dimensions, strategy and serialized layout metadata.
The archived browser fidelity tests continue to run across Chromium, Firefox
and WebKit, checking legacy artworks.

**These tests are a release gate.** Do not update the reference commit or
tolerances merely to make a changed picture pass. New intentional visual
behaviour belongs in a separately reviewed, explicitly versioned change.

## Next steps (separate PRs)

1. Inventory and categorise the remaining literals per composition subsystem.
2. Extract small coherent groups with exact-output equivalence checks.
3. Document plausible duplicates **without normalising them**.
4. Experiment with different artistic weights only in a separately versioned
   renderer, comparing samples and preserving old share links.

This first PR does **not** claim to eliminate or rationalise all of the
remaining tuned values.
