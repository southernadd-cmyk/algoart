# Renderer and material history

This technical record preserves revision details and compatibility rules. See the [README](README.md) for current usage.

V9 makes paper colour an independent visual choice. Both Marker and Tissue & Graphite default to the established cream `#f5f0e6`; selecting a different paper colour changes the substrate without changing V9 geometry or its seed-selected pigment palette. The Paper picker persists across materials. Published V1–V8 renderings remain locked, including the fixed cream in Tissue revisions 4–6 under V8 links.

V8 expands Growth Systems with seeded golden-angle root directions, entries at the 38.2% and 61.8% stations on all four edges, and interior-root alternatives. Two to four growth forms appear more often, especially in landscape. Branch lengths diminish by φ, with space-aware turns and a shared segment budget. Other engines retain their V7 output. New social batches use V8; existing editions keep their recorded renderer and media.

## Drawing materials: Marker / Tissue & Graphite / Watercolour / Oil Paint v1

**Drawing material** in Compose currently offers four choices:

- **Marker drawing:** the established deterministic ALGO/ART marker work.
- **Oil Paint v1:** released 15 October 2026 (`material=oil-v1`); source-connected painted masses and loaded-bristle contacts retain the original composition's golden-ratio guide, colour ownership, hierarchy and negative space. This is a distinct material renderer, not a ninth engine or a filter.
- **Watercolour:** V2R remains frozen at `material=watercolour-v2r`; new V2S at `material=watercolour-v2s` retains Marker stroke hues and eligible original open linework, with V2R pigment physics preserved.
- **Tissue & Graphite:** layered pigment is derived from the **seeded Marker
  palette**, with the **original Watercolour V1 texture and graphite treatment**.
  Seeded Marker hues colour the paint; V1 pigment lightness and saturation
  preserve its muted character. V6 retains the approved torn edges and adds selected pale, translucent tissue
  layers over denser coloured marks, before the original pencil details.
  Paper defaults to cream `#f5f0e6` and is selectable for V9 artwork. **Randomise
  keeps the selected drawing material**.

All four choices preserve the same seed, φ geometry, orientation, composer controls
and the original versioned marker vectors. Switching material does not create a
new composition engine or modify the generator's random sequence.

The Watercolour V2R/V2S renderers are separate, versioned files; a saved V2R link
never upgrades silently. Approved Watercolour V2S matches each source Marker hue
(HSL source inks are converted deterministically to RGB), restores some omitted
open gestures, and preserves the V2R monochrome treatment. V2S is not the
experimental V2Q staged-drying renderer.

- **Legacy links and archives:** `?watercolor=1` and prototype `?oil=1`
  deliberately continue selecting **Tissue & Graphite**, producing the same
  historical fixed-palette pixels as before. Previous **`?tissue=2`**
  links reproduce the colour-wash-only revision. Earlier **`?tissue=3`** links retain the first graphite pass. New
  **`?tissue=4`** returns to the earlier material's softly coloured washes,
  neutral paper and original internal graphite texture, while
  preserving seeded palette hues and the same V8 geometry.
  **`?tissue=5`** retains the torn-edge revision and its closed-contour corner
  fix. **`?tissue=6`** adds the approved pale tissue pass while keeping
  the historic V8 fixed-cream backdrop, seeded paint hues, the V5 torn contours and original
  graphite operations. **`?tissue=7`** retains pale tissue and graphite but matches broad and
  fine tissue pieces to their original Marker stroke inks; atmospheric blooms
  use the nearest source stroke's RGB rather than the preset V1 palette.
  Earlier material links remain unchanged.
  Randomising an old artwork starts a new seed-driven Tissue image.
  The historical internal material name `watercolor`,
  archive IDs, seeds, queue paths and publishing schedule are unchanged.
  Do not recategorise historical archives, overwrite saved media, or retroactively
  repaint past works. The public-facing editor, new gallery labels and new
  social captions use **Tissue & Graphite**.
- **Export:** the selected material is exported as PNG (new Tissue & Graphite
  filenames end `-tissue-graphite`). SVG/plotter exports still use the original
  marker geometry rather than rasterised pigment.
- **Implementation:** historical modules `js/oil-render.js`,
  `js/oil-material.js` and `js/oil-surface.js` keep their technical names.
  They use Canvas2D without trained models, remote assets or installs, drawing
  technique inspiration from [PigmentLab](https://github.com/wieslawsoltes/PigmentLab)
  and [Wet Paint Flow](https://github.com/simonxxooxxoo/wet-paint-flow)
  without bundling their code or assets.
- **Torn Paper:** the earlier collage prototype stays archived and disabled
  in `experiments/torn-paper-v1.js`. The subsequent released Oil Paint v1 uses
  its own source-connected bristle renderer and is not the older tissue renderer.
- **Tests:** `npm run test:oil-render` verifies the unchanged historical
  material; `npm run test:tissue-colour` verifies seeded Marker inks, real
  palette variation, determinism and unchanged geometry. The real-browser
  regression confirms that Randomise never changes the selected material.
  From **14 October 2026**, initial daily Tissue & Graphite editions used
  `?tissue=6` with muted palette-matched washes, pale tissue, original V1 graphite texture,
  and **default `#f5f0e6` cream paper (editable in V9)**.
  From **15 October 2026**, newly generated Tissue daily editions use `?tissue=7` and the original colour-matched blooms. Earlier dates, URLs, saved JPEGs and original pigments remain untouched.
  All current materials use the shared paper-colour choice in the editor; Oil v1's primed canvas ground uses the selected paper and defaults to cream.

## Publication compatibility and cutover

Watercolor batches use separate `AWL`/`AWP` seeds, `WL`/`WP` archive IDs,
`?tissue=6` editor links for 14 October 2026 and `?tissue=7` from 15 October onward
(and historical `?watercolor=1` links before that date), gallery medium labels,
and independent media
release manifests / per-platform completion markers. Existing social triggers
are reused; there are **no additional cron jobs**. IG portraits use the same
uncropped 4:5 padded image handling as marker portraits. Failed destinations
are retried without reposting destinations already marked successful.

Run `npm run test:watercolor-publishing` to check slot selection, short links,
duplicate-safe gallery merging and the combined 14-work archive. The separate
browser workflow `watercolor-tests.yml` renders and verifies four real studies.
Historical gallery entries remain byte-for-byte unchanged. The 14 October
cutover is in `automation/tissue-edition.mjs`: the two portrait and two landscape
new Tissue editions use quiet, translucent seeded washes, selected pale tissue and fine pencil
hatching on the default **cream** paper (`#f5f0e6`), and the usual 09:00 / 20:30 social slots use the same
frozen JPEGs and links. Starting 14 October, newly generated Marker gallery
studies also use that same cream paper. For Tissue v2/v3, the paint lighting
preserves the visible paper colour instead of washing it out to white.

## Oil Paint v1 release — 15 October 2026

Oil Paint v1 shipped as the **fourth selectable material**, following the independent experimental V5o/V5p/V5q work. Its mark making uses the experimental loaded-bristle V4e contacts, with painting organised by **source-connected masses** and relationships from the already generated ALGO/ART composition guide. The φ geometry supplies placement, scale, hierarchy and relationships: it is not imposed as a literal jigsaw or stencil. Painted forms maintain source colour ownership and preserve intended negative space. Rendering is deterministic and does not use an image-generation model.

- **Release commit:** [`3a6d3cb`](https://github.com/southernadd-cmyk/algoart/commit/3a6d3cbfe4ac7d62a01581ee7b2090aaa36dcce0). Oil is selected with `material=oil-v1`; older `oil=1` still means the historical Tissue material and must not be repurposed.
- **Editor parity:** [`a85ae24`](https://github.com/southernadd-cmyk/algoart/commit/a85ae244adce0e3977f0434be8cf5376316b4974) restored Oil Reveal overlays, original guide/void metadata, material-specific help, and selected-artwork metadata across editor and 4-Up interactions. [`e4409af`](https://github.com/southernadd-cmyk/algoart/commit/e4409af9c88f6be98c9c99a44cb722f93c2e366d) refreshed cached scripts.
- **Paper:** [`b6b4844`](https://github.com/southernadd-cmyk/algoart/commit/b6b484471daa6da2cd3e1d75941369042de6c1a1) made Oil's primed canvas respect the selected Paper colour, preserving the cream default and the seeded source geometry, brushwork and palette.
- **Exports and compatibility:** Oil appears in on-screen and PNG renders and exact-artwork share links. SVG/plotter continue exporting source marker geometry. Marker, Tissue and Watercolour versions and pre-existing artwork links remain preserved.
- **Publishing:** [`000b3cb`](https://github.com/southernadd-cmyk/algoart/commit/000b3cb0d980c592aa06bcd5fc94c8bad7080911) added one Oil portrait and one Oil landscape per daily gallery edition, each with independent seed and palette, and dispatch during the existing 15:00 UK social publishing slot. This makes 16 studies when all 10 Marker, four Tissue and two Oil artworks are generated.
- **Sharing interface:** [`f6102f0`](https://github.com/southernadd-cmyk/algoart/commit/f6102f08f204d61ef3aa47308f5e6ab1546ba2e5) put Copy Link first and introduced social sharing. [`eb4dd54`](https://github.com/southernadd-cmyk/algoart/commit/eb4dd5455289ccbb0f4892e7e274bff38568412b) removed the editor's Instagram share control, replacing Threads and Bluesky controls with marker-drawn icons and artwork preview URLs; scheduled Instagram publishing was not removed. [`b6f2726`](https://github.com/southernadd-cmyk/algoart/commit/b6f27265f857a417356247b41b2cfac96de721cb) refreshed versioned Threads preview metadata. Social metadata caching and remote previews should continue to be checked in real clients; passing browser checks does not guarantee a particular platform has refreshed its cache.

**Version naming:** Oil **v1** is the released material identifier; experimental V5o/V5p/V5q describe its pre-release evolution, not three separately released Oil materials. Maintain this distinction when adding later Oil revisions. Historical source modules named `oil-render.js`, `oil-material.js`, and `oil-surface.js` still belong to the Tissue lineage.
