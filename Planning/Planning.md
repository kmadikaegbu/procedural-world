# Planning

Design decisions, feature ideas, and open questions for the Roosevelt Island
procedural world — the working notes behind what ends up in `react-app/`.

## Current feature set

- Height-field terrain, masked to the real Roosevelt Island outline
- Biome coloring (water → sand → grass → rock → snow), tied to sea level
- Seeded tree scattering, density-noise clustering
- Weather system: sky/sun, fog, cloud puffs, rain/snow with ground accumulation
- Sea level control (floods/drains the coast, not just a floating plane)
- A second "Voxel" scene — the same terrain params rendered as blocky cubes
- A noise-displaced "Orb" scene (Perlin + cellular/Worley noise)
- Firebase Hosting deploy

## Open questions / ideas

- [ ] Wind as a true vector field (direction varies by position) instead of a
      constant, for precipitation drift
- [ ] Chunked/infinite terrain (tiles generated around the camera)
- [ ] Animated snow accumulation on the voxel terrain (currently smooth-only)
- [ ] Greedy meshing / face culling for the voxel renderer, to lift the fixed
      fill-depth limitation

*(Fill in as you go — this is a living doc, not a spec.)*
