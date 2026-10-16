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

## Stage B: cached pressure and tangent-normal calculations

GitHub Actions: https://github.com/southernadd-cmyk/algoart/actions/runs/38882249321

A separate switch, `A.oilBrushPerfExperimental===true`, changes only
the brush arithmetic, while default Oil v1 still follows the original code.
The branch caches per-frame pressure, relative travel and the brush normal,
and reuses those values across the bristle footprints. It does not change
brush count, contact sampling, load, colour, boundaries or output size.

The same genuine browser renderer produced **exactly identical PNG bytes**
on all four tested 0.45-scale paintings, with or without the earlier
single-source-capture change. Contact counts were unchanged.

| Case | Brush baseline ms | Brush optimized ms | Brush gain | Total baseline ms | Both optimizations ms | Total gain |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Organic landscape | 187.7 | 123.2 | 34.4% | 460.9 | 394.8 | 14.3% |
| Rects portrait | 123.7 | 85.7 | 30.7% | 325.5 | 277.8 | 14.7% |
| Network landscape | 76.6 | 53.1 | 30.7% | 204.1 | 168.0 | 17.7% |
| Burst portrait | 169.1 | 116.4 | 31.2% | 405.2 | 353.9 | 12.7% |

Each cell is the **median of three warmed browser samples** in one
GitHub Actions runner, with experimental/baseline variants interleaved.
These are promising results, not production guarantees or statistical
performance certification.

Output metadata also matches. Examples: Organic had 430 brush calls,
23,445 centreline frames, 5,627 tufts, and 247,187 active bristle
contacts in both versions; no contacts were cut to obtain these gains.

The high proportion of time in contact rendering justifies spending some
of the recovered compute on **genuine, individually varied bristle
footprints** for a separately versioned Oil V2. This experiment does
not by itself improve appearance, and no production material switch,
historical links, daily gallery or social artwork have been changed.

### Next acceptance gate

Repeat across all eight modes, both canvas orientations where
applicable, and at export resolution; inspect 1:1 bristle-tip crops
and whole images for *visible* detail. Only promote after the
geometry and timing results meet the agreed visual/performance targets.

## Stage C — genuine finer bristle contacts (experimental, not released)

Experiment source: `js/oil-stage-c-brush.js`. The public site does not load
this script. The V1 core only calls it when `A.oilStageCExperimental`
is set explicitly in the test. When absent, historic Oil v1 pixels and
the Stage B performance experiment remain unaffected.

**Visual model:** 26–34 distinct seeded bristles per sufficiently wide
stroke, each a real pigment-and-relief silhouette with different width,
start/lift position, tip length, lean, and optional dry contact gaps.
Translucent connected under-contacts restore the loaded brush body,
stopping before the staggered hair endings. Three pigment/relief colour
batches reduce Canvas2D fill calls while retaining 30 separately
constructed individual hair contours; the batches are *not* decorative
overlays on a fake brush.

**Measured performance lesson:**

- Rendering 30+ contacts indiscriminately (first Stage C prototype)
  changed every image but increased total render time by **25–45%**,
  and the brush body was too line-like. Rejected.
- Higher-opacity body deposits and batching made the loaded paint
  more continuous but were not enough to control global cost: **25–55%**
  overhead in the next single-run sample. Rejected.
- Detail is now output-resolution-aware: widths under **20 physical
  pixels** retain the proven Stage B V1 contact. Eligible strokes use
  the 30-hair brush, with reduced path sampling at preview scale.
  For a larger export more strokes qualify automatically.
- One intermediate 34px threshold eliminated *all* Stage C contact
  detail in Organic, so CI rejected that variant.

Current passing test: https://github.com/southernadd-cmyk/algoart/actions/runs/38892998827

| Real composition | Detailed / fallback calls | Stage B ms | Stage C ms | C overhead |
| --- | ---: | ---: | ---: | ---: |
| Organic landscape | 104 / 346 | 270.2 | 278.3 | +3.0% |
| Rects portrait | 82 / 65 | 214.6 | 257.6 | +20.0% |
| Network landscape | 80 / 143 | 169.2 | 169.8 | +0.4% |
| Burst portrait | 103 / 113 | 257.2 | 287.7 | +11.9% |

These times are **single warm-browser CI comparisons** at render scale
0.65 and may vary with runtime conditions. They establish an encouraging
direction, not final mobile/export performance certification.

**Invariants verified (4/4):** Changed physical-bristle PNG, identical
source composition metadata and protected voids, deterministic rerender,
and hundreds/thousands of genuine fine hair contacts. The test writes
4 pairs of full images, 2 brush-lab images, and JSON performance metrics
as a GitHub Actions artifact. Only ALGO/ART's genuine renderer is used.

**Visual judgement:** The loaded body and staggered endings are improved
relative to the thin parallel-line prototype, but some tips remain too
regular and the body-to-tip transition needs more irregular physical
paint depletion. This is not yet approved as final-quality Oil V2.

### Next-stage acceptance before release

1. Broaden visual tests to all eight source modes and both orientations,
   including muted and strongly saturated source palettes.
2. Evaluate 1.0x and larger PNGs plus mobile performance.
3. Optimise the remaining high-cost Rects path (currently +20% once,
   above the desired 10–15% ceiling).
4. Break up excessively straight, parallel hair contact bands with
   correlated load/bend and less uniform ridge lighting, retaining the
   original geometry and 30 individually staggered tips.
5. Compare physically detailed bristle-tip crops at 1:1 scale and
   whole paintings before deciding whether to release `oil-v2`.
