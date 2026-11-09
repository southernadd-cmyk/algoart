# No-domain Cloudflare R2 delivery for PROPORTION PIECE — DRAFT ONLY

Decision context (9 November 2026): no Cloudflare-managed custom domain; avoid purchasing one and avoid any new R2 bucket or second backup provider.

## Proposed public URL

Use an isolated, read-only Cloudflare Worker named proportion-piece-media on the built-in workers.dev hostname, backed by the EXISTING R2 bucket proportion-piece-media-test. This is a new Worker script, **not another bucket or storage service**.

URL format: https://proportion-piece-media.ACCOUNT-SUBDOMAIN.workers.dev/editions/...
The real account subdomain must be read from the Cloudflare dashboard or Wrangler output; never guess a permanent URL.

The separate source files are:
- cloudflare/media-read-only/src/worker.mjs
- cloudflare/media-read-only/wrangler.toml
- tests/r2-media-worker.test.mjs

The Worker exclusively binds R2 bucket proportion-piece-media-test as MEDIA. Never bind the private proportion-piece-archive-test recovery bucket. It is separate from the existing proportion-piece-social Worker and the root wrangler.toml.

It permits GET and HEAD of correctly formed SHA-256-addressed edition JPEG/WebP/PNG/sculpture assets; no PUT, POST, DELETE, file listing or hidden backup keys. Error responses are non-cacheable. Immutable assets have 1-year cache headers. CORS permits only https://southernadd-cmyk.github.io. Workers Cache is supported by Cloudflare's workers.dev routing with Wrangler 4.69.0 or above.

Cloudflare's workers.dev routing is intended for hobby and personal projects, not business-critical SLA applications. Workers Free currently has a limit of 100,000 requests/day across the account. R2 usage and operations have their own billing limits. Consider a proper domain if site scale/reliability requirements change.

## Completed — no deployment

GitHub Actions offline safety run: https://github.com/southernadd-cmyk/algoart/actions/runs/42635044650
Result: all 10 tests passed; no cloud credentials or R2 objects used, no Cloudflare deploy, no GitHub Pages or social Worker change.

The historic edition migration and actual phi tower R2 development-URL browser checks also passed; this is additional evidence, not a production switch.

## Next permitted stage, after separate authorisation

1. Create a separate Cloudflare Worker named proportion-piece-media and bind the existing public-media bucket only. Do NOT replace the social-preview Worker.
2. Deploy with an authenticated Wrangler account or a narrowly scoped Cloudflare Workers API token (not the existing R2 S3 key). For example, from repository root: npx wrangler@latest deploy --config cloudflare/media-read-only/wrangler.toml. This is an instruction, NOT an action taken.
3. Read the actual workers.dev URL assigned to the Worker.
4. Upload one or two disposable media files under valid immutable editions/... keys; verify public GET, HEAD, MIME, SHA-256, exact CORS and Edge Cache HIT/MISS at the real Worker URL; delete only the temporary files.
5. Re-run the actual phi gallery R2 browser integration with the new Worker URL; test social previews and actual Quest 3 hardware when possible.
6. Only after explicit separate approval, update future daily publishing to use immutable R2 URLs. Do not delete historical GitHub Pages JPEGs or break old links.

The user has not authorised live media traffic switching, historical deletion, new billing commitments, or merging draft PR #256.

## Rollback

Revert or disable the standalone media Worker without touching gallery source files. Published historical GitHub image links remain intact. No new publishing workflow is activated by this plan.
