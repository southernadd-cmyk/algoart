# Watercolour V2Q — isolated layered-drying experiment

**No release. No production material changes. No gallery or social changes.**

Branch `experiment/watercolour-layered-drying-v2q` is forked from the
approved V2P draft commit `0b16e1732347e7ea5817dc757af56d4f49e5cf9f`.

## Question

Do independently settled washes make overlaps and crisp glazes more
convincing than V2P's single flow pass over a finished composite, *while
preserving deterministic seeds and the established eight compositions*?

## Architecture

The unchanged geometry/seed/palette feeds three deliberately coarse
chronological painting groups:

1. **Broad washes:** deposit, transport only through the live wet mask
   (plus a two-pixel capillary fringe), settle, bank, freeze
2. **Hero washes:** draw on a fresh cream-backed temporary canvas,
   independently transport and dry, freeze
3. **Details:** draw on a fresh canvas, transport any remaining wet details,
   then freeze; previously deferred dry structural accents and fine strokes
   are drawn onto the final page after the layered composition

Each stage has independent wet/damp/soft mask raster layers. Earlier layers
are never resubmitted to `flowThroughPaper`. Successive settled stages are
combined by summing positive per-channel optical density relative to the
standard `#f5f0e6` cream paper and capping the accumulated optical density
at 0.89 (same upper cap used by the original post-pass). This is a
Beer–Lambert-inspired RGB approximation, **not** Kubelka–Munk spectral
pigment mixing.

During each stage, the primary capillary stencil and the soft wet-in-wet
boundary stencil both refuse flux outside the wet mask + a 2px feather zone.
The `fixedPixelChanges` invariant is zero between initial loading and
completed diffusion outside that zone. Note that later optical settlement
and placed water-bloom modifiers are tonal effects, not further transport.

For exact V2P comparison, set
`window.AlgoArt.watercolourV2qOptions.layeredDrying=false`.
This takes the prior one-post-pass code path using the original RNG sequence.
The draft defaults to `true`; there is no public editor control.

### Tests and visual evidence

- `tests/watercolour-wet-edge-preview.mjs`: V6 reference pixel
  identity, V2Q deterministic replay, V2P reversible replay,
  different V2P/V2Q output, stage order and freeze invariants
- `tests/watercolour-v2j-fixed-seeds.mjs`: eight independent V8 engines,
  exact archived seeds and settings; writes **both** V2P and V2Q PNGs
  in the same test run and records wall time for both modes
- `tests/watercolour-v2o-targeted.mjs`: earlier random burst/rects
  problem seeds, both V2P and V2Q imagery
- `tests/watercolour-eight-random.mjs`: fresh V2Q seed for each engine,
  full settings and freeze/mobility statistics stored in JSON

Accept only if old wash edges remain stable under new glazes,
V2Q rendering retains the existing composition hierarchy and pale
contrast, and the runtime/memory cost is tolerable on mobile.
Reject if composite optical glazes become muddy or missing wet-layer
mobility makes washes look uniformly sharp.

This version does **not** add gravity, true shallow-water flow,
pigment-specific granulation, actual timed water evaporation, or rewetting
of dried pigments. Three stages are a coarse test of chronology, not a
fully time-stepped paper simulator. Entire experiment can be abandoned
without touching V2P or production.
