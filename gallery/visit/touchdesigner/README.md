# PROPORTION PIECE — The Translation Room (TouchDesigner Phase 1)

**Status: TouchDesigner export pending.** Three test reception monitors work, but an actual TouchDesigner movie has **not** yet been rendered or published. The first monitor displays a real source painting; the other two retain lightweight previews.

## Source and translation

Source: Golden Trajectories — Oil Paint Study 14, 27 October 2026, seed OL-20261027-02-57201. Full parameters, file paths and the reproducible editor link are in [phase-one.json](phase-one.json).

The horizontal triptych is SOURCE → TRANSLATION → EMERGENCE.

- Left: actual source artwork, unchanged.
- Middle: TouchDesigner Edge TOP reveals contours while retaining the source.
- Right: Noise, Displace, Feedback, Transform, Level and Composite TOPs create a moving second interpretation.

## Produce the authentic TouchDesigner export

1. Start TouchDesigner on a Windows computer and create a Text DAT in /project1.
2. Paste and execute [build_translation_room.py](build_translation_room.py) using **Run Script**. It creates /project1/pp_translation_room containing the TOP network.
3. Check source_golden_trajectories loads the published JPEG. If HTTPS access fails, download the source image URL given in the script and set the Movie File In TOP's File parameter to that local JPEG.
4. Inspect triptych_1152x240. Ensure all three panels display properly, with evolving output on panel 3. The network builder has not been executed here because TouchDesigner is not installed in this environment; inspect parameter warnings in the Textport and make any TD-version-specific adjustments in the network.
5. Set timeline to 24 fps. Configure moviefileout1 for VP9, WebM, 1152 × 240 and record about 20 seconds. If encoding drops frames, turn off Realtime for offline rendering.
6. Verify locally in Chrome that the resulting silent WebM has exactly 1152 × 240 pixels, three 384 × 240 panels and a clean loop.
7. Upload the binary file as phase-one-triptych.webm into this directory; only then change the status in phase-one.json from awaiting-touchdesigner-export to published and deploy.

TouchDesigner Non-Commercial's published resolution limit is 1280 × 1280, so the full triptych fits. VP9/WebM is the intended browser-compatible route; H.264 in TouchDesigner can require a paid licence and suitable hardware. Review licence conditions before exhibiting.

## Runtime in the test tower

The site does not execute TouchDesigner. Its test-only three-monitor player uses a single VideoTexture and crops it into three panels. It fetches the media manifest only when a visitor comes near the backroom, never during startup, and pauses video out of range. Until a valid export exists, procedural art remains visible. Missing, malformed or unplayable media must not prevent entry.

Inspect the developer-console object window.__phiLivingMonitorDiagnostics.media to see playback status. Typical states: fallback, checking-export, awaiting-export, loading-export, export-ready and playing-export.

Test with Node:
- node --test tests/phi-touchdesigner-phase-one.test.mjs tests/phi-reception-refresh.test.mjs
- Browser CI: tests/phi-public-entry.test.mjs

**Phase 1 completion criteria:** the actual TD-created WebM is uploaded; browser shows playing-export and three distinct video panels; load/movement performance is preserved; live gallery remains untouched.

No synthetic binary TouchDesigner project has been passed off as a .toe or .tox. The Python Text DAT is a portable builder for making the actual TD network.
