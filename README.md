# ALGO/ART — φ Generator

A browser-based algorithmic art generator that builds compositions around the golden ratio, then renders them as imperfect marker-pen strokes.

## Core idea

The generator separates **composition** from **rendering**:

1. φ (`1.6180339887…`) controls scale, spacing, anchor points, recursive rectangles and spiral/golden-angle placement.
2. The marker renderer adds wobble, repeated passes, variable pressure, transparency and dry-ink behaviour afterwards.

This means the composition remains mathematically structured even when the drawing looks loose and handmade.

## Features

- Seeded, repeatable art generation
- Eight composition modes:
  - Golden Field
  - Golden Spiral
  - Recursive Rectangles
  - Fibonacci Burst
  - Phi Network
  - Organic
  - Geometric
  - Controlled Scribble
- Golden-ratio adherence control
- Golden-angle placement
- Recursive φ scaling
- Straight lines, Bézier curves, ellipses, golden rectangles, polygons and arcs
- Marker simulation with wobble, overdraw, pressure, opacity and dryness
- Seven pen styles
- Multiple colour systems, including golden-angle hue stepping
- Paper colour and grain
- Optional φ construction overlay
- Mutate / randomise / seeded regenerate controls
- PNG export
- No libraries, build step, backend or API keys

## Run locally

Open `index.html` in a modern browser, or serve the folder using any simple static HTTP server.

## GitHub Pages

The project is fully static and can be published directly from the repository root on the `main` branch using GitHub Pages.

## Keyboard shortcuts

- `G` — regenerate
- `M` — mutate
- `N` — new seed

## Technical notes

Canvas size is 1400 × 1000. The UI is responsive and the art itself is generated at the fixed internal resolution so seeds remain consistent across viewport sizes.
