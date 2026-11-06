# Action Painting V5 — isolated physical paint study

**Status:** experiment / review only. No studio default, daily archive, social queue, or historical V1–V4 renderer is changed.

## Purpose
Compare the same φ-governed drawings using the current experimental Action V4 material and an independent V5 treatment of pigment behaviour. Preserve *all* existing daily works, including awkward and unresolved examples: they are part of the project's experiment, not material to filter out.

## What V5 changes
- **Load depletion:** line thickness progressively falls within each already planned V4 pour.
- **Dry endings:** near the tail of a stroke, occasional segments become small beads.
- **Kinetic droplets:** localized droplet sprays depend on the stroke's segment travel, not a uniform random canvas position.
- **Slow-turn deposits:** curved slower passages can leave a small localized paint pool.
- **Separate material seed:** extra effects use `seed|mode|action-v5-material|variant` and never consume V4's placement/trajectory RNG.

## What V5 must not change
- The source marker geometry and the eight composition engines.
- Golden-ratio placement, hierarchy, negative space, path endpoints, curvature, material palette and layer ordering as chosen in V4.
- Existing source geometry, source seed, source paths, output image dimensions, historical V3/V4 pixels, saved URLs, or archive entries.
- The editor's material selector, gallery curation/recording, publication scheduler or live deployed gallery.

**The V4 renderer is copied into a new, separately versioned V5 file** with localized treatment changes; V3 and V4 remain intact. Comparisons must be generated from identical seeds and settings. The study exposes the actual dry-bead, kinetic-droplet and slow-pool counts, not simply claims about appearance.

## Review instructions
Serve repository root with `python -m http.server 4173`, then open
`http://localhost:4173/test/action-physics-v5/`. Change seed, engine, orientation and φ pull to compare V4 against V5. Review effects at full image and close range, particularly the impact on quiet paintings, saturation, edge detail and negative-space boundaries. The comparison harness has no public editor route.

Run `node tests/action-physics-v5.test.mjs` for deterministic Node tests, and `node tests/action-physics-v5-browser.mjs` with the server running for browser snapshots. The Action V5 workflow runs both and uploads PNG comparison screens plus JSON measurements.

## Attribution and provenance
Technique review was informed by Vitalii Samolovskikh's [Pollock Dreams](https://github.com/kefirfromperm/pollock-dreams), especially its depiction of depletion, paint pooling and splatters. The adaptation here is an independent implementation in PROPORTION PIECE's existing V4 material engine; no Pollock Dreams source code, colour palettes or assets were copied. Pollock Dreams' repository is published under Apache License 2.0.

## Release gate
A successful test run means the experimental implementation is reproducible and structurally isolated, **not** that its output is aesthetically better. Do not merge or change production. A decision requires visual review of multiple ordinary works at weak and strong φ pull, not cherry-picked images.
