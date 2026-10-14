# Oil Paint V1 — real procedural renderer experiment

**Status: experimental only; not on live material menu or gallery/social.**

## Visual contract

An opaque, viscous, brush-led material translation of the recorded ALGO/ART V9 Marker geometry: visible loaded-brush direction, continuous ribbons, bristle striations, dry drag, paint-body buildup, subtle specular height-map highlights and warm cream primed canvas. Source Marker hue, golden-ratio composition, negative space and source path order must remain intact.

## Pipeline

1. Invoke the existing deterministic Marker renderer with a temporary precise SVG recorder. The generator chooses the same composition, colours and optional shared phi framing as other materials.
2. Parse M/L/C paths and resample along tangent. Keep source RGB/HSL ink for each selected source chain; avoid independent secondary palette.
3. Paint a thin cream ground with seeded very faint woven tooth. Underpaint only along actual long source strokes.
4. Draw continuous opaque variable-width ribbons in recorded stroke order. Clip thin bristle filaments, warm/cool pigment shifts based only on source hues, and local broken brush drag inside paint.
5. Accumulate an independent grayscale height buffer of paint bodies and bristle ridges. Compute restrained directional relief shading from local gradients and fine seeded tooth, not a generic painting filter.
6. Save an actual canvas PNG. Leave all legacy Marker/Tissue/Watercolour production modules and gallery/social schedules untouched.

## Non-public test controls

- Thickness: 0.80; body width / height relief
- Brush drag: 0.54; broken longitudinal pickup
- Bristle visibility: 0.88; fine grooves along stroke tangent
- Phi framing: enabled for comparison renders to match approved shared framing; off remains available

## Outputs

Eight frozen fixed seeds, one per engine; eight reproducibly random seeds with 4 landscape and 4 portrait. The Chrome browser test writes original full-size PNGs, two contact sheets, and a JSON manifest of seeds, engine names, formats, source colours and rendering time. These come from js/oil-paint-v1.js, not an image model.

## Acceptance

Deterministic pixels; nonempty strokes and source colours; no modification of existing published material renderers; preserve phi placement; useful bristle and relief appearance in all eight systems, including sparse and crowded compositions. No public launch before visual review.

## Deliberately deferred

Physical pigment mixing, fluid solver, solvent drying, palette knife presets, wet-into-wet smears and extra public sliders.