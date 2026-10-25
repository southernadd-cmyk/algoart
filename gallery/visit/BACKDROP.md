# Distant city backdrop

The exterior uses a generated, blurred city strip in place of the photographic
panorama. `procedural-backdrop.mjs` draws three seeded layers of building faces,
roof shapes and tree silhouettes, then softens the small canvas once.

The canvas is 1024 by 256 on desktop and 512 by 128 on mobile. Those sizes use
one eighth of the pixels of the previous 2K/1K equirectangular source textures,
without their image downloads, JPEG decoding or cube-map conversion. The old
503,286-byte desktop and 374,236-byte mobile JPEG files remain available for
older gallery links; the current bundle does not request either file.

One shared texture covers sixteen flat panels around the distant environment,
with 32 triangles in total. The gradient sky is separate. The panels stay at
ground level as visitors travel upwards, their lower fade joins the terrain,
and horizontal wrapping avoids a visible texture seam. Distance haze is drawn
into the cards; global fog does not soften the gallery or its artworks.

The texture, material and geometry are retained across lift journeys. Blurring
is performed once during generation, with no post-processing pass per frame.
Debug mode reports dimensions, generation time and resource reuse through
`window.__galleryBackdrop`.

    node --test tests/gallery-backdrop.test.mjs
    node tests/gallery-exterior-graffiti-browser.mjs
