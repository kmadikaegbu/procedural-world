# Analysis

Reference material, precedent, and research behind the Roosevelt Island
procedural world — real-world sources, prior art, and technique notes.

## Site reference

- Roosevelt Island, NYC — a ~3.2 km ribbon in the East River between
  Manhattan and Queens. Landmarks modeled in the island outline: Lighthouse
  Park, Coler Hospital (north & south campuses), The Octagon, Roosevelt
  Island Bridge, Blackwell Park, the Tram/Sportspark, Four Freedoms Park.
- [RIOC island map](https://rioc.ny.gov) — source traced for the coastline
  profile in `react-app/src/map/noise.ts`.

## Technique references

- Fractal Brownian motion (layered Perlin noise) for the height field
- [Red Blob Games — Making maps with noise functions](https://www.redblobgames.com/maps/terrain-from-noise/)
- Worley/cellular noise for the orb scene's cracked/cellular surface
- Heightmap-voxelization (column-based, not true 3D volumetric) for the
  Voxel scene — no caves/overhangs needed since the real island is flat

*(Fill in as you go — add precedent apps, papers, or inspiration here.)*
