# Assignment Checklist

What's still outstanding from each class's assignments, checked against the
code in `react-app/`. Tick items off (`- [x]`) as they land, and add a line
to the [progress log](README.md) when a class's work is done.

_Last reviewed: 2026-11-02_

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

Required items complete.

- [x] Voxel scene rendering the shared terrain as instanced cubes
- [x] **Terraforming.** The **Sculpt** tab has a Raise / Lower / Flatten
      brush with Size, Strength, Undo, and Reset, in both the Map and Voxel
      scenes
- [ ] **(Optional) Real geographic data.** The island outline is traced
      from the RIOC map, but heights are pure noise. Optionally blend in
      real elevation (DEM) data for Roosevelt Island.

## Class 05: Shaders (Assignment 2)

Shader studies are done; the strategy note and the swap section are not.

- [x] **Shader studies.** Custom shaders for the water (waves, depth colour,
      shore foam), the ground (grass, paving, street grid) and the trees
      (season colours), all via `onBeforeCompile`.
- [ ] **Pick a simulation strategy.** Write down what the shaders drive and
      why, in [`Planning/Planning.md`](../../Planning/Planning.md). The
      History Timeline driving paving and the grid is the strongest case.
- [ ] **In-app shader section.** The Tree panel's Look & season switch (realistic /
      flat / toon) already swaps strategies for the trees. Still needed: one
      panel section that swaps approaches across the scene, e.g. stock
      material ↔ custom shader.
- [ ] **(Optional) Contact foam on objects.** From the class's contact-shader
      examples: foam where the water meets anything standing in it, not just
      the terrain. This needs the scene's depth buffer instead of the
      terrain depth map.

## Class 06

- [ ] **Fill in topics and assignment** once the deck content is available
      (see the Class 06 entry in the [progress log](README.md)).

## Class 08: Agents (Assignment 1) and Scale (Assignment 2)

- [x] **Inhabitants and how they behave.** Birds, deer and foxes in the
      Wildlife tab, retreating from the paved city over the timeline.
- [x] **State machine.** Deer (graze, flee) and foxes (wander, hunt, eat,
      rest), plus displaced and leaving for every species.
- [x] **Simple rules, complex behaviour.** The birds flock (boids).
- [x] **Species forming an ecosystem.** Foxes hunt deer and starve without
      them; every species depends on the wild land left.
- [ ] **(Optional) A behaviour tree or a schedule.** Not used; the state
      machines cover the behaviour so far. Inhabitants on Roosevelt Island
      with daily schedules (hospital staff, residents, the Tram) would be
      the natural next step.
- [x] **Define a scale and keep objects proportional.** See
      [Real-World Scale](<../../Tutorials/Real-World Scale.md>).
- [x] **Resolution and camera tied to scale.** The terrain mesh is finest
      around the island, and the camera is framed from the island's real
      length.

## Housekeeping

- [ ] Add screenshots for each class under `docs/progress/class-NN/`.
- [ ] Clear the three existing `npm run lint` warnings
      (`weather/Precipitation.tsx`, `map/Terrain.tsx`), or document them as
      accepted.
