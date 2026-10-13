# ALGO/ART
<img src="https://github.com/southernadd-cmyk/algoart/raw/main/social-card.png" alt="Social card" width="377">

**Mathematics sets the structure. Materials bring the texture.**

ALGO/ART is a browser-based generative art project built around the **golden ratio (φ ≈ 1.618)**. Eight composition systems use mathematical rules, seeded randomness and deliberate visual calibration; a separate material renderer adds imperfect marker ink or translucent tissue and fine graphite.

**Guiding question:** *How far can the golden ratio govern a composition while its marks remain visibly human?*

[Open the editor](https://southernadd-cmyk.github.io/algoart/) · [Browse the Daily Gallery](https://southernadd-cmyk.github.io/algoart/gallery/)


## Using ALGO/ART

1. Open the [editor](https://southernadd-cmyk.github.io/algoart/) and choose one of the eight composition systems.
2. Adjust the composition, **Additional φ pull**, colour, paper and **Materials** controls. **Randomise** explores across all eight systems; **Mutate** changes the current system's settings, while **4-Up Variations** shows alternatives within the selected system.
3. Choose **landscape (1400 × 1000)** or **portrait (1000 × 1400)**.
4. Export as **PNG**, **SVG** or **Plotter SVG**, or copy a share link to reopen the same artwork.

Artworks are deterministic: the **renderer version + seed + settings** identify a reproducible state, including through shared URLs.

## The eight systems

| System | Composition approach |
| --- | --- |
| **Orbital Studies** | Scores candidate layouts using φ-related focal points, hierarchy and visual relationships. |
| **Golden Trajectories** | Uses golden-angle movement and φ-informed expressive paths. |
| **Recursive Divisions** | Divides the canvas into territories at golden sections. |
| **Radiant Systems** | Builds radial arrangements around focal points with golden-angle steps. |
| **Connected Fields** | Creates networks with φ-weighted distances and hierarchy. |
| **Growth Systems** | Grows branching structures with golden-angle turns and φ-based decay. |
| **Constructed Forms** | Arranges independent geometric shapes around φ-guided positions and scales. |
| **Automatic Marks** | Organises loose, gestural strokes around φ-weighted anchors and negative space. |

The golden ratio governs aspects of composition; not every stroke or tuning value is a mathematical identity. The tension between those rules and the hand-drawn appearance is part of the experiment.

## Run locally

The interactive editor is **static HTML, CSS and JavaScript**. It requires no JavaScript framework, build step, backend or API key. Serve the repository from a local HTTP server so gallery and other file requests work normally:

```bash
git clone https://github.com/southernadd-cmyk/algoart.git
cd algoart
python3 -m http.server 8000
```

Then visit **http://localhost:8000/**. On Windows, `py -m http.server 8000` is an alternative if Python is installed.

### Project layout

| Path | Purpose |
| --- | --- |
| `index.html`, `css/` | Editor interface and styles |
| `js/phi.js`, `js/random.js` | φ geometry and seeded randomness |
| `js/generator.js`, `js/marker.js` | Compositions and expressive mark rendering |
| `js/app.js`, `js/control-help.js` | User controls, versioned URLs and interface guidance |
| `js/export.js`, `js/plotter.js` | Image, SVG and plotter exports |
| `gallery/`, `automation/` | Daily archive and optional publishing workflows |
| `tests/` | Determinism, geometry, export and browser regression checks |

## Development and tests

For automated tests and gallery/social tooling, use **Node.js 22** and npm:

```bash
npm ci
npm run test:control-ranges
npm run test:orientation
npm run test:organic-version
npm run test:growth-v8
npm run test:renderer-lock
npm run test:plotter
npm run test:tuning-equivalence
```

The tuning-equivalence test compares generated drawings with a pinned historical Git commit; it needs that commit available in the local Git history. Browser-based archive and plotter-fidelity checks run in GitHub Actions across Chromium, Firefox and WebKit (see [the archive workflow](.github/workflows/archive-reproduction.yml)).

**Current renderer: V9.**

| Renderer | Status |
| --- | --- |
| **V9** | Current editor; paper colour no longer changes seeded composition or pigments |
| V8 | Preserved with its original paper-seeded geometry and historic Tissue cream background |
| V1–V7 | Preserved for historical seeded artworks and exact shared links |

Historical renderer and material versions remain available so saved links reproduce their original artwork. See [Renderer and material history](MATERIAL_HISTORY.md) for revision details, compatibility rules and implementation notes.

## Drawing materials

- **Marker drawing:** expressive ink with wobble, uneven weight, pressure and dryness.
- **Tissue & Graphite:** translucent torn tissue and fine graphite, with colours chosen by the seed, on your selected paper colour (cream by default).

Both materials use the same seeded composition. From renderer V9, changing paper colour does not change the artwork's geometry or selected pigment colours, and switching materials preserves the paper choice. Published V1–V8 compositions remain version-locked. Choose the material in **Compose**, and adjust underlying stroke settings in **Materials** (formerly **Pen**). The **Mark-making tool** is labelled **Source mark profile** for Tissue & Graphite. Its seven choices use material-appropriate names such as Fine contours, Wide bands and Flat-edged bands, while retaining the exact underlying pen IDs and seeded source paths. The Materials sliders likewise describe source marks in Tissue mode; they do not simulate physical paper thickness, brushes or graphite pressure. Switching materials restores the original Marker labels without changing any setting values. **Randomise keeps the selected material.** PNG exports include the selected material; SVG and plotter exports retain the original marker paths.

## Daily gallery and publication

The daily gallery includes **four additional deterministic Tissue & Graphite studies** (historically called watercolour):
two portrait and two landscape. The 04:15 UTC gallery build creates all four,
and the existing London social slots publish them to configured platforms:

| London slot | Tissue & Graphite additions |
| --- | --- |
| 09:00 | One portrait + one landscape |
| 15:00 | None (existing marker posts only) |
| 20:30 | One portrait + one landscape |

The ordinary five-landscape and five-portrait marker batches and their
publishing times are unchanged, giving **14 total studies** per complete day.
Material batches have independent publication records and reuse the existing social triggers. Failed destinations are retried without reposting successful ones. Historical gallery entries and their saved media remain unchanged.

Run `npm run test:watercolor-publishing` to check slot selection, short links, duplicate prevention and the combined archive. See [publication compatibility](MATERIAL_HISTORY.md#publication-compatibility-and-cutover) for historical IDs and cutover details.

## PNG export on phones

On mobile PNG export defaults to 1×; 3× is disabled on small screens. Tap
**Prepare PNG**, then the visible **Download PNG** link. The PNG is encoded
before the download tap, with no hidden programmatic click. **Open PNG to save
manually** also opens the prepared image. Changing the artwork or export size
clears the prepared file. Desktop PNG export remains one click.
Touch-emulated browser tests cover repeated exports and closing/reopening the
panel around Randomise; they do not verify Android Chrome’s download manager.

## Plotter compatibility

Plotter SVG supports faithful colour runs and grouping by pen, with light-to-dark pen identities and pen-change pause labels. **Actual Inkscape/AxiDraw behaviour has not been hardware-tested.** See [issue #40](https://github.com/southernadd-cmyk/algoart/issues/40) to help verify pauses, Resume and individually selected numbered layers.

## Further documentation

- **[Development Log](DEVELOPMENT_LOG.md)** — the full original README, preserved verbatim, including design decisions, renderer history, gallery/social workflows and detailed tests.
- **[Calibration Audit](CALIBRATION_AUDIT.md)** — which numbers are genuine φ mathematics, artistic calibration or rendering mechanics.
- **[Tuning History](TUNING.md)** — numerical extraction and exact-output compatibility notes.

**Published renderer versions are immutable.** The V8 output is locked against the permanently pinned source commit `395e473a826d7c481fde2e0198f753467332b04b` by `npm run test:renderer-lock`. The check compares 144 representative renderings in the same runtime, including native canvas operations, Reveal metadata and plotter SVG pen paths. It runs on pull requests through the lightweight control-range regression workflow (not the browser matrix). Never refresh the reference commit to make changed V8 output pass: introduce V9 for changed rendering behaviour, preserve the V8 code path, and add a corresponding lock for V9 after publication. Archived JPEG reproduction remains a separate browser regression check.

The guard freezes the documented V8 baseline as of 12 October 2026; it cannot retroactively restore any V8 links shared between V8's first publication and the interior-root amendment `da79010`.

The supported renderer versions are declared in `js/app.js` and validated when the editor renders. When introducing V9 or later, update this list together with the renderer's version-specific dispatch and archive regression fixtures. Do not silently interpret an unknown `?v=` as a new renderer; legacy URLs and pinned outputs must stay stable.
