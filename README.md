# ALGO/ART — φ Generator

**Mathematics sets the rules. The marker breaks them.**

ALGO/ART is a browser-based generative art studio that builds compositions around the golden ratio, then renders them as imperfect marker-pen strokes.

Live: https://southernadd-cmyk.github.io/algoart/

## The idea

ALGO/ART separates **composition** from **rendering**.

1. φ (`1.6180339887…`) influences scale, spacing, hierarchy, focal positions, recursive divisions, golden-angle trajectories and negative space.
2. The marker engine then adds wobble, repeated passes, variable pressure, transparency and dry-ink behaviour.

The underlying composition stays mathematically structured while the final drawing looks loose, physical and imperfect.

## Eight art systems

- **Field / Orbital Studies** — scored φ-based placement with visual hierarchy and controlled negative space.
- **Spiral / Golden Trajectories** — multiple golden-angle spiral families including shell, double, broken, offset, void and loose compositions.
- **Rects / Recursive Divisions** — recursively subdivided golden-ratio structures.
- **Burst / Radiant Systems** — single, twin, triad, cropped, void and satellite radial systems.
- **Network / Connected Fields** — hierarchy-aware, low-crossing networks with φ-weighted link lengths.
- **Organic / Growth Systems** — branching structures whose lengths decay through φ-related scaling.
- **Geometric / Constructed Forms** — independent Bauhaus/Suprematist-style arrangements using balance, stack, axis, collision, float and crop families.
- **Scribble / Automatic Marks** — weighted φ territories, directional flow, clusters and protected gaps.

## Reveal System

**Reveal φ** turns the artwork into a mode-aware construction x-ray.

Depending on the active system it can reveal:

- 61.8% / 38.2% canvas divisions
- golden-ratio focal intersections
- golden-angle trajectories
- hero / medium / supporting scale hierarchy
- reserved negative-space regions
- recursive subdivision cells and depth
- burst hubs and radial paths
- network backbone and secondary links
- scribble territories and directional flow
- organic roots and branch generations
- Constructed Forms object scaffolding

When Reveal System is active, hover the highlighted construction marks for plain-English explanations of what each part is doing.

## Exploration and sharing

- deterministic seeds
- **4-Up Variations** for four alternative seeded interpretations of the current settings
- exact artwork state encoded into shareable URLs
- visual series chooser with generated previews
- mutate and full randomise controls
- responsive desktop/mobile interface
- first-visit artist-statement toast

## Marker engine

- felt tip
- fine marker
- broad marker
- highlighter
- dry marker
- paint pen
- scribble pen
- thickness, wobble, overdraw, opacity, pressure and dryness controls
- straight lines, Bézier curves, ellipses, rectangles, polygons and arcs
- multiple palettes including golden-angle hue stepping
- paper colour and grain

## Export

- PNG at 1×, 2× or 3× resolution
- true SVG vector export
- SVG preserves the generated marker paths, including wobble, repeated passes, opacity and dry-marker dash behaviour

## Keyboard shortcuts

- `G` — regenerate
- `M` — mutate
- `N` — new seed
- `V` — four-up variations
- `[` — toggle parameters

## Technical notes

- fixed internal artwork size: 1400 × 1000
- fully static
- no libraries
- no build step
- no backend
- no API keys
- same seed + same settings = same artwork
- suitable for GitHub Pages

## Project identity

ALGO/ART is not intended to compete on algorithm count. Its focus is the relationship between **mathematical composition and physical imperfection**: the composition is governed by a visible system, while the marker rendering deliberately refuses computer-perfect geometry.
