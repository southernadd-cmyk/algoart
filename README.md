# ALGO/ART
<img width="52vw" alt="image" src="https://github.com/user-attachments/assets/70f42727-c269-4fc5-b5c4-6202990000b0" />

**Mathematics sets the rules. The marker breaks them.**

ALGO/ART is a browser-based generative art project built around the **golden ratio (φ ≈ 1.618)**. Eight composition systems use mathematical rules, seeded randomness and deliberate visual calibration; a separate marker renderer adds wobble, layering and imperfect ink.

**Guiding question:** *How far can the golden ratio govern a composition while its marks remain visibly human?*

[Open the editor](https://southernadd-cmyk.github.io/algoart/) · [Browse the Daily Gallery](https://southernadd-cmyk.github.io/algoart/gallery/)


## Using ALGO/ART

1. Open the [editor](https://southernadd-cmyk.github.io/algoart/) and choose one of the eight composition systems.
2. Adjust the composition, **Additional φ pull**, colour, paper and marker controls, or use **Randomise**, **Mutate** or **4-Up Variations** to explore.
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
npm run test:plotter
npm run test:tuning-equivalence
```

The tuning-equivalence test compares generated drawings with a pinned historical Git commit; it needs that commit available in the local Git history. Browser-based archive and plotter-fidelity checks run in GitHub Actions across Chromium, Firefox and WebKit (see [the archive workflow](.github/workflows/archive-reproduction.yml)).

**Current renderer: V7.**

| Renderer | Status |
| --- | --- |
| **V7** | Current editor and new artwork generation |
| V1–V6 | Preserved for historical seeded artworks and exact shared links |

## Plotter compatibility

Plotter SVG supports faithful colour runs and grouping by pen, with light-to-dark pen identities and pen-change pause labels. **Actual Inkscape/AxiDraw behaviour has not been hardware-tested.** See [issue #40](https://github.com/southernadd-cmyk/algoart/issues/40) to help verify pauses, Resume and individually selected numbered layers.

## Further documentation

- **[Development Log](DEVELOPMENT_LOG.md)** — the full original README, preserved verbatim, including design decisions, renderer history, gallery/social workflows and detailed tests.
- **[Calibration Audit](CALIBRATION_AUDIT.md)** — which numbers are genuine φ mathematics, artistic calibration or rendering mechanics.
- **[Tuning History](TUNING.md)** — numerical extraction and exact-output compatibility notes.

New visual behaviour should use explicit renderer versioning so previously shared and archived artworks remain reproducible.
