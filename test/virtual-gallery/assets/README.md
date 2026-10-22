# Town-square HDRI backdrop

Source: HDRMAPS, **Jedlina-Zdrój Plac Zdrojowy**
https://hdrmaps.com/freebies/jedlina-zdroj-plac-zdrojowy/

The source is a 10,000 × 5,000 EXR (~466 MB). Do **not** host or fetch that source in the gallery browser. Download separately, inspect the HDRMAPS royalty-free terms, and convert it to equirectangular display-referred JPEGs with exposure and tone mapping.

Place the generated files in this folder:

- `jedlina-zdroj-2k.jpg` — 2048 × 1024, target < 350 KB, mobile and desktop fallback
- `jedlina-zdroj-4k.jpg` — 4096 × 2048, target < 1.5 MB, desktop

Keep a 2:1 equirectangular image (not a perspective crop). Tone-map highlight detail and save sRGB JPEGs; reject visible seams. Adjust horizon and orientation after previewing against the physical forecourt.

The gallery tries the 4K image on desktop and the 2K image on low-power/mobile devices. If either image is unavailable, it falls back to 2K and finally to the existing procedural sky. The HDR EXR is **not** decoded on the client.

The JPEG is the photographic **background**, not a real distant walkable city. Existing tower, benches, plaza, artworks and visitors remain native 3D geometry.

Optional future enhancement: add a separately compressed KTX2/PMREM lighting source after profiling mobile hardware. Do not use the LDR JPEG as if it retained the EXR's HDR dynamic range.

Licensing: HDRMAPS currently identifies this item as royalty-free and free for personal/commercial use, but verify the relevant terms for redistribution of derived panoramas before publishing them to GitHub. Credit HDRMAPS / Grzegorz Wronkowski and link the source.
