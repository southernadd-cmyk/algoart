# Retired one-off ALGO/ART social workflows

These files are preserved for historical reference only. They are **not**
GitHub Actions workflows while outside `.github/workflows/`.

Retired on 2026-10-12 after V8, because they target historical V3/V4/V6
test batches, the October 2026 launch backfill, and a one-off upgrade burst.
Some of them published real Instagram/Threads/Bluesky posts or updated the
gallery. Keeping them executable would risk accidental duplicate or obsolete
social posts when manually dispatched or when a trigger file changes.

The active landscape publisher remains `social-live.yml`, with
`portrait-live.yml` called from it; current gallery generation remains in
`gallery-daily.yml`. This archival change does not modify those systems.

Do not move an archived file back into `.github/workflows/` without
reviewing its secrets, release markers, renderer version, dates and
live-publishing safeguards. Git history also preserves the original files.
