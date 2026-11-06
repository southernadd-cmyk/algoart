# Oil V8 — bounded wet-paint flow experiment

**State:** study only; do not merge or alter the production Oil V5 or the ongoing archive. Based on the existing standalone Oil V7 prototype, which remains completely unchanged.

## Artistic requirement

The same input seed, source marks, golden-ratio pull, field boundaries, gesture order and protected voids produce a source plan identical to V7. The change is **what happens after brushes have deposited the pigment**, not which drawings are selected or published. Unsuccessful and unresolved results belong in the daily archive and must not be curated away.

## Implementation

- `js/oil-paint-v8.js` duplicates the isolated V7 renderer as a fixed historical reference and inserts **one** new material pass between painting and the existing optical relief computation. It only records actual brush contacts; it does not consume composition random numbers.
- `js/oil-flow-v8.js` estimates a local height field from the existing relief mask and applies two stable, pairwise conservative transfers proportional to the local height gradient and cubic height mobility (thin-film-inspired). It does **not** implement the full implicit solver from Pour Dreams.
- Flow is permitted only between cells already occupied by painted V7 material, never across edges into blank paper or protected plan voids. The canvas has ordinary hard edges, not toroidal/wrapping boundaries.
- **Settling** modifies height alone. **Displacement** adds short, deterministic, contact-guided pigment advection restricted to the V7 footprint. **Boundary** adds very small ridge transfers between existing pigmented cells at adjacent colour interfaces; every ridge is funded by pigment height withdrawn from the same side.
- This is a local *stylised simulation*, not a physically validated oil/viscosity model. No spectral colour model or independent new spatial composition is introduced.

## Review and measurements

The review page `test/oil-v8/` renders V7 and the three V8 stages from identical settings. It reports brush/flow times, ink coverage, heavy-paint coverage, mean saturation, changed relief pixels, moved pigment pixels, mass conservation and protected pixels. The self-check re-renders V7 at the end and compares the original pixels.

The CI tests check: deterministic pixels, mass conservation, fixed painted boundary, protected void parity, original V7 replay and source plan consistency; also all eight engines in both orientations at low/mid/high `phiStrength` (spread across cases), two deliberately sparse scenes and one full-size study. Actual comparison screenshots, four native-resolution paintings and numeric JSON are attached to the GitHub Actions workflow.

## Performance

Oil V7's final relief pass already reads the pigment and height textures. V8 adds one height read/write and, for displacement, a pigment read/write. It performs two stencil sweeps plus bounded recent-contact stamps. Benchmark actual full-resolution overhead and visually inspect the results before proceeding. An isolated prototype that passes technical checks **is not evidence** of materially better-looking paintings.

## Source and licence

Conceptual reference: Vitalii Samolovskikh's [Pour Dreams](https://github.com/kefirfromperm/pollock-dreams) (Apache-2.0). That project solves a more ambitious implicit thin-film equation and stores moving pigment boundaries on a GPU. This experiment independently implements a bounded approximation from first principles; it does not copy code, shader assets, or palettes. Preserve acknowledgement and check licence obligations if any actual code is later incorporated.

## Release boundary

Do not edit the production material selector, Gallery, daily-publishing job, previous Oil V7 module, or any historical images. Do not merge the draft PR until the visual comparisons and representative performance/negative-space metrics are reviewed.
