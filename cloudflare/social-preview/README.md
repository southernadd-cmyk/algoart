# PROPORTION PIECE · Cloudflare social preview

A separate Cloudflare Worker for the site's social-preview endpoints. Does **not** replace the ChatGPT composition MCP plugin. Never deploy the repository root as a Worker.

## Cloudflare setup

1. Create a Cloudflare R2 bucket named `proportion-piece-previews` (R2 may require billing setup).
2. In Workers & Pages, connect `southernadd-cmyk/algoart`. Use project name `proportion-piece-social`.
3. Set **Root directory** to `cloudflare/social-preview` if the dashboard offers the setting. Use deploy command `npx wrangler deploy` and leave build blank; if these controls are unavailable, do not click Deploy until the configuration is verified.
4. Bind R2 `ARTWORK_PREVIEWS` to `proportion-piece-previews`, either from the checked-in wrangler.toml or dashboard bindings. No secrets should be shared in chat.
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
