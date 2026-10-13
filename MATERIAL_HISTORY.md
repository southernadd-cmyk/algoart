# Renderer and material history

This technical record preserves revision details and compatibility rules. See the [README](README.md) for current usage.

V8 expands Growth Systems with seeded golden-angle root directions, entries at the 38.2% and 61.8% stations on all four edges, and interior-root alternatives. Two to four growth forms appear more often, especially in landscape. Branch lengths diminish by φ, with space-aware turns and a shared segment budget. Other engines retain their V7 output. New social batches use V8; existing editions keep their recorded renderer and media.

## Drawing materials: Marker / Tissue & Graphite

**Drawing material** in Compose currently offers two choices:

- **Marker drawing:** the established deterministic ALGO/ART marker work.
- **Tissue & Graphite:** layered pigment is derived from the **seeded Marker
  palette**, with the **original Watercolour V1 texture and graphite treatment**.
  Seeded Marker hues colour the paint; V1 pigment lightness and saturation
  preserve its muted character. V6 retains the approved torn edges and adds selected pale, translucent tissue
  layers over denser coloured marks, before the original pencil details.
  Paper stays at the default cream `#f5f0e6`. **Randomise
  keeps the selected drawing material**.

Both choices preserve the same seed, φ geometry, orientation, composer controls
and the original V1–V8 marker vectors. Switching material does not create a
new composition engine or modify the generator's random sequence.

**Watercolour v2 remains experimental** in its separate draft pull request.
When its wash behaviour is visually finished, add **Watercolour** as a *third*
material choice beside Marker and Tissue & Graphite; never replace or silently
change the original material.

- **Legacy links and archives:** `?watercolor=1` and prototype `?oil=1`
  deliberately continue selecting **Tissue & Graphite**, producing the same
  historical fixed-palette pixels as before. Previous **`?tissue=2`**
  links reproduce the colour-wash-only revision. Earlier **`?tissue=3`** links retain the first graphite pass. New
  **`?tissue=4`** returns to the earlier material's softly coloured washes,
  neutral paper and original internal graphite texture, while
  preserving seeded palette hues and the same V8 geometry.
  **`?tissue=5`** retains the torn-edge revision and its closed-contour corner
  fix. Current **`?tissue=6`** adds the approved pale tissue pass while keeping
  fixed cream paper, seeded paint hues, the V5 torn contours and original
  graphite operations. Earlier material links remain unchanged.
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
  in `experiments/torn-paper-v1.js`. Opaque impasto/oil remains a separate
  possible future style.
- **Tests:** `npm run test:oil-render` verifies the unchanged historical
  material; `npm run test:tissue-colour` verifies seeded Marker inks, real
  palette variation, determinism and unchanged geometry. The real-browser
  regression confirms that Randomise never changes the selected material.
  From **14 October 2026**, new daily Tissue & Graphite editions use
  `?tissue=6` with muted palette-matched washes, pale tissue, original V1 graphite texture,
  and **fixed default `#f5f0e6` cream paper**.
  Their previous dates, URLs, saved JPEGs and original v1 pigments remain untouched.
  Marker editions retain their own paper-colour choices.

## Publication compatibility and cutover

Watercolor batches use separate `AWL`/`AWP` seeds, `WL`/`WP` archive IDs,
`?tissue=6` editor links for editions on or after 14 October 2026
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
