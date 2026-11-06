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
