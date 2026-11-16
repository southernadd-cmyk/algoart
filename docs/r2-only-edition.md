# R2-only gallery editions

An R2-only edition keeps its paintings, WebP textures, cover and social images in R2. Git receives the edition's HTML and JSON only. Unlike the canary in `r2-first-edition.md`, there is no Pages copy of the artwork to fall back to.

Since 15 November 2026 every new daily edition is R2-only automatically. This runbook covers how editions get published, how to recover them, and how to roll back. Steps marked *untested* have not been rehearsed.

## Which editions are stored where

| Date | Storage |
|---|---|
| 2026-11-11 | R2 canary with a Pages copy (`pagesFallback: true`) |
| 2026-11-12, 2026-11-14 | Legacy: artwork in Git |
| 2026-11-13, 2026-11-15 onward | R2-only (`pagesFallback: false`) |

`gallery/<date>/media-publication.json` is the receipt. If it exists, the edition's media is in R2.

## How a day gets published

The edition must be live before the 09:00 London social slot.

1. **Cloudflare fallback Worker** (`automation/cloudflare-gallery-fallback/`), 04:30, 06:30 and 08:30 UTC. This is the trigger that actually fires on time: GitHub's scheduled runs have been arriving 6–8 hours late. It does one of the following:
   - No edition on `main`: dispatches the gallery workflow.
   - Edition committed but Pages not serving it, R2 receipt present: dispatches the gallery workflow with `date`. That runs the recover job: it verifies every R2 object, redeploys Pages and waits for the live page.
   - Edition committed but not live, no receipt (legacy): dispatches **Deploy Pages**.
   - Edition live, or a gallery/Pages run already active: does nothing.
2. **GitHub schedules** (04:15, 06:15, 08:15 UTC, usually late). They follow the same rule: they stand down only when Pages serves `gallery/<date>/meta.json`. Otherwise they recover (R2 receipt) or redeploy Pages (legacy).
3. **Social slots** wait up to 12 minutes for the edition on latest `main`. A slot that still finds no edition fails without posting.
4. **Social catch-up.** When the gallery build, recovery or redeploy makes today's edition live, it re-dispatches the most recent social slot that is already due and has no `done-<date>-…slotN-…` marker. Only that one slot is caught up, only on the same London day, and only when no social run is active. Earlier missed slots are not posted.

## Backups

Each R2-only build uploads two Actions artifacts:

- `r2-edition-backup-<date>`: an exact-byte ZIP of every painting, texture and cover object
- `r2-v2-backup-<date>`: the Sculpture V2 source packs

They expire after **90 days**. Current expiry dates:

| Edition | Run | Expires |
|---|---|---|
| 2026-11-13 | 43334480634 | 2027-02-11 |
| 2026-11-15 | 43706016542 | 2027-02-13 |
| 2026-11-16 | 43827853305 | 2027-02-14 |

Copy them somewhere outside GitHub and R2 before they expire:

```bash
gh run download <run-id> -R southernadd-cmyk/algoart -n r2-edition-backup-<date> -D backups/<date>
gh run download <run-id> -R southernadd-cmyk/algoart -n r2-v2-backup-<date> -D backups/<date>
```

The automated repair (below) restores painting, texture and cover objects only. Sculpture and social-image restoration are not automated.

## If something fails

**The build fails before the push.** Nothing is in Git. R2 may hold some immutable objects for the date; they are harmless and unreferenced. Dispatch **Build ALGO ART daily gallery** again with no inputs on the same London day. The paintings come from a date seed and are expected to be byte-identical on a rerun. The sculpture bake is **not** byte-identical, so a rerun after the sculpture manifest was written stops with `R2 daily object collision: manifest`. Stop then, and use the legacy rollback below. Don't delete R2 objects.

**The push succeeded but the edition is not live.** The fallback Worker and the scheduled runs now repair this automatically. To do it by hand, dispatch the gallery workflow with `date` = the edition date and no other inputs. It verifies each R2 object against its SHA-256, redeploys Pages, verifies the live edition, then catches up a missed social slot. Recovery verifies; it does not repair objects.

**A day was missed entirely (no `meta.json`), and it is now a later day.** Dispatch the gallery workflow with `date` = the missed date and no flags. Within 7 days of the missed date, this publishes it R2-only. The R2 guards accept a past date only for this dispatch (`R2_RECOVERY_DATE`). Social posts for a past date are not made. *Untested.*

**Roll back to the legacy Git-backed path for a day.** Dispatch the gallery workflow with `date` = the edition date and **`legacy_fallback` = true** (other flags false). The date must not already have a `meta.json`. The artwork goes into Git as before 13 November. Social slots for that date accept a legacy edition: they find `meta.json` without a receipt on `main` and publish via the old GitHub Release hosting. Clearing repository variables is **not** needed and is **not** enough on its own: without `legacy_fallback`, a new same-day edition is always R2-only. *Untested.*

**A painting, texture or cover R2 object is missing after publication.** Dispatch the gallery workflow with the published `date`, both R2 flags false, and `r2_restore_run` = the numeric Actions run ID of the original publication (see the backup table). The repair job downloads `r2-edition-backup-<date>` and checks it against the published receipt. It then writes **only missing keys**, using conditional writes, verifies each one and checks the live gallery. It never overwrites or deletes an existing object. This only works while the backup artifact still exists.

To inspect a downloaded ZIP without R2 credentials: `python3 automation/r2-edition-backup.py verify --receipt gallery/<date>/media-publication.json --archive edition-<date>.zip`. To extract verified bytes outside Git: `restore --receipt ... --archive ... --to /tmp`. Never extract an untrusted archive into the repository.

**An existing R2 object is corrupt.** Repair fails closed rather than replacing a SHA-addressed immutable URL that may be cached. Preserve the backup and investigate the object and cache explicitly.

**A social post fails.** Social jobs fail without posting, and the `done-…` markers prevent duplicates on a rerun. Rerun a slot only on the same London day by dispatching **PROPORTION PIECE live social publishing** with that slot. After midnight the workflow acts on the next date, so don't rerun then.

**Removing an edition entirely.** Revert the publish commit and deploy Pages. The R2 objects remain, so links already posted keep working. *Untested.*

## Repository variables

`PP_R2_ART_ONLY_DATE` and `PP_R2_CANARY_DATE` only matter for the manual armed paths (`r2_art_only` / `r2_canary` inputs) and for the social wait. Daily R2-only publishing doesn't use them. Leave `PP_R2_ART_ONLY_DATE` empty unless you are arming a manual edition. While it equals a date, the scheduled build for that date is held.
