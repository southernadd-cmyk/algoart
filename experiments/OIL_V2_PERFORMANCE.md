# Oil Paint V2 — Stage A/B performance experiment

Branch: `experiment/oil-v2-performance-baseline` (based on main, 16 October 2026).

## Scope

This is an experiment, **not a material release**. Main, daily gallery,
share URLs and the historical `oil-v1` material remain unchanged.

Code inspection found that the V5 area planner and V4e oil painter each
re-capture the same source geometry using `AlgoArt.render`. They use
different small scratch render scales (.18 and min(.22, output scale)), even
though both record source-space vector paths. These may or may not produce
identical pixels when reused, so the test **requires exact pixel equality**.

## Change behind an explicit test-only flag

When `AlgoArt.oilPerfExperimental === true`:

1. Capture the source once with `captureCompositionV5`.
2. Interpret the exact captured source with `planCompositionV5FromSource`.
3. Pass that same vector capture to V4e instead of calling `render` again.
4. Leave all other oil-bristle physics, colour, negative space, relief and
   metadata handling unchanged.

Without the flag, the original oil-v1 codepath is used, including its two
source captures.

## Benchmark

`tests/oil-performance-baseline.mjs` renders actual ALGO/ART oil paintings,
not AI-generated substitute images, for:

- Organic Systems (landscape)
- Recursive Divisions / rects (portrait)
- Connected Fields / network (landscape)
- Radiant Systems / burst (portrait)

The script records source generator calls, source capture timing, Oil V4e
phase timings, full material-render timing and artwork dimensions. It exports
V1 and experimental PNG files plus `results.json`.

The CI test **fails closed** if any baseline-vs-experimental PNG differs, or
if call counts are not exactly 2 (baseline) and 1 (experimental).
Speed gains are reported rather than assumed; CI timings are indicative only.

## Follow-on decisions

1. If the pixel-equality gate passes, run the broader eight-engine,
   preview/full-size/mobile performance matrix.
2. If it fails, compare recorded paths, source metadata and render-scale
   differences. Do not ship an approximate or silently altered Oil v1.
3. Once source capture is optimised, profile stroke-frame calculations,
   per-pixel relief work and surface allocations separately.
4. Redesign bristle geometry as a separately versioned V2 feature, not a
   hidden change to existing Oil v1 share links.

## Stage A/B measured results (16 October 2026)

GitHub Actions: https://github.com/southernadd-cmyk/algoart/actions/runs/38881321025

The actual ALGO/ART browser renderer passed **exact PNG equality** on all four
seeded 0.45-scale canvases (630×450 or 450×630). The original V1 path called
`A.render()` twice per image; experimental capture reuse called it once.
Existing v1 output is unchanged.

| Case | V1 total (ms) | Reuse total (ms) | Difference | V4e paint (ms), baseline | V4e relief (ms), baseline |
| --- | ---: | ---: | ---: | ---: | ---: |
| Organic landscape | 405.75 | 403.00 | 0.7% faster | 138.1 | 14.9 |
| Rects portrait | 267.15 | 269.85 | 1.0% slower | 150.8 | 30.9 |
| Network landscape | 209.85 | 216.45 | 3.1% slower | 134.9 | 11.2 |
| Burst portrait | 300.50 | 309.40 | 3.0% slower | 208.5 | 19.6 |

These are limited CI timings (two post-warmup samples per path), **not
statistically established speed regressions**. Source capture in the
baseline took only ~2–8 ms; V4e brush painting took ~135–209 ms on the
same runs. Removing redundant captures is architecturally clean but
**does not materially improve total render time** at this tested size.

### Decision / next steps

- Keep this exact-match experiment separate. **Do not promote to V1 or
  release V2 based on this change alone.**
- Prioritise profiling and optimising `drawContactBrushV4e`:
  shared curve sampling and pressure frames, contact/path allocations,
  clipping/compositing and brush-footprint density.
- Profile the second oil material adapter separately; the outer totals
  exceed V4e phases because broad areas and connection brushes add work.
- Test tile/dirty-region relief shading and minimise full-buffer transfers
  once per-stroke profiling identifies the actual cost.
- Only after recovering time, develop the uneven-length 30-hair real
  contact model as a separately versioned Oil V2. Test *visible*
  bristle detail at preview and export sizes, not just hair counts.
- Extend benchmarks to all eight engines, larger exports and mobile
  before any release decision.
