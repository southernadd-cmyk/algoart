# Shared φ sheet framing — isolated experiment

**Status:** Unreleased. No production switch and no alteration to historical Marker, Tissue V1–V7, or Watercolour V2R/V2S links. The experimental branch adds a separate optional `sheet=phi` control for all three materials.

## Mathematical rationale

The golden ratio does not mathematically *require* a particular canvas margin or cropping rule. Here it provides a deliberate **framing convention**, not a claim that φ dictates all artistic decisions:

- **Envelope:** aim for artwork's longest normalized bounds at `1/φ ≈ 0.618` of the sheet, leaving `1/φ² ≈ 0.382` of that dimension as unoccupied surroundings.
- **Scale cap:** multiply uniformly by at most `φ ≈ 1.618`, or reduce no further than `1/φ` in a single optional step.
- **Placement:** find the nearest focal landmark among the four `(1/φ², 1/φ)` combinations; move the existing artwork centre only `1/φ²` of the way toward that landmark, then clamp so content remains on the sheet.
- **No distortion:** identical x/y scaling preserves angles, internal φ relationships, mark widths and relative focal hierarchy; any chosen global size/position change is user-visible.

The transform is computed from the **original SVG marker stroke recorder**, before choosing the visible material. Canvas marks and recorded SVG paths receive the exact same transform. Tissue and Watercolour then receive the same fitted source paths. This prevents the historic Watercolour-only problem where a coloured PNG and its plotter source have different layouts.

## Compatibility

- New opt-in saved state is `sheet=phi`. All previous URLs with no `sheet` retain their published pixels and links.
- Watercolour V2S's existing `fit=0` / `fit=1` are left intact; using shared φ framing suppresses the old material-only fitting to avoid double application.
- Watercolour V2R's historical auto-fit is immutable and the new control is unavailable on V2R.
- Source paths, paper grain, material simulation and RNG seeds do not change when shared framing is disabled.
- The φ framing control must show applied scale and before/after coverage so it never silently does nothing.
- Existing Marker, Tissue and Watercolour mode thumbnail caches now include shared/legacy fitting flags.

## Go/no-go review

Before live rollout: compare Marker, Tissue & Graphite V7, Watercolour V2S at identical seeds, orientations and `sheet=phi`. Verify original `sheet`-absent artifacts are pixel-identical, and that SVG/plotter exports contain precisely fitted paths. Check full artwork and φ Reveal annotation alignment, overall bounds and margins, and the speed overhead from the necessary lightweight marker-path preflight. New framing should be a genuine optional design choice rather than replacing the generator's own golden-ratio layout.

Experiment must remain a PR until visual comparisons and CI are checked.
