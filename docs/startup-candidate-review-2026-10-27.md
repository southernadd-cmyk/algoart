# Startup candidate review — 27 October 2026

Decision: do not promote either candidate to live. The experiment is isolated on startup/live-v2; main has not been updated by this work.

## Revision and validation

The first candidate precompiled detached models and explicitly uploaded their textures. Its cumulative recorded main-thread long tasks increased from 4.18 seconds to 11.16 seconds, and models were late in one early checkpoint. This approach was rejected.

The revision removes explicit model shader compilation and initTexture calls. It retains stable material map slots, texture callback scheduling and staggered model attachment. Original texture resolution, models, geometry, reflecting pool and artwork colours remain in the source.

GitHub Actions run: https://github.com/southernadd-cmyk/algoart/actions/runs/40570678962

Production and test bundle builds, focused unit checks and the synthetic post-processing browser checks passed. All four reception runs loaded all required models, drained their preparation queues and reported no page errors. These are functional checks, not performance acceptance.

## Revised results

Four cold Chromium starts in baseline/candidate/candidate/baseline order, 960 × 600, software rendering through SwiftShader. Two observations per variant are insufficient for statistical confidence or hardware/mobile FPS claims.

| Metric | Baseline | Revised candidate |
| --- | ---: | ---: |
| Enter enabled, mean | 6.090 s | 5.688 s |
| Initial scene compile, mean | 3.829 s | 3.938 s |
| Cumulative long tasks through early checkpoint, mean | 4.066 s | 3.961 s |
| Median sampled frame gaps, each run | 944.6 / 936.6 ms | 252.4 / 147.6 ms |
| Largest sampled frame gaps, each run | 2155.7 / 2041.9 ms | 1954.0 / 2609.4 ms |
| Models complete at early checkpoint | Both runs | Both runs |
| Final shader program count | 40 | 39 |

Enter becomes available around 0.402 s (6.6%) sooner. Typical sampled intervals improve, but initial compile does not, and the longest gap worsens in one run. There is no reliable evidence of eliminating the entry stutter.

## Measurement limits found during review

The harness records enteredAt after Playwright's Enter action returns. Blocking during the action can occur before that timestamp, making post-entry frame and long-task windows non-equivalent. Future instrumentation must timestamp the captured key/click event before the gallery handler executes, and report the entry action duration separately.

LongTaskMs in the console summary is cumulative from navigation, including initial compilation; it is not post-entry blocking alone.

The settledAt field is the timestamp of a snapshot after a mandatory 12-second observation window, not the first instant the scene completed loading. It must not be presented as exact total loading time.

Frames were sampled while stationary. SwiftShader rendering and driver synchronisation do not establish actual GPU performance or lift travel smoothness.

A separate walkthrough workflow on the first candidate failed because its hard-coded graffiti count expected 85 but the current scene reports 187. This was not silently fixed or counted as passing; it is outside this startup experiment.

## Next useful measurement

Capture entry-handler start, first presented frame after entry, largest frame gap and long-task blocking on the same physical device with a fixed camera movement and identical full reception content. Keep startup scheduling changes isolated until that comparison demonstrates an improvement. Do not reduce artwork fidelity, texture resolution, reflecting pool detail or model detail to make the benchmark pass.
