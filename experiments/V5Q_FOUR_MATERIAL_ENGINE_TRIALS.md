# V5q — actual cross-material ALGO/ART engine test

**DRAFT EXPERIMENT. Not merged, not deployed.**

The previous 8 images accidentally came from an image-generation model and were *not* suitable evidence for the ALGO/ART composition system. V5q uses ALGO/ART's actual browser rendering code to generate **eight independently seeded, full-native-size PNG artworks**, two per physical material.

## Genuine material paths

| Material | Source renderer | New geometric-material interpretation |
|---|---|---|
| Marker | `A.render()` | Overlapping directional felt-pen contacts, fine dry-tip striations along V5o guide connections |
| Watercolour | released `A.renderWatercolourV2R()` | Soft translucent connected washes, irregular wet rims, pooled pigment at real source joins |
| Oil | `A.renderInterpretedV5P(...oil)` using Oil V4e contact brushes | Additional real V4e loaded-bristle contact strokes along the legal V5o source graph |
| Tissue & Graphite | `A.renderInterpretedV5P(...tissue)` | Tested V5p torn perimeter, independently layered tissue sheets and subtractive pooled overlap |

No trained image generation, image style transfer or illustrative approximation is used. Source contours, V5o selection, source IDs, deterministic seed, negative-space reservations and palette ownership are unchanged. The three added material passes are **clipped to V5o source-owned broader field hulls**; faithful material implementations are not edited.

## Random seed selection

Any random seed can produce zero qualified large linked colour masses under V5o's source-guide selection. V5q first draws truly random seed candidates and only accepts seeds with at least two genuine broad source connections. It records both the accepted seed and the number of trials in `manifest.json`.

## Completed actual-browser evidence

[GitHub Actions run 38805159124 — PASS](https://github.com/southernadd-cmyk/algoart/actions/runs/38805159124)

[Artifact with 8 full-size PNGs + JSON manifest](https://github.com/southernadd-cmyk/algoart/actions/runs/38805159124/artifacts/12005773738)

The final accepted seeds produce:

| Artwork | Native resolution | Source-linked larger fields |
|---|---:|---:|
| Marker / Organic / portrait | 1000×1400 | 4 |
| Marker / Golden Trajectories / landscape | 1400×1000 | 3 |
| Watercolour / Constructed Forms / landscape | 1400×1000 | 4 |
| Watercolour / Growth Systems / portrait | 1000×1400 | 4 |
| Oil / Golden Trajectories / portrait | 1000×1400 | 4 |
| Oil / Constructed Forms / landscape | 1400×1000 | 4 |
| Tissue / Growth Systems / landscape | 1400×1000 | 2 |
| Tissue / Golden Trajectories / portrait | 1000×1400 | 3 |

All eight pass full-size, non-empty output and material contact checks. Production renderer-lock regression passes (144 comparisons); image generation is not involved.

**Visual assessment is explicitly reserved for the user.** This test establishes functional end-to-end real rendering across the four materials, not a claim that every material now reaches reference artwork quality.
