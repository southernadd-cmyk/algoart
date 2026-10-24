# Writing on the wall

An isolated PROPORTION PIECE graffiti specimen, at `test/graffiti/`.

Words are constructed from original letter centre-lines, alternate movements,
word-level slant and baseline rhythm, joins, and finishing strokes. A continuous
pressure/speed ribbon and the existing `AlgoArt.stroke` marker renderer deposit
ink into a transparent layer. The brick's grain modulates that layer's alpha.
The specimen presents three writer profiles and actual stroke playback.

## Phi construction

Version 2 constructs the alphabet in `phi-lettering.mjs` before adding the
writer's motion. For a cap height H=100, a nominal letter has width H/phi
(61.8034), short bowl H/phi² (38.1966), long bowl H/phi (61.8034), and a
working unit H/phi⁶. A and H crossbars use H/phi, B divides its upper and
lower bowls at H/phi², and O begins as an ellipse in the golden rectangle.
Spacing, word gaps, overlap and the returning stroke use those same units.
Each writer can then lean, compress, stretch and vary that construction.

The **Show phi construction** control overlays the actual letter frames after
their writer transforms; it does not change the tag geometry, seed or ink.
`phi=1` in the URL preserves the overlay. Small offsets, curve control points
and nib/ink settings remain aesthetic parameters, rather than claims that
every visible distance is an exact golden ratio.

## Reference studies

The three hands are original constructions informed by visual observations:

- **Rush:** direct, open capitals and economical pen lifts from the tags
  photographed on [TAKI 183's own site](https://www.taki183.net/).
- **Loop:** overlapping shapes, extended movements and whole-word rhythm
  from [Matt Weber's photograph of an early Futura tag](https://weber-street-photography.com/2010/03/01/futura-2000-vintage-graffiti-tag/).
- **Cut:** controlled capitals, angular counters and broad calligraphic
  contrast from [Chaz Bojórquez's Placa/Rollcall](https://americanart.si.edu/artwork/placarollcall-32848),
  supported by [his own account of Cholo lettering](https://www.graffitiverite.com/GraffitiisArt.htm).

These are design observations, not claims that the reference artists used phi.
The sources are linked in the specimen. Reference photos were inspected for
research; they are not bundled in the site or used as generated tag textures.

`planFloorTags({ floorId, seed, text, hand, ink })` always returns **one or two
tags for each floor**, including every upper floor. Use a stable exhibition date
as `floorId` when integrating into the tower. Never use the number of floors or
a ground-level visibility condition to seed the plan. A floor's selection is
independent of tower growth. `text` may be blank to choose from the vocabulary.

The floor browser previews each floor's tag selection on one specimen wall.
It does not yet place graffiti on the live tower. Tower integration must choose
solid exterior wall segments from the existing room layouts, avoid openings,
and work in the current-floor, prepared-archive and fallback geometry paths.
It should share texture atlases and batch wall overlays, rather than creating
a texture or material per letter. Lettering and placement must stay reproducible.

The existing marker renderer and marker font are unchanged.

## Run

Serve the repository root over HTTP, then open `/test/graffiti/`.
Run the geometry/planning checks with:

    node --test test/graffiti/tag-engine.test.mjs

`word`, `seed`, `floor`, `hand` and `ink` are stored in the specimen URL.
The word accepts Latin letters, digits, spaces, phi, full stops, exclamation
marks, question marks and hyphens, up to 24 characters. Letter shapes are capitals
with a lowercase phi. A blank word selects different words for each floor.

## Brick asset

`assets/brick-wall.webp` is a 768px WebP derivative of **brick_wall_02**,
by **Dimitrios Savva / Poly Haven**, licensed **CC0**:

- Asset: https://polyhaven.com/a/brick_wall_02
- Source: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brick_wall_02/brick_wall_02_diff_1k.jpg

The buff tint matches `gallery/visit/architectural-materials.mjs`. This small
same-origin derivative is used only by the specimen. The live material bank
and gallery textures have not been changed. A seeded brick fallback remains
available when the image cannot be loaded.
