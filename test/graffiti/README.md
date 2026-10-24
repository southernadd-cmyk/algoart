# Writing on the wall

An isolated PROPORTION PIECE graffiti specimen, at `test/graffiti/`.

Words are constructed from original letter centre-lines, alternate movements,
word-level slant and baseline rhythm, joins, and finishing strokes. A continuous
pressure/speed ribbon and the existing `AlgoArt.stroke` marker renderer deposit
ink into a transparent layer. The brick's grain modulates that layer's alpha.
The specimen presents three writer profiles and actual stroke playback.

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
