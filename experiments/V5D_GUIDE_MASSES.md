# ALGO/ART V5d — guide-derived semantic masses
**Draft experiment only. No merge, release, daily gallery, or materials-picker integration.**

V5c proved φ rectangular subdivisions can yield painted and deliberately unfilled territories. V5d generalises semantics to actual **source guide metadata** rather than inferring convex hulls or colouring every enclosed/nearby line.

## Planning contracts
- Growth Systems `guide.roots` and `guide.segments`: depth- and branch-aware corridors along documented growth branches; short/deep foliage remains faithful drawn marks.
- Golden Trajectories `guide.points` and point `arm`/`local` metadata: consecutive small trajectory ribbons per genuine arm; **never** fill the space enclosed by a full spiral.
- Constructed Forms `guide.items`: focal oriented paintable forms centred on actual placed objects, larger hero masses prioritised, some supporting objects unfilled.
- Recursive Divisions: preserve existing V5c semantic φ cells untouched.
- Source provenance: every new mass requires nearby actual source SVG marks, and its pigment colour comes from the local dominant coherent pigment family, not a random palette or global average.
- Negative space: preserve generator-declared voids, reject cross-void candidate contours, clip all adapter raster deposits to the protected voids.
- Same deterministic plan for any material; plan contains only geometry, hierarchy, source references and colour. No paper fibres, bristle counts, paint reservoirs or material choices.

## Material expression
**Oil**: guide-derived bounded masses get translucent body colour and loaded V4e bristle streaks following the real recorded guide; pigment footprint and deposited relief use the same contact shapes. 
**Tissue & Graphite**: the identical guide masses become independently torn, semitranslucent multiple pieces with graphite along the original branch or trajectory axis. Reduce dark flat-panel risk with restrained per-layer alpha, lighter fibrous fringes, and source colours.
Faithful stays completely unchanged and is the exact default.

## Acceptance and tests
One same-seed four-engine lab, both materials, each Faithful / frozen V5c / V5d = **24 original procedural PNGs** + common six-column contact sheet + JSON provenance. Include source-guide kind, painted/framed counts, source IDs and protected voids in the manifest. Enforce deterministic byte equality, original faithful exact pixels and shared plan independent of material, no ungrounded or cross-void regions. Preserve V5c subdivision results. Treat any failures as defects to fix; passing CI is necessary but not proof of visual quality.

The aim of V5d is visible `organic` and `spiral` improvements without fabricating closed territories. Full eight-engine integration and Marker/Watercolour adapters remain separate decisions based on the demonstrated artistic merit of these prototypes.

## Actual V5d browser results — 15 October 2026

The final [GitHub Actions run 38753466119](https://github.com/southernadd-cmyk/algoart/actions/runs/38753466119) passed: source/archived renderer checks, deterministic same-seed pixels, source-lineage, source-void tests, identical material-independent guide plans, the strict **V5c comparator delta** check, and all **24 real ALGO/ART renderer images** (4 engine families × 2 materials × Faithful/V5c/V5d).

| Source engine | Source-guide masses | Painted | Framed | Changed pixels vs V5c (Oil) | Changed pixels vs V5c (Tissue) |
|---|---:|---:|---:|---:|---:|
| Growth Systems | 13 source-attached branch corridors | 11 | 2 | 15,369 | 3,268 |
| Recursive Divisions | 7 preserved φ cells | 3 | 4 | **0** | **0** |
| Golden Trajectories | 6 short arm-specific ribbons | 5 | 1 | 12,302 | 2,587 |
| Constructed Forms | 9 source-derived focal forms | 7 | 2 | 11,695 | 2,758 |

Counts are pixels with RGB-difference sum above 18 at 0.4 preview scale; **they measure change, not aesthetic quality**. Oil adds more spatial coverage than Tissue. This confirms the new guide interpretation makes real, visible, reproducible pixel changes and is not merely returning V5c re-labelled. V5d leaves all V5c rectilinear output *pixel-identical* rather than reinterpreting an already semantic engine. All Faithful material images remain pixel-identical to original Oil V4e or Tissue V7 outputs.

Actual source guide fields used: Growth `guide.segments[depth,branch,x1,y1,x2,y2]`; Trajectories `guide.points[arm,local,x,y]`; Constructed `guide.items[tier,x,y,size,rot]`. Every output region includes source SVG index references and a coherent local source hue. The same JSON region plan is handed to both material adapters, which apply different physical deposition methods.

### Decision: HOLD — experimental, do not merge

The test validates **guide-aware architecture and reproducibility**, not photographic or painterly fidelity. Final aesthetic inspection of the contact sheet is still needed before calling V5d a visual improvement: for Oil, check whether guide ribbons look like coherent paint masses rather than thicker path decorations; for Tissue, check physical torn edges and whether translucency resembles thin coloured tissue instead of flat translucent polygons.

Especially important: geometric form approximation here creates *focal ellipses* from real `guide.items`, not exact enclosed semantic silhouettes. Do not misrepresent them as mathematically exact object boundaries. Existing V5c φ subdivision boundaries, by contrast, are exact source guide cells.

If the visual results are promising, consider guide-aware treatment for the other four engines, then prototype Marker/Watercolour as separate material adapters. The user agreed this interpretation should be optional across materials—not forced onto historical output.
