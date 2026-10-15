# V5 — Optional shared composition interpretation (pilot)

**Status:** experimental only; branch `experiment/v5-shared-region-interpretation`.
Do not merge or deploy, change the material selector, edit current share URL
semantics or alter gallery and daily social images until visual approval.

## Core decision

V5 is **not oil specific**. ALGO/ART first produces the same φ-governed
source geometry. A shared, deterministic region planner optionally translates
its paths to local mass regions, medium-scale gestures and deliberate small
accents. Then a **material adapter** expresses that same plan in its own
physical language. Faithful source rendering remains the default and is
byte-identical to the existing renderer.

Prototype pipeline:

```
Eight ALGO/ART engines -> recorded source paths / φ framing
     -> optional shared planner (region IDs, geometry, colour, provenance)
     -> [ Oil V4e loaded brush adapter | Tissue V7 torn-paper adapter ]
     -> image
```

The shared plan does not contain wetness, bristle counts, cloth tear
parameters, graphite roughness, material flags, or any final raster pixels.

## First implemented pilot

- `js/composition-interpret-v5.js`: standalone source recorder and
  deterministic, source-linked grouping planner. It emits `regions`,
  `gestures`, `accents`, protected source voids, original source indices,
  stable identifiers, colour and geometry. Candidate masses require nearby
  aligned source segments and similar source colour, with bounded width,
  length and local density; no global convex hulls or spanning distant islands.
- `js/v5-material-adapters.js`: an opt-in `A.renderInterpretedV5`
  orchestration API. Oil starts from the frozen V4e material and applies
  the shared plan using **the actual V4e bristle-contact brush primitive**,
  with matched RGB/height footprints and constrained local surface shading.
  Tissue uses the existing V7 Tissue & Graphite underlay, plus overlapping
  multiply-composited torn pieces and source-following graphite. This is
  intentionally a proof-of-concept adapter, not a committed production style.
- No editor UI or historical material files are touched. Watercolour and
  Marker adapters are future work; their opt-in behaviour must be evaluated
  independently.
- One source seed and φ framing is preserved across both materials; planner
  output and source path capture do not read `material`. No material choice
  re-randomises region position or region ID.

## Strict pilot tests

- Synthetic reserved negative-space rectangle remains empty.
- Same source settings produce exact same JSON plan and source-provenance
  index lists; plan contains no material-specific properties.
- Three representative engines: **Growth Systems** (curved/organic),
  **Recursive Divisions** (rectilinear), **Golden Trajectories** (curved).
- Two materially different adapters (Oil, Tissue & Graphite).
- Two interpretation modes: `faithful` returns exact original renderer
  pixels, `areas` produces noticeable additional paint masses.
- Generate 12 actual PNGs and a 3-row / 4-column sheet comparing faithful
  and interpreted Oil/Tissue for identical seeds/settings; no model artwork
  or screenshots of site overlays.
- Verify deterministic repeats, source-state restoration, protected void
  exclusions, measurable image differences and historical renderer locks.

## Visual gate for next step

Do the masses read as a genuinely painted composition or merely as extra
blobs over the original drawing? Does Tissue darken through overlaps rather
than become opaque plastic? Does Oil remain loaded/bristly? Are the shape
relationships, intentional gaps, palette and eight-engine identities clear?
If the pilot has no regions on difficult sparse images, improve the shared
planner rather than fabricate regions unrelated to its source.

After actual render review, decide **V5b**, which would replace simplistic
local primitive grouping with a more meaningful semantic/territory plan,
add **watercolour** and **marker** adapters, and provide an experimental
preview toggle before any public exposure.

**No production deployment authorised by green CI alone.**

## V5a actual pilot and V5b follow-up — 15 October

[First successful real V5 pilot run 38732807470](https://github.com/southernadd-cmyk/algoart/actions/runs/38732807470) produced **12 PNG paintings** (3 engines × Oil/Tissue × Faithful/Interpreted), one full A/B sheet and a full JSON source-provenance manifest. All six faithful renders were *byte-identical* to the untouched original material outputs, with a repeatable identical planner across the two materials. Synthetic reserved negative-space and historical renderer locks passed.

Actual V5a source-region counts: Growth **26**, Recursive Divisions **17**, Golden Trajectories **26**. V5a interpreted pixel changes: Oil **10,907 / 3,797 / 7,279**; Tissue **2,874 / 1,180 / 1,929**. A/B inspection found this **visually too timid**: the old linework still dominates; the interpretation mostly thickens details.

### V5b experiment

- Shared planner emits an explicit **material-neutral tapered area contour** for each source-linked region, instead of only a centroid, orientation and width. Its outline comes from the same mathematically anchored source clusters.
- Slightly broaden bounded region width and length while retaining original colour, source provenance, focal relationships and void exclusion. These are local colour-block footprints, never whole-image convex hulls.
- Oil uses the contours as **opaque broad, source-derived paint masses** below actual V4e bristle deposits, with matching deposit-height support.
- Tissue uses the **same contours** for distinctly material-specific translucent torn paper with irregular cut edges and graphite, not an oil shape with a texture filter.
- Faithful remains the exact default; no shared-plan settings migrate historical render seeds.

**V5b visual gate:** the interpreted sheet should now read as areas of colour—not just chunky paths—while preserving the original geometry and sparse negative space. The regions must be visibly different physically in Tissue versus Oil. Passing CI alone is insufficient.

## Actual V5b render and visual review — 15 October

[Passing V5b test run 38733455670](https://github.com/southernadd-cmyk/algoart/actions/runs/38733455670) generated 12 real source-seeded PNG paintings and the full four-column material comparison sheet. The six faithful variants remained **byte-identical** to the earlier renderers, with deterministic source plan and no change to original composition settings.

| Engine | Regions | Oil changed pixels V5a → V5b | Tissue changed pixels V5a → V5b |
|---|---:|---:|---:|
| Growth Systems | 26 | 10,907 → **22,160** | 2,874 → **3,771** |
| Recursive Divisions | 17 | 3,797 → **5,995** | 1,180 → **1,281** |
| Golden Trajectories | 26 | 7,279 → **13,316** | 1,929 → **2,339** |

These measurements represent image difference versus faithful output at the same 0.4 rendering scale, not a painterliness score. Oil now changes roughly 1.6–2× as many visibly different pixels. Tissue changes much less.

### Human visual assessment

**Shared planner and data contract: PASSED as a proof of concept.**
Material-neutral composition region contours, source indices, colour hierarchy, independent reproducibility, exact original faithful mode, and adapter-specific rendering have been demonstrated on real images.

**Oil interpretation: PARTIAL SUCCESS.** The regions visibly add overlapping colour masses and the source's focal hierarchy remains identifiable. Still, sparse compositions mostly read as *thickened lines*, and Recursive Divisions does not become an arrangement of broad painted planes. Passing numeric coverage doesn't mean the right artistic result.

**Tissue & Graphite: NOT YET A GOOD INTERPRETATION.** The V5b differences are too modest at normal scale; some extra small paper fragments appear detached from the main composition, particularly in Growth Systems and Golden Trajectories. The basic tissue source rendering already has broad washed regions, so adding local cut-paper decorations isn't an adequate V5 adapter strategy.

**Root cause:** source-path proximity isn't enough to infer the larger semantic **territories**, enclosure, hierarchy and relationship between separate marks. A source line may frame an area rather than itself becoming a coloured area. The next planner must distinguish **filled territories versus strokes versus deliberately empty framed interiors** before applying any material treatment. Keep the shared plan separate from brush/paper physics.

**Decision:** keep [draft PR #91](https://github.com/southernadd-cmyk/algoart/pull/91) unreleased. Do **not** turn V5 on by default, add Watercolour/Marker from this immature grouping method, change historical link semantics or alter scheduled posts. V5c should focus on a stronger territory/semantic planner and explicit negative-space support masks; only then expand the two other adapters, with faithful pixel identity guarded throughout.
