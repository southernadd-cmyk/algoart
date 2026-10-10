# AlgoArt Marker

Original uppercase letter skeletons drawn using this repository's `A.stroke` marker renderer. Three separately seeded versions of each supported glyph cycle through OpenType contextual alternates (`calt`). The same text renders consistently. `ss01` and `ss02` expose the two alternate sets. Lowercase Latin input maps to uppercase shapes; φ uses a curly lowercase form with a descender.

TTF is installable; WOFF2 is used by the site. This monochrome outline font preserves ink silhouettes, wobble and uneven weight; translucent overlapping passes are merged. Body text, captions and numeric outputs retain the existing fonts.

To rebuild, run `node fonts/source/draw-glyphs.cjs` then `python fonts/source/build-font.py` from the repository root. The builder requires FontTools and Shapely, plus Brotli (or installed system libbrotli on Linux using the included bridge). No packages are needed to use the font in the website.

The OpenType `kern` feature tightens 22 capital pairs across every alternate combination. Keep marker lettering at 13px or larger; compact toolbar controls and tabs use sans-serif. Contextual alternates cycle deterministically and do not change on reload.
