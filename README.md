# Procedural World Building — Roosevelt Island

A procedurally generated **Roosevelt Island, NYC**, built in the browser with
React and three.js. Seeded fractal noise becomes a height-field terrain that's
masked to the real island outline. On top of that terrain sit biomes,
scattered trees, a full weather system, a voxel rendering mode, and a climate
timeline that floods the coast between 1950 and 2100.

**▶ Live demo:** https://procedural-world-design-app.web.app

This repository holds two things:

1. **The app**, in [`react-app/`](react-app/).
2. **The course vault**: notes, tutorials, planning, and a per-class progress
   log for the Procedural World Building course. It's an
   [Obsidian](https://obsidian.md) vault, but every file is plain Markdown,
   so it reads fine on GitHub too.

---

## Contents

- [Where to start](#where-to-start)
- [Repository map](#repository-map)
- [The app at a glance](#the-app-at-a-glance)
- [Quick start](#quick-start)
- [Deployment](#deployment)
- [App source layout](#app-source-layout)
- [Built with](#built-with)

---

## Where to start

| If you want to… | Go to |
| --- | --- |
| See the finished thing | [Live demo](https://procedural-world-design-app.web.app) |
| Run the app locally | [Quick start](#quick-start), then [`react-app/README.md`](react-app/README.md) |
| See what was built in each class | [`docs/progress/README.md`](docs/progress/README.md) |
| Learn the tools from scratch | [`Tutorials/`](Tutorials/) |
| See the visual rules (palette, lighting, materials) | [`Style Guide.md`](<Style Guide.md>) |
| See why things were designed this way | [`Planning/`](Planning/) and [`Analysis/`](Analysis/) |
| Read or change the code | [App source layout](#app-source-layout) |

---

## Repository map

```
procedural-world/
│
├── README.md               ← you are here
├── Style Guide.md          visual design system: palette, lighting, materials,
│                           procedural-generation rules, UI conventions
│
├── react-app/              THE APP: Vite + React + TypeScript + three.js
│   ├── src/                source code (see "App source layout" below)
│   ├── public/             static files copied as-is (favicon)
│   ├── firebase.json       Firebase Hosting config (serves dist/)
│   └── README.md           developer guide: scripts, architecture, deploy
│
├── docs/
│   └── progress/           progress log, by class session and by feature
│
├── Tutorials/              step-by-step guides written while building this
│                           (Git/GitHub, React, three.js, procedural map)
├── Planning/               design decisions, feature ideas, open questions
├── Analysis/               site reference, precedent, technique research
│
├── archive/                earlier class vaults, kept for history only;
│                           not part of the app
└── .obsidian/              Obsidian vault settings (ignore on GitHub)
```

### Folder by folder

- **[`react-app/`](react-app/)**: the only code in the repo. Everything you
  run, build, or deploy happens inside this folder. Its own
  [README](react-app/README.md) covers development in detail.
- **[`docs/progress/`](docs/progress/README.md)**: the progress log. One
  entry per class (deck link, class topics, what this repo did that week),
  plus a feature log grouped by area: terrain, props and weather, scenes,
  tooling.
- **[`Tutorials/`](Tutorials/)**: beginner-friendly guides, best read in this
  order: Git & GitHub → Installing React → Installing three.js → Building a
  Procedural Map. See [`Tutorials/README.md`](Tutorials/README.md).
- **[`Style Guide.md`](<Style Guide.md>)**: the design rules the app follows.
  Check it before changing colors, lighting, or generation rules.
- **[`Planning/`](Planning/Planning.md)**: the working notes behind the
  features: current feature set, decisions, and ideas not built yet.
- **[`Analysis/`](Analysis/Analysis.md)**: research. Roosevelt Island
  landmarks and coastline sources, plus references for the noise and
  rendering techniques.
- **[`archive/`](archive/)**: notes from the first class sessions, from
  before this project existed. Read-only history. See
  [`archive/README.md`](archive/README.md).

---

## The app at a glance

The app has **three scenes**, switched from the control panel:

| Scene | What it shows |
| --- | --- |
| **Map** | Smooth shaded terrain on the Roosevelt Island outline, with biomes, trees, water, and weather |
| **Voxel** | The same terrain parameters drawn as instanced cubes, with trees snapped to the voxel grid |
| **Orb** | A separate sphere displaced by fractal Perlin and cellular (Worley) noise |

The Map and Voxel scenes share one parameter set, controlled from the panel:

- **Simulation**: Running/Paused freezes weather and animation in place
- **Climate Timeline**: a 1950–2100 year slider with Play/Stop that drives
  sea level. The rise curve is *stylized for illustration*, not real
  NOAA/IPCC data.
- **Terrain** tab: seed, frequency, octaves, persistence, ridged noise, sea
  level, island width, resolution, pan offset
- **Weather** tab: presets, sun position, fog, cloud puffs (count, altitude,
  size, speed…), rain/snow with wind, and snow that builds up on the ground
- **Props** tab: show/hide trees, tree count, replant

A live top-down **minimap** sits in the corner, and every control shows a
tooltip on hover.

---

## Quick start

**Requirements:** Node.js `^20.19` or `>=22.12` (required by Vite 8) and npm.

```bash
git clone https://github.com/kmadikaegbu/procedural-world.git
cd procedural-world/react-app
npm install
npm run dev
```

Then open http://localhost:5173.

| Command (run in `react-app/`) | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-checks (`tsc -b`) and builds to `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | Lints with oxlint |

---

## Deployment

The app is hosted on **Firebase Hosting** (project
`procedural-world-design-app`). Deploys run from inside `react-app/`, and
`firebase.json` runs `npm run build` before uploading:

```bash
cd react-app
firebase deploy
```

The first time, you'll need the Firebase CLI (`npm i -g firebase-tools`) and
`firebase login`.

---

## App source layout

```
react-app/src/
├── main.tsx            entry point: mounts <App />
├── App.tsx             scene switcher, control panel, all UI state
├── App.css, index.css  panel styling and theme tokens
│
├── map/                Map and Voxel scenes
│   ├── noise.ts        seeded fractal Perlin heightfield + island mask;
│   │                   TerrainParams and its defaults
│   ├── biomes.ts       height → biome color ramp (shared by both scenes)
│   ├── Terrain.tsx     smooth terrain mesh
│   ├── VoxelTerrain.tsx  instanced-cube terrain + grid-snapping helpers
│   ├── Map.tsx         Map scene: terrain + water + props
│   ├── VoxelMap.tsx    Voxel scene: voxel terrain + water + props
│   ├── Water.tsx       water plane at sea level
│   ├── Props.tsx       seeded, density-clustered tree scattering
│   ├── Minimap.tsx     top-down orthographic minimap
│   └── timeline.ts     climate timeline: year → sea level
│
├── weather/            sky, fog, clouds, rain/snow (shared by Map + Voxel)
│   ├── Weather.tsx     combines sky, clouds, and precipitation
│   ├── presets.ts      WeatherParams type, defaults, named presets
│   ├── Sky.tsx, Clouds.tsx, Precipitation.tsx
│
└── orb/                Orb scene
    ├── NoisyOrb.tsx    noise-displaced sphere
    └── cellularNoise.ts  3D cellular / Worley noise
```

Data flows one way. `App.tsx` owns all parameters in React state and passes
them down as props, and scenes are pure functions of those params. The same
seed always gives the same island.

---

## Built with

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript
- [three.js](https://threejs.org) via
  [`@react-three/fiber`](https://r3f.docs.pmnd.rs/) and
  [`@react-three/drei`](https://github.com/pmndrs/drei)
- [oxlint](https://oxc.rs) for linting
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Obsidian](https://obsidian.md) for the course vault
