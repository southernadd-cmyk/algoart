# CPU canvas backend material versions

Status: **preview, link-only**. Defaults are unchanged (Oil V3, Tissue V7,
Watercolour V2S). The new versions are reachable only through their links
until the benchmark below has been reviewed.

| New version | Link | Drawing code | Backend |
|---|---|---|---|
| Oil V4 | `material=oil-v4` | Oil V3, unchanged | CPU canvases |
| Tissue V8 | `tissue=8` | Tissue V7, unchanged | CPU canvases |
| Watercolour V2T | `material=watercolour-v2t` | Watercolour V2S, unchanged | CPU canvases |

## What changed

`js/cpu-canvas.js` adds `A.withCPUCanvases(fn)`. Inside it, every 2D context
created is requested with `{willReadFrequently:true}`. `A.renderViaCPUCanvas`
renders an existing renderer onto an internal canvas inside that scope, then
copies the finished bitmap to the caller's canvas with one 1:1 `copy` draw.
The visible page canvas (and the export canvas) never receive
`willReadFrequently`.

This covers every intermediate canvas in the three pipelines, not only the
ones read back directly: Oil's tooth scratch and stencils, the Oil V1
connection pass, Tissue's pigment/height/final layers and paper raster,
Watercolour's pigment, wet and soft layers, and the source-capture canvases.
Old versions never enter the scope, so their code paths are untouched.

`js/oil-brush-v3.js` keeps its module-level tooth caches per backend, so
Oil V3 and Oil V4 never share a canvas in the same page. Oil V3's pixels are
unchanged by this refactor (verified by hash). A tempting extra change —
growing the scratch to the larger of old/new sizes — was tested and **changes
pixels** (scratch size affects anti-aliasing at its edge), so it was not made.

`js/app.js` and `js/export.js` route the new links, URL round-trips, archived
`?art=` restores and PNG export. Separately, this fixes an existing bug:
saving a PNG while on Oil V3 exported `oilPaintRevision:'v1'`, so the file
was painted by Oil V1, not the V3 shown on screen.

## Benchmark and re-baseline harness

`tests/cpu-context-rebaseline.mjs` (workflow `cpu-context-rebaseline.yml`)
renders four compositions × two orientations for each material, old and new
version, and records warm and cold first-render medians, new hashes and
dimensions, determinism, a CPU-context audit, and an old-vs-new difference
summary. Browser profiles: `default`, `cpu`, `swiftshader`, `hardware`.

It **fails** on: changed dimensions; nondeterministic new output; a non-CPU
context inside a new-version render; `willReadFrequently` on the visible
canvas; new hashes that differ from `tests/fixtures/cpu-context-reference.json`.
Old-version hashes are reported, not asserted.

The fixture is not committed yet. Generate it on CI (workflow_dispatch with
`write_fixture`), review the uploaded artifact, then commit it. Hashes from
other Chromium builds can differ, so don't freeze a locally generated one.

## Preliminary results (local, not CI)

Chromium 131 headless, scale 0.45, Connected Fields and Recursive Divisions
landscape, 3 warm / 2 cold samples per version (medians).

| Material | Case | `swiftshader` warm old→new | ×  | `cpu` warm old→new | × |
|---|---|---|---|---|---|
| Oil | network | 3911 → 364 ms | 10.8 | 363 → 322 ms | 1.1 |
| Oil | rects | 4702 → 512 ms | 9.2 | 520 → 480 ms | 1.1 |
| Tissue | network | 1207 → 199 ms | 6.1 | 205 → 167 ms | 1.2 |
| Tissue | rects | 2135 → 272 ms | 7.8 | 211 → 234 ms | 0.9 |
| Watercolour | network | 638 → 319 ms | 2.0 | 308 → 588 ms | noise |
| Watercolour | rects | 2399 → 930 ms | 2.6 | 464 → 663 ms | noise |

* With `cpu`, all six new renders are **pixel-identical** to the old version.
* With `swiftshader`, old versions differ (8–96% of pixels changed, max
  channel difference 24–63), new versions do not.
* The new-version hashes were **identical in both profiles**: the output no
  longer depends on whether the browser GPU-accelerates canvases.
* Watercolour's `cpu` warm samples were bimodal for both versions
  (≈300 ms or 600–1200 ms), so those ratios are noise; cold medians matched.
* SwiftShader is a software GPU, so its readback costs overstate a real GPU.
  The `hardware` profile on real devices is what decides the release.

## Ready to promote when

1. CI `default` profile passes and shows new = old pixels for all 24 cases.
2. CI `swiftshader` profile gives the same new hashes as `default`.
3. The `hardware` profile on at least one desktop and one Android phone shows
   a worthwhile speedup and no new-version hash differences from CI.
4. Then switch defaults (`tissuePaletteVersion`, `watercolourMaterialRevision`
   and an Oil V3 legacy flag) in a separate, reviewable commit.
