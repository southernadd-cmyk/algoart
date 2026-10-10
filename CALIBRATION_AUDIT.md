# ALGO/ART — final cross-engine numeric calibration audit

**Audited:** 10 October 2026  
**Source:** `js/generator.js` on `main`, following Orbital Studies PR #37
(commit `5958a1e6d6ff39e6c1535d37cd3909f476de55fb`).  
**Scope:** All eight composition engines, shared field placement/scoring,
drawing primitives and Reveal φ overlays.  
**Change policy:** This audit does **not** change any generator numbers,
compositional rules, RNG sequence, renderer version, or existing artwork.

The guiding design question remains:

> **How far can the golden ratio govern a composition while its marks remain visibly human?**

## Audit method and what the counts mean

The audit inventories numeric **occurrences**, not distinct numerical values
or alleged errors, in the 3,879-line `js/generator.js`:

1. Scan numeric tokens in executable JavaScript; omit text in comments,
   quoted strings and template-text regions.
2. Exclude the values in all **18 named `*_TUNING`** tables, which have
   already been labelled as deliberate calibrations.
3. For a *focused* remainder, omit routine `0`, `1`, `2` and `100`
   occurrences. Retain `.5`, `3`, `5`, `8` and other values because
   they can express either genuine mathematical form or tuned decisions.
4. Group by top-level source region, assigning shared network helpers
   starting at `nearestNeighbours` to Connected Fields, and treating
   Reveal φ/overlay rendering separately.

The scan is a **lexical inventory**, not a formal AST or mathematical proof:
it intentionally overcounts such things as coordinate centres, palette
indices, polygon sides, switch cases, Fibonacci numbers and visual-overlay
labels. Each use must be reviewed in context before any proposed extraction.
Counts are specific to the audited commit and may change with later edits.

| Scope in `generator.js` | Remaining non-trivial occurrences | Interpretation |
| --- | ---: | --- |
| Constructed Forms | **114** | Significant deliberate shapes and geometric art-direction remain inline |
| Shared field placement, Orbital Studies scoring and legacy mark drawing | **86** | Mixture of existing φ maths, stroke-level tuning and mechanical choices |
| Automatic Marks | **31** | Gestural path direction and void-relocation choices remain partly inline |
| Golden Trajectories | **24** | Mostly centres, Bézier mathematics and procedural path/branch choices; inspect leftover path-start coordinates |
| Radiant Systems | **12** | Mostly hub/centre, phase and three-hub bookkeeping |
| Recursive Divisions | **12** | Exact golden cuts, half-way interpolation, coin flips, Fibonacci/polygon indices |
| Growth Systems | **4** | Canvas centres, a Fibonacci quantisation base and a seeded direction coin flip |
| Connected Fields, including the `nearestNeighbours` helper region | **3** | Fibonacci quantisation and two inline satellite hierarchy values |
| Shared setup before the Orbital helper region | **2** | Element count references in shared crowding function |
| Reveal φ, labels and visual display overlays | **215** | Primarily screen-space sizes, stroke widths, guide rendering and annotation placement |
| **Total outside named tables, excluding 0/1/2/100** | **503** | **Not 503 magic numbers or 503 items requiring refactor** |

The broader lexical inventory also found **1,943** numeric occurrences
before the filters, including **609** within already named generator
tuning tables and **1,334** elsewhere. The 503 count is a narrower
subset of those 1,334 occurrences. The shared `js/phi.js` helper tables
and the separate physical-marker engine are not part of this
`generator.js` count.

## Golden-ratio mathematics: verified and kept separate

| Engine | Genuine mathematical structure | Artistic decisions that are **not** φ identities |
| --- | --- | --- |
| **Orbital Studies** | `A.INV` / `1-A.INV` target regions, distributed golden-cell points, golden-angle/true spiral strategy guides, φ distance quantisation | Candidate budget, weighted-centroid tiers, scoring preferences, collision and void penalties |
| **Golden Trajectories** | V1–V3 inverse-φ base exponent; V4–V5 `b=2*log(A.PHI)/PI` true logarithmic φ growth; V6–V7 golden landmarks, angle increments, φ-guided curves and decay | Family-specific turns, path starts, bounds, sweep width, sinusoidal perturbations, mark visibility; not all V6–V7 paths are logarithmic spirals |
| **Recursive Divisions** | `A.INV` vs `1-A.INV` subdivision proportions, golden-angle marks and phi-scaled nested shapes | Area priority, split guard, leaf count, depth, empty regions, mark probabilities |
| **Radiant Systems** | Exact `A.GOLD` angle; hero positions at inverse-φ indices; φ-relative rings, ellipses and arcs | Reach exponents, hub territories/weights, ray chances and void avoidance |
| **Connected Fields** | φ-scaled link and hierarchy preferences; golden-distance quantisation | Topology rankings, decorative node ink and satellite weight/falloff |
| **Growth Systems** | Golden-angle changes, `/A.PHI` branch decay, Fibonacci-based quantisation where used | Branch-length scales, fallbacks, collision avoidance and terminal details |
| **Constructed Forms** | Phi focal targets, `A.qphi` sizes and golden-angle relations | A deliberately much freer Bauhaus/Suprematist visual grammar of sizes, anchors and independent forms |
| **Automatic Marks** | φ-positioned anchor hierarchy, `A.qphi` offsets and golden-angle relationships | Line routes, ink density, marks, jitter, relocation search, directional flow |

**Important number traps:** `.62` is not the exact
`A.INV` (approximately 0.618034). A golden-angle *multiplier* such as
`.58`, `.7`, or `.72` is an artistic modifier, not a new mathematical
constant. A `qphi` call can legitimately use a **non-Fibonacci** base
(e.g. **22**, **28** or **9**) as a drawing-grid calibration. Having a
phi-quantised output does not make the chosen base itself mathematical.
Coin-flip probability `.5`, Bézier's cubic coefficient `3`, and
polygon sides `[3,5,8]` must not be indiscriminately labelled as
tuning weights.

## Residual decision register (recommended future order)

### Priority 1 — Constructed Forms: visible geometry, 114 occurrences

The independent-form engine still places several families through
hand-set proportions and ranges: e.g. `r.range(235,360)`,
`r.range(175,285)`, page sweeps `.08`/`.92`, stack width `.72`,
and shape counts or colour indices. Those values shape the artwork and
should be classified by substyle (BALANCE, STACK, AXIS, COLLISION, FLOAT,
CROP). Preserve all independent values even when numerically equal.
Some `A.qphi` bases here are *not* Fibonacci values.

**If further extraction is desired:** do one substyle at a time, add
exact-output seeded tests for all six, and retain the original
arithmetic and RNG call sequence. Extraction is not required for
correctness; this is an optional maintainability pass.

### Priority 2 — shared field drawing: historical version sensitivity

Three related drawing functions (`drawPlannedElement`,
`drawPlannedElementLegacy`, `drawPlannedElementV3`) retain
stroke-specific artistic choices, including `r.range(.65,1.68)` for
aspect ratios before blending toward exact `A.PHI`, hero/small
stroke-scale values `1.62` and `.76`, and nesting-density modifiers
`.65`, `1.24`, `.66`.

These are legitimate calibration, but **very high-risk to unify**:
the three versions can differ intentionally. Use three independent
named configurations, or document version differences without editing
the renderer. Test V1–V7 and active version-specific seed states.

### Priority 3 — Automatic Marks: gesture and collision-path constants

`drawScribble` retains choices such as path centres `.34`/`.66`,
flow interpolation `.62`, knots, relocation rings with a **28 px**
step up to **252 px**, and a 12-direction collision search. These are
intentional hand-drawn-looking gestures and safety logic, not phi
identities. Extract only when maintenance justifies touching them.

### Priority 4 — Connected Fields: two satellite constants

The network hierarchy helper retains
`i===0 ? 1.55 : Math.pow(A.INV,i*.62)`. The inverse-φ base is real
mathematics; **1.55** (lead satellite weight) and **.62** (falloff
exponent) are aesthetic calibration. Do not swap `.62` for `A.INV`.

### Priority 5 — overlay and mechanical values: document, usually leave

Most of the **215** Reveal φ/overlay occurrences are screen-space
labels, frame widths, alpha, line dashes, polyline sampling budgets
(e.g. 240 steps), and plot annotations. These are **display mechanics**.
Changing them could still affect reveal screenshots but is unrelated
to the mathematical composition. Treat separate from the generator.

**Lower-priority engine remnants:** Golden Trajectories' few free
path-start fractions (including CASCADE's initial `.18/.12`) are
aesthetic. Recursive Divisions' `34` grid and `.5` coin flips are
deliberate, and its `[3,5,8]` side set doubles as polygon geometry.
Radiant, Growth and most Connected remainder are small and explainable.
No blanket extraction is justified.

## Documentation findings resolved in this audit PR

The live application explicitly sets
`CURRENT_RENDERER_VERSION=7` in `js/app.js`, but the README still
contained a top-level **Current renderer: V6** declaration, a V6
history row claiming it was current, a V6-only current-overlay
description, an illustrative `V6 renderer` in the social workflow,
and a **Current V6 operational safeguards** title. The README now
describes **V7** as current, adds its history row, preserves V6
as a historical safety milestone, and uses a versioned-renderer
description for published artworks.

A read-only control-range test now checks the README's current
renderer label and renderer-history row against `js/app.js`.
It will flag this kind of drift on future edits.

## Release invariants, non-goals and conclusion

- **No generator changes** are made by this audit. The 18 existing
  `*_TUNING` tables in `js/generator.js` and
  `PHI_PLACEMENT_TUNING` in `js/phi.js` remain as implemented.
- Never move the pinned baseline
  `99611b850bd812354701b8fec464a036d9b2c750` to make a visual
  change pass. Archive reproduction and exact-output checks must stay
  strict across Chromium, Firefox and WebKit.
- Do not infer that a repeated value is a single conceptual setting.
  Do not globally replace near-φ decimals with phi constants.
- Do not introduce a new renderer version for naming-only changes.
  Any *intentional new look* belongs in a separately versioned design PR.
- Do not change the public guiding question, the eight system names,
  existing share-link versioning, export mechanics, or publishing
  automation as part of this audit.

**Finding:** φ is the genuine mathematical grammar, but many decisions
about emphasis and human-looking marks are explicitly aesthetic.
Keeping that boundary legible is more important than reducing the
literal count to zero.
