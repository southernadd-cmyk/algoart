# Oil Paint V2 — Impasto & Brush Massing: file-by-file implementation plan

**Status:** implementation plan, not renderer code. **Experimental only; do not merge V1 or V2 to `main` or add Oil to the material selector without a separate visual approval.**

**Base:** V1 draft PR #81, `experiment/oil-paint-v1-impasto` at commit `52ca66f0326337f01db774ae2479dcfe9429fa80`. Retain `js/oil-paint-v1.js` unchanged as the pixel-reproducible comparator. The new renderer must use ALGO/ART's recorded Marker geometry/colours and the same optional shared `sheet=phi` transform, not an image-generation model.

## 1. What the actual V1 code tells us to fix

| Code area | Current V1 implementation | V2 action |
|---|---|---|
| `getChains(paths)` (around line 79) | Samples Marker strokes, then keeps at most **115** paths over 70px and **145** short paths. Dense art can lose meaningful strokes simply because of ordering. | Replace blunt truncation with deterministic significance/coverage ranking **with source-order reconstruction** and explicit dropped-path statistics. Prefer fidelity before merging strokes. |
| `ribbon()` (around line 111) | One near-constant-width ribbon with uniform tapered ends and two sine waves. Every engine receives virtually the same brush silhouette. | Add separate continuous `filbert` and `flat` profiles using arc-length and tangent information, correlated edge deposits, endpoint variants and corner-load handling. |
| `paintOne()` (around line 131) | Body is nearly uniform RGB at alpha .93, with thin filaments and some small pale drag marks; visually resembles thick marker. | Layer thin block-in, loaded body, exposed ground, localized dry pickup, pigment-shifted side ridges and heavy accents. Distinguish flat/filbert without sacrificing original ink hue. |
| Height drawing in `paintOne()` (~line 177) | Repaints a ribbon with a **different random seed** than pigment ribbon. Height pass uses `source-over` alpha and a mostly flat interior, so overlap doesn't truly add physical thickness and the relief may not align to paint edges. | Derive pigment and height **from the same computed stroke geometry**, accumulate scalar height on top of existing height with a bounded per-stroke mask; add central/lateral peaks, corners and ends. |
| `finish()` (around line 210) | Gradients are calculated from the alpha channel of the height canvas; relief and specular highlights are modest and tied to a saturated 8-bit alpha representation. | Produce per-pixel surface normals from **accumulated height**; stronger but bounded directional lighting and highlights; preserve luminance and source hues. Expose a relief-debug map. |
| `ground()` (~line 196) | Almost invisible straight woven tooth. | Keep cream ground and introduce canvas/gesso relief primarily where thin dragging reveals it, never as indiscriminate texture noise. |
| `renderOilPaintV1()` (~line 231) | Marker source path extraction, opaque paint rendering, material-specific seed, temporary canvases, output stats. | Preserve the same semantics and deterministic seed inputs in a separate V2 entry point; do not change the V1 function. |

**Important geometry rule:** any paint "massing" is an *expanded paint footprint derived from the source paths*, never a new composition. Paint must not arbitrarily join separated focal groups, cover intentional voids or erase important open strokes.

## 2. Files to create or change

### A. **Create `js/oil-paint-v2.js` — actual material renderer**

Keep the standalone browser API and V1 frozen:

```js
AlgoArt.renderOilPaintV2(canvas, settings, scale, {
  phiFraming: true,
  thickness: 0.86,      // more impasto than V1
  drag: 0.62,           // irregular but directional dry pickup
  bristles: 0.90,
  massing: 0.44,        // percentage/strength of eligible close path groups
  relief: 0.78,         // height contrast, not global image sharpening
  profile: "auto"       // "auto" | "flat" | "filbert"
});
// AlgoArt.lastOilPaintV2Stats = { ... }
```

V2 render order / proposed internal helpers:

1. **`captureSource(settings, phiFraming)`** — use the same temporary precise Marker recorder as V1; restore `AlgoArt.svgRecorder`, `AlgoArt.phiFramingEnabled` and render metadata in a `finally`. Record original source colour, precise path, draw order, lengths and transformed bounds. Never call V1 to render a screenshot. Respect the existing V9 φ framing at the source geometry stage.
2. **`extractOilChains(paths)`** — keep support for `M/L/C` commands and colour parsing but make path truncation explicit. Preserve major lines, short focal dabs, and a representative fraction of dense backgrounds using a *seeded, stable* score (length, width, geometric relevance, source order); expose `sourceCount`, `retainedCount`, `droppedCount`. Prioritize retaining all nontrivial source paths when feasible.
3. **`makeStrokePlan(chains, seed, options)`** — generate geometry **once per stroke**: arc-length samples, tangent/normals, loaded width, correlated edge contours, colour, brush type and matching pigment/height masks. Derive per-stroke PRNG from `seed + chain source index + "oil-v2"` so adding paths or grouping does not perturb unrelated strokes.
4. **`chooseBrushProfile(mode, chain, options)`** — `rects` and `geometric` favor flat/broad chisel edges; `spiral`, `organic` and `network` favor filbert; `field`, `burst`, `scribble` mix. Auto decision must be deterministic and tied to actual curvature/length, not only the mode name.
5. **`planPaintMasses(chains, seed, options)`** — optional local massing on near-parallel, nearby, chromatically related runs. Prefer graph clusters only if tangents align and distance is below a multiple of loaded brush width; never form a convex hull of a whole group. Trace overlapping **local** brush envelopes and include narrow gaps when genuinely bridged by paint. Cap massing footprint and protect negative-space masks. Store `massGroups` and `massAreaRatio`.
6. **`paintUnderlayer(ctx, groups, ...) `** — low-opacity desaturated source-colour *block-in* underneath eligible masses, not a global coloured haze. No free-floating blotches detached from the source. Canvas stays standard cream.
7. **`paintStrokeBody(ctx, plan, options)`** — opaque central paint body, graded deposits across the brush, continuous irregular boundaries, chamfer/filbert ends, bristle filaments following local tangents. Avoid repeated square or circular stamps. Late strokes overpaint early ones.
8. **`paintDryPickup(ctx, plan, groundTooth, ...)`** — coherent source-aligned bristle skips that reveal the previous paint or canvas, with depletion increasing towards selected stroke ends. Must not scatter marks outside the stroke.
9. **`depositHeight(heightField, strokeMask, plan, ...)`** — maintain **additive** paint volume across overlaps rather than replacing alpha. Recommended V2: one pixel-domain `Float32Array(width*height)` or a bounded/quantized scalar surface, and a local mask per stroke, clipping work to the mark's bounding box; avoid repeatedly allocating a full-canvas image for every stroke. Height = body + central ridges + slight edge bank + accumulated overlap + end/corner loading. Cap relief at a documented limit to avoid towering blobs. Ensure the **same stroke contour** drives colour and relief.
10. **`shadeImpasto(pixels, heightField, ...) `** — normal map from finite differences, fixed warm upper-left illumination, restrained cool/dark side relief, selective specular on high-load ridges and occasional scraped highlights. Use premultiplied-safe / clamped RGB, never darken all paint into grey.
11. **`renderOilPaintV2(target,...)`** — compose the phases above, draw output via `toDataURL`/canvas, return V2 stats and time per phase. Confirm no global renderer state remains changed.

**Performance guard:** V1 already scans a full pixel image in `finish`; prefer one finishing scan for V2 too. Bound the number of stroke bands and mask regions. Benchmark median render time for fixed/complex landscape and portrait separately, and report peak memory proxies (canvas sizes, height-array bytes). Do not claim it is faster until measured.

### B. **Keep `js/oil-paint-v1.js` unchanged**

Do not rewrite, rename or reuse V1's code in place. The existing 16-image V1 artifact is the approved baseline comparator. V2's code can initially fork V1's standalone prototype; extracting helpers into a common source is optional *after* matching V1 outputs exactly, not a prerequisite for visual iteration.

### C. **Create `tests/oil-v2-sixteen.mjs` — fixed and random images**

Read V1's frozen test vectors from the existing `tests/oil-v1-sixteen.mjs`, or move the settings arrays into **`tests/oil-study-cases.mjs`** imported by both test scripts only if doing so does **not** alter V1 render bytes. Do not generate new seeds for the "fixed" V2 baseline.

- **Eight fixed:** same *seed, mode, format, source slider settings, palette and shared φ framing* as V1.
- **Eight random:** exact same eight V1 seeded-random cases (including landscape/portrait choices), not eight newly drawn seeds. "Random" describes how the settings were originally sampled; it must remain repeatable for A/B evaluation.
- Generate V2 images directly from `canvas.toDataURL('image/png')`, **never DOM screenshots** (the V1 test initially captured the intro overlay).
- Save `oil-v2-results/fixed/*.png`, `oil-v2-results/random/*.png`, `oil-v2-results/oil-v2-fixed-contact-sheet.jpg`, `oil-v2-results/oil-v2-random-contact-sheet.jpg`, and `oil-v2-manifest.json`.
- Additionally create two comparison contact sheets pairing **V1 and V2 for identical seeds** (at least all 8 fixed), and four 100%-pixel crops (geometry, a loaded long stroke, a junction, and dense bristles) so visual improvements cannot hide behind downscaling.
- Manifest contains `sourceSettings`, `materialVersion`, `phiFraming`, `profile`, `renderMs`, `paintedPaths`, `massGroups`, `massAreaRatio`, `heightP95` and `sourceColourCoverage`.

### D. **Create `tests/oil-v2-physics.test.mjs` — targeted invariants**

At minimum:

- Same seed/options/renderer/browser → identical RGBA canvas output on consecutive runs.
- Source points, source bounds and φ framed placement unchanged between Marker, V1 and V2; thickness may extend the *paint edge*, not relocate the source.
- Real accumulation: overlapping stroke masks produce greater height than either one alone at shared locations; no artificial opaque-alpha ceiling before height cap.
- Pigment and height contours align (edge pixel parity/tolerance); no "halo shadow" displaced from the paint.
- Flat and filbert brushes have distinguishable continuous endpoint / edge profiles, including on short strokes.
- For thin dry pickups, canvas tooth shows only within stroke support; no unrelated flecks.
- For a synthetic test containing many paths, retained source coverage exceeds V1's simple 115+145 path cutoff; dropped-path stats accurately report remaining paths.
- Underpaint masses do not fill a protected negative-space region and do not merge widely separated groups.
- Monochrome palette stays neutral, chromatic source hues remain source-derived, cream background unaffected.
- V1 binary pixel outputs unchanged and historical materials pass the existing regression suite.

### E. **Create `.github/workflows/oil-v2-sixteen-tests.yml` — V2 artifact producer**

Copy the structure of `.github/workflows/oil-v1-sixteen-tests.yml`, **without editing the V1 workflow**. Install Playwright Chromium, run static syntax checks and `oil-v2-physics.test.mjs`, check `npm run test:renderer-lock`, `tests/oil-render.test.mjs`, `tests/materials-ui.test.mjs`, render all 16 V2 studies and produce comparisons.

Upload artifact name **`oil-v2-16-real-engine-renders`** with PNGs, comparison contact sheets, crops, manifest and phase timings. Fail if files or stats are missing. Keep the experiment independently reviewable, no writes to gallery/main/social or automatic merging. Use an appropriate CI timeout based on first profiling run, not a guessed constant.

### F. **Create `experiments/OIL_PAINT_V2.md` — real implementation log**

Reference `experiments/OIL_PAINT_V1.md`, record all brush-profile rules, massing thresholds, paint-height units/cap, source hue treatment, default parameter values, matched seeds, performance results and known failure modes. Include visual examples and a clear **experimental / not released** status. Append measured differences only *after* actually running tests.

### G. **Do not change production integration yet**

Specifically do **not** modify `index.html`, `js/app.js`, production Oil-named Tissue modules `js/oil-render.js`, `js/oil-material.js`, `js/oil-surface.js`, SVG/plotter paths, `automation/generate-social.mjs`, `automation/build-gallery.mjs`, or gallery/social workflows. First review actual V2 generated artwork. A later approved release can separately add Oil as a new material, migrate UI labels, handle share versioning and mobile export.

## 3. Incremental implementation passes and review checkpoints

**Pass A — true impasto (highest priority):** fork V1 into V2; compute a *shared* pigment/height contour per stroke; additive height accumulation; improve normals and directional lighting. Render the same fixed **Field/Rects/Growth** seeds as V1. Compare magnified paint junctions; check new thickness actually reads at normal size. **Do not yet introduce massing** until this works.

**Pass B — two physical brush behaviours:** filbert and flat stroke envelopes, loaded-brush taper, correlated roughness, visible directional bristle grooves. Repeat **Spiral/Rects/Automatic Marks** fixed seeds; avoid square stamps, toothpaste outlines and regular comb striations.

**Pass C — restrained paint masses and overpaint:** localized path-family grouping, underpaint, opacity hierarchy and dry-drag contact. Review both dense **Field/Network** and sparse **Spiral/Orbital** to ensure negative spaces and source focal hierarchy are not erased. Instrument mass coverage and path retention.

**Pass D — full V2 acceptance:** fixed 8, *identical* random 8, matching V1/V2 side-by-sides and crops. Run comprehensive determinism/archived-material CI, compare timestamps and render costs, upload artifact. Iterate if it still looks marker-like. Remain on a draft experimental PR until the images earn approval.

## 4. Review criteria before anyone asks to release Oil V2

| Criterion | How to judge |
|---|---|
| Convincing opaque oil at normal viewing scale | Thick stroke bodies and dragged, stacked paint visible without zoom |
| Convincing 100% crops | Bristles aligned with path; variable paint loading; relief at crossings and ends; no stamped dabs |
| Source composition intact | Original φ focal placement, negative space, key geometry and deliberate sparse marks still recognizable |
| Real physical-looking layering | Overlaps visibly build height; later opaque strokes cover rather than multiply earlier hues |
| Palette fidelity | Source Marker hue relationships preserved; neutral seeds not muddy; cream ground unchanged |
| Deterministic and stable | Fixed and random seeds reproduce exactly; no contamination of V1 or production materials |
| Performance acceptable | Median and worst-case render time measured; no unbounded per-stroke full-canvas passes or mobile-memory blowup |

**Deliverable for V2 implementation:** 16 reproducible PNGs, 4 or more close-up crops, V1/V2 paired comparisons, parameter/seed manifest, timings, green regressions and an experiment-only PR. **Do not substitute AI-generated example images.**
