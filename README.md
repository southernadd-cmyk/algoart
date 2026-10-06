# ALGO/ART — φ Generator

**Mathematics sets the rules. The marker breaks them.**

ALGO/ART is a deterministic, browser-based generative art system built around the golden ratio. It does not use a trained image model. Instead, mathematical and aesthetic knowledge is explicitly encoded into the generator: φ-based proportions, golden-angle turns, recursive divisions, hierarchy, negative space, layout scoring and seeded variation. A separate marker engine then deliberately introduces physical-looking imperfection.

Live site: https://southernadd-cmyk.github.io/algoart/

**Current renderer: V6.**

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

Within a renderer version, the intended model is:

**renderer version + seed + settings = deterministic artwork state**

The renderer version is written into share URLs as `v=`, and the interface recognises versions **1 through 6**. New interactions use **V6**, while explicitly versioned links remain identifiable as legacy states in the UI.

### Renderer history

| Version | Main change |
| --- | --- |
| **V1** | Original field renderer and earliest deterministic artwork states. |
| **V2** | Reworked field layout/composition behaviour. |
| **V3** | Family-aware Field rendering, including shape-aware angular alignment and stronger relationships between hero, medium and supporting forms. |
| **V4** | Introduced the true golden logarithmic spiral used by Golden Trajectories and by spiral-influenced placement elsewhere. |
| **V5** | Reimagined Golden Trajectories so φ acts as a **trajectory grammar**, not a requirement to draw one complete textbook coil. It introduced multiple deterministic trajectory families including sweeps, fans, S-curves, echoes, intersections, cascades, orbits, scatter and cropped paths. |
| **V6** | Current hardened renderer. It keeps the diverse V5 trajectory idea but adds a visible-canvas safety test and deterministic `SAFE-SWEEP` fallback so a valid seed cannot quietly produce an empty/off-canvas Golden Trajectories export. |

V6 is also paired with publication-time image validation: social/gallery automation checks that a rendered canvas contains a meaningful amount of visible artwork before publishing it. A file merely existing is no longer considered proof of a successful render.

The unparameterised home page loads the final artwork from the newest Daily Gallery as its current default. A URL containing explicit artwork settings takes priority, so shared states are not replaced by the gallery default.

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

Golden Trajectories is the system in which φ is most explicitly treated as **movement through the canvas**.

### V4: the mathematical foundation

V4 introduced a true logarithmic golden spiral:

```text
r(θ) = a · e^(bθ)

b = 2 ln(φ) / π
```

Therefore:

```text
r(θ + π/2) = φ · r(θ)
```

Every quarter-turn multiplies the radius by φ. That relationship remains the mathematical foundation of the trajectory system.

### V5: from one spiral to a trajectory grammar

V5 deliberately moved beyond the idea that every Golden Trajectories work should visibly resemble a complete spiral. The same φ/golden-angle vocabulary can organise very different paths.

The deterministic family set introduced in V5 includes:

- **CLASSIC** — the recognisable logarithmic golden-spiral form.
- **SWEEP** — a broad curved trajectory entering and moving across the canvas.
- **FAN** — several golden-angle-related arms from a φ-biased anchor.
- **S-CURVE** — a long Bézier path moving between golden-section regions.
- **ECHO** — repeated related trajectories offset from one another.
- **INTERSECT** — multiple trajectories crossing through the composition.
- **CASCADE** — successively smaller path segments whose scale decays through φ.
- **ORBIT** — marks organised around an orbiting/curved path.
- **SCATTER** — a looser interpretation of the trajectory grammar.
- **CROP** — deliberately places the trajectory source outside the frame so marks enter from beyond the canvas edge.

This is a key conceptual change: **the mathematics defines the rule system; the final picture does not have to look like a diagram of that mathematics.**

### V6: hardened Golden Trajectories

Testing exposed an important V5 failure mode: some SWEEP/CROP combinations could generate a mathematically valid trajectory whose sampled points all sat outside the drawable canvas. The export existed, but visually it could be blank.

V6 checks how many generated trajectory points actually intersect the visible artwork area. If too few are visible, it deterministically replaces that path with **SAFE-SWEEP**: a φ-informed Bézier trajectory guaranteed to cross the canvas.

That renderer-level protection is reinforced by the automation layer, which samples rendered pixels and rejects near-empty output before an image is allowed into the social feed or gallery.

The result is still deterministic, but now the publishing pipeline distinguishes between **“a render completed”** and **“a visible artwork was actually produced.”**

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

In the current V6 interface, the principal golden frame and explanatory spiral are **composition-aware**. They are positioned from the artwork's dominant hero/focal region rather than simply being pasted into the centre of the canvas. The revealed geometry therefore explains the current composition instead of showing an unrelated generic golden-ratio diagram.

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

The normal daily generator creates a **five-work scheduled base set**, but a day is not limited to five entries. Validated test, repair or curated studies can be appended as additional works.

The gallery builder preserves those additional studies when the scheduled base set is regenerated. It no longer deletes the day's existing JPGs and rebuilds blindly from only the five scheduled entries. This matters because curated/validated work must survive later automation runs.

Social/gallery generation also performs visible-pixel validation before accepting a new render. Near-empty output is rejected rather than archived.

The gallery is connected back to the generator: when the home page is opened **without explicit URL settings**, it reads the newest gallery edition and loads its **last artwork** as the default. This means the front page naturally moves forward as the gallery evolves while exact shared URLs remain stable.

The gallery publishes crawlable static HTML plus Open Graph/Twitter metadata, Schema.org structured data, RSS and sitemap information.

---

# Social publishing

The social pipeline uses the same deterministic V6 generator rather than creating unrelated promotional images.

Current automated destinations are:

- **Instagram** — `@artalgorithm`
- **Threads** — `@artalgorithm`
- **Bluesky** — `@artalgorithm.bsky.social`
- **Pinterest** — supported by the workflow but only runs when explicitly enabled/configured

The main London publishing slots are **09:00, 15:00 and 20:30 (Europe/London)**. GitHub Actions uses redundant GMT/BST-aware triggers around each slot; a London-time gate determines which slot is due. This avoids depending on GitHub starting a cron job at one exact minute.

Before publishing, each platform checks a release-hosted completion marker such as:

```text
done-YYYY-MM-DD-slotN-instagram.txt
done-YYYY-MM-DD-slotN-threads.txt
done-YYYY-MM-DD-slotN-bluesky.txt
```

A successful platform post writes its marker immediately afterwards. If GitHub retries the workflow, already-completed destinations are skipped rather than knowingly posted twice.

A social artwork is generated from a seed/settings state, validated, rendered by the specified renderer version and published with a URL capable of reopening that state. The same validated work can therefore become a gallery entry without losing its generative identity.

This creates a continuous chain:

```text
rules + seed + settings
        ↓
   V6 renderer
        ↓
 visible-art validation
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

# Current V6 operational safeguards

The current production system includes several safeguards added after real publishing tests:

- **Visible-canvas trajectory fallback** prevents V5-style off-canvas Golden Trajectories from becoming blank V6 exports.
- **Pixel-level render validation** rejects images with too little visible artwork before publishing.
- **Per-platform completion markers** make social retries idempotent at the slot/platform level.
- **Curated-gallery preservation** prevents the scheduled five-image rebuild from deleting additional validated studies.
- **Explicit Pages dispatch after automation commits** avoids relying on a `GITHUB_TOKEN` push to fan out into another workflow.
- **Non-cancelling concurrency** prevents a later social run from cancelling a valid publish already in progress.
- **Composition-aware Reveal φ** anchors explanatory geometry to the generated artwork rather than the viewport centre.
- **Versioned share URLs** expose the renderer version alongside the deterministic seed/settings state.

These safeguards are operational rather than aesthetic: they are there to make the generated art reproducible, visible and reliably publishable.

---

# Project philosophy

ALGO/ART is not trying to maximise the number of algorithms or imitate a text-to-image model.

Its purpose is to explore a specific relationship:

**Can a composition be strongly governed by mathematics while the marks that express it remain visibly human, loose and imperfect?**

The golden ratio provides the underlying grammar. The eight systems interpret that grammar differently: as fields, trajectories, divisions, radiance, connections, growth, constructed balance or automatic gesture.

The seeded generator makes those decisions reproducible.

The marker renderer makes them imperfect.

**Mathematics sets the rules. The marker breaks them.**
