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
├── weather/      sky, fog, clouds, rain/snow (used by Map and Voxel)
└── orb/          Orb scene (Perlin + cellular noise sphere)
```

### How it fits together

- **One-way data flow.** `App.tsx` holds every parameter in React state:
  `TerrainParams`, `WeatherParams`, tree count, timeline year, and so on.
  It passes them down as props. Scene components have no state of their own
  that affects generation.
- **Deterministic generation.** `map/noise.ts` builds the heightfield from a
  seeded `ImprovedNoise` (fractal Perlin, optional ridging) and multiplies it
  by a Roosevelt Island outline mask. The same seed and params always give
  the same island.
- **Shared terrain, two renderers.** `Terrain.tsx` (smooth mesh) and
  `VoxelTerrain.tsx` (instanced cubes) both sample the same height function
  and color it through `biomes.ts`, so the two scenes always match.
- **Sea level is a terrain param.** It shifts biome thresholds and tree
  placement as well as moving `Water.tsx`. The climate timeline
  (`timeline.ts`) maps a year to a sea level and writes it into that same
  param.
- **Instancing.** Trees and voxels use drei `<Instances>` with a fixed
  `limit` (allocated once) and a live `range`. Changing the count never
  reallocates GPU buffers, which is why the sliders stay cheap to drag.

### Adding a control

1. Add the field to the relevant params type and its defaults
   (`TerrainParams` in `map/noise.ts`, `WeatherParams` in
   `weather/presets.ts`).
2. Read it where it's used (the noise function, a scene component, …).
3. Add a slider or checkbox in the matching tab in `App.tsx`, with a
   `title="…"` tooltip explaining what it does, like every other control.

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
