# Procedural World Building — Roosevelt Island

A procedurally generated Roosevelt Island, NYC: a noise-driven heightfield
terrain masked to the real island outline, with biomes, scattered trees, a
full weather system, a blocky voxel rendering mode, and a separate
noise-displaced "orb" scene — all driven from one shared parameter set.

This repo doubles as the course vault (notes, tutorials, planning) and the
app itself, which lives in [`react-app/`](react-app/).

## Contents

- [Project structure](#project-structure)
- [Progress](#progress)
- [Getting started](#getting-started)
- [Built with](#built-with)

## Project structure

```
.
├── Analysis/              research, precedent, technique references
├── Planning/               design decisions, open questions, feature ideas
├── Tutorials/              Git/GitHub, React, three.js, and procedural-map
│                           how-tos written while building this
├── docs/
│   ├── progress/           running build log (see docs/progress/README.md)
│   └── style-guide/
├── Style Guide.md           visual design system — palette, lighting,
│                           materials, procedural-generation rules
├── archive/                 earlier, unrelated class vaults — kept for
│                           history, not part of this project
└── react-app/                the actual app (Vite + React + TypeScript +
                              three.js / @react-three/fiber)
```

## Progress

See [`docs/progress/README.md`](docs/progress/README.md) for the running
build log.

## Getting started

```bash
cd react-app
npm install
npm run dev
```

Opens at `http://localhost:5173`. See [`react-app/README.md`](react-app/README.md)
for the underlying Vite template notes, and [`Tutorials/`](Tutorials/) for
longer walkthroughs (installing React, installing three.js, building the
procedural map from scratch).

Deploys to Firebase Hosting from inside `react-app/`:

```bash
cd react-app
firebase deploy
```

## Built with

- [Vite](https://vite.dev) + [React](https://react.dev) + TypeScript
- [three.js](https://threejs.org) via
  [`@react-three/fiber`](https://r3f.docs.pmnd.rs/) and
  [`@react-three/drei`](https://github.com/pmndrs/drei)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
