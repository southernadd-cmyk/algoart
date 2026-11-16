# Independent daily gallery safety net (Cloudflare Worker)

This is an **optional cron-only Worker**, separate from the existing R2 media
Worker. It uses GitHub's official `workflow_dispatch` API rather than modifying
or committing a trigger comment. Nothing here runs until deployed to Cloudflare.

## Activate

From this folder, authenticate Wrangler to the Cloudflare account that will
host the cron Worker, then run:

```sh
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

The secret must be a fine-grained GitHub token for
`southernadd-cmyk/algoart` with **Contents: read** and **Actions: read/write**
permissions. Never commit the token or put it in `wrangler.toml`.

The cron runs at 04:30, 06:30 and 08:30 **UTC**. It checks today's date in
Europe/London, checks `gallery/YYYY-MM-DD/meta.json` on current main, and
checks for active gallery runs. Only when the edition is absent **and** no
gallery workflow is active will it call `workflow_dispatch` on `main`.
The GitHub workflow performs its own second latest-main safety check.

Deployment is **not** part of this repository change: Cloudflare authentication
and the GitHub token must be configured in the Cloudflare account. The GitHub
04:15 / 06:15 / 08:15 scheduled triggers remain as additional fallbacks.
Check Cloudflare scheduled-event logs after deployment.

To test locally without dispatching anything:
`node --test src/index.test.mjs`.
