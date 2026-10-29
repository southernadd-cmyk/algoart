# Translation Study II — second monitor bank

The second 3 × 3 bank is beside the original installation. Its upper two rows
currently show the existing `../td-network-loop.webp`; the third row repeats
the current network preview, explanation and project download as placeholders.
The original bank retains its published six-screen film.

When the two new triptychs are ready, combine them into a 1152 × 480 WebM
(top triptych in the top 240 pixels, second triptych in the bottom 240 pixels).
Each row is cropped into three 384 × 240 screens. Put that file here as
`six-screen-installation.webm`, verify all six crops and playback, then update
`six-screen.json` to `status: published`, recording the actual frame rate,
size and SHA-256. The second bank uses this manifest independently and will
switch from its WebP fallback to one shared video decoder and texture.

Update the information-row assets/project if new authoring files are supplied.
Both banks load media only when approached and release resources on departure.
