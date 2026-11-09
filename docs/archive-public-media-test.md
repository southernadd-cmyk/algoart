# Release A — isolated public R2 media-delivery test

**Status:** offline harness self-test passed. Real public R2 and browser checks have NOT run.

**Issue:** https://github.com/southernadd-cmyk/algoart/issues/255

## Storage isolation

- PRIVATE backup bucket: proportion-piece-archive-test — NEVER enable public access or re-use its access token.
- NEW media-only scratch bucket: proportion-piece-media-test — must start EMPTY; only this bucket may have a public development URL for test images.

The existing private bucket holds retained repository, GitHub Release, and KV preview backup material. This distinction is a hard safety gate.

## Cloudflare setup

1. Create a new Standard R2 bucket named proportion-piece-media-test. Leave it EMPTY.
2. Create a new Account R2 API token granting Object Read & Write access ONLY to the new media bucket. Save its new S3-compatible Access Key ID and Secret Access Key securely.
3. On the NEW media bucket only, in Settings > CORS Policy, use this JSON:

    [
      {
        "AllowedOrigins": ["https://southernadd-cmyk.github.io"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": [],
        "ExposeHeaders": ["Content-Type", "Content-Length"],
        "MaxAgeSeconds": 3600
      }
    ]

The origin MUST NOT include a trailing slash or /algoart. Never use wildcard * as an allowed origin.

4. On the NEW bucket, Settings > Public Development URL, enable it and copy the base URL beginning with https://pub- and ending with .r2.dev. This URL is for testing only, and is rate limited. DO NOT enable this on the PRIVATE backup bucket.
5. In the GitHub repository Settings > Environments, create NEW environment archive-media-test restricted to the single planning branch plan/archive-storage-foundation-20261109. Do not reuse the backup environment archive-r2-test.
6. Under the new environment's SECRETS, save:
   - R2_ACCOUNT_ID — existing Cloudflare 32-hex-character account ID
   - R2_MEDIA_ACCESS_KEY_ID — NEW media-only R2 Access Key ID
   - R2_MEDIA_SECRET_ACCESS_KEY — NEW media-only R2 Secret Access Key
7. Under the new environment's VARIABLES, save:
   - R2_MEDIA_PUBLIC_URL — NEW bucket's https://pub-....r2.dev public origin, no trailing slash.

Do not share credentials in chat, CI logs, artifacts, files or issue comments.

## The planned one-shot test

Workflow: .github/workflows/r2-public-media-test.yml
Upload and cleanup: automation/r2-public-media-smoke.py
HTTPS/CORS/browser check: automation/test-public-r2-media.py

An isolated-branch workflow will require an explicit one-shot trigger; no schedules.
The media-only upload phase refuses nonempty buckets, refuses any bucket other than proportion-piece-media-test, and stages seven real published 9 November image files:

- C01 Confluence portrait original JPEG, 1100px WebP and 640px WebP
- C02 Confluence landscape original JPEG and 640px WebP
- G08 Action original JPEG and 1100px WebP

For every staged object, the public HTTP test checks 200 status, correct image MIME, exactly matching bytes and SHA-256, and precise CORS from the GitHub Pages origin. A different origin must not be granted CORS access.

The browser phase opens the live but UNMODIFIED GitHub Pages dated-gallery page and checks anonymous CORS fetch, image decode and WebGL texture upload in Chromium, Firefox and WebKit. Chromium WebGL uploads are required; other browsers report texture availability.

Every temporary test object is removed and absence-verified, including on failed tests. The original images remain untouched. No backup bucket API call is made. No Worker or GitHub Pages deployment occurs.

## What a passing test would prove (and what it would not)

- Proves exact image bytes, public HTTPS delivery and development-host CORS/texture loading, with zero production changes.
- Does NOT verify a future production CUSTOM DOMAIN, CDN caching, Quest 3 real hardware, retention or any actual production switch.
- A public r2.dev URL remains development-only; do not use it in permanent manifests.
- A passing test does not authorise Release B.

## Outstanding independent recovery gate

Current retained R2 backups are provisional because future production images may also live at Cloudflare. Before moving production or deleting originals, independently preserve and restore all archive assets outside this Cloudflare account/provider: complete repository Git history, published image files, GitHub Release media and actual Workers KV preview bytes. GitHub Actions artifacts with 30-day expiry are not independent disaster-recovery backups.
