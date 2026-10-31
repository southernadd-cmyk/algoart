# Translation Study II — second monitor bank

This bank follows the same 3 × 3 arrangement as the first installation.
Its upper six panels use one 1152 × 480, 24 fps, 20-second VP9 WebM
(`six-screen-installation.webm`), with the uploaded organic oil triptych
in the top 240 pixels and scribble/action triptych underneath. Each of the
six monitors UV-crops one 384 × 240 cell from that one playing texture.

GitHub Actions builds the film from the actual source WebMs in the parent
directory, validates the frame count, dimensions, all six crops and SHA-256,
and publishes this bank's independent manifest. The first bank is unchanged.
Until verification succeeds, the second bank keeps its WebP fallback.

The third information row uses the uploaded `../phi-net-model.webm` as its
lazily loaded looping model/network video, the curatorial study description,
and `../phi_net.toe` for the independent downloadable TouchDesigner project.
The project download is shown only after its URL responds successfully.
Media remain lazy and pause outside the visitor proximity threshold.

Build: `.github/workflows/build-touchdesigner-bank-two.yml`.
Completion triggers a Pages deployment so token-authored media commits are
published as well as source changes.
