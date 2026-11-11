# Progress

## Contents

- [Progress by class](#progress-by-class)
- [Feature log](#feature-log)
- [Assignment checklist](CHECKLIST.md): what's still outstanding

## Progress by class

### Class 01 — Intro

**Deck:** [PWB — Class 01](https://www.figma.com/deck/POK6565upmCTz79sU6Q2ns/PWB---Class-01)

**Class topics:** Course intro & PCG framing; Microscope-style worldbuilding;
tools / version control (Git + GitHub).

**This repo's progress:** Wrote the [Git & GitHub](<../../Tutorials/Git & Github Tutorials.md>),
[Installing React](<../../Tutorials/Installing React.md>), and
[Installing three.js](<../../Tutorials/Installing three.js.md>) tutorials
now in `Tutorials/`; set up the first git repos and commits; scaffolded the
Vite + React + TypeScript project that became `react-app/`.

### Class 02 — Web tools: React + Three.js

**Deck:** [PWB — Class 02](https://www.figma.com/deck/PFjBPB5uuqJIZd3em9Kk7P)

**Class topics:** Traditional web stack (HTML / CSS / JS); tools — React +
Three.js app shell.

**This repo's progress:** Built the first interactive three.js canvas inside
React — an orbit-camera scene with a centered object (a cube, then a
noise-displaced orb), live control-panel sliders, a 2D/3D view toggle, and
the first pass of [`Style Guide.md`](<../../Style Guide.md>) defining the
visual design system (palette, lighting, procedural-generation rules).

### Class 03 — Noise Field + Simulations

**Deck:** [PWB — Class 03](https://www.figma.com/deck/Hc8vcT9xVjjd1p3sT5xKgQ/PWB---Class-03)

**Class topics / Assignment 1:** 3D grid in the viewport; 2D view of a noise
equation; apply noise to the 3D grid; slider controls for noise + grid
resolution; shaping ops; layered noise, noise-type blending.

**This repo's progress:** The full noise-driven height field — Seed,
Frequency, Octaves, Persistence, and Ridged controls over layered (fractal)
Perlin noise, a Resolution slider for grid density, a 2D/3D view toggle plus
a live top-down minimap, and a Sea Level control that reshapes the coast.
Completed afterwards: a Perlin ↔ cellular (Worley) noise-type blend on the
terrain itself, two shaping ops (a Redistribute power curve and Terraces),
and an inset mode that draws the raw noise field in grayscale, the 2D view
of the noise equation.

### Class 04 — Voxels

**Deck:** [PWB — Class 04](https://www.figma.com/deck/nGInnCOpuzyqmq9z8mFUod/PWB---Class-04)

**Class topics:** Geographic data, voxels, and terraforming.

**This repo's progress:** A Voxel scene rendering the exact same terrain
parameters as blocky instanced cubes instead of a shaded mesh — same seed,
sea level, and island shape as the Map scene, sharing weather and tree
placement with it. Trees are snapped onto the voxel grid so they can't
float over open water at the coastline. Terraforming followed: a Sculpt tab
with a Raise / Lower / Flatten brush that works in both scenes. Edits are
stored as a height-offset grid on top of the noise, so biomes, trees,
voxels, and the minimap all follow them, and they survive seed and shaping
changes.

### Class 05 — Shaders

**Deck:** [PWB — Class 05](https://www.figma.com/deck/XP1cVSq9wjUzFZuUn0ury1/PWB---Class-05)

**Class topics:** What shaders are and how they run on the GPU, then a tour
of shader examples: contact shaders (water marked where it touches the shore
and floating objects), vertex displacement (objects popping in, surface
ripples), contact shaders combined with vertex deformation, and the looks of
*Sable* and *Manifold Garden*.

**Assignment 2:**
- Create your own shader studies.
- Show an understanding of what shaders can do for your simulations.
- Consider which shaders you could use or would like to develop, and why.
- Build a section of the app dedicated to shaders that lets you swap between
  strategies.

**This repo's progress:** Three custom shaders, all written by patching
three.js materials with `onBeforeCompile`:

- **Water** ([`waterMaterial.ts`](../../react-app/src/map/water/waterMaterial.ts)):
  Gerstner waves displace the vertices. Colour comes from a terrain depth map,
  pale and clear in the shallows and dark in deep water. White foam laps
  where the water meets the land, which is a contact effect worked out from
  terrain depth. Ripples and reflections sit on top. It has its own Water
  panel.
- **Ground** ([`grassMaterial.ts`](../../react-app/src/map/grass/grassMaterial.ts)):
  per-pixel grass with moisture, season, grain and bare soil on steep slopes.
  It also paints the paved city and the 1811 street grid, both driven by the
  History Timeline.
- **Trees** ([`materials.ts`](../../react-app/src/map/trees/materials.ts)):
  season colours are patched into the tree shader. The Tree panel's **Look & season**
  switch swaps between three shading strategies: realistic, flat and toon.

Still open: a dedicated shader section, a written note on the chosen
strategy, and a contact shader that also foams around objects standing in
the water (see the [checklist](CHECKLIST.md#class-05-shaders-assignment-2)).

### Class 06

**Deck:** [PWB — Class 06](https://www.figma.com/deck/U71zqbp10aK9ev95kpopkZ)

**Class topics:** _TBD_

**This repo's progress:** _TBD_

### Class 08 — Agents and Scale

**Deck:** [PWB — Class 08](https://www.figma.com/deck/ZXPEZJjOz4JqAmhYm8KHW5/PWB---Class-08)

**Class topics:** Agent-based systems: flocking (Craig Reynolds' alignment,
cohesion and separation), social insects and stigmergy (ant pheromone
trails), crowd simulation, finite state machines, perception (cones of
vision with obstructions), predator–prey steering, stealth-game AI, the
Sims' affordances and hierarchy of needs, and behaviour trees. Then PCG 06:
Scale, how architectural drawings set a scale and keep objects in
proportion to it.

**Assignment 1 (agents):**
- Consider whether your world has inhabitants, and how they behave.
- Consider a state machine, a scheduling system or a behaviour tree, based
  on your needs.
- Consider how simple rules can give complex behaviour, as in flocking and
  termites' stigmergy.
- Consider how different species of agents can form an ecosystem that
  interacts.

**Assignment 2 (scale):**
- Define a scale to work at.
- Make objects proportional to that scale.
- Consider how resolution is connected to scale, and to the camera's
  position.

**This repo's progress:** A **Wildlife** tab with three species in the land
around Roosevelt Island ([`map/wildlife/`](../../react-app/src/map/wildlife/)):

- **Birds** flock with Reynolds' three rules, each looking only at its
  neighbours.
- **Deer** are a state machine: graze, flee when a fox comes close.
- **Foxes** are a state machine with perception: wander, hunt a deer they
  see inside their cone of vision, eat, rest. Hunger rises all the time, so
  a fox that catches nothing starves, and a fed fox may raise a kit.
- **Habitat ties them to the history.** The animals only live on land the
  city hasn't paved (the same rule that clears the trees). As the History
  Timeline paves the city, animals on paved ground follow a flow field back
  to the nearest wild land, or leave when there's none. How many of each the
  land holds falls with the share that's still wild, so by today they're
  down to Roosevelt Island.
- **Show states** tints every animal by its state and draws the foxes'
  cones of vision; the panel counts each species by state.
- **Real animal models.** The deer and foxes use Quaternius's rigged,
  hand-animated low-poly Deer, Stag and Fox (CC0, from
  [Poly Pizza](https://poly.pizza/u/Quaternius)). The models' animations are
  baked into textures when the page loads, so the whole herd still draws in one
  call per model. Each animal plays the clip that fits its state (walk, gallop,
  graze or drink, idle, rest), at the pace that keeps its hooves planted.
  Grown bucks use the Stag, with antlers. The birds are still built in code,
  because no free bird model has a flying animation.

Scale was already done: [Real-World Scale](<../../Tutorials/Real-World Scale.md>)
defines 1 unit = 33.5 m, keeps every object in proportion through one
factor per category, and offers a Readable / True to scale switch. The
animals use the same rule, with a Size slider on top because a real deer
is a twentieth of a unit.

*(Class 09 onward: add an entry here as each happens — deck link + class
topics + what this repo actually did, same format as above.)*

<details>
<summary>Adding screenshots for a class</summary>

1. Save an image into `docs/progress/class-NN/` (create the folder if it
   doesn't exist yet).
2. Reference it under that class's entry above:
   ```markdown
   ![Caption](class-NN/screenshot.png)
   ```
3. Commit and push — it'll render on the GitHub repo page.

</details>

## Feature log

A running record of what's been built, organized by feature area rather than
class session — more granular than the by-class summary above.

### Terrain & map

- Height-field terrain from seeded fractal noise (seed, frequency,
  octaves, persistence, ridged toggle)
- Noise-type blending: Perlin ↔ cellular (Worley), mixed per octave
- Shaping ops: Redistribute (power curve) and Terraces (flat steps)
- Hydraulic erosion: a droplet simulation (`map/erosion.ts`) that carves valleys and
  deposits sediment, stored as an offset grid so it layers on the noise; Erosion
  slider in the Terrain tab (thousands of drops)
- Masked into the real Roosevelt Island outline, with a width control and an
  island on/off toggle (raw square noise field when off). *(Since 2026-10-28
  this is the whole of New York City on its real coastline, with Roosevelt
  Island inside it; one map, no toggle.)*
- Biome coloring (water → sand → grass → rock → snow), thresholds scaled to
  amplitude and shifted by sea level
- Sea level control — floods or drains the coast; biomes and tree placement
  move with it, not just a floating water plane
- A pan/offset control that slides through the same noise field without
  jumping the coastline (separate from the seed, which does jump)
- Terraforming: a Raise / Lower / Flatten brush (Sculpt tab) with size,
  strength, undo, and reset. Edits sit on top of the procedural terrain, and
  raising the river builds new land
- Gradual snow accumulation on the ground while it's snowing, melting back
  when it stops
- A climate timeline (1950–2100) that drives sea level through a stylized
  rise curve, with Play/Stop animation — watch the coast flood over time

### City

- **Real buildings (2026-11-10).** All 421,993 buildings standing on the map
  today come from NYC Open Data's
  [Building Footprints](https://data.cityofnewyork.us/d/5zhs-2jue): each at its
  real place, as the smallest rectangle around its outline, at its real roof
  height, rising in its recorded construction year.
  `react-app/scripts/build-nyc-buildings.mjs` downloads them and packs them into
  `public/data/nyc-buildings.bin` (5.2 MB); `map/city/realBuildings.ts` loads it
  after the page starts, and the city rebuilds once it arrives.
- **The lost city.** The data only holds buildings that still stand, so the
  procedural buildings now stand for the ones that were torn down: each comes
  down when the first real building on its ground goes up, or in about 1950
  where nothing stands today. Roosevelt Island keeps its photo-placed buildings.
- **Caveats:** 64% of the years are round numbers, so the city fills in with
  jumps at 1910, 1920 and 1930; 3,758 buildings have no year and get an
  estimate from the city's growth.

### Props & weather

- Seeded tree scattering, clustered by a density-noise field, with a
  Count/Replant control and a fixed instance pool for cheap live redraws
- Full weather system: sky/sun position, fog, cloud puffs (count, altitude,
  spread, size, opacity, speed — independent of overall cloud cover), and
  rain/snow particles with wind drift
- A Simulation Running/Paused control that freezes all of the above in place

### Scenes

- **Map** — the smooth terrain scene described above
- **Voxel** — the exact same terrain params (seed, sea level, island shape…)
  rendered as blocky instanced cubes instead of a shaded mesh; trees are
  snapped onto the voxel grid so they can't float over open water
- *(The separate noise-displaced Orb scene built in Class 01–03 was removed
  on 2026-10-25. Its cellular noise lives on in the terrain.)*
- A fixed-corner 2D top-down minimap, live-updating with the main scene;
  switchable to a grayscale view of the raw noise field

### Tooling

- Firebase Hosting deploy (`react-app/firebase.json`, predeploy build hook)
- Hover tooltips on every control explaining what it does
