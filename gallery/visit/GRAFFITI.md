# Exterior writing

The tower uses the specimen's procedural writing engine, bundled into the
existing gallery JavaScript. It adds no font, image, library or CDN request.
The source import points to `test/graffiti/tag-engine.mjs`; that engine is
compiled into the production bundle rather than fetched from the test page.

`exterior-graffiti-plan.mjs` selects fifteen marks on the ground floor and
fifteen on the first floor. Higher floors have no marks. Each painted floor
has five Proportion Piece tags, five PHI tags and five φ tags. Wall faces may
be reused, so the tags can overlap with a repeatable drawing order. All 53 writer profiles and eight lettering forms remain available.
Selections use the exhibition date and slot, independently of tower height,
the currently occupied floor, or prepared versus procedural tower geometry.

The planner reserves the lift wall and ground entrance, excludes connector
doors, and fits each rotated mark inside the remaining brick face. It prefers
exposed facades facing the entrance square. Only outward-facing transparent
quads are created; no inside walls, glass bridges or artworks receive paint.
Active-room veneer and archived brick have separate millimetre surface offsets.

Up to 32 marks share one atlas, material and draw call. Desktop atlas cells
are 512 by 256 pixels; mobile cells are 384 by 192. The last atlas uses only
the rows it needs. Each mark's UV rectangle preserves its original aspect.
Painting progresses in small renderer-frame steps, including immersive XR
and the welcome screen. Filled words are split by letter with identical final
pixels, avoiding one long paint job for a whole word. Existing atlas pixels
are retained across lift journeys.
Brick grain modulates coverage; desktop paint reuses the brick normal-map
image with metre-based wall UVs. These UVs are separate from the atlas UVs.

Run the placement and renderer-loop checks with:

    node --test tests/gallery-exterior-graffiti.test.mjs tests/gallery-xr-loading.test.mjs

Run the full prepared/fallback, lift and mobile browser check with:

    npx playwright install chromium
    node tests/gallery-exterior-graffiti-browser.mjs

`GALLERY_CHROMIUM` can select an existing Chromium binary. Debug builds opened
with `?debug=1` expose `__galleryGraffiti` diagnostics, a mark snapshot and a
close-up preview helper. This does not add controls to the visitor interface.
