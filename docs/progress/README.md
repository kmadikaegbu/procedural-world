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

*(Classes 03 onward: add an entry here as each happens — deck link + class
topics + what this repo actually did, same format as above. Screenshots can
go in `docs/progress/class-NN/` and get linked in from here.)*

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
