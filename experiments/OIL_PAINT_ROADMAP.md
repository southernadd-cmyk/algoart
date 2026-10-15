# ALGO/ART — Oil Material & Shared Interpretation Roadmap (after V3c)

**Status:** planning document, 15 October 2026. **Not approval to deploy.**
**Baseline:** V3c on `experiment/oil-paint-v3c-organic-tips-and-masses` (draft PR #85).
**Comparators:** frozen V1, V2, V3, V3b and V3c studies. Same 8 fixed + 8 seeded-random cases.
**North star:** the golden ratio proposes composition; each material decides how its marks or regions physically express that composition. Render original ALGO/ART source geometry, not a generated or retrieved reference image.

## 1. Diagnosis from actual renders

V1–V3c progressively introduced wide strokes, additive height, individual bristle contact,
pigment pickup, rounded tips and path-local impasto patches. Engineering has improved,
but normal-sized images still often resemble thick ink/marker drawings. V3c runs
~170.6 ms on average for 16 tests at 0.7 scale versus V3b ~144.5 ms (separate
CI runs, not controlled performance benchmarks).

Key causes in current `js/oil-paint-v3.js`:

1. **Line-following paradigm:** `getChains()` extracts Marker paths and `paintOne()`
   independently follows each path. V3c patches decorate those chains rather than
   replacing marks with painterly planes. Main blocker for painted appearance.
2. **Segmented contact:** `sample(pts,7)` followed by independently randomized
   contact decisions per sampled point can create short gaps and regular disconnected
   marks. The old 2×2 pixel hash was fixed in V3c, but not every blocky-looking tip
   originates from that hash.
3. **Limited brush behaviors:** broadly similar-width rails, narrow bristle bundles and
   synthetic flicks appear in nearly every system; ink exhaustion mainly makes
   strokes transparent rather than changing paint transfer/edge shape.
4. **Shallow pigment interaction:** local crossing colour pickup is occasional and
   based on a few point samples. No coherent reservoir or tangent-directed smear
   moves pigment continuously through a wet contact.
5. **Relief not yet visually integrated:** scalar heights are real and additive, but
   more height alone is not a good proxy for painterly result. Geometry, paint
   transitions, selective highlight/shadow, and changing gloss matter more.
6. **Weak visual test hierarchy:** CI confirms pixels exist and are deterministic,
   but cannot tell whether they look like convincing oils.

**Architectural change:** introduce a deterministic, optional **composition interpretation plan** between the
φ-governed source geometry and the pigment/height rasterizer:

`ALGO/ART source & metadata -> mark/region planner -> paint passes ->
brush contacts & pigment transfers -> height-aware finishing -> export`.

Do not start with fluid dynamics, whole-image AI stylization, a global blur, or
further decorative grain. Treat abstract source shapes as constraints, *not*
one-to-one lines that must all be traced.

## 2. Sequenced experiments (each has an explicit stop/go gate)

### Phase 0: Build an honest material test bench (before changing paint again)

- Preserve current V3c outputs, source seeds, per-mode statistics, SVG/source
  recorder metadata, and branch SHA.
- Create a dedicated stroke-only browser test sheet, using **actual procedural
  drawing code**: single straight brush, S-curve, short dab with lifting tip,
  right-angle turn, two crossing complementary colours, several overlapping
  broad strokes, sparse marks, and dense grouped marks.
- Freeze the 16 existing 8-engine compositions and add a *small separate*
  difficult-case bank (short strokes, low density, monochrome, heavy overdraw).
- Produce identical normal-view PNGs, 100% and 200% crops, pigment-only view,
  height-only view, normals, tip/contact map, plus timed stage summaries.
- Compare surfaces with actual photographs of oil paint as **physical references**,
  not composition targets. Don't import photo pixels into outputs.
- Define a blind side-by-side judging sheet: paint mass, brush edges, colour
  interactions, relief, visual hierarchy, and oil impression.
- **Gate:** baseline + test bench reproducible, with both pixel-physics assertions
  and a human visual review. No changes to the production editor.

### V4: Brush physics and organic tip geometry (solve tip quality in isolation)

**Aim:** one convincing paint stroke on a blank cream support *before* repainting
the eight engines.

- Replace uniform 7-unit sampled-point contact switching with arc-length-based,
  smoothly changing pressure, orientation, velocity, shear, contact and paint
  load. Tune step size relative to brush radius and output resolution.
- Use a continuous **brush footprint** comprising nonuniform tapered bristle
  clusters, occasional broad knife-like face, flexible edges, and a true round/
  filbert/chisel termination—not a grid of square stamps or evenly spaced comb.
- The brush footprint deposits **pigment and scalar height from the same
  contact field**; finish with antialiasing at target output size. Test
  fractional-offset stability rather than hiding jaggies in a global blur.
- Have paint gather at the toe, edges and bends while some bristles lift to
  expose underpaint. Optional dry-drag is a coherent motion-dependent event,
  not random missing pixels.
- Separate and compare **filbert, flat, dry-bristle, palette-knife** brushes as
  four materially distinct tip profiles. Not all must enter production.
- **Gate:** demonstrably smooth organic tips at 100% and 200%, believable
  changing load across long and short brush strokes, no checkerboard or repetitive
  stamp sequence; acceptable speed on test cards.

### V5: Shared composition interpretation for **every material** (main architectural leap)

**Aim:** separate what ALGO/ART composes from how a chosen material expresses it.
The planner is **material-agnostic**. Oil paint is the first demanding test,
but the resulting system should be available **optionally** for Marker,
Tissue & Graphite, Watercolour and Oil Paint. This is an explicit change to
the earlier oil-only V5 proposal.

**Public-facing concept (names provisional):**
- **Faithful paths (default):** original path-led material rendering exactly as
  before. Historical images, established seeds and share URLs must remain
  pixel-identical; no migration of archived renderer versions.
- **Interpreted areas (opt-in):** use the source's focal structure, φ territories,
  related geometry and negative spaces to plan coherent regions, broad masses,
  medium gesture passes and selective fine detail. This is not an indiscriminate
  "fill polygons" mode and not a new source composition.
- A **hybrid/strength** control can come later, once the two distinct modes work
  and remain predictable. Do not introduce multiple controls prematurely.

**Pipeline:**
`eight source engines -> source geometry & metadata -> optional shared
interpretation planner -> material-specific deposition/rendering -> export`.

**Planner responsibilities:**
1. Capture source paths/primitives, order, source colours, scale, bounds,
   mode/territory and any hierarchy/focal/negative-space metadata. The current
   recorder is primarily path-based; add explicit descriptors only when needed,
   rather than pretending that every curve is already a filled region.
2. Group spatially/tangentially/semantically related shapes into bounded,
   deterministic candidate regions. Keep disjoint clusters separate, preserve
   protected voids, important accents and dominant φ relationships.
3. Output a **non-material-specific plan** of source-linked regions, layered
   masses, directional gestures, and accents with stable IDs and per-region
   random streams. Geometry is generated once, *before* material simulation.
4. Give the material adapter freedom to **express** the plan but not to silently
   invent unrelated structure or move focal masses. Audit coverage/negative
   space and original source path lineage in debug views.
5. Keep plan-version, interpretation mode and optional strength explicit in
   share state; use deterministic sub-seeds so switching material/approach
   never changes the underlying ALGO/ART source composition. A saved painting
   must not silently become a different picture after updates.

**Material adapters (same plan, different physical expression):**

| Material | What "Interpreted areas" should produce | What it must preserve |
|---|---|---|
| Marker | Broader drawn or filled marker masses, overlapping stroke groups, selected linework | Visible human-marker character, deliberate gaps and original fine path mode |
| Tissue & Graphite | Larger overlapping translucent/torn pieces for broad regions; graphite following selected structure, edges and details | Darkening-overlap/paper-cut character, graphite identity and source-related piece placement |
| Watercolour | Wash regions, gradual overlaps, pigment rims and dry-brush accents; local water/pigment behaviour | Transparent wash behaviour, seed palette, clean reserved white/cream areas and wet-edge logic |
| Oil (experimental) | Opaque broad colour blocking, mid-scale loaded strokes, selective impasto detail | Oil bristle physics, additive paint relief, direction, physical overpainting and φ structure |

**Rollout and scope discipline:** prove the planner in **one engine and two
contrasting materials** (suggest Oil + Tissue & Graphite, then Watercolour
and Marker) before claiming it is truly material-independent. Expand to the
eight engines using matched seeds and both sparse/dense cases; gate other
materials independently. Oil itself remains unreleased while the shared
planner can mature. Do **not** put oil-specific paint load, wetness or
bristle geometry inside the shared planner.

**Tests/gate:**
- Existing default renders, historical versions, SVG/plotter exports and
  production social/gallery runs do not change.
- Matched source seed + settings = same focal placement, φ envelope, palette
  family and intentional voids across *all* material adapters, even when
  the material's mark shapes differ.
- Planner produces stable output independent of material selection, identical
  across repeated runs; toggling interpretation changes only the rendering
  strategy, not the source geometry/seed.
- For each adapter, visually convincing material-specific regions rather than
  identical region silhouettes with cosmetic textures. No erosion of the
  original eight-engine identities.
- Oil benchmark: clear departure from tracing every Marker path at normal
  screen size; if that fails, do not spend another version polishing lighting.

**Decision:** V5 becomes an **optional shared ALGO/ART interpretation feature**,
not an oil-only rendering component and **not a default behaviour change**.
Keep production integration behind separate explicit review gates.

### V6: Local wet paint transfer and layered colour

**Aim:** coloured paint should physically interact where strokes cross.

- Track local brush reservoirs by cluster/bristle. A brush lays down some source
  paint, lifts a bounded amount of prior wet pigment at a crossing, and drags
  that colour along its own tangent for a limited distance.
- New opaque paint partly covers older layers; wet strokes carry a controlled
  trace of previous pigment. Dry passages scrape through at selected
  contact points, not via global randomness or a whole-canvas blur.
- Model wetness / time simply through deterministic ordering and a bounded
  local contact state. Keep separate RGB pigment, deposited mass/height and
  wetness/contact values. Consider more complex mixing only after the simple
  transport model visually succeeds.
- Keep source hue hierarchy and monochrome neutrality stable; no grey mud or
  falsely milky overlap.
- **Gate:** at a two-colour crossing the *direction* of pigment carry is obvious
  and plausible; colours remain identifiable in 16 full compositions.

### V7: Oil surface, light, canvas and performance

**Aim:** mass visibly occupies the surface rather than looking like emboss
over a digital line.

- Improve height slopes/normal calculation across multiple footprint scales.
  Selective side lighting, edge shadows, specular ridges and smoother flat
  planes should correlate with local deposition, not unrelated noise.
- Add subtle primed-canvas tooth only where thin coverage reveals it;
  underpaint should remain stable cream unless the composition uses paint.
- Test full-size PNG and print-resolution render as new native renders,
  not upscaled previews. No pixel-stepped edges or repeated stamp patterns.
- Profile per-phase time, peak memory and scale sensitivity; selectively use
  tiles/workers only when needed. Verify both desktop and mobile Chromium.
- **Gate:** better oil impression at normal and close inspection, stable
  performance with no repeated-download regressions.

### V8: Production integration only after material-by-material approval

- Integrate the **optional shared interpretation switch** into each existing
  material only after that adapter passes its own visual and regression gates.
  Keep Faithful paths as the default and encode interpretation/version in
  share URLs without changing the underlying seed.
- Maintain oil as a separately versioned material rather than rename historical
  Tissue & Graphite modules, and preserve SVG/plotter source paths.
- Make material-aware parameter controls and exports match the new semantics.
- Cross-check deterministic seeds, portrait/landscape, φ framing, colour/paper
  choice independence, live editor, mobile PNG repeat-export and gallery safety.
- **Gate:** *explicit approval after 16-image comparison and device test.*
  Only then consider editor material picker, gallery, scheduled publishing/social
  posts, or release. Nothing is auto-published by a green CI result.

## 3. Evaluation protocol and success targets

At each phase, review **4–6 diagnostic test cards first**, then 4 representative
engines (Recursive Divisions, Growth Systems, Connected Fields, Automatic Marks),
then the same 16 frozen study settings when the small set passes.

Visual: blindly compare candidate to V3c at gallery size *and* 100%/200% crop.
Two reviewers should prefer candidate for an **oil-paint** impression in at
least **12/16 matched studies**; record dissent rather than optimizing only
for easy dense examples. This is a proposed target, not a measured claim.

Functional invariants:
- Exactly repeatable seed/options/render version pixels.
- Same source palette relationships, focal hierarchy and φ-based layout;
  guard negative-space regions and prevent painted masses from bridging
  intentionally separate clusters.
- Pigment and height boundaries align; crossings accumulate real mass.
- Zero square-grid brush artefacts, clipped highlight bands or global grey soup.
- No old render, gallery, social, material choice or plotter regression.
- Benchmark representative full-resolution and mobile workload. V3c ~171ms
  (16-image CI mean at 0.7 scale) is a **reference**, not a performance SLA.
  The candidate should not double the reference preview cost without a clear
  visual improvement; record memory/time separately for mobile and print.

Each change should ship *only* as an **experimental branch/draft PR** with:
source changes; test sheet; identical-seed 16 paired PNGs; crop sheet; manifest
with code SHA/options/measurements; and a short human verdict
(**better, mixed or worse**, with failure examples). Revert unsuccessful trials
rather than compounding them.

## 4. Technical boundaries and sources

Good sources of techniques (draw principles, do not copy code without license review):

- [Krita Bristle Engine](https://docs.krita.org/en/reference_manual/brushes/brush_engines/bristle_engine.html): shape, random offset, density, pressure, connected hairs, depletion and soak.
- [Krita Color Smudge Engine](https://docs.krita.org/en/reference_manual/brushes/brush_engines/color_smudge_engine.html): local smearing, blend/opacity and separate height map. The documentation explicitly notes thick-oil uses for smear mode.
- [MyPaint libmypaint](https://github.com/mypaint/libmypaint): dab spacing relative to brush radius, hardness/antialiasing and loaded pigment.
- [Aaron Hertzmann, Painterly Rendering with Curved Brush Strokes of Multiple Sizes (SIGGRAPH 1998)](https://doi.org/10.1145/280814.280951): multi-scale broad-to-fine brush passes. Adapt the planning idea to ALGO/ART's own abstract source geometry—not to photographic image matching.

Deliberately **out of scope now**: full Navier–Stokes fluid simulation,
spectral pigment chemistry, photorealistic canvas scans, AI re-styling,
a production UI rewrite, new engine modes, or replacing the φ compositor.

## 5. Immediate next work item

**Build the Phase 0 diagnostic sheet and the V4 brush primitive in a new,
isolated experimental branch.** Prove an organic opaque single brush stroke
with real bristle contact and relief before applying it to full ALGO/ART paths.
Keep V3c immutable as the comparison baseline. Only begin V5 mass planning once
a normal-size single stroke and its 200% crop genuinely look like deposited oil.
