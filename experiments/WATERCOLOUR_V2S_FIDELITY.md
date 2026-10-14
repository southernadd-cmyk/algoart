# V2S — source fidelity experiment (not a release)

**Fork:** `experiment/watercolour-v2s-fidelity` from production main on 14 October 2026. **Status: hold for review.** The currently live `js/watercolour-v2r.js`, gallery jobs, `material=watercolour-v2r` URLs and materials menu must not change.

## Question

Can we keep the V2R pigment/wet edge behaviour while restoring visible original Marker strokes and retaining their source hue, especially in Field, without spoiling Spiral or Recursive Divisions?

## What changes

- **Source lineage:** guarded provenance in `js/oil-render.js` attaches original ink and original SVG path index to sampled chains **only** while `A.watercolourV2sActive` is set; grabs up to 700 source chains. For any existing renderer the guarded code does not execute. No change to original geometry, palette generator or SVG export.
- **Matching source hue:** the opt-in V2S renderer prefers its own source chain's recorded ink for broad/hero/detail colours. Existing wetness/random layout choices are unchanged. Near-pigment source colours may still be gently desaturated through the existing V2R `pigmentInk` gamut filter. This is *not* a guarantee of identical marker colour values, which would be physically implausible.
- **Original missing gestures:** a limited, deterministic choice of existing supporting paths renders in thin translucent dry brush after the original V2R transport. Every path is derived from the SVG recorder; no fabricated positions. The same V2R presentation transform is used, so paths do not shift relative to the layout.
- **No wash physics changes:** V2R V2P-derived paper-fibre transport, soft/hard boundaries, granulation and density cap are copied byte-equivalently. No V2Q three-stage drying.

The experimental renderer is `experiments/watercolour-v2s-fidelity.js` and only tests load it. It is **not** exposed in the production editor.

Set `AlgoArt.watercolourV2sOptions.fidelity=false` for byte-identical V2R output; both routes run the isolated copy and should reproduce the released V2R reference when disabled. Its wrapper cleans up global source/path capture state even on exceptions.

## Acceptance

CI renders **three matched pairs** using seeds `BDS8W-3918` (Spiral), `LEH92-6799` (Recursive Divisions) and `3XHXQ-4616` (Field).

**Limitation:** the supplied screenshot PNG files did not contain complete slider settings or a share URL. The test pairs share seed, mode, current editor defaults and render version, but are *not* represented as exact pixel reproductions of the screenshots.

Verify no disappearance of strokes at 100%, especially Field, and that the palette corresponds to source hues. Reject if saturation becomes artificial, visual clutter displaces the φ hierarchy, or the transparency of broad wet areas is compromised. Check rendering times and small-screen quality. Changes must stay experimental until user approves results.
