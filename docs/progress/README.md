# Progress

## Contents

- [Progress by class](#progress-by-class)
- [Feature log](#feature-log)

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
Noise-type blending was explored separately in the Orb scene, which
combines Perlin with cellular/Worley noise.

### Class 04 — Voxels

**Deck:** [PWB — Class 04](https://www.figma.com/deck/nGInnCOpuzyqmq9z8mFUod/PWB---Class-04)

**Class topics:** Geographic data, voxels, and terraforming.

**This repo's progress:** A Voxel scene rendering the exact same terrain
parameters as blocky instanced cubes instead of a shaded mesh — same seed,
sea level, and island shape as the Map scene, sharing weather and tree
placement with it. Trees are snapped onto the voxel grid so they can't
float over open water at the coastline.

### Class 05 — Shaders

**Deck:** [PWB — Class 05](https://www.figma.com/deck/XP1cVSq9wjUzFZuUn0ury1/PWB---Class-05)

**Class topics / Assignment 2:** Shader studies; what shaders can do for
simulations; choosing a strategy; a dedicated in-app section to swap shader
approaches.

**This repo's progress:** Not started yet — the app currently uses stock
three.js materials (`MeshStandardMaterial`, etc.) throughout; no custom
GLSL has been written.

### Class 06

**Deck:** [PWB — Class 06](https://www.figma.com/deck/U71zqbp10aK9ev95kpopkZ)

**Class topics:** _TBD_

**This repo's progress:** _TBD_

*(Class 07 onward: add an entry here as each happens — deck link + class
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

- Height-field terrain from seeded fractal Perlin noise (seed, frequency,
  octaves, persistence, ridged toggle)
- Masked into the real Roosevelt Island outline, with a width control and an
  island on/off toggle (raw square noise field when off)
- Biome coloring (water → sand → grass → rock → snow), thresholds scaled to
  amplitude and shifted by sea level
- Sea level control — floods or drains the coast; biomes and tree placement
  move with it, not just a floating water plane
- A pan/offset control that slides through the same noise field without
  jumping the coastline (separate from the seed, which does jump)
- Gradual snow accumulation on the ground while it's snowing, melting back
  when it stops
- A climate timeline (1950–2100) that drives sea level through a stylized
  rise curve, with Play/Stop animation — watch the coast flood over time

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
- **Orb** — a separate noise-displaced sphere (fractal Perlin + cellular/
  Worley noise, adjustable gradient)
- A fixed-corner 2D top-down minimap, live-updating with the main scene

### Tooling

- Firebase Hosting deploy (`react-app/firebase.json`, predeploy build hook)
- Hover tooltips on every control explaining what it does
