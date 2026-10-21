# Project Timeline

How the procedural Roosevelt Island grew, from the first commit to today, in
screenshots.

> [!info] How these were made
> Every version of the app that changed what you see was **rebuilt from its
> own commit** and photographed in the same browser window (1400 × 900), so the
> shots compare like for like. Each stage has:
> - a **default view**: what the app looks like the moment it opens, and
> - a **feature shot**: the new thing that version added, switched on (most
>   new features don't show in the default view).
>
> Images live in `Tutorials/timeline/`, named `NN-commit.jpg`.

---

## At a glance

| # | Date | What arrived |
| --- | --- | --- |
| 1 | Sep 16 | Noise terrain masked to the island, biomes, cone trees, weather, the noise orb |
| 2 | Sep 23 | Minimap, cloud puffs, sea level, snow that builds up and melts, Firebase hosting |
| 3 | Oct 7 | Voxel scene; trees fixed to stay on land |
| 4 | Oct 7 | Climate timeline: the year drives sea level, 1950–2100 |
| 5 | Oct 7 | Repo tidy-up (no visible change, no screenshot) |
| 6 | Oct 7 | Perlin + cellular noise blending, Redistribute and Terraces, the grayscale noise view |
| 7 | Oct 13 | Terraform (Sculpt) brush |
| 8 | Oct 13 | Hydraulic erosion |
| 9 | Oct 13 | L-system trees replace the cones |
| 10 | Oct 13 | Tree sliders and 4-level LOD |
| 11 | Oct 13 | Scatter tool: seeded placement, spacing, slope limit, painted mask |
| 12 | Oct 13 | Seasons, toon and flat looks, ivy |
| 13 | Oct 21 | Procedural water |
| 14 | Oct 21 | Readable header |
| 15 | Now | Procedural grass (not yet committed) |

---

## 1 — The first island · Sep 16 · `034ffb5`

The starting point: a fractal-noise height field cut to Roosevelt Island's
outline, coloured by height into sand, grass, rock and snow, with **cone
trees**, a full weather system (sun, fog, clouds, rain, snow) and a separate
**noise orb** scene. The water is a flat, see-through plane.

![Default view](<timeline/01-034ffb5.jpg>)

**Feature: the Noise Orb.** Perlin and cellular noise pushing a sphere's
surface in and out.

![Noise orb](<timeline/01-034ffb5-feature.jpg>)

---

## 2 — Minimap, sea level and snow · Sep 23 · `ea5ba66`

Added the **2D minimap** in the corner, individually controllable **cloud
puffs**, a **sea level** control (moves the beach, the trees and the water
together), **snow that builds up** on the land and melts when it stops, and
**Firebase hosting**. The title became "Roosevelt Island".

![Default view](<timeline/02-ea5ba66.jpg>)

**Feature: snow.** The Snow preset after 30 seconds of snowfall. The island
turns white; the minimap shows it most clearly.

![Snow](<timeline/02-ea5ba66-feature.jpg>)

---

## 3 — Voxel scene · Oct 7 · `5f34222`

A second way to draw the same terrain: as **blocks**, using the same seed,
island and biome colours. Trees were also fixed so they can't float over the
water.

![Default view](<timeline/03-5f34222.jpg>)

**Feature: the Voxel scene.**

![Voxel](<timeline/03-5f34222-feature.jpg>)

---

## 4 — Climate timeline · Oct 7 · `84d07a4`

A **Year** slider (1950–2100) with Play. The year sets the sea level along a
stylised, accelerating curve. It's illustrative, not real NOAA/IPCC data.

![Default view](<timeline/04-84d07a4.jpg>)

**Feature: the year 2100.** Most of the island is under water; only the high
ground and its trees remain.

![Year 2100](<timeline/04-84d07a4-feature.jpg>)

---

## 5 — Repo tidy-up · Oct 7 · `6189f17`

Code reorganised into folders, dead code removed, READMEs rewritten. Nothing
changed on screen, so there's no screenshot.

---

## 6 — Noise blending and shaping · Oct 7 · `e708b9e`

Class 03: the terrain can **blend Perlin and cellular (Worley) noise** per
octave, two **shaping** controls were added (Redistribute and Terraces), and
the minimap can show the **raw noise** in grayscale.

![Default view](<timeline/06-e708b9e.jpg>)

**Feature: Terraces = 5 with the noise inset.** The minimap shows the stepped
grayscale noise behind the terrain.

![Noise view](<timeline/06-e708b9e-feature.jpg>)

---

## 7 — Sculpting · Oct 13 · `d733a19`

A **terraform brush** on a new Sculpt tab: raise, lower or flatten the land by
dragging. Edits sit on top of the noise, so they survive seed and slider
changes.

![Default view](<timeline/07-d733a19.jpg>)

**Feature: raising new land.** A drag with the Raise brush across the river
near the southern tip pushes up a ridge out of the water.

![Sculpt](<timeline/07-d733a19-feature.jpg>)

---

## 8 — Hydraulic erosion · Oct 13 · `a0aed0f`

Thousands of simulated **raindrops** run downhill, carrying soil away from
steep places and dropping it where they slow down. Valleys deepen and ridges
sharpen.

![Default view](<timeline/08-a0aed0f.jpg>)

**Feature: heavy erosion, close up.** Gullies carved down the island's hills.

![Erosion](<timeline/08-a0aed0f-feature.jpg>)

---

## 9 — L-system trees · Oct 13 · `4624f51`

The cone trees were replaced by **procedural trees grown from rules**: an
L-system with three species (open, dense, leaning), drawn efficiently with
instancing.

![Default view](<timeline/09-4624f51.jpg>)

**Feature: the trees up close.**

![L-system trees](<timeline/09-4624f51-feature.jpg>)

---

## 10 — Tree controls and LOD · Oct 13 · `705b8e7`

Sliders for every part of the tree recipe, a species picker, and **four levels
of detail** grown from the same recipe: far trees are drawn with far fewer
triangles.

![Default view](<timeline/10-705b8e7.jpg>)

**Feature: the LOD debug view.** Trees tinted by level (green near, then
yellow, orange, red far away) and rings on the ground at each switch distance.

![LOD debug](<timeline/10-705b8e7-feature.jpg>)

---

## 11 — Scatter tool · Oct 13 · `04dc417`

Trees are placed by a proper **scatter tool**: every tree has its own seed,
with controls for spacing, slope limit, size range, rotation and a **painted
planting mask**.

![Default view](<timeline/11-04dc417.jpg>)

**Feature: a dense forest.** Count raised to 1,500.

![Scatter](<timeline/11-04dc417-feature.jpg>)

---

## 12 — Seasons, looks and ivy · Oct 13 · `ee87695`

The tree code was split into clear modules, and three extras were added:
**seasons** (leaf colour, leaves dropping, fallen leaves on the ground),
**realistic / flat / toon** shading, and **procedural ivy** that climbs trunks
and creeps over banks.

![Default view](<timeline/12-ee87695.jpg>)

**Feature: autumn with ivy.** Orange leaves thinning out, fallen leaves under
the trees.

![Autumn](<timeline/12-ee87695-feature.jpg>)

---

## 13 — Procedural water · Oct 21 · `03030d4`

The flat blue plane became **shader-driven water**: Gerstner waves, colour by
depth, foam at the shore, ripples, sky reflections, and reactions to wind,
rain and cloud. See [Procedural Water](<Procedural Water.md>).

![Default view](<timeline/13-03030d4.jpg>)

**Feature: the water up close.** Deep blue swells around the island.

![Water](<timeline/13-03030d4-feature.jpg>)

---

## 14 — Readable header · Oct 21 · `ea20a94`

The title now sits on a **dark glass card** so it reads on any sky, and turned
**cyan** to match the control panel.

![Default view](<timeline/14-ea20a94.jpg>)

---

## 15 — Procedural grass · now (not yet committed)

The grass became a **per-pixel meadow**: ragged edges, lush and dry patches,
bare slopes, fine grain, wind sheen, wetness after rain, and the same seasons
as the trees.

![Default view](<timeline/15-now.jpg>)

**Feature: the meadow up close.**

![Grass](<timeline/15-now-feature.jpg>)

---

## First vs. now

| Sep 16 | Today |
| --- | --- |
| ![First](<timeline/01-034ffb5.jpg>) | ![Now](<timeline/15-now.jpg>) |

Same island, same seed, same camera. In between: L-system trees with LOD,
scatter and seasons, procedural water and grass, a voxel scene, sculpting,
erosion, a climate timeline and the noise orb.

Index: [Tutorials](<README.md>)
