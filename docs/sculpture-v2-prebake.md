# Sculpture V2 historical asset packs (phase 3, no cutover)

Artist-approved preview: /gallery/sculpture-v2-test/
Live /gallery/visit/ remains the V1 renderer. This plan **does not**
change the public tower, daily publishing, V1 files or the museum-pin support.

## Build contract
- Source: the approved and frozen V4.2.1 Sculpture V2 test-tower engine.
- Version: pp-sculpture-v2-floor / 2.
- One compressed pack per archive date × quality: sculptures.desktop.json.gz
  and sculptures.mobile.json.gz.
- One manifest per date, with SHA-256 of compressed packs.
- Studies are keyed by ORIGINAL imageFile from meta.json.
- Each study has its exact source image filename and SHA-256, its material,
  geometric method 'assembly', source coverage, separate indexed meshes, UVs,
  vertex normals, material groups and a compact original ink-density map.
- Vertex positions and UVs use 1e-5 resolution; normals use 1e-4.
- All actual source texture pixels remain in the existing gallery JPG/WebP.
  The original painting is not copied into the mesh pack.
- Source geometry includes rounded rims, all independent pigment islands,
  inter-region bridges and true 3D layer placement from the approved preview.
- Historical inventory: 37 floors, 267 eligible solo portraits on 10 Nov 2026.
  Confluence is excluded. Count must be re-evaluated on every full bake.

## Only permitted outputs in this phase
- By default: artifacts/sculpture-v2-packs/<date>/3d/v2/.
- Scratch packs and metrics uploaded through a READ-ONLY GitHub Actions
  artifact named sculpture-v2-prepared-packs. The workflow has no write token,
  no git push, and no Pages publish step.
- Never overwrite any gallery/<date>/3d/sculptures.json.gz (V1).

## Bake sequence
1. node automation/build-sculpture-v2-baker.mjs
2. Start local static server: python3 -m http.server 4173
3. Run one date first: node automation/build-sculpture-v2-packs.mjs
   --date 2026-11-10 --quality both --limit 3
4. Validate: node --test tests/sculpture-v2-packs.test.mjs
5. Only after a successful sample: full DATE, then --all --quality both.
6. Validate 100% original paint coverage and manifest checksums before staging.
7. Use the versioned V2 reader to reconstruct and stage a full floor in the
   isolated preview. Artist controls final visual acceptance.

## Quality gates
- Both mobile and desktop geometry is reconstructed from the original paintings.
- The exact painting SHA-256 and V4.2.1 geometry revision are recorded.
- The quality file is marked complete ONLY if every eligible portrait succeeded.
- Compression and vertex budgets are reported; large packs block release.
- No omitted pigment regions, zero unexplained missing/extra studies.
- Scene reconstruction matches stored vertex/triangle counts and dimensions.
- Museum-pin attachments and tower lift staging remain unchanged.
- No repeat allocations on floor exit; full cleanup must be verified.
- Only then can a separate production V2/V1 switch be considered.

## Rollback
The V1 pipeline is untouched throughout this phase. No Gallery Pages deploy
is required to recover from a failed scratch bake.
