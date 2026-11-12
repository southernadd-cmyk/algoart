# First R2-only gallery edition

An R2-only edition keeps its paintings, WebP textures, cover and social images in R2. Git receives the edition's HTML and JSON only. Unlike the canary in `r2-first-edition.md`, there is no Pages copy of the artwork to fall back to.

This runbook covers one manually published edition. It has not been rehearsed end to end; treat every step marked *untested* as a risk.

## Before the day

- The R2-only change is merged to `main` and its checks pass. The publisher only writes to R2 from `main`.
- `r2-first-edition.md` makes scheduled or external-only publishing subject to a seven-day dual-write gate. One canary edition (2026-11-11) has been published so far. Decide explicitly whether to waive the gate for this single edition.
- The artwork Worker `proportion-piece-media` serves `editions/<date>/social/…` keys. Check that this returns 200:
  `https://proportion-piece-media.mr-adam-clement.workers.dev/editions/2026-11-11/social/canary-d2bfff4b91fa31829a1d3e51419d6219974c502c653d486a9db66cca2de455ac.jpg`
- The Worker's source of record is `cloudflare/media-artwork/`. Cloudflare still has a build trigger that deploys `cloudflare/media-read-only/wrangler.toml` from the branch `plan/archive-storage-foundation-20261109`. A push to that branch would redeploy the old source and remove the social rule. Do not push to it; disable or repoint the trigger.
- The GitHub environment `archive-media-test` allows `main` and has no required reviewers. It holds the only copy of the R2 credentials.
- Pick an edition date after 2026-11-11 that has no `gallery/<date>/meta.json`. It must differ from `PP_R2_CANARY_DATE`.

## Arming

Set two repository variables:

- `PP_R2_ART_ONLY_DATE` = the edition date (London calendar day)
- `PP_R2_ART_ONLY_SOCIAL_READY` = `true`

While they are set:

- The 04:15 UTC scheduled build does not publish that date. It waits for the manual run. If no manual run succeeds, there is no edition that day.
- Social jobs for that date wait until the R2 edition is live.
- Every social job on `main`, for any date, runs in the `archive-media-test` environment.

Set them before 04:15 UTC on the edition date, or the scheduled legacy build will publish the date first and the R2-only path will then refuse it.

## Publishing

On the edition date, dispatch **Build ALGO ART daily gallery** on `main` with `date` = the edition date, `r2_art_only` = true and `r2_canary` = false. The date must be today in London. Start before the 09:00 social slot.

The run uploads and verifies the artwork in R2, checks the staged gallery and tower in Chromium, bakes and publishes the V2 sculptures, removes the local artwork files, refuses to commit if any image is staged, and then pushes.

A successful run leaves:

- one commit named `Publish R2-only ALGO ART daily gallery <date>` containing no image files
- `gallery/<date>/media-publication.json` with `published: true` and `pagesFallback: false`
- a passing "Verify the deployed canary and its social source" step

Check by hand, including on an iPhone (the automated checks are Chromium only): the date page, a full-size image, the archive cover, the tower floor and its sculptures, and one share link.

## Keeping the variables set

Leave both variables set until that day's 20:30 social slot has finished and its `done-<date>-…` markers exist on the monthly release. Each social job uploads its images to R2 the first time it runs for the date, and it only receives R2 credentials while both variables are set. Clearing them early makes the next first-time job fail. It fails without posting.

Clear both variables the next morning.

## If something fails

**The run fails before the push.** Nothing is in Git. R2 holds some immutable objects for the date; they are harmless and unreferenced. Dispatch the same run again on the same London day. The edition is generated from a date seed, so a rerun is expected to produce the same files, and identical objects are accepted as already uploaded. *Untested.*

If the rerun stops with `R2 daily object collision: manifest`, the regenerated sculpture data differs from the first attempt and the date's sculpture manifest in R2 blocks it. Stop. Do not delete R2 objects without deciding to; use the legacy fallback below instead.

**The R2-only run cannot be completed that day.** Clear `PP_R2_ART_ONLY_DATE`, then dispatch the daily workflow with `date` = the edition date and both flags false. This publishes the edition the legacy way, with artwork in Git. *Untested for this sequence.*

**The push succeeded but the live check failed.** Dispatch the daily workflow with `date` = the edition date and no flags. It finds the receipt and runs recovery: every R2 object is fetched and checked against its SHA-256, Pages is redeployed, and the live edition is verified. Recovery verifies; it does not repair.

**An R2 object is missing or corrupt after publication.** There is no copy in Git. Regenerating the artwork reproduces it visually, but the JPEG bytes are not guaranteed identical, so the SHA-addressed key may not match. This case has no recovery procedure. Until one exists, keep a copy outside R2 before relying on R2-only editions: `python3 automation/r2-daily-media.py restore gallery/<date>/media-publication.json --restore-to /tmp` rebuilds the dated files from verified Worker responses.

**A social post fails.** Social jobs fail without posting, and the `done-…` markers prevent duplicates on a rerun. Rerun a slot only on the same London day by dispatching **PROPORTION PIECE live social publishing** with that slot. After midnight the workflow acts on the next date; do not rerun then.

**Removing the edition entirely.** Revert the publish commit and deploy Pages. The R2 objects remain, so links already posted keep working. *Untested.*
