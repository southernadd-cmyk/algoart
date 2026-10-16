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
unchanged by this refactor (verified by hash). Growing the scratch to the
larger of old/new sizes was tested and **changes pixels** (scratch size
affects anti-aliasing at its edge), so it was not done.

### Oil V3 render consistency (kept as released; fixed in V4)

Oil V3 is not deterministic within a page. The tooth scratch canvas left over
from one render changes the next render's pixels, so the first render after
loading a link differs from later renders of the same seed, and a PNG export
(a later render) does not match the screen. Example, one page, same seed:
`666606600`, then `3766921744`, `3766921744`. Tissue and Watercolour do not
have this problem.

Decision: Oil V3 stays exactly as released. Oil V4 clears its own scratch
before every render, so every V4 render, Reveal and export equals V3's
**first render in a freshly loaded page**.

`js/app.js` and `js/export.js` route the new links, URL round-trips, archived
`?art=` restores and PNG export. Separately, this fixes an existing bug:
saving a PNG while on Oil V3 exported `oilPaintRevision:'v1'`, so the file
was painted by Oil V1, not the V3 shown on screen.

## Tests

`tests/cpu-canvas-wrapper.test.mjs` unit-tests the scope: restore after normal
exit, after exceptions and after nested scopes; a throwing renderer leaves the
target untouched; the audit detects a canvas whose context predates the scope;
the visible canvas never gets `willReadFrequently`; the final copy is exact for
opaque output; and no canvas references survive in returned or global
metadata. (Copying semi-transparent pixels to a GPU-backed visible canvas can
round differently, so new-version output must be fully opaque; it is, and
the benchmark asserts it.)

`tests/cpu-context-rebaseline.mjs` is the release gate (workflow
`cpu-context-rebaseline.yml`, sharded by material, default and SwiftShader
browser profiles). For every material × all eight engines × both
orientations it records warm timings, cold timings at three levels (fresh
page, fresh browser context, fresh browser process), new hashes, dimensions,
an old-vs-new difference, Reveal renders and PNG exports. It fails on:

* a missing fixture, or a missing or mismatched new hash in it;
  `REQUIRE_FULL_MATRIX=1` (set in CI) also rejects filtered runs and
  incomplete fixture coverage;
* changed dimensions, nondeterministic or non-opaque new output;
* contamination: the old version's hash sequence in a page alternating
  old/new differing from a page rendering only the old version;
* a non-CPU context in a new render, or `willReadFrequently` on the visible canvas;
* a new-version PNG export differing from its on-screen render (user order:
  screen render, then Save, same page);
* on a browser whose plain canvases are CPU-backed: new render, Reveal or
  export differing from the old version's first render in a fresh page. This
  checks the fixture independently of itself.

Reported, not failed: whether the old version is history-dependent within a
page (Oil V3: yes), and whether its export matches its screen (Oil V3: no).

Fixture: run the workflow manually with `write_fixture`. The default-profile
jobs write per-material fragments; `merge-fixture` combines them (48 entries)
into the `cpu-context-reference-fixture` artifact. Review it, then commit it as
`tests/fixtures/cpu-context-reference.json`. Don't freeze a locally generated
fixture: other Chromium builds can produce different hashes.

## Preliminary results (local, not CI)

Chromium 131 headless, scale 1, portrait, Connected Fields and Orbital
Studies, 2 warm and 1 cold sample per level and version. The `cpu` run wrote a
local fixture; the `swiftshader` run was verified against it and passed.

| Material | Case | `swiftshader` warm old→new | × | `cpu` warm old→new | × |
|---|---|---|---|---|---|
| Oil | network | 38078 → 1461 ms | 26.1 | 1944 → 1506 ms | 1.3 |
| Oil | field | 29862 → 1271 ms | 23.5 | 1441 → 1221 ms | 1.2 |
| Tissue | network | 2319 → 437 ms | 5.3 | 412 → 345 ms | 1.2 |
| Tissue | field | 2263 → 414 ms | 5.5 | 392 → 339 ms | 1.2 |
| Watercolour | network | 2042 → 839 ms | 2.4 | 950 → 901 ms | 1.1 |
| Watercolour | field | 2312 → 1072 ms | 2.2 | 968 → 925 ms | 1.0 |

* All six new-version hashes were **identical in both profiles**.
* With `cpu`, every new render, Reveal and export equalled the old version's
  first render (0 changed pixels). Cold-start ratios were 0.93–1.08.
* With `swiftshader`, old versions differed from new on 11–63% of pixels
  (mean channel difference 0.10–0.67); cold-start ratios matched the warm ones.
* Oil V3 was history-dependent in both profiles and its export did not match
  its screen; Oil V4, Tissue V8 and Watercolour V2T had neither problem.
* No contamination: V3's hash sequence was the same with or without V4 renders
  interleaved, in both profiles.
* SwiftShader is a software GPU, so it overstates readback costs on real
  GPUs. The `hardware` profile on real devices decides the release.

## Ready to promote when

1. The fixture is generated on CI, reviewed and committed, and the CI
   `default` profile passes the full gate for all 48 cases.
2. CI `swiftshader` profile gives the same new hashes as `default`.
3. The `hardware` profile on at least one desktop and one Android phone shows
   a worthwhile speedup and no new-version hash differences from CI.
4. Then switch defaults (`tissuePaletteVersion`, `watercolourMaterialRevision`
   and an Oil V3 legacy flag) in a separate, reviewable commit.
