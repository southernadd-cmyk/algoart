# Independent daily gallery safety net (Cloudflare Worker)

This **live cron-only Worker** is separate from the existing R2 media
Worker. It uses GitHub's official `workflow_dispatch` API rather than modifying
or committing a trigger comment. Deployment and scheduled triggers were
verified on 16 November 2026 in
[GitHub Actions run 43835111399](https://github.com/southernadd-cmyk/algoart/actions/runs/43835111399).

## Deployment and maintenance

GitHub Actions deploys the isolated Worker through
[`deploy-gallery-fallback-worker.yml`](../../.github/workflows/deploy-gallery-fallback-worker.yml).
The deployment uses the existing `archive-media-test` Cloudflare credentials
and the `GALLERY_DISPATCH_TOKEN` environment secret to bind a Worker secret
named `GITHUB_TOKEN`. Do not commit token values or put them in
`wrangler.toml`. To redeploy, manually run the deployment workflow; no
existing media Worker is modified.

The cron runs at 04:30, 06:30 and 08:30 **UTC**. It checks today's date in
Europe/London and `gallery/YYYY-MM-DD/meta.json` on current main:

- **Absent**, and no gallery run active: dispatches the gallery workflow.
- **Committed and served by Pages**: does nothing.
- **Committed but not live**, and no gallery or Pages run active: with an R2
  receipt it dispatches the gallery workflow with `date` (recover job:
  verify R2, redeploy Pages, wait for the live page, catch up social); without
  a receipt (legacy edition) it dispatches `deploy-pages.yml`.

The GitHub workflow performs its own second latest-main safety check. The
token needs `actions: write` for both workflows.

The GitHub 04:15 / 06:15 / 08:15 scheduled triggers remain as additional
fallbacks. Cloudflare scheduled-event logs can verify future executions.

To test locally without dispatching anything:
`node --test src/index.test.mjs`.
