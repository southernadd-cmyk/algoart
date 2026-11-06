# Replacement Oil V8: first physical wet-contact lab

The earlier `experiment/oil-v8-bounded-flow-20261106` (PR #226) is a **rejected, unreleased prototype**. This new experimental Oil V8 is a replacement, not V9.

The first acceptance gate is **five controlled same-brush-image comparisons** at `test/oil-v8-replacement/`:

1. Single loaded stroke / depletion
2. Wet-on-wet crossing
3. Exactly the same crossing on dry underpaint
4. Tight turning stroke and raised pigment contact
5. Stroke stop / restart

Both panels use the project's actual V7 physical brush renderer, matching source points, widths, profiles, colours and seeded V7 bristle randomness. The baseline simply layers V7 footprints. The replacement converts **each individual brush contact** into pigment/height/wetness state, updates the surface immediately, mixes prior wet pigment and displaces existing wet paint sideways into raised lips at the new contact boundary. The interaction occurs between strokes, never as a post-render filter. It does not yet intercept individual sub-stroke hair segments: that is a subsequent integration step.

This is a **controlled brush laboratory, not the complete V8 material renderer**. The scenes are hand-defined technical fixtures rather than φ-composition outputs. They establish whether physical behaviour is visually meaningful before trying the costly full integration. Its canvas is 720 × 460 at actual pixel scale.

## Gate
- V7 and V8 use identical real brush footprints, RNG seeds and source strokes.
- Wet crossing gives genuinely changed pigment at the intersection and locally displaced paint ridges.
- Dry crossing does not mix/displace previous dry colour.
- Rerendering the same seed produces identical PNGs for both.
- Visible changes at normal image display size. Code metrics alone are not grounds for merging.
- The experiment must not change existing Oil V7 source, the live Oil V5, the daily gallery, published archives or protected φ composition.

This lab does not yet have the full composition planner or protected-void enforcement. **Do not use it to render production artwork or claim a finished Oil V8.** A later stage must wire the wet surface into the full Oil V7 planner, preserve protected voids and benchmark actual resolution.

## Provenance
The material concept was informed by [Pour Dreams](https://github.com/kefirfromperm/pollock-dreams), by Vitalii Samolovskikh (Apache 2.0). The wet-contact code is independently written; none of its shaders or assets are included.

## Review
The CI artifact contains five native PNG pairs, a full overview and `results.json`. Compare actual pictures before accepting a direction.
