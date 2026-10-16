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
