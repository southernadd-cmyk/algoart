# Virtual gallery architectural materials and entrance

The exhibition architecture uses restrained, reusable **CC0 1.0** photographic textures from [Poly Haven](https://polyhaven.com/license), all requested at **1K**. No ShareTextures assets are redistributed by the repository.

| Surface | Source | Gallery treatment |
| --- | --- | --- |
| Interior plaster | [Plastered Wall 02](https://polyhaven.com/a/plastered_wall_02) | Low contrast warm off-white; .15 normal strength on desktop |
| Exterior brick | [Brick Wall 02](https://polyhaven.com/a/brick_wall_02) | Photographic brick/mortar relief, neutralised to soft buff colour; .11 normal strength on desktop |
| Gallery concrete | [Concrete Floor](https://polyhaven.com/a/concrete_floor) | Smooth pale concrete for main exhibition floors and glazed footbridges |
| Timber rooms | [Wood Floor](https://polyhaven.com/a/wood_floor) | Three subtly different matte timber finishes, built from one shared 1K image |

**Licence:** CC0. Source credits are for provenance; attribution is not legally required.

## Performance and lifecycle

- One 1K texture download per source image is shared between all rooms; timber tonal variants are made in browser canvases from a *single* downloaded scan.
- Scanned colour maps are reduced to 384 pixels on low-power/mobile displays and up to 1K on desktop.
- Normal maps are skipped on mobile. Displacement/tessellation/ambient-occlusion texture passes are not used.
- Materials are shared between all floors and explicitly preserved during lift scene swaps. Floor geometry and artwork assets can be disposed separately.
- If remote texture hosts fail, locally-generated pale architectural materials stay visible. The gallery remains navigable.
- Plaster and concrete remain neutral to preserve the visual priority of the artworks.

## Main entrance

The 3.40 × 4.15 metre ground-floor opening now has a pair of human-scale
**animated hinged doors** (1.54 × 2.171 metres), glass sidelights and transom.
The leaves open smoothly as a visitor approaches from either side and close only
when nobody is at the threshold. They do not add a collision wall. This
controller is independent of the model download and preserves gallery startup.

The uploaded [Innerscene French Double Doors](https://www.innerscene.com/tools/library/3d-parts/french-french-double-doors-eeefa4e8)
GLB is CC0 and has separately named sash, latch, frame and hinge meshes. An
optional loader in `entrance-doors.mjs` can replace the procedural door leaves
with the actual mesh while preserving the same hinge controller. The **binary
GLB has not yet been added to the repository**: publishing it under
`test/virtual-gallery/models/glazed-french-double-door.glb` and passing
`modelURL:'./models/glazed-french-double-door.glb'` to `createEntranceDoors`
will enable the detailed model. Until then the animated procedural doors work.

## Visual verification

A source-level test is not a WebGL screenshot. Real desktop/mobile browser
verification is still needed to judge colour, UV repeat and door clearance.
