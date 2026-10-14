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
