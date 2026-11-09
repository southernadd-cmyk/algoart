# PROPORTION PIECE — Release A: archive storage foundation

Status: planning and audit only. No live cutover authorised.
Issue: https://github.com/southernadd-cmyk/algoart/issues/255
Work branch: plan/archive-storage-foundation-20261109
Frozen baseline commit: 45f1f7a2768ad66aa282994c877357f51fb2ca7e

## Hard limits of this release

Do not change main, GitHub Pages, active workflows, today's artwork, schedules or social posts.
Do not remove images, overwrite historical output, rewrite Git history or alter old public URLs.
Do not introduce credentials into source, issues or logs. Use one integration branch only.

## Audit at baseline

The complete main commit tree contains 35 dated gallery directories with metadata.
Dated media: 1,743 files / 128,515,838 bytes.
All dated files: 132,973,793 bytes.
Total gallery folder: 2,263 files / 304,487,658 bytes.
Tracked whole tree: 3,347 files / 474,958,369 bytes at HEAD; Git history is additional.
Historical gallery/release-art mirrors: six files / 594,120 bytes.
These are GitHub tree sizes, NOT yet SHA-256-verified byte backups.

## Read-only SHA-256 inventory

From a complete local clone on the integration branch:

    node automation/audit-gallery-storage.cjs

No gallery content is modified. The script writes under .git/archive-storage-audit or STORAGE_AUDIT_DIR:
- inventory.json: exact tracked file sizes, SHA-256, categories, day counts, references and anomalies;
- gallery.sha256: one SHA-256 per tracked gallery file;
- SUMMARY.md: findings and missing-reference report.

Nonzero exit means invalid/missing references. This script does not upload anything or create a backup.
A complete checkout is required. Keep the inventory and exact source commit together.

## Dependencies that must be inventoried before any move

1. Dated originals, archive-preview mosaics, 3d WebP mobile and desktop textures, and portrait sculpture packs.
2. Gallery date pages, meta.json, social-meta.json, archive.json, tower-layouts.json, tower-geometry.bin.gz, RSS, sitemap, and thumbnail references.
3. Gallery 3D viewer, which parses dated HTML and only then resolves 3D manifest variants; address all readers through one compatible asset resolver.
4. Every Actions job that stages and commits gallery media (daily and social/material-specific). A single job change is insufficient.
5. Legacy release-art mirrors plus GitHub Release-hosted historic references; direct old Pages JPEG links must remain accessible.
6. Cloudflare Workers KV preview JPEGs and social state, monthly social Releases and their completion markers; these are distinct from the dated gallery.
7. Confluence full three-artist state, systems, individual settings, materials and palettes, not merely one seed.

## Proposed v2 manifest (Release A schema design only)

Keep all existing v1 fields and old URLs readable. Add immutable storage keys with per-asset byte counts,
SHA-256, image dimensions, MIME and source renderer revision. Include original JPEG, mobile/desktop WebPs,
preview, and sculpture pack where relevant. Preserve the full, original Confluence shared state
or a stable immutable snapshot identified by digest, including all three participating artists.
The edition manifest records exact expected entries, external keys, and an atomic published/not-published state.

Do not modify an existing key if its bytes differ; publish new revisions at new keys.
Ensure both old and new clients can decode the manifests during migration.

## R2 test storage — requires account connection and restricted credentials

Cloudflare R2 Standard is the proposed long-term media store, not confirmed provisioned.
Before uploading test objects, agree a stable public asset hostname, bucket access policy,
restricted Actions credentials, CORS for the GitHub Pages origin, MIME handling,
immutable caching, separate manifest caching, and backup/restore lifecycle.
Never ship an S3/R2 credential to client-side JavaScript.
The public service must not rely on a development-only storage hostname.

## Future production contract — NOT enabled in Release A

Generate edition in private staging, validate exactly 12 solo and 4 Confluence,
check 2 portrait / 2 landscape Confluence, full state, images, textures and sculpture mapping.
Checksum and upload all media, read back and verify before exposing the edition.
Only after successful complete verification publish pages/manifest and trigger site deployment.
Keep the prior edition public if any step fails; do not publish a partial day.
Social automation must consume canonical media and keep its existing per-platform
completion markers to avoid duplicate posting.
Dual-write is reversible and must pass seven consecutive days before moving read traffic.
Old direct Pages image URLs must remain reachable, even after new publication moves to R2.

## Rollback

- Upload failure: previous manifest stays live.
- Asset resolver failure: switch the read path back to verified legacy media.
- 3D lift failure: roll back gallery code separately from storage changes.
- Historical mismatch: quarantine new copy and leave original untouched.
- Never delete until independent offsite restore is proven byte-perfect.
- Never rewrite Git history as part of this migration.

## Release A completion criteria

[ ] Byte-level SHA-256 inventory from immutable checkout executed, not just scripted.
[ ] Legacy GitHub Release and Cloudflare KV preview inventories collected.
[ ] Independent offsite backup exists and isolated byte-perfect restore demonstrated.
[ ] URL inventory and preservation policy verified.
[ ] Versioned manifests and resolver compatibility test fixtures implemented.
[ ] R2 test bucket, secure credentials, CORS, domain and cache settings validated.
[ ] Isolated 16-work edition verified end-to-end (HTML, editor, WebGL textures, sculptures).
[ ] Desktop, Firefox, WebKit, Android and Quest 3 regression gates pass.
[ ] Rollback drill completed and evidence recorded.
[ ] Separate approval received before Release B or any production change.

This checklist is deliberately incomplete until each result is independently verified.
