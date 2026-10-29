# Virtual gallery architectural materials and entrance

Current live/test reception mixes [ambientCG Bricks055](https://ambientcg.com/view?id=Bricks055) charcoal-black brick with [ShareTextures Decorative Wall 2](https://www.sharetextures.com/textures/wall/decorative_wall_2) wallpaper and [Aman Bajwa](https://sketchfab.com/3d-models/pbr-floor-tiles-material-4f30f4ab3cf4461d8f0460c236fd9309) floor tiles. Upper gallery plaster and most floors use Poly Haven textures. The historical table below originally described an earlier prototype; see [the active-source audit](../../gallery/visit/ASSET-AUDIT.md) and [current test credits](./credits.html).

| Surface | Source | Gallery treatment |
| --- | --- | --- |
| Interior plaster | [Plastered Wall 02](https://polyhaven.com/a/plastered_wall_02) | Low contrast warm off-white; .15 normal strength on desktop |
| Exterior and reception black brick | [Bricks055](https://ambientcg.com/view?id=Bricks055) by ambientCG, CC0 | Shared charcoal-adapted brick material on exterior and selected reception faces |
| Gallery concrete | [Concrete Floor](https://polyhaven.com/a/concrete_floor) | Smooth pale concrete for main exhibition floors and glazed footbridges |
| Timber rooms | [Wood Floor](https://polyhaven.com/a/wood_floor) | Three subtly different matte timber finishes, built from one shared 1K image |

**Licences:** Poly Haven and ambientCG are CC0; ShareTextures Decorative Wall 2 is listed as CC0; Aman Bajwa tiles and many model props are CC BY 4.0. These descriptions are not blanket permissions for all gallery assets: the Sketchfab Standard lift and HDRMAPS background present separate issues noted below and in the audit.

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


## Sketchfab lift integration (optional binary)

The source-file integration in `sketchfab-elevator.mjs` uses the exact
[Elevator - Game Ready](https://sketchfab.com/3d-models/elevator-game-ready-e0ec659e907c4a35a840df99f8cd25be)
by **Big5shadow**. Its downloaded ZIP says **Sketchfab Standard**, not CC0.
The GLB's original metadata and names were examined locally:

- overall source bounds: 3.1624 m wide × 2.9605 m high × 2.9037 m deep
- door scene nodes: `DoorL_0` and `DoorR_1`
- fitted scales: width .7273, height .8951, depth .6543
- sliding positions produce an approximately 1.22 m clear gap and 0.2 mm
  centre seam when closed

**Update 29 October 2026:** The GLB is now present in the public GitHub repository, contrary to the older statement below. Public standalone distribution requires permission beyond the documented Sketchfab Standard licence; see the audit. The optional
loader expects `test/virtual-gallery/models/elevator-game-ready.glb`.
If absent or blocked it silently leaves the existing functional elevator
visible. Once an appropriately authorised deployment of the GLB is
available at that location, the real mesh replaces the fallback and
inherits the existing proximity and floor-travel animation.

The Free Standard terms permit incorporating the model in larger works
but prohibit distribution/access as a stand-alone asset. Public GitHub
Pages hosts raw binary files openly; confirm redistribution permission
before placing the GLB in that public path.

The model is low-polygon (~5,300 triangles) and ~296 KiB. It loads on
demand after the floor scene is ready and its geometry is reused after
lift-floor changes. It is not a prerequisite for a working elevator.


## Twin surface spotlights and office ceiling (CC0)

- Physical exhibition fittings: [Twin Spot – Twin Surface Spotlight](https://www.innerscene.com/tools/library/3d-parts/twin-spot-twin-surface-spotlight-68df1e43) by Innerscene. Original approximately 27.6 × 10.5 × 19.8 cm GLB with included textured PBR materials, released under CC0.
- Interior solid-ceiling finish: [OfficeCeiling001](https://ambientcg.com/view?id=OfficeCeiling001) by ambientCG, CC0. Source 1K JPEG Color, NormalGL and Roughness maps. Installed as optimized 768px JPEGs with original spatial scale ~3.85m per repeat.
- The local asset installer is `automation/install-gallery-lighting-assets.py`. `.github/workflows/gallery-lighting-assets.yml` downloads and validates from the official publisher sites, commits the binary files under `test/virtual-gallery/models` and `test/virtual-gallery/textures`, then requests a Pages deployment.
- The actual light cones use the existing limited light pool. Individual detailed fixtures are optional decoration, loaded after entry; until the GLB is available the original simple fitting stays visible. Missing ceiling maps leave the neutral roof finish intact, with no blocking promises.
- The central roof skylights are preserved and the new office-ceiling material is applied only to solid interior ceiling panels, not exterior walls or the tower facade.
