# Oil pigment study

Open `test/oil-pigment/index.html` through an HTTP server. It loads the real
production Oil V4 engine directly, without an iframe or the editor app.
Compare previous oil, Claude's original pigment mapping, and the developed
Oil V5 treatment using identical settings.

The original upload supplies the starting idea and reference mapping in
`oilPigment.claudeRGB`. The developed treatment adds:

- Smooth hue-dependent lightness/chroma cusps and a soft chroma shoulder.
- Fixed-hue/lightness sRGB gamut mapping rather than RGB channel clipping.
- No universal warmth or darkening; neutral source colours retain identity.
- Perceptual tints for small bristle variations and white mixtures.
- Three-channel K/S-inspired wet mixing with approximate tint strength.
- A bounded per-render colour cache with copied results.

These are artistic approximations. They do not use measured pigment spectra,
simulate wavelength-dependent scattering, or change paint opacity by pigment.
Canvas source-over compositing remains unchanged. Wet mixing acts at the
existing sampled crossing/pickup sites, not at every overlapping pixel.

The complete source composition is captured and planned with its original
colours. Only then does V5 map separate material colours. Source path
eligibility, colour-based clustering, connections, brush geometry, random
sequences, paint height, ground and protected voids keep their existing logic.

`renderOilPaintV5` scopes the pigment model and planner wrapper in `try/finally`.
The studio now selects V5 for new oil work and writes `material=oil-v5`
into its exact links. Daily/social editions switch on 26 October 2026; older
dates and explicit V1–V4 links retain their recorded renderer.
Small dormant hooks in the active oil painter/brush allow the versioned
wrapper to act on paint colours without copying or editing historical
planner variants. V4's fallback expressions retain their original math.

Validation:

```sh
node tests/oil-pigment.test.mjs
python3 -m http.server 4173 --bind 127.0.0.1
OIL_BASE_REF=92e4d25cc492e7d692295ce0574a226fa954e608 node tests/oil-pigment-browser.mjs
```

The browser test renders all eight compositions in both orientations,
compares unchanged V4 output against the base commit, checks V5 repeats,
source geometry, work counts, opacity and restored state, and captures four
three-way palette comparisons plus the mobile layout. The separate GitHub
workflow runs this test and retains its screenshots and timing results.

Further work can investigate measured pigment mixing and pigment-specific
opacity/glazing after visual review of this colour-only experiment.
