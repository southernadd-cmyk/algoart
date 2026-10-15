# ALGO/ART V5e — broad 2D colour fields

**Status: experimental, not for release.** Branch `experiment/v5e-broad-colour-fields`.
V5c and V5d files remain frozen. The same mathematical source seed and layout must work across materials; faithful history remains byte-identical.

## Visual problem

V5d made narrow bristle/tissue marks following individual source branches and trajectories. It still looked like **a drawing with thicker lines**. V5e therefore separates the **field of colour (large 2D shape)** from **source marks (fine direction/detail)**. This is a change in geometric interpretation, not a brush-width or global-grain change.

## Algorithm

- Read actual source guide geometry, not a raster mask or image-generator model.
- Group genuine growth-system branches, adjacent segments of each real trajectory arm and focal Constructed Forms with nearby supporting marks.
- Build a bounded, gently rounded **area contour enclosing several related source points**, expanded outward. It is a field with a measurable surface area rather than a capsule around one line.
- Derive each field's dominant pigment family and reference path IDs from actual recorded source marks. No pigment hue or field is conjured without genuine source evidence.
- Protect explicit source negative-space voids. Exclude fields that would span them; keep uncovered space.
- **Do not** change V5c's golden rectangle colour planes.
- Share one field plan for all material adapters; physical paint and tissue settings are absent from the plan.

## Different material treatment of one field

**Oil:** Broad source-colour underpainting, plus multiple wide, overlapping actual V4e loaded-bristle passes across the *interior* of each area, not along the old contour or source centre-line. Pigment and relief deposits match.

**Tissue & Graphite:** Several larger independently torn transparent sheets following the same field silhouette, with subtractively darkening overlaps. Retain source graphite as gesture/detail rather than enlarging it.

## Review requirements

Render 4 original engines × both materials × Faithful / frozen V5d / V5e = **24 genuine PNGs**, and one comparison contact sheet. Require the nonrectilinear V5e images to change substantially (>2,500 Oil, >900 Tissue pixels at scale 0.4) relative to *frozen V5d*, not merely relative to original Faithful. Require all field contours to have source-path lineage and significant 2D area. Rectangular V5c result must remain exactly unchanged; faithful output must remain byte-identical to historical.

**Human visual criteria**: fields must read as broad arrangements of colour; the old strokes should be small features within a field, not thick outlines; intentional gaps must remain open. No release or other-material integration based on numeric pixel changes alone.
