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
