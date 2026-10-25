# Wall writing

The tower uses the specimen's procedural writing engine, compiled into the
existing gallery bundle. It adds no font, image, library or CDN request.

The exterior has ten marks on the ground floor and ten on the first floor.
Higher exterior walls stay clear. The three phrases are Proportion Piece, PHI
and φ, with seeded writer profiles, lettering forms and ink. Five additional
freehand tags on each level use distinct writing profiles. Their placement
samples alternate golden-ratio positions to minimise overlap and keep existing
lettering legible; rotated bounds fit solid walls clear of openings.

Every exhibition also gets three to five small interior handstyle tags. The
interior planner receives the exact hanging plan before deferred artwork images
load. It excludes every wall face that has any planned painting. It spreads
signatures across rooms and wall faces, using clear doorway wings when useful.
Interior tags are at most 1.35 m wide and 45 cm high, in a reachable wall band.
Their rotated bounds avoid door openings, corners and one another.

Both planners place tags by φ within the usable wall area. Successive golden
fractions choose horizontal and vertical positions after allowing for rotation.
Angles alternate direction and vary from about 5° to 21°, using powers of φ.
The date and slot seed the choices, so floor travel and tower growth do not
reshuffle the writing.

`graffiti-placement.mjs` handles the shared positioning. The exterior and
interior planners are separate; both use the shared atlas renderer. Outward
brick and inward plaster have their own surface offsets, grain and normal
maps. Transparent quads are batched by atlas. The exterior atlas survives lift
travel; the occupied floor has one small interior atlas, replaced on a journey.
Higher-floor interiors are generated when that exhibition is visited.

Painting progresses on the desktop/XR renderer loop, including the welcome
screen. Filled outside words are split by letter with identical final pixels.

    node --test tests/gallery-exterior-graffiti.test.mjs tests/gallery-interior-graffiti.test.mjs tests/gallery-xr-loading.test.mjs
    npx playwright install chromium
    node tests/gallery-exterior-graffiti-browser.mjs

`GALLERY_CHROMIUM` can select an existing Chromium binary. Debug mode exposes
`__galleryGraffiti` and `__galleryInteriorGraffiti` diagnostics, snapshots and
close-up previews. These add no controls to the visitor interface.
