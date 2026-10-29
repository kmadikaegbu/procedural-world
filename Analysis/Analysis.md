# Analysis

Reference material, precedent, and research behind the Roosevelt Island
procedural world — real-world sources, prior art, and technique notes.

## Site reference

- Roosevelt Island, NYC — a ~3.2 km ribbon in the East River between
  Manhattan and Queens. Its outline now comes straight from the city's own
  shoreline data rather than a hand-traced profile.
- [NYC Department of City Planning — Borough Boundaries (Clipped to Shoreline)](https://www.nyc.gov/site/planning/data-maps/open-data/districts-download-metadata.page)
  — the coastline of the whole map, including Roosevelt Island
- [RIOC island map](https://rioc.ny.gov) — source originally traced for the island's coastline
  profile in `react-app/src/map/noise.ts`.

## Technique references

- Fractal Brownian motion (layered Perlin noise) for the height field
- [Red Blob Games — Making maps with noise functions](https://www.redblobgames.com/maps/terrain-from-noise/)
- Worley/cellular noise, blended with Perlin per octave into the terrain's height field
- Heightmap-voxelization (column-based, not true 3D volumetric) for the
  Voxel scene — no caves/overhangs needed since the real island is flat

*(Fill in as you go — add precedent apps, papers, or inspiration here.)*
