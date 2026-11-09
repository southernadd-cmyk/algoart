# First R2 gallery edition

The canary uses one new London edition. It keeps the original JPEGs, mosaics, WebP textures and sculpture packs in Pages as a rollback copy. The gallery and tower textures read the verified R2 URLs. The tower reads its sculpture pack from Pages. Social slots keep their normal timing and completion markers. The archived evening Threads highlight and the original Confluence image use the verified R2 JPEG. Confluence platform derivatives, independently generated social artwork and frozen queues use the existing Releases path.

## Before publishing

- Review the publisher integration run. The historical fixture checks the 16-work edition and rehearses a byte-identical rollback. The first new edition should have 14 works and 44 media objects.
- Chromium checks replay against the original archive JPEGs. The WebKit archive check reports Confluence raster differences and checks repeat rendering. The gallery and tower test loads the same original media in both browsers.
- Use the existing media bucket and Worker. In the GitHub environment `archive-media-test`, add `main` to the allowed deployment branches alongside the rehearsal branch. The canary uses the existing bucket-scoped `R2_ACCOUNT_ID`, `R2_MEDIA_ACCESS_KEY_ID` and `R2_MEDIA_SECRET_ACCESS_KEY`.
- After Release B is approved, set the repository variable `PP_R2_CANARY_DATE` to an unpublished London date. On that date the scheduled job waits for an operator to dispatch **Build ALGO ART daily gallery** on `main` with that date and `r2_canary` enabled. Start before the first social slot.

The job validates the full edition before uploading. It uses conditional writes, verifies Worker GET and HEAD responses, and opens the staged gallery and tower before pushing. Pages then deploys both the legacy edition commit and the R2 read switch together. The post-deploy smoke test repeats the gallery and tower checks without substituting responses. Social jobs wait for the Pages edition and use the existing platform completion markers.

## Recovery and rollback

For a published R2 date, dispatch the daily workflow with its date. It checks the frozen manifest, local media bytes and public Worker responses before redispatching Pages. Recovery preserves the original JPEGs and share state.

To rehearse a media restore, run `python3 automation/r2-daily-media.py restore gallery/YYYY-MM-DD/media-publication.json --restore-to /tmp`. This reconstructs the original dated file paths in a fresh directory from Worker responses verified against the archived SHA-256 hashes.

If the live smoke test fails after the push, revert only the commit named `Serve YYYY-MM-DD daily gallery media from R2`, then deploy Pages. That restores the local edition and keeps the preceding gallery publication commit. Clear `PP_R2_CANARY_DATE` to resume the normal path. Check the date page, archive mosaic, tower, and a direct image URL after the revert. Keep the immutable R2 objects so social links already published continue to resolve.

After a successful canary, clear the date variable and review the live checks, including the lift on Quest 3. Scheduled or external-only publishing is a later change subject to the seven-day dual-write gate.
