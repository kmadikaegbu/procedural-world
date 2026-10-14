# react-app — Developer Guide

The procedural Roosevelt Island app: Vite + React 19 + TypeScript + three.js
(via `@react-three/fiber` and `@react-three/drei`).

For what the project is and how the repo is organized, see the
[root README](../README.md). This file covers working on the code.

## Setup

Requirements: **Node.js `^20.19` or `>=22.12`** and npm.

```bash
npm install
npm run dev        # http://localhost:5173, hot reload
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | `tsc -b` type-check, then a production build into `dist/` |
| `npm run preview` | Serve `dist/` locally to check a production build |
| `npm run lint` | Run [oxlint](https://oxc.rs) (config: `.oxlintrc.json`) |

## Architecture

```
src/
├── main.tsx      mounts <App />
├── App.tsx       scene switcher + control panel; owns ALL parameter state
├── map/          Map + Voxel scenes, terrain generation, minimap, timeline
│   └── trees/    procedural trees: L-system, LOD, scatter, ivy, seasons, panel
├── weather/      sky, fog, clouds, rain/snow (used by Map and Voxel)
├── noise/        cellular (Worley) noise, shared by the terrain and the orb
└── orb/          Orb scene (Perlin + cellular noise sphere)
```

### How it fits together

- **One-way data flow.** `App.tsx` holds every parameter in React state:
  `TerrainParams`, `WeatherParams`, tree count, timeline year, and so on.
  It passes them down as props. Scene components have no state of their own
  that affects generation.
- **Deterministic generation.** `map/noise.ts` builds the heightfield from
  seeded fractal noise: Perlin and/or cellular, blended per octave, with
  optional ridging. It then applies the shaping ops (redistribute, terraces)
  and multiplies the result by a Roosevelt Island outline mask. The same
  seed and params always give the same island.
- **Shared terrain, two renderers.** `Terrain.tsx` (smooth mesh) and
  `VoxelTerrain.tsx` (instanced cubes) both sample the same height function
  and color it through `biomes.ts`, so the two scenes always match.
- **Sea level is a terrain param.** It shifts biome thresholds and tree
  placement as well as moving `Water.tsx`. The climate timeline
  (`timeline.ts`) maps a year to a sea level and writes it into that same
  param.
- **Terraforming is a terrain param too.** `TerrainParams.edits` is a
  128×128 grid of height offsets (`terraform.ts`) that `height()` adds on top
  of the procedural surface. `TerraformBrush.tsx` wraps the active scene,
  raycasts to anything marked `userData.ground`, and paints into a working
  copy of the grid during a stroke. It commits a new grid about every 80ms,
  so every consumer of `height()` regenerates from it. App keeps a snapshot
  per stroke for Undo.
- **Instancing.** Voxels use drei `<Instances>` with a fixed `limit`
  (allocated once) and a live `range`. Trees use one `InstancedMesh` per tree
  shape and level of detail (see Procedural trees below). Changing the count
  never reallocates GPU buffers, which is why the sliders stay cheap to drag.

### Adding a control

1. Add the field to the relevant params type and its defaults
   (`TerrainParams` in `map/noise.ts`, `WeatherParams` in
   `weather/presets.ts`).
2. Read it where it's used (the noise function, a scene component, …).
3. Add a slider or checkbox in the matching tab in `App.tsx`, with a
   `title="…"` tooltip explaining what it does, like every other control.

## Procedural trees

Every tree is grown from a small set of rules, not modelled by hand. The code
is in `src/map/trees/`; the controls are on the map's **Props** tab.

### The L-system

An L-system grows a plant by rewriting a string of letters. You start from an
**axiom** and apply the **rules** a number of times (**generations**):

```
axiom:  FFA
rule:   A -> F[/&A][\&A]          every A becomes a fork with two new A's

gen 0:  FFA
gen 1:  FF F[/&A][\&A]
gen 2:  FF F[/&F[/&A][\&A]][\&F[/&A][\&A]]
```

A **turtle** then walks the final string and draws it:

| Symbol | Meaning |
| --- | --- |
| `F` | move forward, drawing a branch segment |
| `+` `-` | turn left / right |
| `&` `^` | pitch down / up |
| `\` `/` | roll left / right |
| `[` `]` | remember / return to a position (start / end a side branch) |
| `A`, `B`… | placeholders: rewritten by the rules, never drawn |

A symbol can have several rules with probabilities
(`A -> 0.55: …`, `A -> 0.25: …`). The **seed** picks between them and
jitters every turn, so one recipe gives many different trees, and the same
seed always gives the same tree. The three species (`open`, `dense`,
`leaning`) are readable rule strings in `species.ts`.

### Sliders

**Trees and scatter**

- **Count:** how many trees to draw, out of every spot that fits the rules below.
- **Clustering:** 0 spreads trees evenly over the grass; 1 groups them into stands.
- **Rotation / Tilt:** random spin range, and random lean off vertical.
- **Scale min / max:** each tree's size is a random pick in this range.
- **Spacing:** minimum distance between any two trees. This can cap how many fit.
- **Slope limit:** the steepest ground a tree will grow on.
- **Shapes:** distinct shapes grown per species. More shapes means fewer
  lookalikes, but also more draw calls.
- **Replant:** a new placement seed. The trees move; their shapes stay the same.

**Planting mask**

- **Limit to area:** plant only inside the painted zone.
- **Brush off / Paint / Erase:** left-drag on the land to paint the zone.
  Right-drag orbits the camera.
- **Clear / Fill all:** reset the zone.

**Tree shape** (pick a species first; *Mixed* uses the three presets as-is)

- **Generations:** rewrite passes. Each one adds a layer of finer branches and
  multiplies the cost.
- **Angle / Randomness:** how far branches splay, and how much each turn wobbles.
- **Segment / Len falloff:** trunk segment length, and how much shorter each
  child branch is.
- **Trunk radius / Rad falloff:** trunk thickness, and how much thinner each
  child branch is.
- **Branches:** limbs per fork. Any value other than the preset's swaps in a
  generic rule.
- **Gravity / Lean:** droop (positive) or reach up (negative); a sideways
  wind-bend.
- **Leaf size / Leaf density:** card size, and a multiplier on how many leaves
  there are.
- **Seed / Randomize seed:** grows a different set of trees from the same recipe.

**Look and season**

- **Realistic / Flat / Toon:** smooth lighting, faceted low-poly, or three
  cartoon light bands.
- **Spring / Summer / Autumn / Winter:** leaf colour, how many leaves stay on,
  and fallen leaves on the ground. Switching is instant; no tree is regrown.

**Ivy**

- **Ivy plants:** how many plants. Half climb trunks, half creep over steep banks.
- **Growth:** how far each strand grows.
- **Branching:** chance per step that a strand splits.
- **Ivy gravity:** how much a strand droops once it loses its grip.
- **Adhesion:** how tightly strands hug the nearest surface.
- **Ivy leaves:** leaf chance per step.

### Level of detail (LOD)

Each tree shape is built at four levels from the **same** recipe:

| Level | Detail |
| --- | --- |
| LOD0 | full tree, every leaf, 7-sided limbs |
| LOD1 | one generation fewer of branches; half the leaves, 1.45× bigger; 4–5 sides |
| LOD2 | trunk and main limbs; leaves merged into a few clumps |
| LOD3 | a trunk stick and one blob in the tree's average colour |

LOD1 is literally the LOD0 tree with its last generation removed. Every symbol
remembers which generation created it, so the branches it keeps land exactly
where they were.

The three **LOD thresholds** (*LOD1 at*, *LOD2 at*, *LOD3 at*) are camera
distances in world units. Each frame, a tree closer than the first threshold
draws at LOD0, one between the first and second at LOD1, and so on.

**Hysteresis** adds a dead band around each threshold. A tree only switches to
a coarser level once it's *Hysteresis %* past the threshold, and only switches
back once it's that far inside it. This stops trees on a boundary from
flickering.

**Debug view** draws a ring on the ground at each threshold and tints each tree
by its level. The readout compares tree triangles, frame triangles and FPS with
LOD off and on.

**Caching:** generated shapes (all four LODs) are cached by species, every
slider value, seed and shape count. Returning to settings you've already used
is instant. The least-recently-used sets are disposed once there are more
than 10.

### Modules

| File | Role |
| --- | --- |
| `species.ts` | the recipes: axiom, rules, numbers |
| `grammar.ts` | rule parser and string rewriting |
| `turtle.ts` | turtle interpreter → branch segments + leaves |
| `geometry.ts` | segments + leaves → meshes, all four LODs |
| `treeSet.ts` | slider settings → species, shape cache |
| `lod.ts` | LOD manager: picks levels, fills the instanced meshes |
| `scatter.ts`, `ScatterMaskBrush.tsx` | the scatter tool and the mask brush |
| `seasons.ts`, `materials.ts`, `FallenLeaves.tsx` | look and seasons |
| `ivy.ts`, `IvyMesh.tsx` | ivy growth |
| `TreePanel.tsx`, `useTreeControls.ts` | the UI panel and its state |

## Deploying

The app is hosted on Firebase Hosting (project `procedural-world-design-app`,
configured in `.firebaserc` and `firebase.json`). `firebase.json` runs
`npm run build` as a predeploy step and serves `dist/` as a single-page app.

```bash
npm i -g firebase-tools   # once
firebase login            # once
firebase deploy
```

Live at https://procedural-world-design-app.web.app.

## Known lint warnings

`npm run lint` reports a few React-purity warnings: `Math.random` in
`weather/Precipitation.tsx`, and in-place geometry mutation in
`map/Terrain.tsx`. Both are deliberate three.js performance patterns. They
are warnings, not errors, and don't affect the build.
