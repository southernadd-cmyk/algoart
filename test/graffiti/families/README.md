# Graffiti alphabet development — nine active families

[Open the comparison page](https://southernadd-cmyk.github.io/algoart/test/graffiti/phase-d-alphabets.html).

The 60 A–Z reference sheets in the user-provided Bombing Science page were analysed and provisionally grouped by **letter anatomy and movement**, not just mark thickness or colour. This release exposes **nine distinct A–Z alphabets, each with a separately authored φ**, following review of the completed word specimens. The original tenth study is retained as research, but not displayed as a distinct family because its results looked too similar to Rotational loops.

| ID | Active family | Principal sheet | Structure |
|---|---|---:|---|
| A | Interlocked marker | 41 | Dense diagonal crossings and compressed counters |
| B | Arrow-cross handstyle | 7 | Rebuilt from #7 and #9 using broad marker slashes, asymmetrical loops and hooked reversals |
| C | Cut-wedge angular | 13 | Solid filled wedges with inset negative space |
| D | Rectilinear block | 20 | Squared counters and hard corners |
| E | Fractured gothic | 29 | Broad fractured staves and fine joining lines |
| F | Broad-nib calligraffiti | 59 | Fixed-angle nib and direction-dependent stroke width |
| G | Rotational loops | 8 | Nested counterloops and circular crossings; incorporates former J references |
| H | Fragmented brush | 30 | Deliberately broken slash structures |
| I | Angular chisel gestures | 10 | Tapered rectangular-marker cuts and sparse triangular gestures |

**Retired J:** original independently authored `sweeps` A–Z geometry remains in `families/I-J.mjs`, with reference sheets 36, 40, 52 and 54 included under G's research anchors. The public registry does **not** expose a separate J. Historical production tags were not migrated, and the public comparison handles old `?family=J` links by selecting G.

All active families contain **26 independently authored SVG glyphs plus φ**. Letter rendering is construction-specific, not a common font with a new texture. Compatible writers can draw optional measured, deterministic cross-letter links; less connected families intentionally do not receive joins. Long multi-letter words have slightly more tracking than short tags to protect legibility. Seed affects small word-level shifts, not authored letter shapes.

The original sheets are third-party images retained in the user's offline research archive; none are checked into this repository. These paths are **new studies of construction rules**, not licensed duplicates or authenticated artist-specific handwriting.

## Test and release boundary

```sh
node --test test/graffiti/phase-d.test.mjs
node test/graffiti/phase-d-browser-check.mjs
```

The Playwright check renders the complete alphabet (+φ) in every active family, verifies distinct word geometry, bounds, SVG exports, ligature controls, broad marker and chisel stroke generation, and a mobile viewport. The `Phase D graffiti alphabet review` GitHub workflow uploads browser screenshots.

**No production gallery files are changed** by this review. In particular, `gallery/visit/gallery-bundle.js`, exterior and indoor tag atlases, historical floors and publishing jobs are not modified. Production integration needs separate visual approval, spray/marker adaptation, deterministic tag placement, rebuilds and VR/mobile regression checks.
