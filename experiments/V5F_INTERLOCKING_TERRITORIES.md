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
Inspect contact sheet `v5e-results/v5f/v5f-faithful-v5e-v5f-oil-tissue.jpg`.
Require deterministic plans and images, byte-identical Faithful output,
unchanged V5c rectangles, protected voids, credible source provenance,
significant difference versus frozen V5e and critically a human check
that Oil looks more painterly rather than merely producing different polygons.

**Current finding:** The source-rendered 24-image comparison and compatibility checks passed (run 38765248423); the visual gate did not. It is still experimental and must not be released.

## Next visual questions

1. Do Growth's local paint areas actually interpenetrate, rather than resembling
   several small cutout petals?
2. Are trajectory colour regions broad and coherent while leaving surrounding
   negative space intact?
3. Does Constructed Forms develop organic near/far passages without obscuring
   the source focal forms?
4. Does Tissue still look like torn material rather than cloudy paint?

Do not merge V5f without viewing the rendered source images.

## Actual browser results — 15 October 2026

[Passing V5e + V5f CI run 38765248423](https://github.com/southernadd-cmyk/algoart/actions/runs/38765248423).
The existing V5e workflow invokes the new V5f browser test **only on this
experimental branch**. The original frozen V5e assertions run first and pass;
the new test then writes another 24 renderer-created PNGs, a contact sheet,
and manifest into the nested `v5e-results/v5f/` artifact directory.
The reusable download is [artifact 11987137752](https://github.com/southernadd-cmyk/algoart/actions/runs/38765248423/artifacts/11987137752).
This avoids changing or installing another Actions workflow.

Pixel differences versus frozen V5e at scale 0.40 (sum of RGB delta >18):

| Engine | Oil | Tissue | V5c rectangles unchanged? |
|---|---:|---:|---|
| Growth Systems | 61,458 | 12,031 | — |
| Golden Trajectories | 54,472 | 11,400 | — |
| Constructed Forms | 9,484 | 2,885 | — |
| Recursive Divisions | 0 | 0 | **yes, identical** |

All original Faithful modes remain byte-identical to the unchanged material
renderers. Plan and image repeatability, source IDs, 40-point bounded local
contours, protected voids and material-independent geometry passed.

### Visual assessment of the actual contact sheet — HOLD

**V5f has improved the geometry but not yet produced convincing oil.**
Growth and Trajectories replace single smooth cutouts with separate nested,
overlapping colour-rich gestures. However, viewed at the same sheet scale,
the local masses still resemble grouped flat, graphic clusters in places.
Their edges break up more organically, yet the balance of volumes, paint
movement, wet transitions and true chromatic blending remains insufficient.
Constructed Forms changes rather modestly and keeps its mark-based appearance.
Tissue gains some individually torn local shapes but not an unambiguous leap
in physical realism.

**Decision:** keep PR experimental and unmerged. Passing pixel-delta tests
means the renderer changed, **not** that the oil painting problem is solved.
Next investigation should focus on stroke-overlap physics, pigment mixing
and transitions between source-linked regions, not additional decorative
noise or inflated colour polygons.
