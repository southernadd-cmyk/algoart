# Phase D — graffiti alphabet families

This is an isolated research prototype for PROPORTION PIECE.

Review page: [Graffiti lettering, ten ways](https://southernadd-cmyk.github.io/algoart/test/graffiti/phase-d-alphabets.html).

## What is actually authored

There are **260 individually authored uppercase glyphs** across ten different source-informed construction families, not ten colour treatments of a single font. The dataset contains **679 independent authored SVG gesture paths**. Each family is implemented in a separate section of `families/A-C.mjs`, `D-F.mjs`, `G-H.mjs`, or `I-J.mjs`, and validated by `families/parse.mjs`. No fallback to `phi-lettering.mjs` or the older handstyle skeleton is allowed.

| Family | Primary reference sheet | Key geometry |
|---|---:|---|
| A — Interlocked marker | 41 | crossing diagonals; compressed counters |
| B — Linear skeletal | 7 | open thin strokes; exposed nodes |
| C — Cut-wedge angular | 13 | filled acute wedges; diagonal white gaps |
| D — Rectilinear block | 20 | squared counters; corridor construction |
| E — Fractured gothic | 29 | blade-shaped staves; fine hairline joins |
| F — Broad-nib calligraffiti | 59 | fixed-angle nib; direction-dependent width |
| G — Rotational loops | 8 | linked circular strokes; nested counterloops |
| H — Fragmented brush | 30 | purposeful disconnected blade fragments |
| I — Sparse gestural | 10 | one or two economical open strokes |
| J — Kinetic sweeping handstyle | 52 | long recoil gestures and return turns |

Sheet numbers refer to the **60 complete alphabet images** in the offline saved Bombing Science article supplied in the conversation. The separate lead image contains only A–L. The images remain in the user's offline archive and are **not copied to this repository**.

These are new, original designs **informed by letter-anatomy observations** from that collection, not reproductions or purportedly authentic handwriting from any specific artist. Reference **families** are still provisional; the number of final tower styles can increase or decrease after comparison.

## Using and testing

Choose a family on the review page to see its 26 capitals. Enter the same word at the top to compare all ten. **Underlying geometry** presents every style in monochrome with the same simple pen outline to separate anatomy from ink treatment. The seed adjusts only very small placement/rotation differences; letter construction is fixed for reproducibility. Export either the complete 26-letter SVG sheet or the selected word.

The production virtual tower, atlas planner, bundle and historical floors are not changed.

```sh
node --test test/graffiti/phase-d.test.mjs
# After installing the project's Playwright dependencies and Chromium:
node test/graffiti/phase-d-browser-check.mjs
```

The browser script verifies 26 letters in each family, ten distinct geometric and raster word previews, letter bounding boxes, SVG downloads, console errors and mobile overflow. It uploads twelve screenshot artifacts through the `Phase D graffiti alphabet review` GitHub workflow.

## Before production

1. Review all ten **A–Z sheets** at usable size, especially the visually simpler B and I families.
2. Assess full-word composition across SKUF, PHI, MUSHROOM and PROPORTION PIECE. Approve writer identity, letter proportions and real tag plausibility, not just code tests.
3. Give every approved family its own versioned identity and add missing special characters (especially `φ`) and contextual joins. There is **no** direct production fallback or auto-upgrade of historical tags.
4. Integrate with marker/spray materials, deterministic exterior/interior planning and offline atlases; rebuild `gallery/visit/gallery-bundle.js`.
5. Run gallery loading, VR, mobile, SVG/PNG export, cached atlas and historical backfill regression checks before deployment. Keep old tower output until the new geometry is approved.

Nothing in this Phase D prototype should silently migrate existing tower graffiti.
