# Progress

A running record of what's been built, in the order it was built — not
organized by class session, since that mapping isn't filled in here yet.
(If you want a class-01 … class-NN breakdown like the folder structure
suggests, add `docs/progress/class-01/`, etc. and move the relevant
entries below into each.)

## Terrain & map

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

## Props & weather

- Seeded tree scattering, clustered by a density-noise field, with a
  Count/Replant control and a fixed instance pool for cheap live redraws
- Full weather system: sky/sun position, fog, cloud puffs (count, altitude,
  spread, size, opacity, speed — independent of overall cloud cover), and
  rain/snow particles with wind drift
- A Simulation Running/Paused control that freezes all of the above in place

## Scenes

- **Map** — the smooth terrain scene described above
- **Voxel** — the exact same terrain params (seed, sea level, island shape…)
  rendered as blocky instanced cubes instead of a shaded mesh; trees are
  snapped onto the voxel grid so they can't float over open water
- **Orb** — a separate noise-displaced sphere (fractal Perlin + cellular/
  Worley noise, adjustable gradient)
- A fixed-corner 2D top-down minimap, live-updating with the main scene

## Tooling

- Firebase Hosting deploy (`react-app/firebase.json`, predeploy build hook)
- Hover tooltips on every control explaining what it does
