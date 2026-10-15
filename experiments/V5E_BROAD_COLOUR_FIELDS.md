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

## Real V5e iteration / first visual verdict — 15 October 2026

The user correctly observed that V5d essentially painted thicker lines, not actual areas. V5e is a change to the **geometric planner and material adapters**, not to original pens, seeds or the website.

Three real-browser iterations were inspected. The first V5e contact sheet introduced large opaque orange fields, but the result looked like a few oversized, single-colour flat shapes. The subsequent pass sampled distinct **local original source pigment families** for multi-hued brush deposition and separate translucent tissue sheets. The third pass divided Growth into canopy and basal groups and Constructed Forms into a broad focal field plus supporting regions. The strict coverage regression surfaced an underpowered Constructed Forms case; the final correction broadened the primary field across actually related hero and satellite source objects, without dropping the acceptance requirement.

[Final passing V5e GitHub Actions run 38761236001](https://github.com/southernadd-cmyk/algoart/actions/runs/38761236001) generated **24 actual source PNGs** and one faithful/V5d/V5e contact sheet across 4 engines and 2 materials. All original Faithful pixels and the unchanged Recursive Divisions V5c/V5d result remain byte-identical in these tests. All V5e source-based colour fields have source stroke provenance, geometrically bounded area and reserved-void protection.

| Source | New V5e 2D fields | Oil changed pixels vs frozen V5d | Tissue changed pixels vs frozen V5d |
|---|---:|---:|---:|
| Growth Systems | **5** | **65,113** | **13,560** |
| Recursive Divisions | **0** (original φ cells retained) | **0** | **0** |
| Golden Trajectories | **3** | **55,741** | **11,480** |
| Constructed Forms | **2** | **8,841** | **3,423** |

Pixel differences count pixels with summed absolute RGB change >18 at 0.40 preview scale; they indicate **visible change, not artistic quality**.

### Visual review: meaningful step, but not release-ready

- **Oil — clearly now forms broad colour fields.** In Growth, two large clustered golden/terracotta/coral masses occupy the branch structure rather than widening original strokes. Golden Trajectories has a multi-colour field supporting the dense sweep and still retains empty surroundings. Constructed Forms now has a stronger supporting colour group.
- **Oil still has a graphic/collage quality.** Some field boundaries are too convex and large, and repeated broad internal bristle patches lack the complex interpenetrating shape relationships of painterly colour masses. They can read as coloured paper cut-outs painted over original marks. This is an improvement over thick lines but **not convincing oil painting**.
- **Tissue & Graphite — the new fields remain comparatively subtle**, partly because the faithful Tissue V7 underlay is already washed and broad. A few new washed pieces still appear somewhat detached. More physically credible torn edges and overlaps would be required if the interpreted option proceeds.
- **Recursive Divisions unchanged by design.** Its source-guide golden subdivision was already expressed as legitimate broad planes by V5c.

**Decision:** hold PR #94 as draft/unreleased. The next meaningful improvement is to break large polygon field outlines into **overlapping locally anchored, interlocking secondary territories** and improve shape transitions, NOT increase marker line widths or dump additional noise/grain. Visual approval required before expanding to other materials or changing the live gallery/social schedule.
