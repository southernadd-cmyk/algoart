# The Translation Room: third information row

The backroom now contains three horizontal rows of three screens:

- Top row: original oil painting interpreted in TouchDesigner.
- Middle row: watercolour burst.
- Bottom row (the information row): a looping view of the TouchDesigner node network, a short description, and the TouchDesigner by Derivative logo with an optional project download.

## Three assets for the information row

Place these exact filenames beside this document in `gallery/visit/touchdesigner/`:

1. `td-network-loop.webp`: 384 × 240, 84 frames, animated WebP compressed from the artist's 10.54-second node-network screen recording. It is decoded only when a visitor approaches the screens.
2. `touchdesigner-logo.png`: white-background TouchDesigner by Derivative logo, cropped from the artist-provided branding image.
3. `pp_translation_room_watercolour.toe`: the **actual saved TouchDesigner project**. This file is already in the repository and the download link points directly to it.

The last screen displays **CLICK TO DOWNLOAD .TOE** only after an HTTP HEAD request confirms that the published project exists. A pointer click on that screen within five metres opens the .toe; on mobile, visitors can tap the screen. Without the .toe, it displays **Project file awaiting publication** instead of offering a broken download.

## Runtime and performance

The top two rows share one playing video and one video texture: `six-screen-installation.webm`, declared by `six-screen.json`. Its 1152 × 480 frame stacks the original oil triptych above the watercolour triptych, preserving 384 × 240 pixels per screen, 24 fps and the 20-second loop. Each screen selects one of the six grid cells through its geometry UVs. The original source files and manifests remain available for provenance; neither source video is requested during installation playback. Both rows start, pause and dispose together. The six-screen manifest deliberately does not follow the single-triptych daily active pointer. The third information row uses simple canvas textures. Animated WebP frames are uploaded at no more than ~7 fps and **only when the visitor is within 11 metres**. The network recording is not loaded at tower startup. The full installation is disposed when leaving the reception.

The entire project file, if published here, is **publicly downloadable by everyone**. Review the .toe for private data, licence material, embedded usernames, and local file paths before publication.

## After uploading the assets

The normal GitHub Pages workflow will publish them from the repository. The display reads the exact names above and does not require a manifest change.
