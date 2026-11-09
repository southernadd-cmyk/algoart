# PROPORTION PIECE — Release B media cutover design (DRAFT ONLY)

**Status:** proposal, NOT deployed, NOT approved for production changes.
**Updated:** 9 November 2026
**Tracking:** https://github.com/southernadd-cmyk/algoart/issues/255
**Work branch:** plan/archive-storage-foundation-20261109

## Decisions, in force

- Reuse existing **public media** R2 bucket: `proportion-piece-media-test`. The name is cosmetic.
- Keep `proportion-piece-archive-test` **PRIVATE**. Never grant it a public domain, media worker token, or media CORS policy. Retain verified existing recovery snapshots.
- No new bucket or second backup provider.
- Procedural preservation is primary: keep complete artist seed/settings, Confluence `?s=` state, renderer code and historical versions in GitHub. The full 564-work Chrome audit passed; JPEG byte-for-byte reconstruction is NOT established.
- Historic GitHub Pages **media URLs must keep resolving**; do not delete historic originals or rewrite old public share links.
- All changes in this plan are proposed; the current GitHub Pages site, 3D tower bundle and daily publishing job remain untouched.

## Cloudflare custom domain (user-owned zone required)

The R2 development `.r2.dev` origin is rate-limited and has no standard Cloudflare cache controls. Do not use it in future permanent media URLs.

A custom media hostname, e.g. `media.<zone-owned-by-user>`, must be a subdomain of a Cloudflare-managed zone **in the same account** as the existing R2 media bucket. Do not use an unrelated domain, an unowned domain, a CNAME to `.r2.dev`, or the `southernadd-cmyk.github.io` hostname, which belongs to GitHub.

Dashboard: **Storage & databases → R2 → proportion-piece-media-test → Settings → Custom Domains → Add → choose hostname → review generated DNS record → Connect Domain**. Wait for Active.

The zone/domain choice is user-specific and pending confirmation. Do not infer an available hostname or alter DNS automatically.

**After connecting, before storing any permanent media:**
- Verify HTTPS GET, HEAD and correct MIME for real test objects through the custom domain, exact SHA-256 and the allowed GitHub Pages origin CORS.
- Verify browser Image.decode, WebGL texture uploads and actual phi tower 3D painting loads from the custom domain.
- Configure Cloudflare caching for immutable SHA-addressed media only (e.g. `editions/*`), with suitable response Cache-Control and CDN cache rules. Treat manifests as mutable and do not cache them indefinitely.
- Verify cache HIT after warm-up; verify miss/initial request; establish purge strategy for non-immutable URLs and WAF/security behavior.
- Check R2 billing and object count before enabling scheduled uploads.
- Disable the `.r2.dev` development URL after the production custom domain is working if its public route is no longer wanted.

## Current production data flow (verified against .github/workflows/gallery-daily.yml)

1. Generate 12 solo and 2 Confluence daily studies (9 Nov special case: 12+4).
2. Build gallery daily HTML/metadata, social metadata, archive index.
3. Build daily archive preview, 3D WebPs and compressed portrait sculptures.
4. Rebuild tower bundles and verify gallery.
5. Commit the whole `gallery/` tree to `main` and run Pages deployment.
6. Existing social publishing uses the committed image/URL contracts.

**Do not insert a network upload ahead of the final gallery generation, or publish pages before public R2 images are verified.**

## Safe desired new daily sequence (requires separate Release B approval)

1. Generate **all** artwork in the Actions workspace, with no site changes.
2. Freeze the edition manifest: 12 solo + 2 Confluence; preserve every full seed/version/state, `shareUrl`, image identifier and artwork ordering.
3. Produce optimized 3D WebP variants and sculpture polygon pack. Validate exactly one portrait sculpture per portrait artwork and complete 3D texture variants.
4. For each asset, compute SHA-256, bytes, MIME, dimensions and immutable object key; propose v2 manifest using existing `automation/propose-gallery-manifests.cjs` as foundation.
5. Put all media to the PUBLIC media bucket with scoped credentials, setting correct Content-Type and immutable Cache-Control; **never** modify the private backup bucket.
6. HEAD every uploaded key; fetch through the **custom domain** and independently compare byte length and SHA-256. Abort the day without publishing if any item fails. Keep the prior published day untouched.
7. Render gallery HTML, OpenGraph, RSS, archive index and 3D manifests that point to verified stable custom-domain media URLs, preserving the editor/share destinations unchanged.
8. Run actual browser loading checks for 2D images and phi tower art/sculptures, including CORS and no fallback image failures.
9. Commit **HTML, JSON, renderer source, procedural state, manifests and other non-reproducible source only** to GitHub main. Do not commit new daily JPEG/WebP/generated sculpture assets once the migration is approved.
10. Trigger Pages deployment. Only after Pages is healthy, allow pre-existing social distribution schedules to use the new daily media URLs.
11. A failed R2 upload or browser check must abort before the GitHub commit; make every upload idempotent (content-addressed keys, never overwrite changed bytes under an old key).

## Gallery and tower asset resolution

The live phi tower currently:
- Fetches `gallery/YYYY-MM-DD/index.html` and `gallery/YYYY-MM-DD/3d/manifest.json` relative to GitHub Pages.
- Parses `article.art-card img.src` as original artwork URL; uses filename to look up desktop/mobile `3d/manifest.json.images[filename]`.
- Resolves an optimized texture URL using `new URL(variant, editionUrl)`, which naturally accepts an absolute custom-domain URL.
- Fetches `gallery/YYYY-MM-DD/3d/sculptures.json.gz` from the **same-origin** GitHub Pages path; this loader needs an explicit cross-origin media URL strategy (or keep the small pack at GitHub) before sculpture packs can be moved.

The one-edition R2 rehearsal already proved all 50 asset bytes and cross-browser image texture loading. The `automation/test-r2-real-tower-integration.py` experiment exercises the **actual phi tower bundle** by modifying responses only inside Playwright. It is not a deployed feature or a new permanent resolver.

## Backward compatibility

Historical `southernadd-cmyk.github.io/algoart/gallery/YYYY-MM-DD/*.jpg` URLs cannot be transparently redirected at GitHub's domain by changing Cloudflare DNS. Keep them accessible indefinitely or separately design a truthful compatibility mechanism. The first production migration should affect **future** editions only.

Social preview images, OpenGraph and RSS should use the permanent custom domain only after that URL is tested and stable. Account for Cloudflare KV preview and GitHub Release media paths separately; no release or KV deletions.

## Rollback

- Before first production cutover, preserve last known-good workflow commit and static web source.
- No historical image deletion; current historical paths continue resolving.
- Roll back the daily publication switch by restoring the old workflow code **without deleting any media**. Existing R2 object keys remain immutable.
- If R2 upload fails **before** GitHub publish: abort and keep live previous state, no broken image URLs.
- If Cloudflare custom-domain availability fails **after** Pages publish: restore previous HTML/manifest source and stop subsequent daily R2 commits; retain uploaded R2 objects for forensics.
- Run a controlled canary edition first with actual live browser, social preview and Quest 3 checks before switching scheduled daily publishing.

## Outstanding gates

- [x] 564/564 procedural reproductions visually matched in Chromium.
- [x] 50/50 test-media bytes, MIME, CORS, Chromium & WebKit WebGL image upload and 3-browser 2D gallery.
- [ ] Verify actual phi tower bundled loader via browser-only R2 substitution.
- [ ] User selects a domain in an eligible Cloudflare zone; connect it to existing public media bucket.
- [ ] HTTPS custom-domain CDN, cache behavior, WAF and CORS check.
- [ ] Decide whether tower sculpture packs stay in GitHub or gain a new public R2 resolver.
- [ ] Test production publisher switch on staging branch, no live changes.
- [ ] Explicit separate user approval for Release B / production publishing switch.
