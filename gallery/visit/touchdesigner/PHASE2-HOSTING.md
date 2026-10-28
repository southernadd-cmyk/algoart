# Phase 2 hosting decision — no personal laptop dependency

## Current state (28 October 2026)

The test tower successfully plays the real TouchDesigner Phase 1 triptych.
The existing Phase 2 changes prepare a deterministic daily input job
(`jobs/YYYY-MM-DD.json`, `next-study.json`) and a safe playback pointer
(`active.json`). They **do not** currently run a daily TouchDesigner renderer.

**Do not schedule rendering on anyone's personal Windows machine.**
Do not treat a running TouchDesigner desktop or localhost TDMCP endpoint
as a production service. No cloud VM or licence has yet been provisioned.

## Preferred architecture: on-demand hosted GPU worker

1. Existing `gallery-daily.yml` generates 18 studies and queues the selected
   study only after the final daily archive is complete. This step is allowed
   to fail without blocking daily gallery publication.
2. A separate cloud orchestrator starts a suitable GPU virtual machine
   only when a new unrendered job appears.
3. The cloud image contains a **verified supported TouchDesigner environment**,
   graphics drivers and a properly licensed saved `.toe` project. The
   editable project and licensing material remain private.
4. Worker downloads the selected public JPG/metadata, updates the inputs
   of the genuine TouchDesigner network and renders exactly 480 frames.
   Convert frames to 1152x240, 24fps, silent VP9/WebM on the worker.
5. Run ffprobe, check exact dimensions/codec/frames/duration, inspect a
   contact sheet or image-difference samples, calculate SHA256, and publish
   the WebM and daily manifest **before** promoting `active.json`.
6. The VM shuts down/deallocates in a finally step. On any failure, preserve
   the current published triptych; the gallery must never depend on worker uptime.
7. Test-tower video remains lazy, one shared VideoTexture and three UV-mapped
   screens; live gallery is not enabled.

### Before provisioning

- Confirm an on-demand Windows desktop/GPU configuration is actually
  compatible with TouchDesigner. Official requirements list Windows 10/11
  or macOS 13+, 4GB GPU VRAM minimum and Vulkan 1.1 capable drivers. Some
  cloud VMs offer Windows Server rather than Windows desktop, so validate
  compatibility and display/GPU acceleration in a one-time pilot.
- Confirm license eligibility and price with Derivative. Non-Commercial
  keys are not transferable; Derivative provides Floating Cloud licences
  for cloud machines and lists separate cloud licence fees. Never copy
  passwords, token files, licence credentials or private `.toe` assets
  into public GitHub.
- Confirm the GPU provider and spending limit. AWS G4dn or Azure NVadsA10v5
  are candidate classes, not yet tested or provisioned for this project.
- Keep MCP localhost-only inside the VM, or restrict it using authenticated
  private access; do not expose port 13316 publicly.
- Limit the number of attempts and have a hard VM shutdown/deallocation
  after each scheduled render, including timeouts.

## Lower-cost alternative: daily browser/WebGL rendering

For fully unattended updates without a paid TouchDesigner cloud environment,
extract and port the *ideas and visual rules* from the existing authored
TouchDesigner project into WebGL/Playwright rendering on GitHub Actions. The
daily study can then be genuinely reinterpreted in the hosted build pipeline,
but **these new outputs are not rendered by TouchDesigner**. Label them
"TouchDesigner-derived" rather than claiming genuine TouchDesigner output.

Do not switch to this artistic approach without a deliberate decision:
it changes the role of TouchDesigner from a daily rendering engine to a
one-time authoring/prototyping tool.

## Current implementation note

`automation/publish-touchdesigner-daily.mjs` is a platform-independent
post-render verification/publishing utility despite requiring a local path
on the worker. It can run on the cloud GPU machine; it does **not** imply
using the artist's own laptop.

No financial resource may be provisioned without explicit authorization.
