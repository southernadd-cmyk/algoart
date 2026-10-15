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
