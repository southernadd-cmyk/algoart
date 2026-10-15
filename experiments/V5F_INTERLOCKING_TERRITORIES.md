# V5f — interlocking source-anchored colour territories

**Status: isolated experiment. Do not merge, deploy, or alter gallery/social schedules.**

Built from the frozen V5e branch; archived V1–V5e oil physics, the default
Faithful output, original source seeds, and V5c golden-ratio rectangle cells
are not edited.

## Why

V5e finally created broad colour fields, but smooth, mostly convex outer shapes
often read as painted collage cutouts. Simply increasing width, blur or noise
cannot solve this. V5f decomposes every nonrectilinear source field into
several independently seeded **local** colour territories, positioned using
the actual engine's growth segments, trajectory-arm points, or constructed
object anchors, **inside the existing V5e composition**.

### Common geometric plan

- Local territories retain their original field's guide ID and source path IDs.
- Each local area has a nonconvex, softly scalloped 40-point bounded outline
  with source-anchored centre and geometric area, rather than a stroke-width
  expansion or a large new invented polygon enclosing the whole composition.
- Three to five local regions *overlap*, interrupt and influence one another.
  The parent field is **not filled** as one opaque silhouette.
- Protected negative-space regions and the phi subdivision of Recursive
  Divisions remain untouched.
- Exactly the same material-neutral plan is passed to both Oil and Tissue.

### Two separate material treatments

**Oil:** Each region receives a radial translucent source-colour underpainting,
tapering to transparency at its perimeter. Multiple V4e physical, separately
loaded bristle contacts then deposit colour and relief, without hard clipping
the bristles against the field perimeter. Neighbouring colour areas mix through
their actual overlapping paint and bristle deposits.

**Tissue & Graphite:** Each shared subregion receives independently torn
translucent pieces with subtractively darkening overlaps. It remains paper,
not a marker, and source graphite/details remain as before.

### Files

- `js/composition-interlocking-v5f.js` — material-neutral geometry override
- `js/v5f-material-adapters.js` — Oil and Tissue presentation of the same plan
- `tests/v5f-interlocking-paint.mjs` — faithful / frozen V5e / V5f real-image test

## Acceptance gate — not yet cleared

Run the browser test in an actual ALGO/ART browser environment; it renders
**4 original engines × 2 materials × 3 interpretations = 24 PNGs**.
Inspect contact sheet `v5f-results/v5f-faithful-v5e-v5f-oil-tissue.jpg`.
Require deterministic plans and images, byte-identical Faithful output,
unchanged V5c rectangles, protected voids, credible source provenance,
significant difference versus frozen V5e and critically a human check
that Oil looks more painterly rather than merely producing different polygons.

**Current limitation:** No CI run is claimed as passing. The attempted
dedicated workflow creation was blocked, so the browser comparison remains
unexecuted. Do not report V5f as visually validated or release-ready.

## Next visual questions

1. Do Growth's local paint areas actually interpenetrate, rather than resembling
   several small cutout petals?
2. Are trajectory colour regions broad and coherent while leaving surrounding
   negative space intact?
3. Does Constructed Forms develop organic near/far passages without obscuring
   the source focal forms?
4. Does Tissue still look like torn material rather than cloudy paint?

Do not merge V5f without viewing the rendered source images.
