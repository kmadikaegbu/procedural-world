# Tools and Procedural Techniques

What this project is built with, where its data and models come from, and how
each part of the world is generated. Every technique links to the code that
does it.

- [What I used](#what-i-used)
  - [Software and libraries](#software-and-libraries)
  - [Real-world data](#real-world-data)
  - [3D models](#3d-models)
  - [Methods and references](#methods-and-references)
- [The procedural techniques](#the-procedural-techniques)
  - [At a glance](#at-a-glance)
  - [1. Seeded randomness](#1-seeded-randomness)
  - [2. Terrain: fractal noise shaped by the real coastline](#2-terrain-fractal-noise-shaped-by-the-real-coastline)
  - [3. Hydraulic erosion](#3-hydraulic-erosion)
  - [4. Variable-density mesh](#4-variable-density-mesh)
  - [5. Trees: L-systems and a turtle](#5-trees-l-systems-and-a-turtle)
  - [6. Scattering the forest](#6-scattering-the-forest)
  - [7. Level of detail and instancing](#7-level-of-detail-and-instancing)
  - [8. Ivy: steered growth](#8-ivy-steered-growth)
  - [9. Grass and ground: per-pixel shading](#9-grass-and-ground-per-pixel-shading)
  - [10. Water: Gerstner waves](#10-water-gerstner-waves)
  - [11. The city: real data plus a rule-based lost city](#11-the-city-real-data-plus-a-rule-based-lost-city)
  - [12. Building over time on the GPU](#12-building-over-time-on-the-gpu)
  - [13. Bridges fitted to the shoreline](#13-bridges-fitted-to-the-shoreline)
  - [14. Wildlife: boids, state machines and a habitat grid](#14-wildlife-boids-state-machines-and-a-habitat-grid)
  - [15. Animation baked into textures](#15-animation-baked-into-textures)
  - [16. Island life: an agent-based city simulation](#16-island-life-an-agent-based-city-simulation)
  - [17. Weather](#17-weather)
  - [18. Hand tools: sculpting and painting](#18-hand-tools-sculpting-and-painting)
- [What is real and what is generated](#what-is-real-and-what-is-generated)

---

## What I used

### Software and libraries

| Tool | Version | What it's for |
| --- | --- | --- |
| [TypeScript](https://www.typescriptlang.org) | 6.0 | The language the app is written in |
| [React](https://react.dev) | 19.2 | The interface: panels, sliders, the tour |
| [three.js](https://threejs.org) | r185 | 3D rendering: meshes, materials, shaders, instancing |
| [@react-three/fiber](https://r3f.docs.pmnd.rs/) | 9.7 | Writing a three.js scene as React components |
| [@react-three/drei](https://drei.docs.pmnd.rs/) | 10.7 | Ready-made helpers: camera controls, the sky dome, stars, cloud puffs, labels |
| [Vite](https://vite.dev) | 8.2 | Development server and production build |
| [oxlint](https://oxc.rs/docs/guide/usage/linter) | 1.79 | Linting |
| [Node.js](https://nodejs.org) | 20.19+ / 22.12+ | Running the data-preparation scripts in [`react-app/scripts/`](../react-app/scripts/) |
| [Firebase Hosting](https://firebase.google.com/docs/hosting) | | Publishing the live site |
| Git and [GitHub](https://github.com/kmadikaegbu/procedural-world) | | Version control, one commit per feature |
| [Obsidian](https://obsidian.md) | | Writing the course notes and tutorials (plain Markdown) |

Noise comes from three.js's built-in `ImprovedNoise` (Ken Perlin's improved
noise). Cellular noise, the random number generator, the L-system, the
erosion, the simulations and every shader are written for this project.

### Real-world data

All three NYC datasets are downloaded and packed into small files by the
scripts in [`react-app/scripts/`](../react-app/scripts/), and the page loads
those files.

| Data | Source | Used for |
| --- | --- | --- |
| Shoreline | NYC Department of City Planning, *Borough Boundaries (Clipped to Shoreline)* | Where the land and water are. [`build-nyc-shore.mjs`](../react-app/scripts/build-nyc-shore.mjs) projects and simplifies it into [`nycShore.json`](../react-app/src/map/world/nycShore.json) (≈70 KB). |
| Buildings | [NYC Open Data, *Building Footprints*](https://data.cityofnewyork.us/d/5zhs-2jue) | 422,000 real buildings, each with its position, smallest bounding rectangle, roof height and construction year. [`build-nyc-buildings.mjs`](../react-app/scripts/build-nyc-buildings.mjs) packs them into a 5 MB binary file. |
| Streets | [NYC Open Data, *Centerline* (CSCL)](https://data.cityofnewyork.us/d/inkn-q76z) | 71,500 street, highway, path, ramp and alley lines, with roadbed widths. [`build-nyc-streets.mjs`](../react-app/scripts/build-nyc-streets.mjs) packs them into a 1.3 MB file. |
| Sea level | [NOAA tide gauge at the Battery (8518750)](https://tidesandcurrents.noaa.gov/sltrends/msltrendstable.htm) | The measured rise since 1856 (2.94 mm a year) |
| Population | [NYC Planning, historical population 1790–2000](https://www.nyc.gov/assets/planning/download/pdf/data-maps/nyc-population/historical-population/1790-2000_nyc_total_foreign_birth.pdf), and the 2020 census | The population figure the timeline shows, and the size of Roosevelt Island's simulated population (11,722 residents) |
| Roosevelt Island's buildings | Reference photographs and published dates (sources listed in [History and Design Position](<../Tutorials/History and Design Position.md#sources>)) | The island's own buildings, placed by hand in [`world/island.ts`](../react-app/src/map/world/island.ts) |

### 3D models

Everything else in the world, from terrain and trees to buildings, bridges, the
Statue of Liberty and the birds, is generated in code. The only imported models
are these, in [`react-app/public/models/`](../react-app/public/models/):

| Models | Author | Licence | From |
| --- | --- | --- | --- |
| Deer, Stag, Fox | Quaternius | CC0 | [Poly Pizza](https://poly.pizza/u/Quaternius) |
| Man, Man in Suit, Woman, Woman in Dress | Quaternius | CC0 | [Poly Pizza](https://poly.pizza/u/Quaternius) |
| Car, Sedan, SUV, Pickup Truck | Quaternius | CC0 | [Poly Pizza](https://poly.pizza/u/Quaternius) |
| [Bus](https://poly.pizza/m/4CPpvEmrMoF), [Van](https://poly.pizza/m/aT_24cDaW1a) | Poly by Google | CC-BY 3.0 | [Poly Pizza](https://poly.pizza/u/Poly%20by%20Google) |

There are no texture images: every surface is coloured by a shader or by
per-vertex colours.

### Methods and references

| Method | Where it comes from | Used for |
| --- | --- | --- |
| Perlin noise, fractal Brownian motion | Ken Perlin (1985, improved 2002) | Terrain height |
| Cellular (Worley) noise | Steven Worley (1996) | Blended with Perlin for terrain |
| L-systems and turtle graphics | Aristid Lindenmayer; Prusinkiewicz and Lindenmayer, *The Algorithmic Beauty of Plants* (1990) | Trees |
| Gerstner waves | Franz Gerstner (1802), as used in real-time water rendering | The sea |
| Exact distance transform | Felzenszwalb and Huttenlocher, *Distance Transforms of Sampled Functions* (2012) | Distance to the coast |
| Boids | Craig Reynolds, *Flocks, Herds, and Schools* (1987) | Bird flocks |
| Units, agents, paths and resources | Stone Librande's SimCity design diagrams (Class 09) | Roosevelt Island's city simulation |
| Dijkstra's shortest path | Edsger Dijkstra (1959) | Finding routes on the island's streets |
| Mulberry32 | A small public-domain random number generator | Reproducible randomness |
| Design precedents | Welikia, the 1811 Commissioners' Plan, *Delirious New York* and others (see the [README](../README.md#standing-on-precedents)) | The project's argument |

---

## The procedural techniques

### At a glance

| # | Technique | What it makes | Main code |
| --- | --- | --- | --- |
| 1 | Seeded randomness and hashing | The same world from the same seed | [`noise.ts`](../react-app/src/map/noise.ts), [`trees/scatter.ts`](../react-app/src/map/trees/scatter.ts) |
| 2 | Fractal noise and a signed-distance coastline | The ground | [`noise.ts`](../react-app/src/map/noise.ts), [`world/sdf.ts`](../react-app/src/map/world/sdf.ts), [`world/shore.ts`](../react-app/src/map/world/shore.ts) |
| 3 | Droplet hydraulic erosion | Valleys, sediment fans, sharper ridges | [`erosion.ts`](../react-app/src/map/erosion.ts) |
| 4 | Variable-density (tensor) grid | One mesh for the whole city, detailed at the island | [`world/grid.ts`](../react-app/src/map/world/grid.ts) |
| 5 | Stochastic L-systems | Tree shapes | [`trees/`](../react-app/src/map/trees/) |
| 6 | Hashed scattering with rules | Where each tree grows, and its size | [`trees/scatter.ts`](../react-app/src/map/trees/scatter.ts) |
| 7 | Level of detail, instancing | Thousands of trees at a usable frame rate | [`trees/lod.ts`](../react-app/src/map/trees/lod.ts) |
| 8 | Steered growth | Ivy on trunks and banks | [`trees/ivy.ts`](../react-app/src/map/trees/ivy.ts) |
| 9 | Per-pixel procedural shading | Grass, soil, paving | [`grass/grassMaterial.ts`](../react-app/src/map/grass/grassMaterial.ts) |
| 10 | Gerstner waves, depth map, Fresnel | The sea | [`water/`](../react-app/src/map/water/) |
| 11 | Rule-based generation along real streets | The lost city that came before today's | [`city/layout.ts`](../react-app/src/map/city/layout.ts) |
| 12 | GPU reveal by year | Streets and buildings rising as the timeline plays | [`city/City.tsx`](../react-app/src/map/city/City.tsx), [`timeline.ts`](../react-app/src/map/timeline.ts) |
| 13 | Shoreline search and part lists | Bridges that span their rivers and build up over the years | [`city/bridges.ts`](../react-app/src/map/city/bridges.ts) |
| 14 | Boids, state machines, flow fields | Birds, deer and foxes | [`wildlife/`](../react-app/src/map/wildlife/) |
| 15 | Vertex animation textures | Hundreds of animated animals and people, cheaply | [`wildlife/models.ts`](../react-app/src/map/wildlife/models.ts) |
| 16 | Agent-based simulation, street graph | Roosevelt Island's people, buses, cars and trash | [`islandlife/`](../react-app/src/map/islandlife/) |
| 17 | Particles, sky model | Weather | [`weather/`](../react-app/src/weather/) |
| 18 | Brushes on an edit grid | Sculpting terrain, painting where trees go | [`terraform.ts`](../react-app/src/map/terraform.ts), [`TerraformBrush.tsx`](../react-app/src/map/TerraformBrush.tsx) |

### 1. Seeded randomness

Nothing uses `Math.random()` for the world. A small generator (mulberry32) is
started from a seed, so the same seed always gives the same terrain, forest
and animals. The forest goes further: each candidate tree spot gets its own
seed from a hash of the base seed and its index. That way, changing one slider
or editing the ground never reshuffles the trees that weren't affected.

### 2. Terrain: fractal noise shaped by the real coastline

- **Noise.** The height comes from fractal Brownian motion: several *octaves*
  of noise are added together, each at twice the frequency and a fraction
  (*persistence*) of the strength of the one before. Each octave can mix
  Perlin noise with cellular (Worley) noise, and a *ridged* option folds the
  noise into sharp ridges.
- **Shaping.** The noise then passes through a power curve (*redistribution*)
  and optional *terraces*, which snap it into flat steps.
- **Coastline.** The real shoreline polygons are painted into a grid, and
  every cell gets its signed distance to the coast: positive on land, negative
  in water. The Felzenszwalb–Huttenlocher transform computes this exactly in
  two passes.
  - The height is built from that distance. Land rises from the shore, the
    riverbed deepens offshore, and the noise adds relief on top.
  - Roosevelt Island has its own field, so it can be widened without closing
    the river channels.
- **Biomes.** Sand, grass, rock and snow are height bands, measured as a
  fraction of the relief, so the mix stays believable at any setting.

### 3. Hydraulic erosion

Thousands of simulated raindrops run downhill over the height field. Each
drop:

- picks up sediment where it moves fast on steep ground,
- drops it where it slows,
- and slowly evaporates.

Half the drops are clustered around Roosevelt Island, where the detail is.
The result is stored as height *offsets*, so erosion layers on top of the
noise and can be turned off or redone without changing the noise.

### 4. Variable-density mesh

One grid covers the whole city. Its lines are close together within 50 units
(about 1.7 km) of Roosevelt Island, and get further apart toward the edges.
Every row and column runs across the whole mesh, so there are no seams
between the detailed and the coarse parts. The result is about 164,000
vertices for the whole city.

### 5. Trees: L-systems and a turtle

A tree is a string of symbols, rewritten by rules a set number of times
(*generations*). For example, `A → F[/&A][\&A]` turns every bud into a branch
with two new buds. A *turtle* then walks the final string and draws it:

- `F` moves forward, drawing a branch.
- `+ - & ^ \ /` turn, pitch and roll.
- `[ ]` start and end a side branch.

Rules carry probabilities, and the seed picks between them and jitters every
angle, so one recipe gives many different trees. The three species are
readable rule strings in [`species.ts`](../react-app/src/map/trees/species.ts).
Seasons change leaf colour and how many leaves stay on, without regrowing
anything. The [developer guide](../react-app/README.md#procedural-trees)
explains every slider.

### 6. Scattering the forest

Candidate spots cover the map. A tree grows only on the grass band, below a
slope limit and outside paved ground. It also has to keep a minimum distance
from other trees, and grows inside a painted mask if one is on. A slow noise
field groups trees into *stands*. Each tree's size comes from its stand's age
and its site, with stunted trees on exposed slopes and tall ones in hollows,
rather than a dice roll.

### 7. Level of detail and instancing

Each tree shape is built at four levels from the same recipe. LOD1 is the
full tree with its last generation removed, so the branches it keeps stay in
place. Each frame, every tree picks a level by its distance from the camera.
A dead band (*hysteresis*) around each threshold stops trees on a boundary
from flickering. All the trees of one shape and level are drawn in a single
instanced draw call.

### 8. Ivy: steered growth

Unlike the trees, ivy has no grammar; it grows by feel. Each strand tip takes
small steps, blending five pulls:

- keep going the way it was heading,
- wander a little,
- move toward the nearest surface (*adhesion*),
- climb while it's clinging to a trunk,
- droop under gravity when there's nothing to hold.

Strands fork now and then and drop leaves as they go.

### 9. Grass and ground: per-pixel shading

The terrain's colour per vertex is too coarse (one vertex every 17 m), so a
shader adds detail per pixel, on grass only:

- ragged edges between colour bands,
- moisture patches at two scales,
- bare soil on steep slopes,
- fine grain,
- wind sheen, wetness after rain, and fading under snow.

A *Paving* control turns built-up ground grey as the city grows over it.

### 10. Water: Gerstner waves

The sea is one flat sheet whose shader adds:

- **Waves:** four Gerstner waves. Each pulls the surface toward its crests as
  well as lifting it, which gives sharp crests and flat troughs.
- **Depth colour:** a depth map, sampled from the terrain, makes the
  shallows pale and deep water dark.
- **Foam:** where dry land is close, and whitecaps on the tallest crests.
- **Ripples and reflection:** moving ripples, and a Fresnel reflection of
  the sky.

Wind, rain and cloud change all of these. See
[Procedural Water](<../Tutorials/Procedural Water.md>).

### 11. The city: real data plus a rule-based lost city

Today's 422,000 buildings and every street are real data. But the data only
knows buildings that still stand, so the ones demolished before them are
generated from a few rules that hold for New York:

- The town grew outward from the Battery, so a lot's year comes from its
  distance to it, plus some delay.
- Streets come first, then the buildings along them.
- Each district has its own grid angle (Manhattan's is 29°).
- Buildings are low at first. Later, business cores such as Wall Street and
  Midtown replace them with towers.

Each lost building comes down in the year the first real building on its
ground goes up. Where nothing stands today, it is cleared around 1950. Parks,
cemeteries and airfields are left empty.

### 12. Building over time on the GPU

Every street and building is placed once, carrying the year it appears and,
for lost buildings, the year it goes. Moving the Year slider sends one number
to the GPU, and the shader decides what is built:

- A street is laid from one end as a dirt track, then paved.
- A building rises in fresh grey concrete and settles into its own colour.
- A building that is pulled down sinks away.
- Anything below the sea is hidden.

The sea level comes from the NOAA gauge up to today, and from a deliberately
steep, stylised curve after that.

### 13. Bridges fitted to the shoreline

Each bridge is given only as an approximate point, a bearing and its dates.
The program walks along that line, finds where it really crosses the water on
the map's shoreline, and spans it from shore to shore. Each bridge is a list
of parts (piers, towers, deck sections, cables), each with its moment in the
construction. As the year moves through its building years, the piers and
towers go up, then the deck grows out from both banks until the last gap in
the middle closes.

### 14. Wildlife: boids, state machines and a habitat grid

- **Birds** flock with Reynolds' three boid rules: alignment, cohesion and
  separation.
- **Deer and foxes** are state machines:
  - a deer grazes, and flees when a fox comes close;
  - a fox wanders, hunts when hungry and it sees a deer inside its cone of
    vision, eats, rests, and starves if it goes too long without food;
  - well-fed foxes raise kits.
- **Habitat:** a grid marks land as wild or paved, using the same rule that
  clears the trees.
  - A breadth-first search from every wild cell gives each cell a step
    toward the nearest wild land (a *flow field*).
  - Animals stranded on paved ground follow those steps home.
  - A second field leads thirsty animals to water, and slope slows them on
    hills.
  - The number of animals the land can hold falls as the city paves it, so
    by today the animals retreat to Roosevelt Island.

### 15. Animation baked into textures

Rigged models are normally animated on the CPU, one skeleton per animal, and
can't be instanced. Instead, when the page loads, each animation clip is
played once and every vertex position, frame by frame, is written into a
texture. The GPU reads each animal's or person's pose from that texture. A
whole herd or crowd is then one draw call per model, and each one can be at
its own point in its own clip.

### 16. Island life: an agent-based city simulation

Roosevelt Island runs as a small city, organised after Stone Librande's
SimCity diagrams:

- **Units:** homes, workplaces, the school, shops, parks, three stations and
  the trash plant.
- **Agents:** people, each standing for ten. Each follows a daily schedule set
  by who they are: commuters, workers, children, retirees, students, hospital
  staff on three shifts, and visitors.
- **Paths:** the island's real streets from the city's data, joined into a
  graph.
  - Dijkstra's algorithm finds each trip's route.
  - Cars and buses keep to the right-hand lane.
  - People walk the pavements and footpaths.
- **Vehicles and timetables:** the Tram, subway and bus run on timetables and
  carry a limited number each trip, so queues build at the rush hours. Cars
  come over the bridge, more of them at the rush hours.
- **Resources:** trash, made at home and in the hospitals, is sucked through
  the AVAC tubes to the plant. Electricity is counted for each building's
  occupants.

### 17. Weather

- **Sky:** a physically based sky dome (drei's `Sky`) sets the sky colour,
  with the sun's height, fog and cloud cover tied to the weather settings.
- **Clouds:** drifting volumetric cloud puffs.
- **Rain and snow:** a fixed pool of particles falls through a box, and each
  wraps back to the top when it reaches the floor, so the effect loops
  forever at a constant cost.

### 18. Hand tools: sculpting and painting

- **Sculpting:** brushes raise, lower or flatten the ground. Their strokes,
  like erosion, are stored as offsets on an edit grid over the procedural
  height, so they can be undone.
- **Planting mask:** a second brush paints where trees may grow.
- **Voxel view:** shows the same ground as instanced blocks.

---

## What is real and what is generated

| Real data | Estimated | Designed or generated |
| --- | --- | --- |
| Shoreline, today's buildings and their heights, streets, sea level to today, population | Missing construction years, the city's spread from the Battery, bridge positions (corrected to the shoreline) | Terrain relief, trees, grass, water, the lost city, wildlife, island life's schedules, future sea level |

The full breakdown, feature by feature, is in
[History and Design Position](<../Tutorials/History and Design Position.md>),
and the limits of the model are under
[Being honest about the model](../README.md#being-honest-about-the-model).
