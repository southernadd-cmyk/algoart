# ALGO/ART — V4d cohesive loaded-tuften brush (experiment)

**Not released.** New independent `js/oil-paint-v4d.js` on `experiment/oil-paint-v4d-loaded-cohesion`.
V4c, V4b and earlier renderers remain unchanged.

## Review of first V4c

GitHub Actions [38699278494](https://github.com/southernadd-cmyk/algoart/actions/runs/38699278494)
passed real material/determinism tests and generated 16 artworks plus the
four-profile lab. V4c brush edges are visibly more bristled and use irregular,
depleting direct-contact footprints rather than V4b's filled vector ribbon.
But many results are skeletal: the opaque colour mass is lost, particularly
at normal size. Dry bristle has overly many isolated scratches. V4c average
135.8ms versus paired frozen V4b 168.2ms (same GitHub run, scale 0.7).
Mean height P95 V4c 2.996 versus V4b 3.484 in its prior run. 33,276
actual contact footprints recorded over the sixteen compositions.

## V4d hypothesis and interventions

A genuine oil brush must display *both* coherent paint volume *and*
irregular split bristles. More decorative texture or returning to a
hard-edged flat-body stencil will not accomplish that.

- Increase actual **tuft footprint widths**, particularly in central clusters.
  Overlapping charged tufts form opaque colour banks organically, not via a
  hidden vector rectangle.
- Keep lateral edge hairs sparser, staggered, narrower than central bristles;
  preserve ragged tips and visible dry-lift.
- Use **paint reservoir load** to modulate each footprint's contact width,
  colour opacity and scalar height simultaneously. More paint at the heel;
  less toward the toe. Tuft volume, not merely transparency, decreases.
- Reduce excessively scratchy dry-bristle dropout without losing dry-brush
  identity. Distinguish filbert, flat, knife and dry.
- Slightly increase local toe/heel deposits as material thickness, with
  pigment and height from exactly matched contact geometry.

## Acceptance

First assess the actual 16-stroke brush laboratory and 100/200% crops
against V4b and V4c. Look for opaque cohesive centres, irregular tuft
split at edges, plausibly loaded toes and coherent depleted exits. Then
judge the same sixteen engine artworks and performance. Better CI doesn't
automatically mean oil paintings look convincing.

The shared optional composition interpreter from V5 is unchanged. Nothing
here may alter existing production materials, published seeds, φ framing
or social/gallery workflows.

## Actual V4d results — 15 October 2026

[GitHub Actions run 38700106439](https://github.com/southernadd-cmyk/algoart/actions/runs/38700106439) **passed**: regression tests, pressure/contact physics, repeat rendering, original 4×4 brush laboratory, 8 fixed + 8 seeded-random V4d images, 16 frozen V4c comparator renders and original-resolution crops.

Matched 16-study metrics (same CI run, 0.7 output scale):
- **V4d 160.24 ms mean**, V4c **149.88 ms mean** (~6.9% slower).
- Average paint-height **P95 3.628 (V4d)** versus **2.996 (V4c)**, with maximum capped-height fraction **0.00002**. Additional height is actual deposited contact support, not a global emboss mask.
- **1,662** painted source paths, identical frozen geometry/seed settings.
- **37,968 real tuft footprints (V4d)** versus **33,276 (V4c)** across the test set. Brush-profile distribution: 1,036 filbert, 331 flat, 221 dry, 74 knife.
- Mean paint load decreases from **1.223 to 0.551** from stroke beginning to end.

### Human visual verdict: improvement, but still experimental

The diagnostic V4d sheet shows convincingly **more continuous centre paint** while retaining the non-square, irregular split ends pioneered in V4c. In particular filbert and flat strokes now read as physically loaded rather than merely a handful of lines. Dry remains visibly broken; knife is broader.

On the **sixteen complete works**, visual changes are much subtler. They still resemble the original line-based ALGO/ART drawings rendered with thick paint. This is partly the fundamental absence of larger interpreted paint regions: increasing brush width or height alone won't solve it. We should not declare oil visually ready simply because the V4d contact lab is better.

**Decision: HOLD as draft PR #88**. Next targeted material step, if pursued before V5, is local opacity/paint-surface light response at bristle boundaries and better true pigment drag at crossings, *not* a global blur, more grain or a return to V4b's filled silhouette.

The shared optional V5 composition interpretation layer will ultimately address the separate issue of strokes versus painted regions. It must remain neutral between Oil, Marker, Tissue & Graphite and Watercolour.
