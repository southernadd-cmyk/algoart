# Oil Paint V3 — loaded bristle bundles and pigment pickup

**Status:** experimental. No production material selector, gallery, scheduled social media or historical renderer changes. V1 and V2 are preserved as comparators.

## Open-source techniques studied

This is an original ALGO/ART JavaScript/Canvas2D implementation inspired by **ideas**, not copied source code:

1. [MyPaint/libmypaint](https://github.com/mypaint/libmypaint): brush direction filter, elliptical tip angle/aspect, pressure and dab density, loaded/dragged pigment smudge. Implement a few direction-following **continuous broad bristle bundles**, and sample the underlying colour only at an actual painted crossing (7–19% pickup). Avoid canvas-wide smearing.
2. [Krita Color Smudge Engine](https://docs.krita.org/en/reference_manual/brushes/brush_engines/color_smudge_engine.html): thick oil look through paint thickness tracked in a separate heightmap; preserve colour separately from height and treat deposited thickness independently of opacity.
3. [Krita Brush Tips — Lightness Map](https://docs.krita.org/en/reference_manual/brushes/brush_settings/brush_tips.html): preserve dark/light brush-tip texture while retaining the chosen brush colour. Here we shade from the **paint-height gradients**, not generic RGB emboss/blur.
4. [Krita Texture Settings](https://docs.krita.org/en/reference_manual/brushes/brush_settings/texture.html): tooth should interact with paint pickup and thin passages rather than becoming unconditional noise.

These are painting software references, not generative image models; we do not invoke external image generation.

## Changes compared with V2

- Direction-following *broad* filaments inside the same continuous brush silhouette, plus fine bristle grooves. The broader coloured/darker ribbons must read at gallery scale, not only 100% crops.
- Limited pickup from previous local pigment where a new stroke crosses an already painted region; underlying paint never takes over the source Marker hue.
- Broken directional drag and exposure of cream ground/underpaint only inside the corresponding stroke silhouette.
- Distinct chisel/filbert brush geometries remain; same source paths, colours, phi-framed geometry and seed settings as V2.
- Height deposition no longer hits an arbitrary four-unit ceiling. Internal scalar height cap is 18 and **only its visual response is logarithmically compressed** during final lighting. The mask uses centre and lateral loaded-paint banks, supported by narrower striated grooves, rather than mostly flat body alpha.
- Measurements expose `heightAtCapFraction`, P95, peak, bristle/flat counts and per-render time to investigate saturation instead of inferring it from an image.

## V3 experiment parameters

Thickness 0.90, drag 0.72, bristles 0.92, local massing 0.44, relief 0.87, phiFraming enabled. Keep all 16 original fixed/random V1/V2 test seeds and all source composition settings unchanged.

## Output and acceptance

`.github/workflows/oil-v3-sixteen-tests.yml` runs old-material regression, V3 physics/determinism, V3 8-fixed/8-random renderer PNGs, the 16 matched **V2 versus V3** reference paintings, 100% paint texture crops, separate contact sheets and a JSON manifest. Require observable improvement in oil paint quality at normal size; source geometry remains recognizable. Evaluate both the reduction of height saturation and the extra rendering cost. Do **not** merge on successful CI alone.

Known trade-offs: still procedural oil approximation rather than spectral paint chemistry or physical viscosity simulation; colour pickup is restrained, not a globally advected flow field.

## First actual V3 render — 14 October 2026

The dedicated GitHub Actions run **38647938844** passed and produced archive **11932134682**, containing 16 V3 images, 16 matched V2 reference images, two V3 contact sheets, one paired V2/V3 contact sheet, four original-resolution texture crops, and a settings/timings manifest.

- **Performance:** average V3 render **190.8 ms**, average V2 render **139.8 ms** over the same 16 seeds and CI Chromium environment. V3 is approximately **36.5% slower**; print-resolution/mobile speed is not established.
- **Height distribution:** V3 raw height P95 is roughly 1.50–6.36 rather than the previous V2 saturation at 4 in most samples. 15/16 V3 studies have zero pixels at the new ceiling; the remaining dense Radiant study had ~0.175% capped pixels. The saturation problem is substantially improved, but the uncompressed height map alone cannot guarantee a painterly result.
- **Visual finding:** at full frame, the images still resemble thick/striated marker strokes. The source geometry is highly faithful, but the long parallel colour bands and concentric rings look engraved rather than dragged through thick oil. This is **not yet a convincing oil painting material**, particularly on the sparse studies. The changed shading improves local edge/surface differentiation but does not alter the painting strategy sufficiently.
- **Decision:** leave PR #83 a draft. No production release.

## More promising next structural experiment

The research suggests the next version must stop treating each source line as a **uniform filled ribbon with decorative grooves**. Instead, render a deposited **bristle-tip footprint** moving over the source path, with variable contact/density, partial pigment exhaustion, pressure-driven splay, and actual multi-bristle pigment pickup/smearing where it crosses wet earlier deposits. Krita's bristle engine supports scale/shear/density/connected hairs, ink depletion and colour soak; MyPaint handles directional/asymmetric brush tips and opacity accumulation. Preserve the source phi envelope and palette, but replace visually literal path tracing with overlapping **local painted strokes and broad block-in planes**. Benchmark before increasing complexity; avoid a full fluid simulation for now.

## V3b — bristle-footprint experiment (unreleased)

Implemented on `experiment/oil-paint-v3b-bristle-footprints` after the first visual review. The untouched
V3 source remains available on `experiment/oil-paint-v3-loaded-brush`.

The first V3 used a nearly opaque silhouette plus several uniform internal
ribbons. This made grooves visible but left the strokes unmistakably digital.
V3b changes the **deposit** model: each brush tip consists of independently
contacting hairs with correlated pressure/splay, charge exhaustion, partial
lift-off, different bristle colours, and local crossing pigment pickup.
The same deposited footprints drive the local scalar heightmap; relief is not
painted independently as a generic emboss filter. Broad block-in remains
restricted to locally related source marks, and sparse passages can show
broken contact. The original seed, source geometry, colour palette and
golden-ratio framing remain unchanged.

The revised physics test now verifies distinct bristle contact runs, relief,
determinism, compatibility and absence of global renderer-state mutations.
The 16-study Actions run must be visually inspected before this experiment
can be judged an improvement. The V3b changes may affect performance.

Open-source references informing the original, non-copied implementation:
[Krita bristle brush engine](https://docs.krita.org/en/reference_manual/brushes/brush_engines/bristle_engine.html)
(independent hairs, depletion and soak) and
[Krita colour smudge engine](https://docs.krita.org/en/reference_manual/brushes/brush_engines/color_smudge_engine.html)
(separate thickness and smearing).

**Release status:** experimental only. Do not merge into main, enable in
production, or add this material to scheduled gallery/social workflows before
real renders are evaluated.
