# Action Painting V6 — V5b paint-conservation experiment

**Stage:** experimental. Keep the production Action renderer, archive and dated gallery unchanged. V4 and V5 source files remain frozen.

## Intention
Evaluate whether richer physical paint behavior can coexist with PROPORTION PIECE's same seed, source geometry, phi-controlled spatial hierarchy and legitimate blank space. The goal is not to select only beautiful outcomes or suppress weak daily works.

## Physical model
The original V4 selected trajectory, anchors, layer ordering, palette and random-draw sequence remain intact. V6 uses the V5 taper profile for the tail, increases material at the beginning, and transfers a per-throw estimate of depleted pigment to an origin contact, a slow curved pool and a stretched droplet along the direction of a fast gesture. Dry endings are more likely to break into larger beads instead of thin continuous lines. All new material placement uses existing trajectory points and a separate seeded material RNG.

**Important:** V5 did not decrease the original global-alpha range. Its reduction in paint presence came primarily from narrowing strokes. V6 preserves the V4 opacity distribution, including existing paint pools and splatter.

## Mass estimation
The V6 renderer returns `throwMass` rows with V4 reference and V6 deposition estimates, ribbon widths × alpha × lengths and approximate pool/droplet areas. Existing V4 deposited effects are counted equally on both sides, so the new droplets, pools and origin deposits are funded from depleted ribbon mass. This is **not measured paint physics**; it is an explicit conservation budget for procedural drawing.

The source paths do not encode brush pressure or actual physical mass. The `paint mass` number is a useful internal approximate ledger, not a statement about millilitres of pigment. Canvas clipping, overlap and opaque compositing can cause visually different coverage even with equal mass.

## Measurements / visual study
Open `test/action-physics-v6/` using a static local web server. It shows V4, V5, and V6, with the same seed, composition, phi pull, orientation and palette.

Measurements under each panel:
- Pixel ink coverage: Euclidean RGB distance from cream ground greater than 22.
- Heavy coverage: RGB distance greater than 85.
- Mean pixel saturation among ink pixels.
- Rendering elapsed time (subject to noise; use repeated measurements for any release decision).
- V6 per-throw reference and deposited mass (saved in downloadable JSON).

The difference toggle marks the changed pixels of V6 versus V4. The 2× loupe follows the same normalised cursor coordinates across all three canvases. Portrait panels use responsive gutters and single-column layout on narrow screens.

## Acceptance targets (do not weaken thresholds to claim success)
- Ink coverage difference versus V4 ≤3% relative, per seed
- Heavy paint coverage difference ≤5% relative
- Mean ink saturation difference ≤2% relative
- Mass-budget deviation per throw ≤3%
- Deposits visibly distinguishable without zoom at 100% render size (manual)
- V6 rendering cost no more than V4 plus 10 ms (measure repeatedly)
- V4 pixels stable, V6 deterministic, same source composition / structural stats

`tests/action-physics-v6-browser.mjs` runs three fixed cases plus an 8-engine × 2-orientation × 3-phi-strength matrix, rotating through eight palettes, and four sparse cases (55 cases total). It stores every case's numeric checks in `action-physics-v6-results/results.json`, and screenshots of important examples. The test differentiates **technical invariance failure** (CI must fail) from **aesthetic acceptance target not met** (record actual failures; do not treat as approved).

## Relationship to Pollock Dreams
Ideas examined in Vitalii Samolovskikh's publicly licensed [Pollock Dreams](https://github.com/kefirfromperm/pollock-dreams) informed the selection of physical effects. This file independently implements these ideas within PROPORTION PIECE's V4 structure; it does not bundle that project's source, colours or assets.

## Approval
No production release, daily archive rewrite, editor default change or PR merge without review of the actual three-panel images and results.