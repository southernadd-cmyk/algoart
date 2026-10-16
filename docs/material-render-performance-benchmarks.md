# ALGO/ART — exact-render performance benchmarks

Established 16 October 2026 from [GitHub Actions baseline run](https://github.com/southernadd-cmyk/algoart/actions/runs/38966586485).

## Test matrix
- Four source systems: Organic, Recursive Divisions, Connected Fields, Radiant Systems.
- Four materials: Marker, Tissue & Graphite, Watercolour V2S, Oil V3.
- Two scales: 0.45 preview and 1.0 full render.
- Identical fixed settings and seed for each system, shared across materials.
- Headless Chromium on GitHub Ubuntu runner; first render warms caches, two timed repetitions check consistency.
- **32 reference RGBA hashes and dimensions** in `tests/fixtures/all-materials-baseline.json`.

## Acceptance criteria
1. **Hard fail:** changed image pixels, changed dimensions, nondeterministic repeat, exception or missing benchmark case. This validates exact artwork reproduction on the same browser/platform.
2. **Performance warning:** any case >15% slower than the frozen reference. CI scheduling, hardware and garbage collection introduce noise, so do not auto-reject solely on one run.
3. **Speedup claim:** three independent completed runs on comparable hardware, warmed and alternated baseline/candidate order; report per-case median and overall material aggregate. Target >=15% faster in the affected material and no persistent >10% regressions in other materials.
4. Retain all materials' drawing passes, detail, geometry, seed mappings, dimensions and export behaviour. Reject reductions in strand count, iterations, canvas resolution, texture density, or output fidelity.
5. Before production adoption, expand parity coverage to **all eight source systems, landscape and portrait, preview and full** for the affected material. Preserve archival link reproducibility separately.

## Initial full-scale times (milliseconds)
| Source system | Marker | Tissue & Graphite | Watercolour | Oil V3 |
|---|---:|---:|---:|---:|
| Organic | 3.55 | 208.10 | 605.40 | 1636.65 |
| Recursive Divisions | 2.55 | 256.25 | 667.10 | 4220.90 |
| Connected Fields | 7.30 | 184.60 | 494.95 | 7201.30 |
| Radiant Systems | 4.75 | 253.95 | 642.20 | 7338.90 |

## First investigation priority
1. Oil V3 full-resolution network/burst composite and raster operations. Confirm group counts, scratch tile bounds, full-canvas readbacks and final finishing cost before changing algorithms.
2. Watercolour CPU arrays, intermediate canvas reads and memory allocations. Existing `watercolour-hotpath-exact` and `watercolour-diffusion-exact` tests offer ready-made independent switches.
3. Tissue texture raster and source capture duplication.
4. Marker only where avoiding redundant editor redraws offers user-perceived improvement; its isolated render time is already low.

Run: `node tests/all-materials-benchmark.mjs` with the local site at port 4173. Results are written to `material-benchmark-results/`.
