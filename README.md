# PROPORTION PIECE

**How far can the golden ratio govern a composition while its marks remain visibly human?**

*Previously presented as ALGO/ART. Existing repository, artwork links and archived seeds are unchanged.*

PROPORTION PIECE is an ongoing generative artwork asking how far a single mathematical proportion can shape an artistic world. The golden ratio (φ ≈ 1.618) influences the drawings, selected sculptural interpretations, exhibition layouts and the architecture of a virtual gallery that grows with the daily archive. The building is not simply a container for the artworks: it extends the same experiment from the page into space and time.

This is not an attempt to prove that φ makes things beautiful. Eight composition systems organise shapes and relationships, while five drawing materials introduce texture and irregularity. Some decisions follow proportion closely; others involve chance or judgement. The free browser-based editor lets you change a seed or move a control and see where mathematical structure holds — and where it doesn't.

The drawings are made with seeded JavaScript, not an AI image generator. You can return to a drawing using its saved settings and renderer version.

**Current renderer: V9.** It retains the earlier seeded composition geometry while allowing the paper colour to be chosen independently of the marks. Earlier renderer versions remain available for saved artwork links.

| Renderer | Main change |
| --- | --- |
| **V9** | Selectable paper colour without changing composition geometry or the drawing’s seeded pigment palette. |

The page uses a practical 7:5 landscape format (1400 × 1000, reversed for portrait). The golden ratio shapes relationships within the drawing; the outer canvas is not itself a golden rectangle.

**[Walk the 3D gallery](https://southernadd-cmyk.github.io/algoart/gallery/visit/)** · **[Try PROPORTION PIECE](https://southernadd-cmyk.github.io/algoart/)** · **[Browse the daily gallery](https://southernadd-cmyk.github.io/algoart/gallery/)** · **[How it works](https://southernadd-cmyk.github.io/algoart/about/)**

## Five materials, five drawings

These are actual archived outputs from 18 October 2026, with material and composition labels checked against that day's gallery metadata. Select a picture to explore its gallery edition and open the original in the editor.

| Marker — Recursive Divisions | Tissue & Graphite — Connected Fields |
| --- | --- |
| [![A portrait marker composition of divided geometric territories](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/2026-10-18-portrait-01-rects-AP-20261018-01-09334.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/) | [![Connected Fields with translucent tissue layers and graphite marks](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/2026-10-18-watercolor-landscape-01-network-AWL-20261018-01-40738.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/) |
| **Watercolour — Golden Trajectories** | **Oil Paint — Constructed Forms** |
| [![A portrait Golden Trajectories watercolour study](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/2026-10-18-watercolour-portrait-01-spiral-CWP-20261018-01-38773.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/) | [![Constructed Forms in simulated oil paint](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/2026-10-18-oil-portrait-01-geometric-OP-20261018-01-11851.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/) |
| **Action Painting — Growth Systems** | |
| [![Growth Systems rendered as a gestural action painting](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/2026-10-18-action-landscape-01-organic-ACL-20261018-01-67793.jpg)](https://southernadd-cmyk.github.io/algoart/gallery/2026-10-18/) | |

## Try a drawing

1. Open the editor and choose a composition system and material.
2. Change the **seed** or **parameters**, use **Randomise** to explore, or **Mutate** to alter the current drawing. **4-Up** lets you compare variations.
3. Switch between landscape (1400 × 1000) and portrait (1000 × 1400).
4. Use **Reveal / Show the φ** to examine the structure, **Describe** to read the drawing's settings, and **Export** to save it.

The welcome screen pairs a short instruction piece with an artwork selected from the gallery. Click the PROPORTION PIECE title to revisit it. The invitation is to experiment, not to accept the mathematics as a guarantee of a good composition.

## Eight ways to compose

| System | Approach |
| --- | --- |
| Orbital Studies | Searches for arrangements with balance and a focal hierarchy. |
| Golden Trajectories | Follows curved paths influenced by the golden angle. |
| Recursive Divisions | Splits the page into unequal rectangular territories. |
| Radiant Systems | Sends marks outwards from focal points. |
| Connected Fields | Connects marks into networks. |
| Growth Systems | Branches, changes direction and grows in scale. |
| Constructed Forms | Places geometric shapes in varied sizes and positions. |
| Automatic Marks | Makes loose, gestural groups of strokes. |

The golden ratio influences divisions, scale, spacing and relationships, but not every decision is mathematically prescribed. Some settings were tuned by eye. The [calibration audit](CALIBRATION_AUDIT.md) records that distinction.

## Five ways to make marks

| Material | What changes |
| --- | --- |
| Marker | Uneven ink, pressure, wobble and dry strokes. |
| Tissue & Graphite | Translucent layers and fine graphite-like marks. |
| Watercolour | Pigment movement, drying edges and paper grain. |
| Oil Paint | Heavier painted forms and bristle texture. |
| Action Painting | Poured gestures, pools and scattered splashes. |

The same underlying composition can look very different when its material changes.

## Walk the growing virtual gallery

**[Enter the 3D tower](https://southernadd-cmyk.github.io/algoart/gallery/visit/)** · **[Daily archive](https://southernadd-cmyk.github.io/algoart/gallery/)**

The navigable Three.js tower carries the experiment beyond individual compositions. Each dated floor adds another layer to the building, making the passage of time visible as architecture. Visitors enter through reception, take a lift to the exhibition floors, encounter paintings and selected portrait studies interpreted as sculptures, and explore the exterior square.

The floor plans use φ-informed divisions, with a merge pass that keeps rooms navigable. Curation also works with proportion: a configurable φ-adherence setting allows the placement system to be tested with weaker or stronger geometric preferences, while preserving clearance and sightlines. This is a curatorial parameter, not currently presented here as a visitor-facing control. It makes the tension between a rule and a workable exhibition measurable rather than merely decorative.

The tower's furnishings, visitors, glass walkways, lighting, textures and reflecting pool give that structure a human-scale setting; they are not all claimed to be generated by φ. Exterior graffiti is procedurally generated, using multiple handstyles and surface-aware treatment. The distinction matters: the proportional system shapes the experiment, while other design choices help people inhabit and judge it.

A **Translation Area** in reception explores how the artworks move into other media. Its TouchDesigner installation includes a model and downloadable project file, with video distributed across six screens from a combined source. This is an experiment, not a claim that the gallery itself is rendered in TouchDesigner.

The tower uses prebuilt geometry and layout data, deferred loading and bundled assets to reduce startup work. Performance and first-movement stutter remain areas of active testing; richer lighting and shadows are evaluated against their cost on desktop and mobile. The [development diary](DEVELOPMENT_LOG.md) records the design decisions and the distinction between implemented changes and remaining work.

## A gallery that keeps growing

The [daily gallery](https://southernadd-cmyk.github.io/algoart/gallery/) archives landscape and portrait studies, including their seeds and settings. Open a gallery entry to try its composition yourself. Editions vary in size and material mix. The accumulating floors make that archive visible as a growing record of the experiment.

Saved links preserve the state needed to reproduce historical drawings. Earlier renderer and material versions remain part of the project rather than being silently replaced.

## Save, share and plot

- **PNG** saves the rendered material as an image. Some mobile browsers use a separate prepared-download step.
- **SVG** preserves the underlying vector marker paths; it does not attempt to reproduce the raster texture of watercolour, oil or other materials.
- **Plotter SVG** offers faithful colour runs or layers grouped by pen, with optional path-travel optimisation. These exports have digital tests, but physical pen-change behaviour has **not yet been verified on a plotter**.
- **Share links** reopen a seeded composition with its recorded settings and version.

## Run it locally

The editor is static HTML, CSS and JavaScript; it needs no backend or frontend build step.

```bash
git clone https://github.com/southernadd-cmyk/algoart.git
cd algoart
python3 -m http.server 8000
```

Open `http://localhost:8000/`. On Windows with Python installed, `py -m http.server 8000` also works.

Node.js 22 and npm are used for development checks and gallery automation:

```bash
npm ci
npm run test:control-ranges
npm run test:renderer-lock
npm run test:plotter
npm run test:orientation
```

Browser regression workflows also cover Chromium, Firefox and WebKit. Some checks need Playwright browser installations or pinned Git history.

## Code and development notes

| Location | Purpose |
| --- | --- |
| `index.html`, `css/` | Welcome screen, editor and styling |
| `js/generator.js`, `js/phi.js`, `js/random.js` | Composition, proportion and seeds |
| `js/marker.js`, `js/*paint*.js`, `js/*watercolour*.js` | Drawing materials |
| `js/app.js`, `js/describe.js` | Editor state, links and descriptions |
| `js/export.js`, `js/plotter.js` | Image, SVG and pen-path exports |
| `gallery/`, `automation/` | Archived artwork and publishing |
| `tests/`, `.github/workflows/` | Regression checks |

The [development diary](DEVELOPMENT_LOG.md) records experiments and changes of direction, retaining the original ALGO/ART name in historical entries. The [publishing documentation](automation/README.md) explains the existing social automation and account identifiers. [Renderer and material history](MATERIAL_HISTORY.md) explains version compatibility (including the current V9 geometry renderer and older saved states). The [calibration audit](CALIBRATION_AUDIT.md) distinguishes the mathematics from artistic decisions; [tuning notes](TUNING.md) document exact-output constraints.

PROPORTION PIECE leaves the question open: how much can a rule contribute to an artwork, and what happens when it meets material, chance and human decisions?
