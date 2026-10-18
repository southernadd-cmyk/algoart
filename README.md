# ALGO/ART

**Can one number compose a drawing?**

ALGO/ART is an experimental drawing machine built around the golden ratio. It uses eight composition systems, repeatable seeds and five ways of making marks. Change the controls, compare the results and decide whether the mathematics helped.

There is no image-generation model behind the drawings. The compositions and marks are produced in JavaScript.

**[Open ALGO/ART](https://southernadd-cmyk.github.io/algoart/)** · **[Daily gallery](https://southernadd-cmyk.github.io/algoart/gallery/)**

## Examples from the daily gallery

These are real archived ALGO/ART outputs, not mockups. Click an image to see its original gallery entry and the link to reproduce it.

| Marker — Recursive Divisions | Tissue & Graphite — Golden Trajectories |
| --- | --- |
| [![A landscape marker composition of nested rectangular territories](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-17/2026-10-17-01-rects-AA-20261017-01-84718.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-17/) | [![A landscape Golden Trajectories drawing in translucent tissue and graphite](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-17/2026-10-17-watercolor-landscape-01-spiral-AWL-20261017-01-02707.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-17/) |
| **Watercolour — Growth Systems** | **Oil Paint — Constructed Forms** |
| [![A watercolour study based on branching Growth Systems geometry](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-17/2026-10-17-watercolour-landscape-01-organic-CWL-20261017-01-67512.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-17/) | [![A portrait oil paint study using Constructed Forms geometry](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-17/2026-10-17-oil-portrait-01-geometric-OP-20261017-01-14273.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-17/) |

These examples cover four of the five materials. Action Painting was added subsequently; the [live gallery](/algoart/gallery/) is the place to browse newly archived work.

## Make a drawing

1. Choose a composition system and a drawing material in **Compose**.
2. Change the parameters or seed. **Randomise** explores new settings; **Mutate** changes the current system; **4-Up** compares variations.
3. Work in landscape (1400 × 1000) or portrait (1000 × 1400).
4. Use **Reveal** to inspect the underlying proportion, **Describe** for the drawing's details, or **Export** to save and share it.

The first-visit welcome page shows an artwork selected from the newest daily gallery. You can open it again by clicking the ALGO/ART logo.

A full-state link stores the renderer version, seed and settings. Old artworks are deliberately kept on their original renderers rather than silently updated.

## Eight composition systems

| System | What it does |
| --- | --- |
| Orbital Studies | Scores possible arrangements for balance, hierarchy and focal relationships. |
| Golden Trajectories | Carries marks along curved paths informed by the golden angle. |
| Recursive Divisions | Breaks the drawing surface into unequal rectangular territories. |
| Radiant Systems | Sends forms and strokes outward from focal points. |
| Connected Fields | Builds networks of marks and connections. |
| Growth Systems | Branches outwards, changing direction and scale as it grows. |
| Constructed Forms | Arranges geometric forms at different sizes and positions. |
| Automatic Marks | Makes looser, gestural groups of strokes with controlled space between them. |

φ informs proportion, placement and relationships; it is not a claim that every visual decision follows an inevitable mathematical rule. Some numbers are artistic calibration. [The calibration audit](CALIBRATION_AUDIT.md) distinguishes these.

## Five drawing materials

| Material | Character |
| --- | --- |
| Marker | Wobbly ink, pressure changes and dry strokes. |
| Tissue & Graphite | Transparent colour, paper-like layers and fine pencil marks. |
| Watercolour | Pigment flow, drying edges and paper texture. |
| Oil Paint | Connected painted forms and loaded-bristle marks. |
| Action Painting | Poured gestures, pools and scattered splashes. |

Materials interpret the same underlying composition differently, so the resulting image may change considerably. PNG captures the chosen material; ordinary SVG and plotter SVG preserve source marker geometry rather than imitating the material's raster texture.

Current editor geometry is **renderer V9**. Watercolour **V2S** and Tissue & Graphite **V7** have version-preserving historical variants; the repository also retains earlier Oil revisions. Consult [Renderer and Material History](MATERIAL_HISTORY.md) for exact URL identifiers and cutover behaviour. Do not assume that an experimental brush version is the same thing as a published material version.

Optional φ sheet framing adjusts the scale and placement of the source composition without stretching individual forms. It is opt-in in the editor and recorded in links as `sheet=phi`. Historical links keep their earlier behaviour.

## The daily gallery

The [gallery](https://southernadd-cmyk.github.io/algoart/gallery/) is a dated archive, not a selection of AI-generated example pictures. Entries retain their seed and settings so they can be opened in the editor.

The publishing process creates landscape and portrait studies in separate material batches. Social publishing uses the existing **09:00, 15:00 and 20:30 UK** slots with independent records for each platform. Counts and material mixes have changed during development; use the actual gallery edition rather than a hard-coded claim about the number of pieces made each day. Older files and shared links must remain usable.

## Save, share and plot

- **PNG:** exports the visible drawing material. On phones, use the prepared download if the browser needs a separate save tap.
- **SVG:** keeps the vector source strokes.
- **Plotter SVG:** provides faithful colour runs or pen-grouped layers and optional travel reduction. Digital previews are tested, but physical AxiDraw/Inkscape pen-change behaviour **has not been verified on hardware**.
- **Share link:** reopens the same seeded artwork. Threads and Bluesky sharing are available from the editor; publication to social accounts is a separate automated process.

## Run it locally

The editor is static HTML, CSS and JavaScript. It does not need a backend or a frontend build process.

```bash
git clone https://github.com/southernadd-cmyk/algoart.git
cd algoart
python3 -m http.server 8000
```

Open `http://localhost:8000/`. On Windows with Python installed, `py -m http.server 8000` is an alternative.

Node.js 22 and npm are used for development checks and the gallery/publishing scripts:

```bash
npm ci
npm run test:control-ranges
npm run test:renderer-lock
npm run test:plotter
npm run test:orientation
```

Browser regression workflows also exercise Chromium, Firefox and WebKit. Some tests require pinned Git history or Playwright's browser installations. Do not regenerate an old baseline to make a breaking renderer change pass; publish a new renderer version instead.

## Where to look

| Location | Purpose |
| --- | --- |
| `index.html`, `css/` | Welcome page, editor and visual styling |
| `js/generator.js`, `js/phi.js`, `js/random.js` | Composition, proportions and determinism |
| `js/marker.js`, `js/*paint*.js`, `js/*watercolour*.js` | Mark-making and material rendering |
| `js/app.js`, `js/describe.js` | Editor state, saved links and descriptions |
| `js/export.js`, `js/plotter.js` | Exports and pen paths |
| `gallery/`, `automation/` | Archived studies and scheduled publishing |
| `tests/`, `.github/workflows/` | Automated verification |

## Notes from development

**[Development diary](DEVELOPMENT_LOG.md)** records the experiments, failed approaches, technical decisions and releases. **[Material history](MATERIAL_HISTORY.md)** covers version compatibility in more detail. **[Calibration audit](CALIBRATION_AUDIT.md)** separates golden-ratio mathematics from artistic tuning; **[Tuning notes](TUNING.md)** document the exact-output constraints.

### Work still worth doing

- Consolidate accumulated CSS overrides without disturbing the mobile controls or drawing overlay.
- Continue improving the physical character and performance of the material renderers.
- Verify plotter pauses and pen handling on real hardware.
- Keep gallery images, share metadata and social previews aligned with the version that actually produced each picture.

ALGO/ART is an ongoing experiment. The intention is not to prove that φ makes better art, but to make that claim something you can test by looking and drawing.
