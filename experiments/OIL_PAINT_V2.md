# ALGO/ART Oil Paint V2 — Impasto & Brush Massing

**Status: isolated browser-only prototype, not released.** Oil V1 remains byte-identical in `js/oil-paint-v1.js`; no changes to gallery, production material menu, historical Oil-named Tissue modules or scheduled social publishing.

## Implemented V2

- `js/oil-paint-v2.js` translates the same V9 precise Marker recorder strokes at the same source seeds and optional approved φ framing.
- **Continuous brush envelopes:** two distinct `Path2D` paint-body profiles, flatter chisel-like edges on Rects/Constructed Forms and filbert/rounded ends on Growth, Trajectories and Network. Deterministic profile mixing on other engines.
- **Directional loaded-brush texture:** denser variable bristle filaments along the path, colour variation derived from source pigments, selected broken pickup near ends, and opaque top-layer overpainting.
- **Conservative paint massing:** expand block-in only along nearby, nearly parallel, similar-hued source marks. No convex-hull bridging, new free-floating paint clouds or filling whole protected voids.
- **Additive impasto height:** a single `Float32Array` height field accumulates per-stroke local masks, with saturating cap 4. The colour and relief are derived from the **same precomputed brush `Path2D`**, avoiding V1 contour misregistration and non-additive alpha blending.
- **Directional relief:** a single pixel pass estimates normals from accumulated surface height, with controlled warm highlights and dark side gradients, preserving the underlying source colour and cream ground.
- **Fewer missing marks:** retain up to 540 significance-ranked source paths in original draw order, rather than V1's 115 long + 145 short limits; report source and dropped counts.

### Prototype controls (not public)

`thickness=.86`, `drag=.62`, `bristles=.90`, `massing=.44`, `relief=.78`, `profile='auto'`, `phiFraming=true` for sample renders.

No generative AI/image generation is involved in the renderer or image tests.

## Test matrix and deliverables

`tests/oil-v2-sixteen.mjs` uses **exactly the V1 frozen eight fixed seeds and the identical reproducibly random eight seeds**, with the same settings, source colours, orientation and φ framing. It outputs:

- 8 V2 fixed PNGs, one per ALGO/ART engine
- 8 V2 seeded random PNGs (4 portrait/4 landscape)
- All 16 V1 reference PNGs generated from the unchanged old engine using identical settings
- V2 fixed and random contact sheets
- 16-pair V1/V2 contact sheet (V1 left, V2 right)
- 4 unscaled 360×280 texture-detail crops
- JSON manifest with exact source settings, paths, profile distribution, mass-group counts, height P95 and timings

`tests/oil-v2-physics.test.mjs` verifies accumulated paint load, deterministic render bytes, significant relief, brush profile selection and restoration of global renderer state. `.github/workflows/oil-v2-sixteen-tests.yml` executes those tests plus existing material regressions and uploads `oil-v2-16-real-engine-renders`.

## Review gates

Do not merge until the 16 oil images have been reviewed. Compare them with V1 at full frame and 100%-pixel crops. Oil must read as loaded impasto, not a marker stroke enlarged or a generalized filter; source φ composition and empty space should remain recognizable. Watch for toothpaste/satin-plastic paint, high-frequency comb bristles, unreadable dense scenes and muddy colours. Capture average and worst-case render times from manifest before publicizing performance claims.

## Known limits

A physically accurate fluid solver, real color-pigment spectral mixing and dry-time are out of scope; massing is deliberately conservative. Limited source-path significance ranking may still drop marks on extreme seeds; each omission is explicitly counted. Run on mobile later before release, because height field + source recorder + two canvases occupy memory.
