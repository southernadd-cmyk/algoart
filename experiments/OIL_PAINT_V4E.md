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
