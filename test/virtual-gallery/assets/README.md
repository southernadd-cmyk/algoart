# Town-square HDRI backdrop

Source: HDRMAPS, **Jedlina-Zdrój Plac Zdrojowy**
https://hdrmaps.com/freebies/jedlina-zdroj-plac-zdrojowy/

The source is a 10,000 × 5,000 EXR (~466 MB). Do **not** host or fetch that source in the gallery browser. Download separately, inspect the HDRMAPS royalty-free terms, and convert it to equirectangular display-referred JPEGs with exposure and tone mapping.

For the currently supplied 1K EXR (1024 × 512), place the converted **`jedlina-zdroj-1k.jpg`** (approximately 115 KB) in this folder. Do not upscale and claim added detail. A higher resolution EXR may be used to create 2K/4K assets in a later upgrade.

Keep a 2:1 equirectangular image (not a perspective crop). Tone-map highlight detail and save sRGB JPEGs; reject visible seams. Adjust horizon and orientation after previewing against the physical forecourt.

The gallery requests the 1K JPEG on both desktop and mobile. If the image is unavailable, it keeps the existing procedural sky. The HDR EXR is **not** decoded on the client.

The JPEG is the photographic **background**, not a real distant walkable city. Existing tower, benches, plaza, artworks and visitors remain native 3D geometry.

Optional future enhancement: add a separately compressed KTX2/PMREM lighting source after profiling mobile hardware. Do not use the LDR JPEG as if it retained the EXR's HDR dynamic range.

Licensing: HDRMAPS currently identifies this item as royalty-free and free for personal/commercial use, but verify the relevant terms for redistribution of derived panoramas before publishing them to GitHub. Credit HDRMAPS / Grzegorz Wronkowski and link the source.
