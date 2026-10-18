# ALGO/ART

**Can one number compose a drawing?**

ALGO/ART is a free, browser-based drawing experiment built around the golden ratio (φ ≈ 1.618). Eight composition systems set out the shapes and relationships; five drawing materials give those structures different characters. Change a seed, move a control, and see what changes. Sometimes the result looks measured. Sometimes it doesn't.

The drawings are made with seeded JavaScript, not an AI image generator. You can return to a drawing using its saved settings and renderer version.

**[Try ALGO/ART](https://southernadd-cmyk.github.io/algoart/)** · **[Browse the daily gallery](https://southernadd-cmyk.github.io/algoart/gallery/)** · **[How it works](https://southernadd-cmyk.github.io/algoart/about/)**

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

The welcome screen pairs a short instruction piece with an artwork selected from the gallery. Click the ALGO/ART logo to revisit it. The invitation is to experiment, not to accept the mathematics as a guarantee of a good composition.

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

## A gallery that keeps growing

The [daily gallery](https://southernadd-cmyk.github.io/algoart/gallery/) archives landscape and portrait studies, including their seeds and settings. Open a gallery entry to try its composition yourself. Editions vary in size and material mix; the gallery itself is the record.

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

The [development diary](DEVELOPMENT_LOG.md) records experiments and changes of direction. [Renderer and material history](MATERIAL_HISTORY.md) explains version compatibility (including the current V9 geometry renderer and older saved states). The [calibration audit](CALIBRATION_AUDIT.md) distinguishes the mathematics from artistic decisions; [tuning notes](TUNING.md) document exact-output constraints.

ALGO/ART doesn't set out to prove that φ makes better art. It gives you a way to test what the number contributes — and what you contribute by changing it.
