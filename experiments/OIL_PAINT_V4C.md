# ALGO/ART Oil Paint V4c — contact footprint experiment

**State: draft, not released.** Branch `experiment/oil-paint-v4c-contact-footprints`.
V4b and earlier material sources remain unchanged; the shared, optional V5
region-planner remains separate.

## Specific falsifiable problem

V4b still creates an almost opaque, fully filled vector silhouette and then clips
decorative bristle tracks inside it. Slightly roughening its edges cannot make
the underlying uniformly coloured ribbon look like oil paint.

## V4c changes

1. Remove the **full-body fill and body clipping** from the brush primitive.
   Instead render independent, overlapping connected **bristle-tuft paint
   footprints** with naturally staggered starts/stops, tapered bodies, smooth
   lateral divergence and rounded/torn tips.
2. Use the **same Bézier tuft outlines** for deposited RGB and the
   independent additive relief mask. Local thick toe/heel paint is also
   deposited, not painted as an unrelated shading effect.
3. Give each tuft a deterministic **depleting pigment reservoir**. Pressure,
   paint mass and coherent dry lift modulate contact/height; decreasing load
   never just darkens the entire image or adds pixel checkerboard noise.
4. Profile-specific brush contacts: filbert rounded dense central tufts,
   flat wider offset tuft families, dry separated splayed hairs,
   palette knife broader loaded patches.
5. Same source seeds, φ geometry and colour hierarchy. This experiment
   changes material geometry only, not the shared V5 interpretation layer.

## Validation

- Strict same-seed pixel reproducibility and old material invariance.
- V4b versus V4c brush laboratory with straight/curved/short/diagonal
  profile contact; enlarged native crop inspections.
- Same 16 original source compositions, 16 V4b reference PNGs and full
  contact sheet; timing, height and source path manifests.
- Assert multiple deposited footprints per source path, pressure continuity,
  average paint-load depletion and colour/height mask alignment.
- **Human visual hold:** examine 100% edges and normal-sized oil impression.
  Passing CI cannot, by itself, approve a production oil material.

## Review questions

Does the brush now appear composed of overlapping, irregular loaded
bristles rather than a decorated ink ribbon? Are broken contacts
coherent? Are exhausted ends credible? Is the colour sufficiently
opaque where paint is loaded, and does the height behave like volume
instead of a relief filter? Does V4c improve normal-sized ALGO/ART
images despite their inherently linear source geometry?

If not, preserve this branch as a comparator and refine the contact
footprint, *not* the V5 shared planner.
