# PROPORTION PIECE · Cloudflare social preview

A separate Cloudflare Worker for the site's social-preview endpoints. Does **not** replace the ChatGPT composition MCP plugin. Never deploy the repository root as a Worker.

## Cloudflare setup

1. Under **Storage & databases → KV**, create a Workers KV namespace named `proportion-piece-previews`. Workers KV is included on the free plan; R2 billing activation is not required.
2. In Workers & Pages, connect `southernadd-cmyk/algoart`. Use project name `proportion-piece-social`.
3. Set **Root directory** to `cloudflare/social-preview` if the dashboard offers the setting. Use deploy command `npx wrangler deploy` and leave build blank; if these controls are unavailable, do not click Deploy until the configuration is verified.
4. Replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml` with the actual namespace ID (this is a resource identifier, not an API token). Bind `PREVIEW_KV` to `proportion-piece-previews` if configuring through the dashboard. Never share API secrets.
5. Deploy only after the Worker files are on the selected deploy branch. Visit `/health` at the actual workers.dev address.

## API

- `POST /share/preload?c=TOKEN` from the published site (Origin allowed: https://southernadd-cmyk.github.io). JSON body `{"jpeg":"BASE64"}`; JPEG dimensions 1200×630, max 285 KB.
- `GET /share?c=TOKEN[&pv=2]` Open Graph HTML for a specific piece.
- `GET /share/image?c=TOKEN` stored image or 404 until a JPEG is uploaded.
- `GET /health` health probe.

The existing renderer-based image fallback cannot run in this Worker: the editor must upload JPEGs before shares. No deployment or website URL change happens merely by adding these files.

## Security/retention

Uploads are size- and format-limited; CORS restricts browser access to the published GitHub Pages origin. **Origin is not authentication.** Before public production use, add durable per-IP abuse controls (for example Cloudflare WAF/rate limits) and storage retention; do not assume this Worker includes robust anti-abuse protections. Avoid storing secrets in the repository.

Old Render-hosted links will remain unavailable unless the old hostname is recovered or redirected.


## Free-plan limits
Workers KV Free currently includes 1 GB total storage, 1,000 key writes/day and 100,000 reads/day. When free operation limits are exhausted, KV operations fail rather than automatically incurring overage charges. Set retention/cleanup plans before 1 GB is used, and expect eventual consistency on newly uploaded images. This avoids the R2 billing activation step. See https://developers.cloudflare.com/kv/platform/pricing/.
