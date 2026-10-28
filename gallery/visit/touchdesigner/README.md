# PROPORTION PIECE — The Translation Room (TouchDesigner Phase 1)

**Status: genuine TouchDesigner export published to the test gallery.** The verified 20-second VP9/WebM (1152×240, 24 fps, 480 frames, 3,384,087 bytes) has SHA256 `d64dd7eda6c7bbb62ce90a19c8543791b455d16989a875fa4b7a72914c0ff9d0`. The manifest is enabled; approaching the three reception monitors should play the published video with three UV-mapped panels. Procedural canvases remain the fallback if decoding fails. The live tower is unchanged.

## Source and translation

Source: Golden Trajectories — Oil Paint Study 14, 27 October 2026, seed OL-20261027-02-57201. Full parameters, file paths and the reproducible editor link are in [phase-one.json](phase-one.json).

The horizontal triptych is SOURCE → TRANSLATION → EMERGENCE.

- Left: actual source artwork, unchanged.
- Middle: TouchDesigner Edge TOP reveals contours while retaining the source.
- Right: Noise, Displace, Feedback, Transform, Level and Composite TOPs create a moving second interpretation.

## Publish the verified Phase 1 export

The real network was constructed and verified using TouchDesigner MCP in Cursor.
It contains 34 operators in `/project1/pp_translation_room`: source image and
darkening scan, golden contour extraction and noise displacement, and minimum
feedback with decay over the cream ground. It was rendered as 480 lossless PNG
frames and encoded into a silent VP9/WebM using the ffmpeg supplied with
TouchDesigner. The 20-second loop and the emitted movie were verified.

To publish from a local Git checkout with access to the exported binary:

```powershell
node automation/publish-touchdesigner-triptych.mjs "C:\\path\\to\\phase-one-triptych.webm"
node --test tests/phi-touchdesigner-phase-one.test.mjs tests/phi-reception-refresh.test.mjs
git add gallery/visit/touchdesigner/phase-one-triptych.webm gallery/visit/touchdesigner/phase-one.json
git commit -m "Publish verified TouchDesigner Phase 1 triptych"
git push
```

The publisher checks the *actual video bytes* against the independent 3.38 MB
SHA256 and only enables the manifest for this verified export. Never enable
`status: published` before the matching video exists in the same commit.

**Keep the TouchDesigner .toe private unless explicitly approved for release.**
The older `build_translation_room.py` is a reference, not a perfect
reproduction of the real MCP-built network. For future re-exports, use the saved
TouchDesigner project; in particular the project timeline must run at 24 fps
and the feedback composite uses *minimum*, not additive blending.

## Runtime in the test tower

The site does not execute TouchDesigner. Its test-only three-monitor player uses a single VideoTexture and crops it into three panels. It fetches the media manifest only when a visitor comes near the backroom, never during startup, and pauses video out of range. Until a valid export exists, procedural art remains visible. Missing, malformed or unplayable media must not prevent entry.

Inspect the developer-console object window.__phiLivingMonitorDiagnostics.media to see playback status. Typical states: fallback, checking-export, awaiting-export, loading-export, export-ready and playing-export.

Test with Node:
- node --test tests/phi-touchdesigner-phase-one.test.mjs tests/phi-reception-refresh.test.mjs
- Browser CI: tests/phi-public-entry.test.mjs

**Phase 1 completion criteria:** the actual TD-created WebM is uploaded; browser shows playing-export and three distinct video panels; load/movement performance is preserved; live gallery remains untouched.

No synthetic binary TouchDesigner project has been passed off as a .toe or .tox. The Python Text DAT is a portable builder for making the actual TD network.
