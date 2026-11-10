# Independent website deployment — PROPORTION PIECE CANARY ONLY

**Never alter the live GitHub Pages URL, `proportion-piece-social` Worker, social-preview KV, R2 media Worker, or the 11 November R2 canary.**

The site already has Cloudflare Git integration for its **existing social-preview Worker** and scoped R2 credentials for gallery media. Neither is a reusable GitHub Actions `CLOUDFLARE_API_TOKEN`. The first version of this experiment tried a GitHub Actions Wrangler deploy and incorrectly treated a missing token as a missing Cloudflare connection. That deployment step has been removed.

## What this branch prepares

- `cloudflare/web-canary/wrangler.toml` declares an entirely different Worker, `proportion-piece-web-canary`, with static assets under `/algoart/`.
- `bash cloudflare/web-canary/build.sh` rebuilds gallery bundles, validates the archive, packages the **same public site tree** used by GitHub Pages, and rejects missing routes or oversized assets.
- The GitHub Actions **canary preflight** runs the build without Cloudflare secrets or a deployment, and does not change `main`.

## Use the existing Cloudflare ↔ GitHub account connection

Cloudflare still requires a **separate Worker project** to be registered once. Linking a GitHub repository to one Worker does not automatically create another Worker. In Cloudflare Workers & Pages, create a **new** project named exactly `proportion-piece-web-canary` using the existing connected `southernadd-cmyk/algoart` repository (do **not** select the existing `proportion-piece-social` Worker). Set:

| Setting | Exact value |
| --- | --- |
| Repository | `southernadd-cmyk/algoart` |
| Production branch (isolated preview, NOT site main) | `experiment/cloudflare-static-assets-canary-20261110` |
| Root directory | repository root `/` |
| Build command | `bash cloudflare/web-canary/build.sh` |
| Deploy command | `npx wrangler@4 deploy --config cloudflare/web-canary/wrangler.toml` |
| Public route | workers.dev ONLY; **no custom domain**, no Pages redirect |

Cloudflare Workers Builds then authenticates through its existing Git connection; **no new GitHub token is needed**. Do not merge this experimental config into `main` or connect the existing social Worker to its Wrangler file.

## Acceptance before a cutover

1. Compare the canary HTML/CSS/JS (home, editor, gallery index, daily editions, Confluence, 3D tower, Sculpture Lab) with Pages, including archived `?s=` share links.
2. Confirm 3D media, sculptures, fonts, audio, and video playback across desktop Chrome, mobile Chrome, and Safari, especially `Range` requests for streamed media (Workers Static Assets do not support byte ranges directly; this may require R2-served media or a byte-range handler).
3. Run same-origin fetches, worker asset URLs, full browser smoke tests, hash/version checks, cache invalidation tests, and a one-file incremental deploy; measure actual changed assets uploaded.
4. Observe the next daily edition and R2 canary separately with NO publication-side change or new publishing trigger.
5. Only after verified parity, design a phased route migration with immediate rollback to the existing GitHub Pages site. **Never delete archived media or replace the live social Worker.**

No public hosting migration has been executed.
