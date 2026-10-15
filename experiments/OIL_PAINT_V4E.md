# ALGO/ART Oil Painting V4e — wet pigment crossing and surface lighting

**Experimental / not approved.** New independent renderer `js/oil-paint-v4e.js`
on `experiment/oil-paint-v4e-wet-drag-lighting`. V4d is the frozen comparator; production materials
and V5 shared optional composition-interpreter remain unchanged.

## Problem and intervention

The previous V4d program sampled the existing colour **at just the middle
of the new path**, and—if paint was present—applied a slight colour tint to
the *whole* new stroke. That doesn't look like pigment dragged by bristles
across a wet intersection.

**V4e replaces this with a local transfer plan:**

1. Sample up to four *actual painted intersections* along the next source
   stroke, **before drawing the new paint**. Only locations with a pre-existing
   additive height above a threshold qualify; do not pick up cream ground.
2. Draw the new loaded V4d tuft marks unchanged as the brush baseline.
3. At each crossing, deposit a short tapered, coloured overlap displaced
   **forward along the new brush's tangent**. Colour is mixed locally with
   the sampled underlying pigment; height support uses the same curved patch
   as the colour. A `wetDrag` parameter enables direct A/B testing of the
   effect without altering the underlying composition.
4. In a separate, independent *two-colour crossing laboratory*, draw
   identical red-under-blue intersecting brush marks with transfer disabled
   and enabled, and verify a nonzero pixel difference attributable to that
   effect. Keep the original 4×4 brush test laboratory too.
5. Replace the old single-slope height shading with a normalized,
   **two-spatial-scale height normal**. Directional diffuse light, a bounded
   specular term and changed pixel values apply only to deposited paint,
   leaving unpainted cream/negative space unmodified.

## Review gates

- Repeated same-seed render bytes are identical; historical material and
  renderer-lock tests remain green.
- The crossing control shows **visible colour transported in the direction of
  the new brush** without a full-sheet haze or accidental off-stroke bleed.
- The heightmap remains additive, coloured patches and height masks align,
  and highlights follow genuine deposited ridges rather than pixel hashes.
- Same 16 fixed/random source compositions and matched V4d renders,
  4x4 brush test sheet and full-resolution crops are generated.
- Runtime, transfer count, paint mass and visual judgement documented
  after the actual browser render. Passing CI alone does not approve oil.

**Limitations:** pigment remains approximate RGB mixing, not spectral
subtractive colour or a fluid solver. Geometry still comes from Marker paths;
the optional material-agnostic V5 region interpretation will address wider
painted masses independently. No production, gallery or social integration.

## Actual browser results — 15 October 2026

The first implementation passed [Actions run 38702701336](https://github.com/southernadd-cmyk/algoart/actions/runs/38702701336), but the real red/blue crossing demonstration changed only **196 of 166,500 pixels** by more than four RGB levels (~0.12%). The colour transfer was technically present but nearly invisible at normal size. **Do not mistake CI success for meaningful painterly effect.**

### Targeted correction

In the same isolated V4e branch, increase the bounded tangent-directed transport distance and tuft width, carry slightly more underlying pigment, and deposit three thinner irregular paint trails per crossing. Do not blur a whole stroke. Added a physical crossing coverage assertion (`pixelsChanged >= 400`, where an RGB-difference sum exceeds 12).

[Actions run 38703245870](https://github.com/southernadd-cmyk/algoart/actions/runs/38703245870) **passed** all physics, historical-material locks, deterministic rendering, wet crossing and 16 matched source images. Real observations:

| Metric | Refined V4e |
|---|---:|
| Matched source studies | 16 |
| V4e mean render, same run | 131.5 ms |
| Frozen V4d mean render, same run | 124.25 ms |
| V4e overhead versus V4d | ~5.8% |
| Wet intersection detections, 16 images | 3,751 |
| Pigment drag deposits, 16 images | 11,253 |
| Mean paint height P95 | 3.808 |
| Cross-lab visibly changed pixels (RGB difference sum >12) | 800 |
| Crossing pixels (450×370) | 166,500 |

The refined two-colour test genuinely carries red pigment *downward in the direction of the blue brush* at the intersection. The difference is local and now visible at ordinary size, rather than a barely measurable colour tint. The changed region is still limited to ~0.48% of the crossing canvas, not a blanket smear.

**Visual finding:** V4e's directional colour transport makes crossings more credible in the diagnostic study. Height-normal shading is more tied to geometry, with restrained highlights. However, most of the 16 full compositions show only subtle improvement: **the main artistic limitation remains translating source paths into painted masses**. The existing line-based geometry remains unmistakable in sparse and geometric engines. The paint engine should not try to solve this through endless grain and micro-tweaks.

**Decision: hold as draft PR #89; do not merge, publish or add to gallery/social.** V4e is an experimental material-level success for local transport, not an acceptable full oil-paint renderer. The next meaningful structural milestone is V5's optional, **shared material-agnostic interpretation planner** (faithful source paths as default, region-based/painterly option across all materials), followed by material-specific polish. Leave all historic source seeds and default behaviour intact.
