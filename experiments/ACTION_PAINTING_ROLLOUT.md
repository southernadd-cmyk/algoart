# Action Painting — V4 review and production rollout plan

Status: experimental only. **Do not merge until samples are reviewed and release tests pass.**

## V4 experiment
- Compare the four fixed V3 seed references with the V4 renderer under identical mode, density, palette and layering.
- Inspect pools at 100% for smooth, irregular contours; inspect black and coloured skeletal gestures for absence of ruler-straight sticks.
- Confirm quiet seed 02 remains quiet, dense seed 03 stays legible, and compositions remain varied.
- Verify portrait and landscape, zero/one/many source paths, reproducibility and runtime on desktop/mobile.
- Keep user colour controls authoritative. The experimental hard-coded KITS palette must be replaced with palettes derived from current settings before release.

## Editor integration
1. Add `Action Painting` as a fifth option in `#materialStyle`, keeping all four current values unchanged.
2. Load the reviewed versioned material module and route `renderArtwork()` to `A.renderActionPainting` only when Action Painting is selected.
3. Add `material=action-v1` to artwork URLs and the matching URL parser. Existing URL/material defaults and legacy links remain unchanged. Distinguish **material release v1** from experimental prototype v4.
4. Reuse palette, colour count, saturation, brightness, paper, seed, mode and orientation; map mark-making controls to meaningful paint properties without silently altering controls for other materials.
5. Check 4-up preview, Randomise/Mutate, exact recreation, saving PNG and the Creating overlay. Keep SVG/plotter exports tied to original geometry as for other materials; clearly label that difference.
6. Update Describe, help text, material descriptions, source/version history and README.

## Gallery and social
1. Extend `SOCIAL_MATERIAL` and `GALLERY_QUEUE_MATERIAL` routing with a distinct `action` value; never overload `oil` or `watercolor`.
2. Allocate a unique, stable seed namespace, output folder, archive ID prefix and `material=action-v1` share URL; include explicit material version in queue and metadata.
3. Generate **four distinct artworks per orientation per day** if retaining the current four-per-material policy; confirm schedule and cadence before enabling publication.
4. Add gallery labels, thumbnails, alt text, material counts and archive composition checks. Use actual renderer-generated imagery, never substitute raster mockups.
5. Add Instagram/Threads/Bluesky publisher routing, caption metadata, image existence checks, retries and deduplication. Preserve independent per-destination publication states and avoid sharing output directories with other materials.
6. Verify landscape and portrait JPEG/Instagram derivatives; social preview URL opens exact artwork, with correct Open Graph image and colour/seed.
7. Add end-to-end Playwright and fixture tests for exact seed/version recreation, gallery queue rendering and social destination handling. Run dry-run publishing before scheduling.
8. **No live gallery or posting changes** until the sample review, performance checks and all release tests are green.

## Rollout sequence
V4 review → palette/controls integration → editor-only branch preview → gallery/social dry run → release tests → draft PR review → deliberate merge → one monitored live publishing batch → regular schedule.
