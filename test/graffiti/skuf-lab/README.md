# SKUF writing laboratory (experimental)

[Open standalone study](https://southernadd-cmyk.github.io/algoart/test/graffiti/skuf-lab/)

**Not a validated reproduction of SKUF's actual handstyle. Not connected to the tower.**

## Scope and current state

1. **Reference gathering:** \`references.mjs\` identifies 13 dated research leads across seven source-page URLs. These are *not* 13 vetted single-image handstyle exemplars. Vetted count begins at zero and increases only when the image-level observation form has been completed. The rooftop-labeled photograph is a throw-up, not handstyle movement evidence.
2. **Reconstruction editor:** The page starts from the obsolete word-study paths explicitly labelled as provisional. Users can load a reference photo locally, align/adjust its overlay, drag anchor/handle points, draw gestures, reorder strokes, mark joins/lifts, annotate observed geometry and uncertain motion, and export editable JSON. The underlying photograph is never included in saved files.
3. **Timed motion prototype:** \`gesture-model.mjs\` builds cubic geometry, samples arc length, and assigns *synthetic* minimum-jerk movement times and independently parameterised pen pressure. Pen lifts are explicit. Geometry is deterministic for a given document, while a fixed seed produces reproducible timings and small pressure variations. Movement has **not** been calibrated with GML data or witnessed stroke capture.

## Rebuilding the study

Work with an actual **handstyle** photo (not a throw-up). Select its source, load a local copy via the browser, align the reference with the view controls, edit or replace every path, and separately record visible shapes and inferred stroke-order hypotheses. Save the document JSON so it can be compared under a fixed seed.

Do not accept a replacement tag merely because ink texture is more realistic. Approve only after geometry matches repeatedly observed features and the writing motion is physically coherent.

## Tests

From the repository root:

\`\`\`sh
node --test tests/gallery-skuf-lab.test.mjs
\`\`\`

The isolated source contains no external dependencies. The test suite validates cubic conversion, time ordering, seed reproducibility, pressure and path validity, joins and lifts, and metadata counts. It does **not** substitute for a browser screenshot test or artist-reference review.

## Release gates

- 15–25 manually reviewed, usable, individual SKUF *handstyle* photo references, each with its source and medium recorded.
- A source-led reconstruction that retains characteristic word silhouette with texture disabled.
- Playable stroke order with clearly annotated uncertainties and no unphysical contact joins.
- Deterministic geometry and motion tests plus fixed-seed browser comparisons across mobile and desktop.
- Approved original word variants, then context-aware A–Z, **before** introducing to any existing gallery atlas.
- Full new-and-historical-floor regression, bundle rebuild, publishing checks and rollback before tower deployment.

The current study remains isolated from \`gallery/visit/gallery-bundle.js\`. Do not increment the production alphabet registry revision while the tag is unapproved.

## Research links

- [SKUF interview, VICE (2016)](https://www.vice.com/en/article/skuf-what-happens-when-a-legendary-graffiti-writer-grows-up/) — distinguishes the recognizable tag S from the specific proportions of a throw-up.
- [SKUF archive, The Great Gallery of Graffiti](https://graffiti.stompandcrush.com/tag/skuf-ykk-2/) — dated images, mixed writing forms. Requires individual image review.
- [SKUF paper work, Carnage NYC](https://carnagenyc.com/home/2015/12/3/december-3-skuf-ykk) — sketches and accompanying handstyle on paper.
- [000000book / GML](https://000000book.com/) — movement examples for motor-behaviour comparison, **not** an archive of verified SKUF movements.

Images remain linked to their original publishers; no third-party photograph is bundled here.
