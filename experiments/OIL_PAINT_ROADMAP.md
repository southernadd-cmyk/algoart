# ALGO/ART — Procedural Oil Paint Roadmap (after V3c)

**Status:** planning document, 15 October 2026. **Not approval to deploy.**
**Baseline:** V3c on \`experiment/oil-paint-v3c-organic-tips-and-masses\` (draft PR #85).
**Comparators:** frozen V1, V2, V3, V3b and V3c studies. Same 8 fixed + 8 seeded-random cases.
**North star:** the golden ratio proposes composition; paint creates the surface. Render original ALGO/ART source geometry, not a generated or retrieved reference image.

## 1. Diagnosis from actual renders

V1–V3c progressively introduced wide strokes, additive height, individual bristle contact,
pigment pickup, rounded tips and path-local impasto patches. Engineering has improved,
but normal-sized images still often resemble thick ink/marker drawings. V3c runs
~170.6 ms on average for 16 tests at 0.7 scale versus V3b ~144.5 ms (separate
CI runs, not controlled performance benchmarks).

Key causes in current \`js/oil-paint-v3.js\`:

1. **Line-following paradigm:** \`getChains()\` extracts Marker paths and \`paintOne()\`
   independently follows each path. V3c patches decorate those chains rather than
   replacing marks with painterly planes. Main blocker for painted appearance.
2. **Segmented contact:** \`sample(pts,7)\` followed by independently randomized
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

**Architectural change:** introduce a deterministic **paint plan** between the
φ-governed source geometry and the pigment/height rasterizer:

\`ALGO/ART source & metadata -> mark/region planner -> paint passes ->
brush contacts & pigment transfers -> height-aware finishing -> export\`.

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

### V5: Translate geometry into a layered *painting plan* (main artistic leap)

**Aim:** stop tracing each Marker path as a thick line.

- Derive deterministic local regions from nearby related source paths (spatial
  overlap, tangent, hue, shared φ territory and importance), while preserving
  source focal points and geometric relationships.
- Construct **three passes:** (1) broad, selectively opaque colour blocking,
  (2) medium directional marks that create weight/volume and overlap, (3) a
  minority of small accent/edge strokes. Bigger brushes first, smaller where
  contrast or structure demands it. Never paint in every gap.
- Create source-derived region masks and **protected negative-space** regions.
  Avoid global convex hulls and keep disjoint islands separate. Painted shapes
  may expand organically around source marks without moving their centres.
- Region orientation/brush choice may vary by engine: rectilinear for Constructed
  Forms/Recursive Divisions, curved sweeps for Golden Trajectories/Growth Systems,
  masses punctuated by flicks for Automatic Marks/Radiant Systems, directional
  connections for Connected Fields/Orbital Studies.
- Each pass has its own paint load, scale and source-derived colour; use
  per-region independent RNG so changes do not re-randomize unrelated regions.
- **Gate:** dramatic and observable shift away from marker-line drawing at
  normal screen size, while φ composition, intentional voids and palette remain
  recognizable across all eight engines. If this fails, **do not** spend another
  iteration polishing highlights or canvas grain.

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

### V8: Integration only after visual approval

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
