# Release plan: replace the live tower with the φ gallery

Prepared 26 October 2026. This is the production migration plan; the public entry-point switch is a later release step. The test gallery remains the place for presentation changes and acceptance checks.

## Visitor experience to preserve

- Keep `/gallery/visit/` as the public gallery URL and canonical address.
- Open general visits in reception. Preserve every existing `?date=YYYY-MM-DD` archive link so it opens that exhibition directly.
- Keep the 2D archive, drawing links, keyboard/touch controls, fullscreen, artwork information and accessible error fallback.
- Keep reception as G and the archive dates in chronological floor order, with both date and floor number visible.
- Carry over the larger paintings, clear lift exits, moving cabin and marker display, Gothic entrance, modern reception, map, credited props and mixed graffiti. Exclude the Loop handwriting and the reception laptop.

## What the source audit found

| Area | Current state | Work before cutover |
| --- | --- | --- |
| Public boot | `gallery/visit/index.html` loads the old `gallery-bundle.js` | Prepare a separate φ bundle and switch the public page to it |
| Page controls | The public HTML lacks `#liftReception`, which the φ app expects | Promote the matching reception/lift template with the new bundle |
| Test boot | `test/virtual-gallery/full-engine.html` uses source modules and a CDN import map | Bundle the pinned npm Three.js and loaders; verify one Three.js instance |
| Build automation | `gallery:bundle` and the rebuild, sync and reproducibility workflows target `gallery-v2.js` | Add an explicit φ build/parity target and update release workflows |
| Assets | New props and credits, plus the renderer adapter and presentation CSS, are under `test/virtual-gallery/` | Promote their runtime paths into the public gallery and audit relative URLs |
| Startup | The φ app still downloads and parses the old 247 KB compressed tower geometry | Remove that unused legacy request and the legacy construction branches from the production entry |
| Deployment | Pages deploys main independently of the gallery test workflows | Require release validation before the public cutover is deployed |
| Sharing | The live page has public metadata and the old tower preview; the test page is noindex | Preserve public metadata, replace the preview image and remove test labels/architecture-study controls |

A trial esbuild of the current φ source succeeds: 1,087,932 bytes minified and 323,528 bytes gzipped. This is a packaging measurement, not a mobile performance result.

## 1. Prepare a production candidate

Create a release branch and a reviewable PR. Extract the shared φ application entry from the test file, keeping debug views behind the debug flag. Give the production bundle its own filename, for example `gallery-phi-bundle.js`; retain the existing legacy bundle for rollback. Promote the matching HTML controls as part of this change: swapping only the JavaScript would fail because the old public page has no reception button. Add a reproducible `gallery:bundle:phi` build and parity check. Check that all dynamic loaders resolve to the same bundled Three.js.

Move the φ renderer adapter, presentation CSS, seven credited model assets and credits page to stable public paths. Audit visitor, lamp, spotlight, texture, sculpture-pack and mirrored artwork URLs from both the public route and the staging route. Preserve embedded attribution and modification records.

Remove unused legacy startup/construction work. Defer interior reception props until the initial frontage is usable, cache shared model resources, and measure actual first entry and lift travel on normal pixel densities. Keep the existing fallback behaviour when optional assets fail.

## 2. Validate the growing archive

Run the curator against every published date, requiring exact artwork counts, unique placement, inward-facing paintings, sculpture viewing space and clear lift/door openings. Exercise future-day fixtures and a month boundary. Add validation to daily publishing before a new floor is offered by the index, so a future unsuitable plan is caught before visitors select it.

Preserve dated links from all archive pages and the studio. Test direct entry, refresh, return to reception, invalid dates and a temporarily unavailable edition. Keep cache-day handling consistent with the publishing timezone.

## 3. Accept the candidate

The prototype already has checks for all 22 current archive plans, enlarged painting bounds, model sizes/credits, 1/3/5/8 golden-angle graffiti groups, excluded Loop handwriting and the poster above the credits. Browser walkthroughs cover historical floor rides, changing marker indicators, free look, actual doors, failed-load recovery, reception return and one Three.js import. Rendered map, plants, paintings, desk and credits views are available in workflow artifacts.

Before release, run the same checks against the **bundled production candidate**, including a fresh browser cache and repeat visits. Review the final reception without the laptop and check the magazine scan's viewing angle/edges. Check portrait/landscape layouts on a real phone and desktop browser. The current software-WebGL CI run uses half pixel density; its mobile screenshot is a responsive-layout check, not proof of phone frame rate. If VR remains advertised, verify entry, movement, lift selection and recovery on a headset as well.

Record load times, frame stability and GPU/resource behaviour through repeated floor changes. Decide performance limits from those measurements and resolve regressions before cutover.

## 4. Cut over and retain rollback

Pin the legacy public entry, styles and bundle to a known commit/tag before release. At plan preparation, the legacy public files remain available at commit `217ec79216cc16cfa298da910d4acc0387b5ab85`.

Merge the approved candidate only after its checks pass. Deploy the new public HTML, φ bundle, styles, assets and metadata together. Use a new bundle filename/version so cached legacy HTML still has its compatible bundle. Verify the deployed public root, an early date, a recent date, reception return, credits and 2D fallback on that exact deployed commit.

If startup, navigation, archive placement or asset loading fails, restore the legacy public entry/style references and deploy that rollback. Keep archive data and the new staging gallery intact; do not revert unrelated daily artwork commits. Retain both bundles and the rollback instructions until the new gallery has passed post-release checks.

## Proposed release boundary

The first production release is this validated gallery with the current artwork archive and presentation. Additional architecture, decor and engine changes can continue on staging after cutover. The immediate next implementation task is the shared production entry and reproducible φ bundle; the live URL switch comes after candidate acceptance.


## Implementation status

The release candidate promotes the application to `gallery/visit/gallery-phi.js` and its reproducible `gallery-phi-bundle.js`. Staging imports that same application. The matching public template includes reception controls, public styles/assets/credits and the canonical URL; the legacy document is retained as `gallery/visit/legacy.html`.

The unused baked-tower request and legacy scene-construction branch have been removed from the new entry. Interior model downloads start on gallery entry. The SVG export hook is preserved in source for both renderers. The cabinet faces the approach and has a small inner backing behind incomplete scan edges.

Both bundle build targets, automatic rebuild workflows, daily archive validation and Pages deployment validation are wired. Local verification covers 61 existing release tests plus 42 phi/public presentation tests, including all 22 archives and 62 future-date mixes across the month boundary. The browser workflow now exercises the bundled public route, exact dated entry/refresh, full-density desktop and mobile touch input. Its artifact supplies the actual-scene sharing image and render/resource measurements.

The legacy rollback baseline for this candidate is `7230993fc16de3a6fee63866ec1828f909c87f8d`. Candidate browser acceptance and live cutover follow the recorded workflow results.
