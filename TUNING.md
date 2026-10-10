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

## Third extraction: element sizing and hierarchy

The 27 existing calibration values in `js/generator.js` are grouped under
`HIERARCHY_TUNING.tiers`, `HIERARCHY_TUNING.scale` and
`HIERARCHY_TUNING.size`. They affect **how many heroes / medium marks** are
planned and the artist-tuned **relative and absolute sizes** of marks. Their
original values, interpolation, φ quantisation and RNG calls are unchanged.

| Group | Existing parameters | Why they are independent |
| --- | --- | --- |
| Hero thresholds | 24 and 70 marks | Jump from one to two to three heroes; these are hierarchy design choices, not golden ratios |
| Medium share | .16 (MONUMENT), .21 (other) | Different proportions deliberately leave the monumental hero more room |
| Hero scale | 2.35 (MONUMENT), 1.72 (other) | Distinct emphasis in the hero tier |
| Supporting scale | .48 (MONUMENT), .56 (other) | Background tiers remain subordinate |
| Count reference | 48 | Controls inverse-square-root scaling as total element count grows |
| Density factor range | .76–1.18 | Hand-chosen response to the Density control |
| Raw mark-size range | 32–215 | Random source sizes before scale and extra φ pull |
| φ quantisation base | floor 7, scaled base 22 | Tuning of the size grid; 22 is **not** a mathematical φ identity |
| Hero size floor | 110 (MONUMENT), 72 (other) | Keep heroes visually dominant |
| Territory fit | floor 20, factors .78–1.22 | Restrict sizes to their intended spatial territory |
| Final size limits | floor 8, caps 470/410 | Prevent excessively small or huge marks |

The original single-hero rule for MONUMENT, the normal hero counts 1/2/3
and the minimum-medium target of 2 are also named. Similar-looking numbers
elsewhere in the engine are **not** deduplicated: different systems may
intentionally have different visual weights.

The pinned equivalence suite now additionally compares **216 full output
cases** across Orbital Studies, Connected Fields and Golden Trajectories,
strategy seeds for BALANCED/MONUMENT/EDGE, both orientations, both extremes
of additional φ pull, and element counts **1, 23, 24, 69, 70, 140**.
It checks drawing-command hashes and layout metadata, including the
24- and 70-element thresholds, so a silent aesthetic drift is a test failure.

## Fourth extraction: placement constraints and collision handling

The 29 artist-calibrated values in `PLACEMENT_TUNING` group the
**protected negative-space boundaries**, mark-to-mark collision spacing,
and placement-candidate search budgets. The values remain byte-for-byte
equivalent to the old literals: the code keeps the same comparisons,
arithmetic order, canvas clamps and RNG call order.

| Calibration group | Preserved examples | Why they matter |
| --- | --- | --- |
| Void activation | .08 | Threshold to reserve any protected blank space |
| Two-void thresholds | .70 globally, .42 for VOID | Two distinct design rules; both use strict `>` comparisons |
| Void cell selection | 10 cells, 54 px margin, stride 3, pool of 8 | Deterministic selection from φ-divided territories, not φ constants |
| Reserved-region bounds | .46–.88 scale, 1.08 VOID boost, 110/90 px floors, .43 canvas cap, 34 px inset | Shape and placement of preserved blank regions |
| Void clearance | .38 mark-radius fraction, 4–34 px pad | How far an element should stay from an exclusion |
| Pair spacing | 1.12 hero boost, .12–.72 overlap response | Minimum desired spacing; distinct from EDGE-strategy .12 and φ-related .72 elsewhere |
| Penalty weights | 4–14 | Influence of negative-space intrusions during placement |
| Search budgets | 30 hero tries, 22 supporting tries | Candidate-budget limits; reducing these changes random-number consumption |
| Retry handling | .28 shrink cap, .012 shrink increment, 28 px inset, .012 acceptance threshold | Prevents excessive collision without losing seeded layouts |

**Near-matching values are not automatically interchangeable.** For example,
the `.12` here is a *pair-spacing* response to Overlap, not the EDGE band
or a golden-ratio constant. The `.012` shrink increment and acceptance
threshold are equal by coincidence of their original calibration, and remain
separate parameters.

Beyond the existing 288 whole-artwork, 36 helper and 216 hierarchy checks,
the pinned compatibility test now compares **112 additional complete
compositions**, covering both Field/Network, VOID/EDGE strategies, orientations
and overlap extremes. Negative Space is sampled at 0, 8, 42, 43, 70, 71 and
100 to catch differences at the original strict threshold boundaries.

**No changes** to the segment/void intersection algorithm, `A.PHI`,
`A.INV`, `A.GOLD`, seeded RNG, canvas sizes or version selection.

## Fifth extraction: field-family relationships and scoring

`RELATIONSHIP_TUNING.legacy` and `RELATIONSHIP_TUNING.v3` name **37 existing
values** across the two different field relationship engines. The original
focal-point, distance and angle mathematics, seeded random decisions, and
calculation order are unchanged. Equal values retain distinct names in the
different renderer generations so a future change cannot accidentally
alter both.

| Purpose | Legacy | V3 | Why it matters |
| --- | ---: | ---: | --- |
| Medium/small φ-distance snap | .20 / .12 | .30 / .18 | Higher V3 attraction to quantised family distances |
| ORBIT/MONUMENT/EDGE snap factors | 1.35 / .75 / .70 | 1.35 / .78 / .72 | Strategy-specific alignment, not general φ constants |
| Medium/small snapping probability | .72 / .48 | .84 / .62 | Changes how often seeded placements move |
| Medium/small rotation alignment | .46 / .26 | .46 / .26 | Keeps nearby marks oriented around their hero |
| ORBIT/DIAGONAL alignment boost | .14 | .14 | Stronger directional organization |
| Medium/small relation metadata | .78 / .48 | .84 / .56 | Distinguishes compositional family strengths |
| Medium/small score weighting | 1.45 / .70 | 1.45 / .70 | Relative contributions to the overall layout ranking |
| Distance/angular score weights | 1.80 / .90 | 1.95 / 1.05 | Separate aesthetic rewards for proportion and alignment |
| Overall score weight | 34 | 36 | Impact of family relationships on candidate selection |
| Baseline φ score contribution | .45 | .45 | Existing nonzero relationship importance at weak φ pull |

The legacy model also independently retains its .72 small-family colour
choice probability. The Fibonacci quantisation base `34`, exact φ
constants and existing `s.phiStrength/180` control scaling remain in the
original formulas: they are deliberately **not** relabelled as artistic
tuning. The V3 accent-colour system remains outside this extraction.

The pinned engine test includes **168 new full V2/V3/V7 Field
compositions** spanning all seven strategies, 24/70 elements, portrait
and landscape, and 0%/100% additional φ Pull. It checks exact drawing
command hashes and layout metadata, catching changes to the legacy or
V3 family-building code and its random-number consumption.

## Sixth extraction: strategy attraction and spiral placement geometry

`STRATEGY_GEOMETRY_TUNING` gives names to **24 unchanged artistic
calibrations** in `js/generator.js`: nine values controlling
strategy-specific placement, six values in the V4 logarithmic-spiral
placement helper, and nine values in the candidate-position blending
and retry path. These are not general-purpose φ identities.

| Area | Preserved examples | Role |
| --- | --- | --- |
| TENSION and ORBIT | .72 / .48 | Pull toward opposing hero targets or spiral orbit |
| EDGE | 38 px inset / .38 pull | Prefer the border without forcing every mark to it |
| MONUMENT | .68 hero pull, .62/.58 satellite centre, .12 satellite pull | Distinguish dominant and supporting forms |
| DIAGONAL | .42 | Attraction to the designated diagonal |
| V4 spiral start | .65 index offset, .17 retry shift, .02 progress floor | Avoid zero-radius starts, vary retry positions |
| V4 spiral reach | 2.35 turns, .43 canvas radius, .035 golden-phase retry nudge | Hand-tuned sweep, spacing and canvas reach |
| Candidate retries | Cell stride 5; pre-V4 index/phase shifts .28/.23 | Preserve deterministic search across renderer generations |
| Position blending | .78 spiral limit, .16–.90 cell mix, .62 hero/1.08 small scales | Control how tightly marks follow territorial layouts |
| Remaining freedom | 36 px | Hand-drawn positional freedom when Additional φ Pull is low |

The expression `b = 2 * Math.log(A.PHI) / Math.PI` is the **actual
logarithmic-spiral mathematical relationship**, and the golden angle
`A.GOLD` is unchanged. In contrast, the 2.35-turn extent, .43 canvas
radius and .035 phase adjustment are artist-chosen geometry. The .65
spiral-index offset remains independent from the .65 offset in
`js/phi.js`; they are equal historical values with separate meanings.
The approximate .62 MONUMENT x-coordinate is **not** silently replaced
with the more precise `A.INV`, which would alter existing seeded art.

The pinned compatibility suite adds **168 complete V2/V4/V7 Field
compositions** covering all seven placement strategies, 24/70 elements,
both orientations, and 0/100% Additional φ Pull. Another **32 Golden
Trajectories tests** cover V3/V4/V6/V7, orientations, Golden Angle at
0/100 and φ Pull at 0/100. Exact drawing commands and metadata are
compared against the same immutable pre-refactor reference. No renderer
or algorithm was redesigned.

## Seventh extraction: Constructed Forms engine

`CONSTRUCTED_TUNING` names **27 unchanged engine-specific artistic
parameters**. This is intentionally **not** a shared configuration for
Scribble, Growth Systems, or any other drawing engine. It preserves the six
Constructed Forms substyles: BALANCE, STACK, AXIS, COLLISION, FLOAT and CROP.

| Subsystem | Existing values | Purpose |
| --- | --- | --- |
| Form count | 7–34 shapes; base 7; Elements × .15 and Complexity × .075 | Keep collages sparse and legible |
| Constructed style | Curve Bias cap 12; Wobble cap 16; Overdraw cap 4 | Crisp geometry rather than loose strokes |
| Ghost guides | Thickness × .58; Opacity floor 18 and × .58; Overdraw × .65 | Subordinate construction lines to the main marks |
| Form size | Hero floor 170 px; small cap 150 px; overall floor 24 px; CROP cap 470 px versus 390 px otherwise | Keep a clear focal hierarchy without suppressing deliberate cropping |
| Shape aspect | Random ratio 1.12–1.92 before φ pull | Expressive initial proportions before φ influence |
| Form handling | Line half-length × .72; hero accent chance .48 + Nesting/250 | Encourage distinct line and nested-form treatments |
| Nested accents | Arc size × .52; rectangle rotates by Golden Angle × .18 | Independent artistic treatments of inner details |
| Finish | 18 px uncropped inset; guide chance .28 + Complexity/260 | Allow CROP to extend beyond the canvas while other variants stay framed |

The `34` and `55` Fibonacci numbers still appear as exact existing
quantisation bases in this engine, and `A.PHI`, `A.INV` and `A.GOLD`
remain mathematical definitions. The first layer of this extraction
names the **shared style and sizing** behaviour; individual variant
layout coordinates and random size ranges remain separate for subsequent
audits. An identical decimal in another engine is not evidence that
both engines should share one variable.

The pinned comparison now additionally exercises **144 complete
Constructed Forms compositions**: all six variants, renderer versions
V2/V5/V7, both orientations, 0% and 100% Additional φ Pull, and low/high
complexity with extreme element counts, jitter, overdraw, opacity and
nesting. As before, drawing-command SHA-256 digests and geometry
metadata must match the immutable pre-refactor version exactly.

## Eighth extraction: Automatic Marks (Scribble) anchor gestures

`SCRIBBLE_TUNING` names **33 original artistic calibration values**
within Automatic Marks, separate from Constructed Forms and the other
drawing engines. This initial Scribble pass is deliberately restricted
to gesture count, anchor hierarchy and territory, portrait rhythm,
and expressive ink. The five variants **RIBBON, CLUSTERS, KNOT, VOID,
DUET** retain their different compositional identities.

| Subsystem | Original values | Purpose |
| --- | --- | --- |
| Gesture population | Minimum 12, crowded/sparse multipliers 1.16/1.8 | Keep dense studies expressive instead of saturating the page |
| Anchor hierarchy | 2–7 centres; base 2; Complexity/28; crowd gain 1.5 | Determine how many independent gestures are composed |
| Variant exceptions | DUET 2, KNOT max 3, CLUSTERS min 4 | Preserve the different mark-grouping styles |
| Extra blank-space rule | Non-VOID Negative Space greater than 24 | Reserve exclusions without forcing every variant into a void |
| Portrait rhythm | Start .17 and span .66 of page height; x pulls .82/.67; y pull .85 | Encourage balanced vertical gestures while retaining variation |
| Portrait escape | Alternative height start .12, span .74 | Avoid erasing or filling intentionally protected regions |
| Ink style floors | Wobble 44, Curve Bias 58, Overdraw 2 | Scribble remains gestural and visibly hand-drawn |
| Ghost ink | Width × .58; opacity floor 15 and × .52; overdraw × .55 | Secondary connections remain subdued |
| Anchor territories | 30 px inset, 68 px minimum radius, density factors .36–.58 | Keep gestures inside coherent territories without pinning every stroke |
| Portrait radius | Canvas-width cap × .35, KNOT × 1.12, other variants × 1.38 | Keep KNOT compact and distribute other gestures across long pages |

The φ-distributed anchor helper and `A.qphi(...,34,...)` remain
unchanged. The existing Fibonacci quantisation base `34`, exact φ
constants and golden-angle stepping are *not* treated as artist-tuned
numbers. The subsequent stroke paths, their golden turns and
random-walk decisions remain intact in this pass.

A further **120 whole-artwork comparisons** now cover all five Scribble
variants, V2/V6/V7 renderers, portrait and landscape, 0% and 100%
Additional φ Pull, and low/high complexity, density, voids and ink
settings. Drawing-command hashes and returned guide/anchor metadata
must match the fixed pre-refactor engine exactly.

## Ninth extraction: Automatic Marks stroke movement and controlled randomness

`SCRIBBLE_STROKE_TUNING` names **37 existing artistic values** in the
Automatic Marks stroke walk: trajectory bias, mark lengths, local direction
changes, run breaks, void avoidance and secondary ghost details. It is
separate from `SCRIBBLE_TUNING` (anchors and ink) and from other engines.
All source values and evaluation order remain exactly unchanged; none are
mathematical consequences of φ.

| Gesture behaviour | Preserved values | Meaning |
| --- | --- | --- |
| Gesture starts | KNOT .12 / others .20 times anchor radius | Different starting distance from the focal point |
| First run | Minimum 3; length interpolates 8 to 4 | Bounded connected gesture lengths |
| Flow following | RIBBON .72; CLUSTERS .28; other .46 | Different degrees of alignment to the dominant direction |
| Golden turns | .11–.31 times `A.GOLD` | Tuned magnitude of an **exact** golden-angle step |
| Human-looking direction noise | Wobble .18–.48, random angle ±.16; KNOT curl .58 | Locally irregular gesture orientation |
| Segment size | Random 13–78 px; crowd factor .76; density .90–1.15 | Keep the marks proportional to visual crowding |
| Territory correction | Base .34 + distance gain .42 | Guide wandering strokes back towards an anchor |
| Protected void detours | 9 retries in portrait, 5 in landscape | Avoid crossing reserved blank areas |
| Canvas restraint | 24 px endpoint inset | Prevent gestural strokes running off the page |
| Run interruption | Chance .035 + Negative Space/650 | Preserve visual pauses and white space |
| Restart | Radius .08–.42; length interpolation 9 to 4 with jitter −1 to 2 | Begin a fresh loose gesture after a break |
| Secondary ink | Arc chance scale .075, minimum radius 9 px; RIBBON linking .58 | Occasional auxiliary gestural marks |
| Focal halos | Chance scale .12, minimum radius 10 px | Deliberately occasional anchor punctuation |

The stroke-length quantisation base `13` and secondary-arc quantisation
base `9` remain intact **as Fibonacci sequence values**. Their
same-number random size bounds or minimum visual radii have different
purposes and are not automatically interchangeable. `A.GOLD`,
`A.INV`, `A.PHI` and the sinusoidal path functions are unchanged.
The existing random-number call *order*, number of attempts, branch
conditions and draw order are preserved, including the subtle difference
between portrait and landscape void avoidance.

**160 new complete-artwork cases** compare each of the five Scribble
variants, V2 and V7, portrait/landscape, both extremes of Additional φ
Pull, and Negative Space 0/24/25/100 (including the original strict
boundary). Each comparison requires byte-identical recorded drawing
commands and metadata against the pinned original.

## Tenth extraction: Growth Systems branching and void protection

`ORGANIC_TUNING` names **39 original aesthetic and mechanical
calibrations** in the Growth Systems branch engine. This is not shared
with Scribble or any other system. The source's breadth-first branching,
seeded random consumption, shape drawing order and exact φ mathematics
are unchanged.

| Part | Original parameters | Purpose |
| --- | --- | --- |
| Organic ink | Curve Bias floor 76; Wobble floor 42 | Retain hand-drawn movement |
| Root count | One additional root per 58 elements | Give larger compositions multiple starting territories |
| Portrait roots | Height .78 minus .17 per root; x pull .76; y pull .88 | Start near lower golden regions with distinct heights |
| Trunk direction | Portrait jitter ±.28; legacy landscape ±.55 | Preserve different historical orientation grammar |
| Trunk size | Portrait .19–.28 of page height; landscape 150–300 px | Different length scales before φ quantisation |
| Growth budgets | At least 12 segments; depth floor 3, ceiling 8, base 2 + Recursion × .7 | Bound growth and maintain legible compositions |
| Child length | `len/A.PHI` times .90–1.08; stop below 12 px | Exact φ shrinkage plus an artistic variation |
| Portrait void detours | 16 attempts, golden-angle deviation .20 + .12 per retry pair, endpoint inset 24 px | Preserve open negative-space regions by checking actual clamped segments |
| Older landscape void detour | .55 × `A.GOLD` after an obstructed endpoint | Preserve V1–V6 path handling rather than imposing portrait rules |
| Branch count | Guaranteed split for the first two portrait depths; chance .52/.35 and Complexity divisors 230/180 | Different branching habits in portrait and legacy landscape |
| Branch directions | Portrait .18–.38 × `A.GOLD`; landscape .26–.52; random turn ±.12; portrait upward attraction .19 | Combine mathematical golden-angle structure with controlled organic asymmetry |
| Terminal ellipses | Frequency Shape Amount/180; minimum radius 5 px | Occasional leaf- or bud-like detail |

The V7 landscape renderer **rotates the portrait growth grammar** into
the longer axis, while V1–V6 landscape uses the original independent
branching behaviour. Its canvas rotation, SVG transformation and
returned guide-coordinate transformations are unchanged. The portrait
fallback root positions for multiple protected voids also remain in
their original source order; this pass does not merge or rationalise them.

The existing Fibonacci quantisation base `34`, mathematical ratio
`A.PHI`, and golden angle `A.GOLD` are deliberately left in the
actual formulas. The .20/.12 detour and .18–.52 turn amplitudes
are *artist-chosen multiples* of the golden angle, not derived
mathematical identities.

The pinned exact-output suite adds **180 complete Growth Systems
drawings**: V3/V6/V7; BALANCED/VOID/DIAGONAL strategies;
landscape/portrait; 0%/100% Additional φ Pull; and element counts
1, 57, 58, 115 and 116, covering root-count thresholds. Complexity,
Recursion, density, negative space and ink settings also vary.
Full drawing-command digests and detailed branch/void/root metadata
must agree with the original engine exactly.

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

These incremental passes do **not** claim to eliminate or rationalise all of the
remaining tuned values. New numerical designs require explicit versioning.
