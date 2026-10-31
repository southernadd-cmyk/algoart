# PROPORTION PIECE — 3D tower material/model attribution audit

Date: 29 October 2026. Scope: the **live gallery** (`gallery/visit/index.html`) and the **independent test tower** (`test/virtual-gallery/index.html` and `full-engine.html`). Both currently build their 3D scene from `gallery/visit/gallery-phi.js`; the test has a separate, stage-safe bundle. Findings below are based on source import/asset-loader inspection and the main-branch file inventory, **not a browser network recording**. “Used” means the current renderer contains an active code path to load or reconstruct the asset; conditional models can fall back on procedural geometry.

## Models used or referenced by active load paths

| Model/geometry | Source / attribution | Licence / status |
| --- | --- | --- |
| `gothic-entrance-door.glb` | [Maria Stashko, Door](https://sketchfab.com/3d-models/door-b037e932fd774dd9b355ba0a403f5c79) | CC BY 4.0 |
| `pothos-plant.glb` | [AllQuad, Pothos](https://sketchfab.com/3d-models/free-pothos-potted-plant-money-plant-e9832f38484f4f85b3f9081b51fa3799) | CC BY 4.0 |
| `cardboard-boxes.glb` | [NotAnotherApocalypticCo., Set of Cardboard Boxes](https://sketchfab.com/3d-models/set-of-cardboard-boxes-8986ba512f704ac5b253286a0d1ad8bb) | CC BY 4.0 |
| `magazine-cabinet.glb` | [JFN, Art Magazines on Old Cabinet](https://sketchfab.com/3d-models/art-magazines-on-old-cabinet-scaniverse-lidar-9868923cd16b4c4db3bd834d8e18fe2e) | CC BY 4.0 |
| `paper-clutter.glb` | [Sousinho, Paper debris](https://sketchfab.com/3d-models/paper-debris-457624d2526744d8890d50d811ef45d7) | CC BY 4.0 |
| `plants-scene-gallery-optimized.glb` | [Nicholas-3D, Plants Scene Free!](https://sketchfab.com/3d-models/plants-scene-free-5425c959e480400e957cd52c6f59c3dc) | CC BY 4.0 |
| `modern-reception-fittings.glb` | [dylanheyes, Minimalistic Modern Office](https://sketchfab.com/3d-models/minimalistic-modern-office-5540183da1c7452f810f8de33734879a) | CC BY 4.0; used under reception refresh feature gate, enabled in both entry pages |
| `reception-chinese-roof.glb` | [KSmodels, Chinese roof](https://sketchfab.com/3d-models/chinese-roof-low-poly-model-783448e879ac4f3c84beb6c836a1b241) | CC BY 4.0 |
| `reception-church-window.glb` | [MWOgier, Ancient Church Window](https://sketchfab.com/3d-models/ancient-church-window-ecac14e511774b53abff25d30a1bb120) | CC BY 4.0 |
| `proportion-piece-pub-sign.glb` | [johhny3D, Pub Sign](https://sketchfab.com/3d-models/pub-sign-7cab4049dd114d049d0fc5b89a7f4da2) | CC BY 4.0 |
| `reception-gramophone.glb` | [josephineburns, Grammaphone](https://sketchfab.com/3d-models/grammaphone-b1a1c0eb77254acd81f94f38e6569c6a) | CC BY 4.0 |
| `ceiling-speaker.glb` | [spy_dogg, Ceiling Speaker](https://sketchfab.com/3d-models/ceiling-speaker-58580cd22a144b64b2aa9873d429a0b5) | CC BY 4.0 |
| `polyhaven-street-lamp-01-optimized.glb` | [Poly Haven](https://polyhaven.com/) | CC0 |
| `twin-surface-spotlight.glb` | [Innerscene](https://www.innerscene.com/tools/library/3d-parts/twin-spot-twin-surface-spotlight-68df1e43) | CC0 |
| `quaternius-{male,female}-meshopt.glb` | [Quaternius](https://quaternius.com/) | CC0 |
| `human-male-female-rigged-optimized.glb` (fallback) | [lzyassoul](https://sketchfab.com/3d-models/human-models-set-malefemale-rigged-7311fcfdc03e4234900eeced42a1e669) | CC BY 4.0 |
| `elevator-game-ready.glb` (optional) | [Big5shadow](https://sketchfab.com/3d-models/elevator-game-ready-e0ec659e907c4a35a840df99f8cd25be) | **Sketchfab Standard** |
| Embedded A-frame sign geometry | [clon6767, Chalkboard_sign_V1](https://sketchfab.com/3d-models/chalkboard-sign-v1-d989e2cf9a0744cb8bcb90c2560bb409) | CC BY 4.0; geometry preserved in `phi-translation-area-sign.mjs` |
| Procedurally rebuilt hanging room signs | [Hospital hanging signage](https://sketchfab.com/3d-models/hospital-hanging-signage-74157aae9eb746d9a0cfe7f9c5c7f83f) | Source module attributes to Sousinho, CC BY 4.0; **independent verification pending** |

## Textures actively applied in the shared tower

| Source | Active use | Credit status |
| --- | --- | --- |
| [ambientCG Bricks055](https://ambientcg.com/view?id=Bricks055) | Charcoal-adjusted exterior bricks **and** reception black-brick feature/opposite walls | CC0; reuse shared material, zero added texture downloads |
| [ShareTextures Decorative Wall 2](https://www.sharetextures.com/textures/wall/decorative_wall_2), M. Tolga Arslan | Reception blue wallpaper faces | Source lists CC0 |
| [Poly Haven plastered_wall_02](https://polyhaven.com/a/plastered_wall_02) | Upper exhibition wall / plinth | CC0 |
| [Poly Haven concrete_floor](https://polyhaven.com/a/concrete_floor), [wood_floor](https://polyhaven.com/a/wood_floor) | Floor and timber variations | CC0 |
| [ambientCG OfficeCeiling001](https://ambientcg.com/view?id=OfficeCeiling001) | Ceiling | CC0 |
| [Aman Bajwa PBR Floor Tiles](https://sketchfab.com/3d-models/pbr-floor-tiles-material-4f30f4ab3cf4461d8f0460c236fd9309) | Reception floor | CC BY 4.0 |
| OpenGameArt texture-pack files `028.jpg` and `048.jpg` | Forecourt paving and optional floor/stone maps | **Artist, original pack URL and licence not currently proven**; do not assume CC0 |

## Assets in the repository **not active in the main live/test tower**

- `gallery/visit/models/vintage-world-map.glb`: old reception map; replaced by PROPORTION PIECE watercolour. Remove its old credit from the test active credits (done).
- `gallery/visit/models/succulent-planter.glb`: old planter; current exterior planters use the Nicholas-3D plant scene. Remove GrrHero from the test active credits (done).
- `gallery/visit/models/reception-old-house-roof.glb`: unused older roof; current roof is KSmodels Chinese roof.
- `gallery/visit/textures/ambientcg-painted-plaster-007/*`: archived maps; the runtime no longer loads them after black-brick substitution.
- `gallery/visit/textures/open-game-art/041.jpg`: old wall preview image; not in the main tower's active material loader.
- Former `test/virtual-gallery/assets/jedlina-zdroj-1k.jpg`: unused HDRMAPS image; removed from the current repository branch and Pages source on 29 October 2026.
- Several old `test/virtual-gallery/models` variants (e.g. full-size rigs, older male/female GLBs, and unoptimised street lamp) belong to prototype pages, not the current independent test tower.
- `gallery/visit/assets/day-environment-hdri-101-{1k,2k}.jpg` are archived backdrop assets; the shared tower uses procedural landscape/backdrop rendering.
- Other archived files remain in the repository even when not fetched by the active renderer. Do not automatically delete those: test/prototype pages may still refer to some. The obsolete HDRMAPS JPG was explicitly removed.

## Follow-up risks (not solved by credits alone)

1. **Lift model:** Big5shadow — Sketchfab Standard.\n2. **Resolved: removed unused HDRMAPS JPG.** Deleted `test/virtual-gallery/assets/jedlina-zdroj-1k.jpg` from the current branch and subsequent Pages site build. Older Git commits can still retain historical copies; neither active tower loads it.
3. **Medium: unverified OpenGameArt pack.** Resolve author, original URL, and licence for `028.jpg` and `048.jpg`; they are currently loaded. Provide exact asset and licence links once recovered.
4. **Medium: room-sign provenance.** The `phi-room-hanging-signs.mjs` source claims Sousinho / CC BY 4.0, but the original model metadata should be checked to establish author and licence conclusively.

## Maintenance rule

The **live and test credits pages** and **in-gallery credits panels** must represent the shared *currently loaded* models/textures, not every file stored in the repository. Keep retired/prototype assets in this audit instead of presenting them as currently exhibited. If a new model or texture load is added to the shared tower, update those three credits surfaces in the same change.
