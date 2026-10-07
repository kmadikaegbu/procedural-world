# Assignment Checklist

What's still outstanding from each class's assignments, checked against the
code in `react-app/`. Tick items off (`- [x]`) as they land, and add a line
to the [progress log](README.md) when a class's work is done.

_Last reviewed: 2026-10-07_

## Class 03: Noise Field + Simulations (Assignment 1)

All items complete.

- [x] 3D grid, noise applied to the grid, sliders for noise and resolution,
      layered (fractal) noise, 2D/3D view toggle
- [x] **Shaping ops on the terrain.** Redistribute (power curve) and
      Terraces (flat steps), in the Terrain tab's **Shaping** group
- [x] **Noise-type blending on the terrain.** A Perlin ↔ Cellular (Worley)
      blend slider, mixed per octave, in the **Noise Type** group
- [x] **2D view of the raw noise.** View → **Inset: noise** shows the
      shaped noise field in grayscale, with the coastline traced in red

## Class 04: Voxels

Done: Voxel scene rendering the shared terrain as instanced cubes.

- [ ] **Terraforming.** No way to edit the terrain by hand yet. Add a brush
      that raises or lowers voxels or height (e.g. click-drag on the
      terrain).
- [ ] **(Optional) Real geographic data.** The island outline is traced
      from the RIOC map, but heights are pure noise. Optionally blend in
      real elevation (DEM) data for Roosevelt Island.

## Class 05: Shaders (Assignment 2)

Not started. Everything uses stock three.js materials.

- [ ] **Shader studies.** Write at least one custom GLSL shader
      (`ShaderMaterial` or `onBeforeCompile`), e.g. animated water,
      height-based biome blending, or snow coverage on the GPU.
- [ ] **Pick a simulation strategy.** Decide what the shader drives
      (water, terrain coloring, weather, …) and note why in
      [`Planning/Planning.md`](../../Planning/Planning.md).
- [ ] **In-app shader section.** Add a panel section or scene that lets you
      switch between shader approaches (e.g. stock material ↔ custom
      shader A ↔ custom shader B).

## Class 06

- [ ] **Fill in topics and assignment** once the deck content is available
      (see the Class 06 entry in the [progress log](README.md)).

## Housekeeping

- [ ] Add screenshots for each class under `docs/progress/class-NN/`.
- [ ] Clear the three existing `npm run lint` warnings
      (`weather/Precipitation.tsx`, `map/Terrain.tsx`), or document them as
      accepted.
