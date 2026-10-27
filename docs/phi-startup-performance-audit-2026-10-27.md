# PROPORTION PIECE: startup performance audit — 27 October 2026

Cast shadows cause a reproducible startup regression in the tested renderer. The shadow layer is too broad for the initial implementation; caching maps does not make receiving shadows or creating their shader variants free.

## Controlled comparison

Pinned application: `7c929b2cbd1075e93b4bebfe73cdbc7d94b4168f`.

Four fresh Chromium processes, ordered baseline / shadows / shadows / baseline. Same reception, 960 × 600 viewport at device pixel ratio 1, AO off, identical assets and application code. The only rendering option changed was `shadows=0/1`. CPU sampling, resource timing, long-task observation and diagnostic counters were applied to both variants. Assets were served locally by the GitHub runner. No WAN or phone benchmark was performed.

**The runner uses SwiftShader software rendering. These values establish an implementation regression on that runner; they are not estimates of the user's hardware FPS.** Two repetitions per variant give a small sample. Early-frame medians varied substantially and only 3–4 GPU query results were available per run, so no steady-state FPS conclusion is justified.

| Metric | Shadows off | Shadows on | Change |
|---|---:|---:|---:|
| Application ready, mean of two | 6.406 s | 8.184 s | +1.778 s / +27.8% |
| Shader-preparation await, mean | 3.801 s | 5.413 s | +1.612 s / +42.4% |
| Programs after initial preparation | 26 | 54 | +28 |
| Programs after entry window | 40 | 72 | +32 / +80% |
| GPU geometry objects after entry window | 399 | 606 | +207 / +51.9% |
| Texture objects after entry window | 85 | 93 | +8 |
| Encoded resource bytes fetched | 27.453 MB | 27.453 MB | Same |
| Main-view draw calls at sampled endpoint | 568 | 568 | Same |
| Main-view triangles at sampled endpoint | 345,166 | 345,166 | Same |

Raw application-ready times: baseline 6.3766 / 6.4351 s; shadows 8.1256 / 8.2428 s. No JavaScript errors were recorded in the four completed measurements.

Application ready is the flag used to enable Enter. It does not mean every deferred model, texture and artwork is uploaded or that the first interactive paint has completed. The subsequent 12-second window was stationary; the initial harness log called these statistics `firstMovement`, but it did not execute walking input. The retained harness now calls them `earlyFrames`.

## Findings, in priority order

1. **Shader preparation dominates the added startup interval.** The await around the existing `renderer.compileAsync(scene,camera)` grows by about 1.61 s, while readiness grows by about 1.78 s. CPU profiles concentrate additional sampled time in Three.js program initialization / shader-status queries and WebGL texture upload calls. These calls can include driver/GPU synchronization, so this is not a claim that all that time is CPU shader compilation. Shadow setup is currently modified from the running tick loop, while the normal startup compilation is in progress. Stabilizing caster/receiver roles and the shadow-light set before the initial compilation is the first fix to test.

2. **Casting and receiving are enabled too broadly.** The audit counted 840 eligible lit meshes by the end of the entry window, plus sunlight and two room shadow maps. The code does not restrict roles to the intended furnishings, sculptures, planters and relevant architecture. The extra 207 resident GPU geometries, despite identical sampled main-view triangles, are consistent with shadow passes uploading geometry the main camera would not otherwise need yet. Confirm this per light when narrowing the shadow coverage; do not remove visible scene detail.

3. **Startup model arrivals invalidate all shadow maps repeatedly.** Both shadow runs recorded eight refresh requests in the initial window. The global `renderer.shadowMap.needsUpdate` refreshes every active shadow light rather than only the affected map. This overlaps model decode, texture upload and first movement. Preserve the final shading but coalesce asset-arrival refreshes and mark only maps whose caster set changes.

4. **The scene scan is secondary, with occasional spikes.** The two runs spent about 47–67 ms total in 14–16 scans, with individual maxima around 9–15 ms. The helper forces world-matrix updates and allocates a string signature four times per second. It also made 909 material-state invalidations as meshes arrived; that is not 909 shader compiles. Replace whole-scene polling with cached participants / dirty notifications and avoid repeatedly invalidating shared materials.

5. **The loader has a threshold worth revisiting after the shadow fixes.** The tick loop processes a deferred job each frame below 30 ms, but otherwise only every eighth frame. Shadows can therefore compound slow visual completion if they push a device above that threshold. The audit did not establish a repeatable deferred-job count regression: paired runs completed 7/7 and 12/11 calls. Treat the threshold feedback as a code-supported risk, not a measured causal result from this sample.

6. **There is also substantial existing startup payload.** The largest observed resources include the 5.08 MB plant GLB, 2.16 MB entrance GLB, a 1.83 MB brick normal map and multiple 1.4–1.83 MB graffiti atlases. Shadows do not add those downloads. Lossless asset compression and deliberate decode/upload scheduling are later opportunities; reducing texture or geometry detail is not required for this audit's first fixes.

## Recommended implementation sequence

1. Keep the baked contact shading; keep real-time cast shadows opt-in.
2. Prepare the final shadow roles and lights once before the existing startup shader warm-up. Avoid generating intermediate shader configurations during initial construction.
3. Split per-light invalidation, reuse allocations, and coalesce model-arrival updates. Maintain the current appearance in matched views.
4. Restrict shadow participation and camera coverage to geometry that can affect visible receivers, with visual checks for off-camera occluders. This requires care and is not equivalent to hiding meshes.
5. Replace the periodic full-scene scan. Re-measure before considering resolution, light-count or image-quality trade-offs.
6. Repeat the same cold-start comparison and then test actual desktop/mobile GPUs, including input response and a scripted walking path. This audit alone does not validate real-device frame rate.

No production or test-page rendering behavior was changed during this audit. Diagnostic builds ran only on the audit branch / runner.

## Evidence

- [First measurement pair and CPU profiles](https://github.com/southernadd-cmyk/algoart/actions/runs/40564705751/artifacts/12763155879). The job later failed on a nonessential font-dependent screenshot; both first-pair measurements had already been saved.
- [Completed second pair and CPU profiles](https://github.com/southernadd-cmyk/algoart/actions/runs/40565503467/artifacts/12763585341).
- [Shadow implementation](https://github.com/southernadd-cmyk/algoart/blob/7c929b2cbd1075e93b4bebfe73cdbc7d94b4168f/test/virtual-gallery/phi-shadows.mjs).
- [Rendering and startup integration](https://github.com/southernadd-cmyk/algoart/blob/7c929b2cbd1075e93b4bebfe73cdbc7d94b4168f/automation/build-phi-post-test.mjs).
