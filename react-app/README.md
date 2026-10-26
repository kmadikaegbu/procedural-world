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
│   ├── trees/    procedural trees: L-system, LOD, scatter, ivy, seasons, panel
│   ├── water/    procedural water: waves, depth colour, foam, panel
│   ├── grass/    procedural grass on the terrain: moisture, bare slopes, wind sheen
│   ├── glsl/     shader snippets shared by water and grass (noise)
│   └── scale.ts  the world's ruler: metres ↔ units, exaggeration per category
├── weather/      sky, fog, clouds, rain/snow (used by Map and Voxel)
└── noise/        cellular (Worley) noise used by the terrain
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
- **Scale min / max:** smallest (sapling) and largest (veteran) tree, as a
  fraction of the species' mature height. Where each tree lands in the range
  comes from its stand's age and its site (see Size variety), not a dice roll.
- **Size variety:** 0 makes every tree the same size; 1 is natural woodland,
  with young and old stands, stunted trees on exposed or steep ground and taller
  ones in sheltered hollows.
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

## Procedural water

The sea is one flat sheet at sea level. Everything that makes it look like
water happens in its shader (`src/map/water/waterMaterial.ts`), which is three's
standard material with extra steps spliced in, so lighting, shadows and fog
still work. The controls are in the **Water** section at the bottom of the
**Weather** tab.

- **Waves:** four Gerstner waves, each with its own direction, length and
  speed, chosen from the terrain seed (`waves.ts`). A Gerstner wave pulls the
  surface toward each crest as well as lifting it, which gives sharp crests and
  flat troughs. Waves shrink where the water gets shallow.
- **Colour by depth:** `depthMap.ts` samples the terrain's `height()` into a
  256×256 image. The shader reads it to find how deep the water is: pale and
  see-through in the shallows, dark blue in deep water. The image stores
  terrain height, not depth, so sea-level changes (the climate timeline) need
  no rebuild.
- **Foam:** white water lapping where land is close, plus rare whitecaps on
  the tallest crests. The island's banks are nearly vertical, so the shore
  foam asks "how near is dry land?" (probing the depth map around each point),
  not "how shallow is it?".
- **Ripples and reflection:** moving noise tilts the surface so the sun
  glitters. At shallow viewing angles the water mirrors the sky (Fresnel).
- **Weather:** wind makes the waves taller and choppier, rain adds ripple
  rings, cloud cover greys the reflection, and Paused freezes the waves.

| Slider | What it does |
| --- | --- |
| Wave height | how tall the swells are (wind adds to it) |
| Choppiness | rounded swells (0) to sharp, peaked crests (1) |
| Wave size | distance between crests |
| Wave speed | how fast they travel; 0 freezes them |
| Direction | the way they travel (90 = south, along the island) |
| Ripples | fine surface ripples that break up glints and reflections |
| Clarity | how deep you can see before the water turns deep blue |
| Foam | shoreline foam and whitecaps |
| Reflection | how strongly the surface mirrors the sky |
| Shallow / Deep | the two water colours |

## Procedural grass

The terrain's biome colour is per vertex (~17 m apart), which on its own
gives flat colour with contour-line edges. `src/map/grass/grassMaterial.ts`
patches the terrain's standard material to work **per pixel, on grass only**:
ragged band edges, moisture (lusher low down, drier high up, patches at
~100 m and ~20 m), bare soil on steep slopes, fine grain in colour and
lighting, wind sheen, wetness after rain, and fading under snow. Sand, rock,
riverbed and snow keep their vertex colours.

At this scale (1 unit ≈ 33.5 m, closest camera ~670 m) a single blade would be
far smaller than a pixel, so this is grass as seen from a drone or plane, not
individual blades.

Controls: **Grass** section at the bottom of the **Terrain** tab. Lushness,
Patchiness, Grain, Wind sheen and Bare slopes, plus lush, dry and soil colours.
The **Season** control (Props tab) and the weather (wind, rain, snow) also
change it. The Voxel scene keeps its plain biome colours.

## Real-world scale

`src/map/scale.ts` defines the world's ruler: **1 unit ≈ 33.5 m**, taken from
the island's real 3,220 m length. Sizes are written as real metres × one
exaggeration factor per category (`vertical` ×15, `objects` ×2.9,
`islandWidth` ×2.5 at the readable scale). The **Readable / True to scale**
switch in the View section sets the factors to 1 for a true-to-life island
(about 7 m of relief, 25 m trees, 240 m wide). Assets are authored at the
readable scale; `applyScale()` and `ratios()` shrink the terrain and objects
on top. See `Tutorials/Real-World Scale.md` for the rules.

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
