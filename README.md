# ALGO/ART
<img src="https://github.com/southernadd-cmyk/algoart/raw/main/social-card.png" alt="Social card" width="377">

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
npm run test:growth-v8
npm run test:renderer-lock
npm run test:plotter
npm run test:tuning-equivalence
```

The tuning-equivalence test compares generated drawings with a pinned historical Git commit; it needs that commit available in the local Git history. Browser-based archive and plotter-fidelity checks run in GitHub Actions across Chromium, Firefox and WebKit (see [the archive workflow](.github/workflows/archive-reproduction.yml)).

**Current renderer: V8.**

| Renderer | Status |
| --- | --- |
| **V8** | Current editor and new artwork generation |
| V1–V7 | Preserved for historical seeded artworks and exact shared links |

V8 expands Growth Systems with seeded golden-angle root directions, entries at the 38.2% and 61.8% stations on all four edges, and interior-root alternatives. Two to four growth forms appear more often, especially in landscape. Branch lengths diminish by φ, with space-aware turns and a shared segment budget. Other engines retain their V7 output. New social batches use V8; existing editions keep their recorded renderer and media.

## Procedural watercolor render

The **Watercolor Render** checkbox in Compose repaints the existing ALGO/ART
composition as layered procedural watercolor. It is a **material option**,
not a ninth composition engine, a new seed, or an image-generation model.
Switching it off restores the original marker drawing with the same
seed, golden-ratio geometry, orientation, controls and hierarchy.

Watercolor v2 uses the same SVG-recorded geometry with ragged, recursively
subdivided wash boundaries, selectively pooled pigment edges, graded translucent
pigment and correlated paper grain. It avoids height-map lighting and soft,
Gaussian-like colored backgrounds. The original v1 pigment and relief buffers
are preserved unchanged for archival reproducibility.
The result is best understood as expressive watercolor / mixed-media washes;
we are **not** claiming a physical watercolor-fluid simulation.
It requires no trained model, network call, third-party image asset or install.

- **Share links:** new checkbox selections use `?watercolor=2`; previous
  `?watercolor=1` and prototype `?oil=1` links continue rendering v1 exactly.
  The material revision never enters V8 composition seed input.
- **Export:** watercolor is available as PNG; SVG and plotter SVG preserve
  the original marker vectors rather than pretending to be vector watercolor.
- **Implementation:** `js/watercolor-v2.js` is a separate watercolour material
  renderer, while `js/oil-render.js`, `js/oil-material.js` and
  `js/oil-surface.js` retain their historical names for compatibility.
  OIL-4 was the technical prototype name; the public style is now **Watercolor**.
  The brushwork separates pigment color from height/lighting, informed by
  published techniques from MIT-licensed
  [PigmentLab](https://github.com/wieslawsoltes/PigmentLab) and
  [Wet Paint Flow](https://github.com/simonxxooxxoo/wet-paint-flow).
  Their code and assets are not bundled.
- **Torn Paper:** the earlier, more collage-like treatment is preserved,
  **not loaded**, in `experiments/torn-paper-v1.js` for a possible future option.
- **Oil Paint:** richer, opaque impasto is a **separate future renderer**.
  This watercolor checkbox must not silently change into an oil effect.
- **Preservation:** published V1–V8 marker renderers, archived artworks and
  existing seeded compositions stay unchanged.
- **Tests:** `npm run test:watercolor-v2` checks v1/v2 determinism and V8
  immutability; the Watercolor v2 preview workflow captures real browser PNG
  comparisons in both orientations. `npm run test:oil-render` still uses its historical internal name
  and checks deterministic materials, reversibility and original geometry.
  Full-resolution export and low-memory mobile performance deserve further
  validation before increasing the material's complexity.

Watercolor v2 is initially an editor-only refinement. Existing daily gallery and
social automation continues publishing the historical v1 material until v2 browser
previews are visually approved. The v2 release must update publishing URLs,
version metadata and archive tests together; never retroactively repaint images.

## Daily watercolor publication

The daily gallery includes **four additional deterministic watercolor studies**:
two portrait and two landscape. The 04:15 UTC gallery build creates all four,
and the existing London social slots publish them to configured platforms:

| London slot | Watercolor additions |
| --- | --- |
| 09:00 | One portrait + one landscape |
| 15:00 | None (existing marker posts only) |
| 20:30 | One portrait + one landscape |

The ordinary five-landscape and five-portrait marker batches and their
publishing times are unchanged, giving **14 total studies** per complete day.
Watercolor batches use separate `AWL`/`AWP` seeds, `WL`/`WP` archive IDs,
`?watercolor=1` editor links, gallery medium labels, and independent media
release manifests / per-platform completion markers. Existing social triggers
are reused; there are **no additional cron jobs**. IG portraits use the same
uncropped 4:5 padded image handling as marker portraits. Failed destinations
are retried without reposting destinations already marked successful.

Run `npm run test:watercolor-publishing` to check slot selection, short links,
duplicate-safe gallery merging and the combined 14-work archive. The separate
browser workflow `watercolor-tests.yml` renders and verifies four real studies.
Historical gallery entries remain byte-for-byte unchanged.

## Plotter compatibility

Plotter SVG supports faithful colour runs and grouping by pen, with light-to-dark pen identities and pen-change pause labels. **Actual Inkscape/AxiDraw behaviour has not been hardware-tested.** See [issue #40](https://github.com/southernadd-cmyk/algoart/issues/40) to help verify pauses, Resume and individually selected numbered layers.

## Further documentation

- **[Development Log](DEVELOPMENT_LOG.md)** — the full original README, preserved verbatim, including design decisions, renderer history, gallery/social workflows and detailed tests.
- **[Calibration Audit](CALIBRATION_AUDIT.md)** — which numbers are genuine φ mathematics, artistic calibration or rendering mechanics.
- **[Tuning History](TUNING.md)** — numerical extraction and exact-output compatibility notes.

**Published renderer versions are immutable.** The V8 output is locked against the permanently pinned source commit `395e473a826d7c481fde2e0198f753467332b04b` by `npm run test:renderer-lock`. The check compares 144 representative renderings in the same runtime, including native canvas operations, Reveal metadata and plotter SVG pen paths. It runs on pull requests through the lightweight control-range regression workflow (not the browser matrix). Never refresh the reference commit to make changed V8 output pass: introduce V9 for changed rendering behaviour, preserve the V8 code path, and add a corresponding lock for V9 after publication. Archived JPEG reproduction remains a separate browser regression check.

The guard freezes the documented V8 baseline as of 12 October 2026; it cannot retroactively restore any V8 links shared between V8's first publication and the interior-root amendment `da79010`.

The supported renderer versions are declared in `js/app.js` and validated when the editor renders. When introducing V9 or later, update this list together with the renderer's version-specific dispatch and archive regression fixtures. Do not silently interpret an unknown `?v=` as a new renderer; legacy URLs and pinned outputs must stay stable.
