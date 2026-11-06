# Isolated lift precompile experiment

Base: `0dcc1dd10d97a0cac5b4e5a7df5519688655469f`.

This is an experiment, not an approved production change. The production HTML
and production bundle remain byte-for-byte unchanged. No main-branch update or
deployment was performed.

## Change

On the separate test page, `liftcompiletest=64` or `liftcompiletest=all` drains
deferred construction, re-stages destination objects, awaits destination-only
compilation with the actual scene as the lighting/environment target, uploads
destination textures, then reveals the floor. The baseline retains the current
16-object/two-frame reveal followed by whole-scene warm-up. Painting readiness
and the door interlock remain in place.

The compilation-only traversal deliberately supplies no second light traversal:
Three r187 already gathers every light from the target scene. It never reparents
or clones original meshes. This adapter is tied to the pinned r187 implementation.

## Run

Install the lockfile dependencies (`npm ci`), then:

```
node automation/build-phi-lift-test.mjs
python -m http.server 8000
```

Open each URL in turn on a WebGL-capable browser. Do not run variants concurrently.

* `http://localhost:8000/gallery/visit/lift-test.html?debug=1&liftprofile=1&liftbench=1`
* `http://localhost:8000/gallery/visit/lift-test.html?debug=1&liftprofile=1&liftbench=1&liftcompiletest=64`
* `http://localhost:8000/gallery/visit/lift-test.html?debug=1&liftprofile=1&liftbench=1&liftcompiletest=all`

The test visits 20 October, 30 October, then returns to reception. The on-page
report records journey time, worst/p95 frame interval, stalls, reveal time,
warm-up details, painting counts, timeouts and errors. Repeat in fresh browser
sessions and reverse variant order to control caching/order effects.

## Results and limits

The isolated test bundle builds successfully with Three 0.187.0 / N8AO 2.0.1.
The seven new tests pass: painting upload readiness/failure, destination scope, unchanged identity/visibility,
lighting target without double counting, compile/upload failure propagation,
disposed/render-target exclusion, and final visibility across batch sizes.
The existing five entry-preparation tests and three door-motion tests also pass.
The older combined `phi-lift-queue-profiler.test.mjs` cannot start because its
existing import `test/virtual-gallery/phi-shadow-render-probe.mjs` is missing.
The new painting-gate checks import and test the actual current production module.

For a synthetic 1,024-object floor, scheduling waits fall from 128 (16-object
batches) to 32 (64-object batches), or 2 (single batch). This is a deterministic
scheduling check, **not a measured GPU speed-up**.

The available browser cannot create any WebGL context (`GL_RENDERER = Disabled`).
The unchanged baseline therefore fails before entry. No lift timing or visual
equivalence results are available. In particular, larger batches could concentrate
geometry upload/first-render costs, and asynchronous lighting/material updates
may still cause shader variants after precompilation. Do not promote without
actual browser measurements and visual checks, including return to reception.


## CI continuation — 6 November 2026

The first workflow run ([42264155751](https://github.com/southernadd-cmyk/algoart/actions/runs/42264155751)) was cancelled after ~21 minutes, with incomplete software-renderer results. Its first floor timings (baseline 142.2 s, 64 147.4 s, all 141.3 s) **do not compare experimental behaviours**: every variant used 16-object reveal batches and skipped destination precompile. The culprit was `loadEdition` rewriting the browser URL during the initial floor load, deleting `liftcompiletest` before `travelLift` read it.

The isolated test page now preserves diagnostic query flags through `loadEdition`. CI asserts the expected precompile stage and actual batch count before counting a result, preventing a false comparison. Software-rendered viewport was reduced from 1280×800 to 640×400. CI now runs an initial full roundtrip per variant rather than two rounds; reverse-order repetition still requires a later verified run.

The first browser run also reached an apparently open door in screenshot while `__phiLiftRide.status` stayed `opening` for 30 seconds. This now becomes an explicitly recorded warning, not a reason to discard measured journeys. It remains an item to verify with a hardware browser and should not be silently treated as a passed door-state check.

The follow-up workflow is [42268158700](https://github.com/southernadd-cmyk/algoart/actions/runs/42268158700). Its results must be reviewed before recommending a production change. The project has **not** deployed or merged the experiment.
