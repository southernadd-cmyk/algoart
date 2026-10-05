# ALGO/ART — φ Generator

**Mathematics sets the rules. The marker breaks them.**

ALGO/ART is a deterministic, browser-based generative art system built around the golden ratio. It does not use a trained image model. Instead, mathematical and aesthetic knowledge is explicitly encoded into the generator: φ-based proportions, golden-angle turns, recursive divisions, hierarchy, negative space, layout scoring and seeded variation. A separate marker engine then deliberately introduces physical-looking imperfection.

Live site: https://southernadd-cmyk.github.io/algoart/

## Core idea: structure first, imperfection second

The project separates **composition** from **rendering**.

The composition layer decides *where* things belong, *how large* they should be, *how they relate* to other marks and *where space should remain empty*. The rendering layer decides *how the marks feel*: wobble, repeated passes, pressure, opacity, dry ink and imperfect edges.

The main mathematical constants are:

- **φ = 1.6180339887…**
- **1/φ ≈ 0.6180339887**
- **1 − 1/φ ≈ 0.3819660113**
- **Golden angle ≈ 137.507764°**
- **Golden logarithmic spiral:** radius grows by φ every 90° in the V4 spiral system.

This means the project is not simply drawing a golden spiral over otherwise random art. φ participates at several levels: focal positions, scale quantisation, hierarchy, spacing, recursive subdivision, branch decay, radii, rotations, network relationships and negative-space organisation.

## Determinism and renderer versions

ALGO/ART uses a seeded pseudo-random generator. Random-looking decisions are derived from the seed and settings rather than uncontrolled randomness.

**renderer version + seed + settings = the same artwork**

Exact state is stored in share URLs, including the renderer version. This is important because the renderer has evolved while old shared works remain reproducible. V1, V2 and V3 are retained for historical work; **V4 is the current renderer**.

The unparameterised home page loads the final artwork from the newest Daily Gallery as its current default. A URL containing explicit artwork settings takes priority, so an old or shared work is not replaced by the gallery default.

---

## The idea becomes the machine

> **“The idea becomes a machine that makes the art.”**  
> — Sol LeWitt

That principle is central to ALGO/ART. The artwork is not conceived first and then reproduced by code. Instead, an idea is formalised as a system: φ proportions, golden-angle turns, recursive rules, hierarchy, constraints, scoring and seeded variation. The system becomes the machine, and individual artworks are deterministic executions of that idea.

Each of the eight modes below is therefore best understood as a different **machine for making art**. They share a mathematical vocabulary, but each interprets it differently.

**Eight ideas. Eight machines for making art.**

---

# The eight generative systems

Each mode has its own compositional logic. They share the same φ toolkit and marker renderer, but they do **not** merely apply different visual skins to one algorithm.

## 1. Golden Field — *Orbital Studies*

Golden Field is the most general-purpose compositional system. It builds a candidate layout, evaluates the relationships inside it, and chooses a strong arrangement rather than accepting the first random placement.

### How it works

Elements are assigned a visual hierarchy:

- **Hero** — dominant anchors.
- **Medium** — bridge forms connecting the dominant and supporting layers.
- **Small** — rhythmic/supporting marks.

Size is influenced by element count and density, then quantised toward φ-related values. Candidate positions combine φ focal points, distributed φ territories and — according to the Spiral Influence control — a V4 golden-spiral trajectory.

The engine tries multiple positions for each element and penalises undesirable collisions or intrusion into protected negative-space regions. Several complete layouts can be generated and scored before the chosen composition is drawn.

### Composition strategies

The seed deterministically selects a strategy:

- **BALANCED** — distributes visual weight around the composition.
- **VOID** — makes protected empty space a major feature.
- **TENSION** — separates major anchors to create opposing visual weight.
- **ORBIT** — pulls objects toward a spiral trajectory and aligns them tangentially.
- **EDGE** — deliberately increases edge activity.
- **MONUMENT** — emphasises one unusually dominant form.
- **DIAGONAL** — organises marks around a diagonal movement.

### Where φ enters

Golden Field uses the 61.8% / 38.2% intersections as preferred focal areas. Element sizes are φ-quantised, family distances can be snapped toward φ-related lengths, and hierarchy is reinforced through related scales. V4 spiral influence uses logarithmic golden-spiral placement rather than the older radial approximation.

The **φ adherence** control determines how strongly the raw layout is pulled toward these mathematical relationships. Lower values allow more freedom; higher values make the structure more explicitly φ-governed.

---

## 2. Golden Spiral — *Golden Trajectories*

This is the system in which the golden spiral is most literal.

### V4 spiral mathematics

V4 uses a logarithmic spiral:

```text
r(θ) = a · e^(bθ)

b = 2 ln(φ) / π
```

Therefore:

```text
r(θ + π/2) = φ · r(θ)
```

In other words, every quarter-turn multiplies the radius by φ.

The spiral is sampled deterministically and used as the trajectory on which marks and connecting strokes are constructed.

### Spiral families

The seed chooses one of six variants:

- **SHELL** — a single spiral with a subtle secondary displacement.
- **DOUBLE** — two opposed spiral arms.
- **BROKEN** — deliberate interruptions and angular perturbations.
- **OFFSET** — the spiral centre is pulled toward a golden-ratio focal point.
- **VOID** — combines a spiral with protected negative space.
- **LOOSE** — reduces connections and loosens the trajectory while retaining the underlying growth law.

Hero points occur at φ-related positions through each arm. Elements are rotated approximately tangent to the spiral so the forms participate in its movement rather than merely sitting on it.

### Important geometric detail

The internal artwork is 1400 × 1000. The current V4 implementation applies the logarithmic radial value independently to canvas width and height. The underlying radial law is exactly the golden logarithmic law, while its on-canvas appearance is therefore an affine-stretched version on the non-square canvas. Some artistic variants also deliberately perturb the ideal path.

That distinction is intentional to document: ALGO/ART is **φ-governed generative composition**, not a claim that every visible contour is untouched textbook geometry.

---

## 3. Recursive Rectangles — *Recursive Divisions*

Recursive Divisions treats the canvas as a hierarchy of territories.

### How it works

The system begins with a large inset rectangle. It repeatedly selects a cell and divides it vertically or horizontally. The preferred cut approaches either **61.8% or 38.2%**, controlled by φ adherence.

Aspect ratio influences the direction of the cut: wide regions tend to divide vertically and tall regions horizontally. Complexity, recursion and minimum cell size determine when subdivision stops.

### Division families

- **MOSAIC** — repeatedly works through the strongest available regions.
- **CASCADE** — follows one recursive branch, leaving previous divisions behind.
- **CROSSCUT** — alternates the character of the cuts and favours large cells.
- **FRAMED** — creates a more nested/frame-like hierarchy.

Some final cells are intentionally left blank according to Negative Space. Other cells can contain diagonals, ellipses, arcs, polygons and nested rectangles.

Nested rectangles reduce dimensions by **1/φ**. Ellipses frequently use φ-related width/height relationships, while rotations can advance using the golden angle.

### What φ is doing

Here φ is architectural. It controls the proportions of the territories themselves, rather than merely decorating a finished layout.

---

## 4. Fibonacci Burst — *Radiant Systems*

Radiant Systems organises artwork around one or more hubs.

### How it works

Each hub emits a sequence of radial placements. Angular movement interpolates toward the **golden angle**, while distance from the hub is quantised toward φ-related radii.

Important positions in the radial sequence become hero forms, with medium and small forms producing a scale hierarchy.

### Burst families

- **SINGLE** — one principal radial system.
- **TWIN** — two hubs arranged across opposing golden focal points.
- **TRIAD** — three φ-distributed hubs.
- **CROPPED** — moves the source beyond an edge so the composition enters the frame.
- **VOID** — places the hub away from a protected empty region.
- **SATELLITE** — one dominant hub plus smaller secondary systems.

### What φ is doing

φ affects hub placement, radius quantisation and visual hierarchy. The Golden Angle control determines how strongly angular stepping approaches approximately **137.5°** rather than ordinary equal-angle radial spacing.

The result is radial without becoming a conventional evenly divided starburst.

---

## 5. Phi Network — *Connected Fields*

Connected Fields combines the Golden Field layout system with a graph-like connection system.

### How it works

Nodes inherit the Field hierarchy: hero, medium and supporting nodes. The network then selects connections according to proximity, hierarchy and structural usefulness.

Primary connections establish a backbone. Secondary connections are lighter and are selected more cautiously. The system tries to avoid unnecessary line crossings so that increasing complexity does not simply turn the drawing into an unreadable mesh.

Hero nodes can receive additional φ-scaled rings.

### What φ is doing

The node positions already inherit Field's φ-based placement and scale logic. Link selection also rewards distances that sit near φ-related lengths. This means the golden ratio affects both the **objects** and the **relationships between objects**.

That is an important distinction: in Connected Fields, φ is not just a coordinate system; it influences graph topology.

---

## 6. Organic — *Growth Systems*

Growth Systems turns φ into a branching rule.

### How it works

One or more roots are placed using φ-distributed canvas positions. Each branch grows to an endpoint and can produce one or two children. The process continues breadth-first until the recursion or element limit is reached.

The mode deliberately raises curvature and wobble so the mathematical skeleton feels biological rather than mechanical.

### Branch mathematics

Initial branch lengths are φ-quantised. Each new generation is approximately:

```text
next length ≈ current length / φ
```

with a small deterministic variation.

Branch turns are derived from the golden angle, scaled by complexity. If growth enters protected negative space, the branch can turn away using another golden-angle-derived adjustment.

Small elliptical forms may appear at endpoints, with their own dimensions related through φ.

### What φ is doing

This mode demonstrates φ as **growth and decay** rather than static layout. Repeated division by φ naturally produces a hierarchy of large trunks, medium branches and small terminal structures.

---

## 7. Geometric — *Constructed Forms*

Constructed Forms is the project's hard-edged, Bauhaus/Suprematist-influenced system. It deliberately uses lower curvature and wobble than the organic modes while retaining the same marker medium.

### Composition families

- **BALANCE** — opposing hero forms occupy golden focal regions.
- **STACK** — forms build along a principal horizontal or vertical sequence.
- **AXIS** — objects are offset from a strong compositional axis.
- **COLLISION** — several large forms converge around a φ-biased focal region.
- **FLOAT** — objects occupy distributed territories around protected empty space.
- **CROP** — oversized forms enter from beyond the canvas edges.

### What φ is doing

Sizes are quantised toward φ scales. Hero positions use 61.8% / 38.2% focal intersections. Axis offsets, collision radii and supporting-form orbits use φ-related distances. Golden-angle rotations stop repeated forms from collapsing into ordinary right-angle grids.

This is intentionally different from Recursive Divisions: **Rects derives forms from subdivision; Constructed Forms composes independent objects.**

---

## 8. Controlled Scribble — *Automatic Marks*

Automatic Marks is designed to look spontaneous without becoming a random walk.

### How it works

The canvas is divided into a small number of weighted activity territories. Each territory has an anchor, radius and flow direction. Scribbled runs are encouraged to stay within their territory and periodically break/restart so the whole image does not become one continuous knot.

The marker settings are pushed toward stronger wobble, curvature and overdraw.

### Scribble families

- **RIBBON** — anchors form an intentional sweeping route.
- **CLUSTERS** — several distinct concentrations of activity.
- **KNOT** — activity is pulled toward a φ focal region.
- **VOID** — scribbling actively works around protected empty space.
- **DUET** — two principal territories interact.

### What φ is doing

Anchors come from φ-distributed points. Territory radii and stroke lengths are φ-quantised. Direction changes include golden-angle turns, and reset positions advance around anchors using the golden angle.

The result is important to the project's philosophy: a drawing can appear loose and gestural while still having a deterministic mathematical composition underneath.

---

# Shared composition systems

## φ focal points

The four major focal points come from intersections of the two golden-section positions on each axis:

- x = 61.8% or 38.2% of the width
- y = 61.8% or 38.2% of the height

Different modes use them as anchors, attractors, centres or scoring targets.

## φ quantisation

Many raw sizes and distances are passed through a quantisation function that pulls them toward a sequence of φ-related values. The pull is blended according to **φ adherence**, rather than forcing every measurement to be mathematically identical.

This is why φ adherence is meaningful: it controls how much mathematical order survives versus how much freedom the generative system receives.

## Golden angle

The golden angle is approximately **137.507764°**. It appears in radial placement, branching, rotations, resets, spiral-related movement and several mode-specific relationships.

Because it is irrational relative to a full turn, repeated golden-angle steps distribute directions without quickly falling into obvious repeated spokes.

## Negative space

Empty space is generated, not accidental.

The system can create protected rectangular regions derived from golden subdivisions. Candidate layouts are penalised for intruding into them, while modes such as VOID actively compose around them.

## Hierarchy

Many systems distinguish hero, medium and small/supporting forms. Scale is not chosen independently for every object: it is quantised and adjusted so that the composition has dominant and subordinate levels.

This is one reason the generator produces compositions rather than evenly weighted collections of random shapes.

## Density and crowding

As element count rises, ALGO/ART changes its behaviour. Territory distribution becomes more important, object scale reduces, spacing rules adapt and some connection/shape probabilities fall. This prevents high-density images from simply becoming the same low-density algorithm with more marks piled on top.

---

# Marker rendering system

After a system has produced its mathematical construction, the marker engine turns that construction into visible strokes.

Available tools include:

- Felt Tip
- Fine Marker
- Broad Marker
- Highlighter
- Dry Marker
- Paint Pen
- Scribble Pen

The controls include thickness, wobble, overdraw, opacity, pressure and dryness.

A mathematically straight construction line therefore does not have to become a computer-perfect one-pixel vector line. It can be redrawn in multiple slightly displaced passes, vary in apparent pressure, become translucent, or break into dry-marker behaviour.

Supported primitives include straight lines, Bézier curves, ellipses, rectangles, polygons and arcs.

This produces the central tension of ALGO/ART:

> **The algorithm knows the geometry. The marker is allowed to misbehave.**

---

# Colour system

Colour is independent from geometry but remains deterministic.

Palettes include Full Spectrum, Golden-angle hues, Classic Markers, CMYK, Primary, Neon, Pastel, Earth, Warm, Cold and Monochrome.

The Colours control determines how many colours participate. Saturation and brightness transform the palette without changing the underlying composition.

Recent renderer behaviour also uses colour families to reinforce compositional relationships: major families receive stable primary colours while additional requested colours can act as accents on supporting forms.

---

# Reveal φ

**Reveal φ** is not merely a decorative overlay. The renderer returns guide metadata describing how the current system was constructed, and the interface uses that metadata to expose the hidden composition.

Depending on the mode it can reveal:

- 61.8% / 38.2% divisions
- golden-ratio focal intersections
- the golden logarithmic spiral
- hero / medium / supporting hierarchy
- reserved negative-space regions
- recursive rectangle cells and depth
- burst hubs and φ-scaled rays
- network backbone and secondary links
- scribble anchors, territories and flow
- organic roots and branch generations
- Constructed Forms scaffolding

Interactive explanations translate those construction features into plain English.

This is especially important conceptually: ALGO/ART's decisions are inspectable. The user can see much of the rule system responsible for the image instead of receiving only an unexplained final output.

---

# Top-down AI and generative art

ALGO/ART can be understood as a **top-down, rule-based generative system**.

The program has not learned the golden ratio from a dataset. We explicitly gave it knowledge such as:

- preferred φ focal positions;
- φ-related scales and distances;
- golden-angle turns;
- rules for hierarchy;
- rules for negative space;
- rules for network construction;
- rules for branching;
- composition strategies and scoring.

The system then applies those rules to a seeded state to generate a result.

In the broad symbolic-AI sense this is a top-down approach: human-authored knowledge and heuristics determine the search/generation process. It should not be confused with modern learned generative AI such as diffusion models. There is **no training dataset, neural network or prompt-to-image model** involved in creating the artwork.

---

# Controls and their role

The interface exposes much of the generative state directly:

- **Elements** — approximate amount of generated content.
- **Density** — affects scale, territories and how tightly content occupies the canvas.
- **Complexity** — increases structural elaboration; its exact effect is mode-specific.
- **Negative Space** — strengthens deliberately protected empty areas.
- **φ Adherence** — increases attraction to φ-quantised relationships.
- **Recursion** — controls recursive depth/generational behaviour where applicable.
- **Spiral Influence** — controls how strongly general layouts are pulled toward spiral placement.
- **Golden Angle** — controls the strength of golden-angle stepping in relevant systems.
- **Nesting** — increases nested forms.
- **Curved ↔ Straight** — changes the character of generated paths.
- **Shape Amount** — controls how frequently non-line forms appear.
- **Overlap** — changes tolerance for forms occupying the same visual territory.
- **Rotation** — controls rotational freedom.
- marker, colour and paper controls then determine the physical rendering.

The same control can intentionally have a different implementation in different modes. “Complexity” in a network, for example, does not need to mean exactly the same operation as complexity in a branching growth system.

---

# Seed, variation and exact-state sharing

The seed is part of the artwork.

All pseudo-random choices are derived from deterministic seeded generators. That includes composition family selection, positions, variations, palette choices and marker imperfections.

**4-Up Variations** creates four deterministic alternative seeds from the current state. **Mutate** changes a small group of parameters. **Randomise** explores the wider parameter space.

Share links encode the exact state in their query string, including renderer version, seed and controls. A recipient can therefore reopen the artwork as a generative state rather than only seeing a flattened image.

---

# Daily Gallery

The Daily Gallery is a permanent archive of generated states:

https://southernadd-cmyk.github.io/algoart/gallery/

Each entry records its image, seed, system/series, renderer version, settings, descriptive metadata and exact remix URL.

The gallery is also connected back to the generator: when the home page is opened **without explicit URL settings**, it reads the newest gallery edition and loads its **last artwork** as the default. This means the front page naturally moves forward as the gallery evolves while exact shared URLs remain stable.

The gallery publishes crawlable static HTML plus Open Graph/Twitter metadata, Schema.org structured data, RSS and sitemap information.

---

# Social publishing

The social pipeline uses the same deterministic generator rather than creating unrelated promotional images.

A social artwork is generated from a seed/settings state, rendered by the specified renderer version and published with a URL capable of reopening that exact state. Successful social works can therefore become gallery works without losing their generative identity.

This creates a continuous chain:

```text
rules + seed + settings
        ↓
     renderer
        ↓
 exact artwork state
    ↙          ↘
gallery       social
    ↘          ↙
      remix URL
```

---

# Export

ALGO/ART supports:

- PNG at 1×, 2× and 3× resolution
- SVG vector export

SVG export preserves generated marker paths, including the wobble, repeated passes, opacity and dry-marker dash behaviour rather than replacing the artwork with idealised geometric primitives.

The internal artwork coordinate space is **1400 × 1000**.

---

# Architecture

The project is intentionally lightweight and browser-native.

```text
index.html
css/style.css
js/random.js       seeded randomness
js/phi.js          golden-ratio helpers and spatial distributions
js/palettes.js     deterministic colour systems
js/marker.js       imperfect marker rendering
js/generator.js    the eight composition systems + Reveal metadata
js/export.js       PNG/SVG export
js/app.js          controls, URLs, versions, gallery default and interaction
automation/        gallery/social generation and publishing
gallery/           permanent daily archive
```

The public generator itself is static:

- no JavaScript framework
- no build step required for the generator
- no backend required to generate artwork
- no API key required
- suitable for GitHub Pages

Automation scripts are used separately to generate gallery/social assets and update the archive.

---

# Project philosophy

ALGO/ART is not trying to maximise the number of algorithms or imitate a text-to-image model.

Its purpose is to explore a specific relationship:

**Can a composition be strongly governed by mathematics while the marks that express it remain visibly human, loose and imperfect?**

The golden ratio provides the underlying grammar. The eight systems interpret that grammar differently: as fields, trajectories, divisions, radiance, connections, growth, constructed balance or automatic gesture.

The seeded generator makes those decisions reproducible.

The marker renderer makes them imperfect.

**Mathematics sets the rules. The marker breaks them.**
