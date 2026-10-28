# The Translation Room: third information row

The backroom now contains three horizontal rows of three screens:

- Top row: original oil painting interpreted in TouchDesigner (`phase-one-triptych.webm`).
- Middle row: watercolour burst (`watercolour-burst-AA-20261005-03-55769-triptych.webm`).
- Bottom row (the information row): a looping view of the TouchDesigner node network, a short description, and the TouchDesigner by Derivative logo with an optional project download.

## Three assets for the information row

Place these exact filenames beside this document in `gallery/visit/touchdesigner/`:

1. `td-network-loop.webp`: 384 × 240, 84 frames, animated WebP compressed from the artist's 10.54-second node-network screen recording. It is decoded only when a visitor approaches the screens.
2. `touchdesigner-logo.png`: white-background TouchDesigner by Derivative logo, cropped from the artist-provided branding image.
3. `watercolour-burst-AA-20261005-03-55769.toe`: the **actual saved TouchDesigner project used to produce the watercolour burst video**, not the unrelated `phase1.toe` project.

The last screen displays **CLICK TO DOWNLOAD .TOE** only after an HTTP HEAD request confirms that the published project exists. A pointer click on that screen within five metres opens the .toe; on mobile, visitors can tap the screen. Without the .toe, it displays **Project file awaiting publication** instead of offering a broken download.

## Runtime and performance

Each of the top two rows uses one video texture cropped into three sections. The third information row uses simple canvas textures. Animated WebP frames are uploaded at no more than ~7 fps and **only when the visitor is within 11 metres**. The network recording is not loaded at tower startup. The full installation is disposed when leaving the reception.

The entire project file, if published here, is **publicly downloadable by everyone**. Review the .toe for private data, licence material, embedded usernames, and local file paths before publication.

## After uploading the assets

The normal GitHub Pages workflow will publish them from the repository. The display reads the exact names above and does not require a manifest change.
