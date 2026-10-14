# Watercolour V2R — dry brush and shard material polish

**Status:** isolated DRAFT experiment forked from V2P at `0b16e1732347e7ea5817dc757af56d4f49e5cf9f`.
Production `main`, V2P PR #68, V2Q PR #71, gallery and social workflows
must not change.

## Rationale

Review of the V2P/V2Q studies found that large wet washes are convincing but
some **small dry strokes** look like overlapping square stamps and some
**small dry polygon fills** look like flat digital shards. Inspection shows:
- `paintThinWatercolourStroke` previously used short `lineCap='butt'`
  segments. This branch changes that only for final, deferred dry accents.
- Dry ribbons `paintRibbon(...,'dry')` are deferred until after paper flow.
  Their edges already use V2P's paper-fibre field, but the interiors lack
  the wet wash's pigment granulation.
- The `paintPlanes` helper is **not called** by current wet-edge rendering.
  Modifying it would not affect the artwork.

## Changes

- **Continuous dry brush.** A brush trace is filled as one continuous
  variable-width polygon following the original point chain. The same
  seeded, non-tiling paper-tooth field provides pressure variations and
  *transparent grain apertures*. These are not short square brush dabs.
  The original final paths, rotations and hierarchy are unchanged.
- **Crisp dry filled ribbons.** Selected microscopic paper-tooth holes
  appear inside a dry ribbon without covering pre-existing glazes or
  touching the original wet-only edge and pigment transport. Existing
  boundary irregularity stays capped at V2P's 1.25 logical pixels.
  This targets *actual active* deferred dry polygon-like marks.
- **No wet wash changes.** Broad, damp, wet and soft wet-in-wet deposits
  all take the *same* V2P rendering code. Water transport still uses
  exactly one post-pass, unlike the archived V2Q layering experiment.
- **Reversible baseline.** Set
  `window.AlgoArt.watercolourV2rOptions.dryMedia=false` to restore
  the original V2P pixels with identical RNG sequence.

## Validation

CI runs `tests/watercolour-v2r-paired.mjs`: eight archived fixed-seed
scenarios plus exact review seeds `WC-V2Q-SPIRAL-445F23F366` and
`WC-V2Q-NETWORK-3BF8679A17`, each rendered in both V2P and V2R modes.
Tests require identical source geometry presentation, wash states, paper
transport statistics, soft/regular wash distributions, colour and
settings; deterministic V2P and V2R replay; a visible difference in
late marks; and a nonzero count of continuous dry-brush paths.
Manifest includes each full set of settings, image sizes, dry-media
metrics, PNG byte counts and render timings.

Acceptance: no digital segment joints in close-up; dry shards acquire
fine paper granulation without looking fuzzy; wet interiors, wash
overlaps, composition and dry edges remain clearly readable. Reject if
marks become hair-like or fading, visible grain appears as evenly
repeated holes, or render cost grows materially. **No production
release without inspecting the paired PNGs.**
