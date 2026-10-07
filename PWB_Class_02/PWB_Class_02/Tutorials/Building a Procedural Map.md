# Building a Procedural Map

A step-by-step guide to turning your `react-app` scene into a procedural map:
a noise-driven landscape with height-based biomes, water, and scattered props —
all reproducible from a seed.

Stack assumed: React + TypeScript + three.js + `@react-three/fiber` + `@react-three/drei`,
which you already have. Noise comes from `three`'s built-in `ImprovedNoise` (Perlin),
the same one used in `src/NoisyOrb.tsx`.

---

## The mental model

A procedural map is a **pipeline**. Each stage takes the previous stage's output
and adds one thing:

```
seed
  │
  ▼
height function  h(x, z) → number          (fractal Perlin noise)
  │
  ▼
mesh             displace a flat grid by h  (the landforms)
  │
  ▼
normals          recompute for lighting     (so slopes catch light)
  │
  ▼
colors           map h → biome color        (water / sand / grass / rock / snow)
  │
  ▼
water            a flat translucent plane at sea level
  │
  ▼
props            scatter trees/rocks where h is in range   (life on the map)
```

Everything downstream is a **pure function of the seed + parameters**. Same seed →
same map, every time. That is the core discipline of procedural generation.

---

## Step 0 — Set up the files

Create a folder `src/map/` so the map code is separate from the app shell:

```
src/map/
├── noise.ts        the height function
├── Terrain.tsx     the landscape mesh
├── Water.tsx       the sea plane
├── Props.tsx       scattered trees / rocks
└── Map.tsx         puts it all together, owns the parameters
```

You'll fill these in over the next steps. In `src/App.tsx`, replace `<NoisyOrb />`
with `<Map />` when you're ready to see it.

---

## Step 1 — A seeded height function

**Goal:** one function `height(x, z)` that returns a terrain elevation, driven by
fractal Perlin noise, and shifted by a seed so different seeds give different worlds.

`src/map/noise.ts`:

```ts
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

const perlin = new ImprovedNoise()

export type TerrainParams = {
  seed: number
  amplitude: number   // max height in world units
  frequency: number   // base noise scale (small = broad hills)
  octaves: number     // how many layers of detail
  persistence: number // how much each finer octave contributes (0–1)
  ridged: boolean     // sharp mountain ridges vs. rolling hills
}

export const TERRAIN_DEFAULTS: TerrainParams = {
  seed: 1,
  amplitude: 6,
  frequency: 0.035,
  octaves: 5,
  persistence: 0.5,
  ridged: false,
}

// fractal Brownian motion: sum several octaves of Perlin noise
export function height(x: number, z: number, p: TerrainParams): number {
  const s = p.seed * 100
  let value = 0
  let amp = 1
  let freq = p.frequency
  let norm = 0

  for (let o = 0; o < p.octaves; o++) {
    let n = perlin.noise(x * freq + s, z * freq + s, s * 0.1) // -1..1
    if (p.ridged) n = 1 - Math.abs(n) // fold negatives up → ridges
    value += n * amp
    norm += amp
    amp *= p.persistence
    freq *= 2 // each octave doubles frequency (adds finer detail)
  }

  value /= norm // keep the sum in a predictable range
  return value * p.amplitude
}
```

**Why each parameter:**

| Parameter | Turn it up and… |
|-----------|-----------------|
| `frequency` | terrain gets busier — many small hills instead of few big ones |
| `octaves` | more fine detail (rocks, bumps) layered on the big shapes |
| `persistence` | that detail becomes stronger / rougher |
| `amplitude` | mountains get taller, valleys deeper |
| `ridged` | rounded hills become sharp alpine ridges |

**Check:** `console.log(height(0, 0, TERRAIN_DEFAULTS))` — you should get a small
number, and it should be *identical* every run. Change `seed` → different number.

---

## Step 2 — Build the terrain mesh

**Goal:** a flat grid of vertices, each pushed up/down by `height()`.

A `PlaneGeometry` is a grid of vertices. Make it horizontal, then move each
vertex's Y.

`src/map/Terrain.tsx`:

```tsx
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { height, type TerrainParams } from './noise'

const SIZE = 100      // world units across
const SEGMENTS = 200  // grid resolution (200×200 = 40k vertices)

export function Terrain({ params }: { params: TerrainParams }) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS)
    geo.rotateX(-Math.PI / 2) // lie flat: plane's local Z becomes world Y-up

    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      pos.setY(i, height(x, z, params))
    }

    pos.needsUpdate = true
    geo.computeVertexNormals() // Step 3 — see below
    return geo
  }, [params])

  // dispose the old geometry when params change (avoid GPU memory leak)
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial color="#c98a63" roughness={0.9} metalness={0} />
    </mesh>
  )
}
```

**Why `useMemo([params])`:** regenerating 40k vertices is expensive. `useMemo`
rebuilds the mesh *only* when a parameter actually changes, not on every render.

**Check:** drop `<Terrain params={TERRAIN_DEFAULTS} />` into your scene. You should
see brown hills. Orbit around — it's a solid landscape.

---

## Step 3 — Recompute normals (so it lights correctly)

A "normal" is the direction a surface faces. Lighting uses it to decide how bright
each point is. When you moved the vertices in Step 2, the original flat-facing
normals became wrong — the terrain looks flat-shaded or oddly lit.

`geo.computeVertexNormals()` (already in the snippet above) recalculates them from
the new vertex positions. **Always call it after displacing vertices.**

**Check:** before adding the call, the hills look muddy. After, slopes facing your
key light are clearly brighter than slopes facing away.

---

## Step 4 — Height-based biome colors

**Goal:** instead of one brown, color each vertex by its elevation — water, sand,
grass, rock, snow.

Add a **vertex color** attribute. The material multiplies its base color by the
per-vertex color, so set the material to white and let the vertex colors do the work.

Add to `Terrain.tsx`, inside the `useMemo`, after the displacement loop:

```tsx
// --- biome coloring ---
const BANDS = [
  { max: 0.0, color: new THREE.Color('#4a6d7c') }, // deep water tint (under sea level)
  { max: 0.6, color: new THREE.Color('#d9c8a0') }, // sand
  { max: 3.0, color: new THREE.Color('#81b29a') }, // grass
  { max: 5.0, color: new THREE.Color('#8a7f76') }, // rock
  { max: Infinity, color: new THREE.Color('#f4efe6') }, // snow
]

const colors = new Float32Array(pos.count * 3)
for (let i = 0; i < pos.count; i++) {
  const y = pos.getY(i)
  const band = BANDS.find((b) => y <= b.max)!
  colors[i * 3] = band.color.r
  colors[i * 3 + 1] = band.color.g
  colors[i * 3 + 2] = band.color.b
}
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
```

And change the material:

```tsx
<meshStandardMaterial vertexColors roughness={0.9} metalness={0} />
```

**Make the bands not look like contour lines:** blend across the boundary instead
of a hard `find`. A simple version — lerp between the two nearest bands:

```tsx
function biomeColor(y: number, out: THREE.Color) {
  for (let b = 1; b < BANDS.length; b++) {
    if (y <= BANDS[b].max) {
      const lo = BANDS[b - 1]
      const hi = BANDS[b]
      const t = THREE.MathUtils.clamp((y - lo.max) / (hi.max - lo.max), 0, 1)
      return out.copy(lo.color).lerp(hi.color, t)
    }
  }
  return out.copy(BANDS[BANDS.length - 1].color)
}
```

**Check:** low ground is sandy, mid-height is green, peaks are grey/white. Adjust
the `max` values to move the snow line etc.

---

## Step 5 — Add water

**Goal:** a flat semi-transparent plane at sea level (`y = 0`), so anything below
it reads as underwater.

`src/map/Water.tsx`:

```tsx
export function Water({ level = 0, size = 100 }: { level?: number; size?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        color="#5a86a0"
        transparent
        opacity={0.72}
        roughness={0.2}
        metalness={0.1}
      />
    </mesh>
  )
}
```

Sea level is just a number you pick. If you want more/less land, raise/lower
`level` — or offset `height()` by a constant.

**Check:** valleys below y=0 now look like lakes/ocean. The shoreline is where the
terrain crosses the water plane.

**Later:** swap the material for drei's `<MeshReflectorMaterial>` or `<Water>` from
`three-stdlib` for reflections and ripples.

---

## Step 6 — Seeded random helper

**Goal:** a random number generator you control, so prop placement is reproducible.

`Math.random()` can't be seeded. Use a tiny PRNG (mulberry32):

Add to `src/map/noise.ts`:

```ts
export function makeRng(seed: number) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 // 0..1
  }
}
```

`const rng = makeRng(params.seed)` gives you a stream of deterministic "random"
numbers for the same seed.

---

## Step 7 — Scatter props (trees, rocks)

**Goal:** place objects on the map, but only where it makes sense — on grass, not
underwater, not on cliffs — and clustered naturally, not on a rigid grid.

**The placement rule** for each candidate point:

1. Pick a random `(x, z)` with the seeded `rng`.
2. Look up `y = height(x, z)`.
3. Reject if `y` is outside the grass band (too low = water, too high = rock).
4. Reject based on a **density noise** sample — a second noise field that says
   "forests here, clearings there". Keeps trees in clumps.
5. If it survives, record `(x, y, z)` plus a random rotation and scale.

`src/map/Props.tsx`:

```tsx
import { useMemo } from 'react'
import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { height, makeRng, type TerrainParams } from './noise'

const forestNoise = new ImprovedNoise()

type Tree = { pos: [number, number, number]; rot: number; scale: number }

// STEP A — decide *where* the trees go (pure data, no rendering)
function useTrees(params: TerrainParams, count: number): Tree[] {
  return useMemo(() => {
    const rng = makeRng(params.seed + 777)
    const out: Tree[] = []
    let tries = 0

    while (out.length < count && tries < count * 40) {
      tries++
      const x = (rng() - 0.5) * 96
      const z = (rng() - 0.5) * 96
      const y = height(x, z, params)

      if (y < 0.6 || y > 3.0) continue // grass band only

      const density = forestNoise.noise(x * 0.05, z * 0.05, params.seed) // -1..1
      if (rng() > (density + 1) / 2) continue // sparser where density is low

      out.push({
        pos: [x, y, z],
        rot: rng() * Math.PI * 2,
        scale: 0.6 + rng() * 0.8,
      })
    }
    return out
  }, [params, count])
}

// STEP B — render them all in ONE draw call with drei's <Instances>
export function Props({ params, count = 400 }: { params: TerrainParams; count?: number }) {
  const trees = useTrees(params, count)

  return (
    <Instances limit={count} castShadow>
      <coneGeometry args={[0.5, 1.6, 6]} />
      <meshStandardMaterial color="#5c7a53" roughness={1} />
      {trees.map((t, i) => (
        <Instance key={i} position={t.pos} rotation={[0, t.rot, 0]} scale={t.scale} />
      ))}
    </Instances>
  )
}
```

The import line for that component:

```tsx
import { Instances, Instance } from '@react-three/drei'
```

**Why instancing:** 400 separate `<mesh>` trees = 400 draw calls = slow. One
`InstancedMesh` draws all of them in a single call.

**Check:** trees appear on the green slopes, in loose clusters, never in the water
or on the peaks. Change the seed — the forest rearranges but follows the same rules.

---

## Step 8 — Assemble the map + parameters

`src/map/Map.tsx` owns the parameter state and renders every layer:

```tsx
import { useState } from 'react'
import { Terrain } from './Terrain'
import { Water } from './Water'
import { Props } from './Props'
import { TERRAIN_DEFAULTS, type TerrainParams } from './noise'

export function Map() {
  const [params, setParams] = useState<TerrainParams>(TERRAIN_DEFAULTS)

  return (
    <group>
      <Terrain params={params} />
      <Water level={0} />
      <Props params={params} count={400} />

      {/* wire these to your control panel like the orb noise sliders */}
      {/* setParams(p => ({ ...p, frequency: value })) etc. */}
    </group>
  )
}
```

Reuse the slider pattern from `src/App.tsx` (the "Orb Perlin Noise" panel). Bind
each slider to one field of `params`. Add a **"Regenerate"** button that bumps the
seed: `setParams(p => ({ ...p, seed: Math.floor(Math.random() * 10000) }))`.

**Check:** every slider visibly reshapes the whole map — terrain, colors, *and*
tree placement update together, because they all read the same `params`.

---

## Step 9 — Lighting and mood

Match `STYLE-GUIDE.md` — late-afternoon warmth:

```tsx
<hemisphereLight args={['#ffd9b3', '#b98a86', 0.6]} />
<directionalLight
  position={[20, 25, 10]}
  intensity={2.5}
  color="#ffd9b3"
  castShadow
  shadow-mapSize={[2048, 2048]}
/>
<fog attach="fog" args={['#2e2431', 40, 120]} />
```

Turn on shadows in the `<Canvas>`: `<Canvas shadows>`. Fog hides the square edge
of the map and focuses attention on the center.

---

## Step 10 — Performance

At `SEGMENTS = 200` regeneration takes a beat. Options, cheapest first:

- **Lower `SEGMENTS`** while tuning (80), raise it (300) only for the final look.
- **Debounce the sliders** — regenerate on `onPointerUp`, not every `onChange`.
- **Move generation to a Web Worker** so dragging a slider doesn't freeze the UI.
- **Chunk the map** — a grid of smaller Terrain tiles, each generated from the same
  global `height()`, so you can add/remove tiles around the camera for an
  "infinite" map. This is the big next step once the single-tile map works.

---

## Step 11 — Weather & atmosphere

**Goal:** the map is the *ground*; weather is the *air* above it — sky colour,
sun position, fog, clouds, rain/snow. Like the terrain, it's one parameter object
so a preset changes everything at once. Lives in `src/weather/`.

```
src/weather/
├── weather.ts        WeatherParams type + presets (clear / rain / snow / storm / fog …)
├── Sky.tsx           sky dome + sun light + fog, all derived from the params
├── Clouds.tsx        volumetric clouds; count & darkness follow cloudCover
├── Precipitation.tsx falling-particle pool for rain / snow
└── Weather.tsx       assembles the three, exports the presets
```

### 11a — The parameter object

```ts
export type Precip = 'none' | 'rain' | 'snow'

export type WeatherParams = {
  sunElevation: number   // 0 = horizon, 1 = noon, <0 = night
  sunAzimuth: number     // sun compass direction, radians
  cloudCover: number     // 0 = clear, 1 = overcast
  fogDensity: number     // 0 = none, 1 = pea soup
  precip: Precip
  precipIntensity: number // 0..1 → particle count + opacity
  wind: number            // horizontal drift, units/sec
}
```

A **preset** is just a frozen `WeatherParams`:

```ts
export const WEATHER_PRESETS = {
  clear: { ...DEFAULTS, cloudCover: 0.1, fogDensity: 0.05 },
  rain:  { ...DEFAULTS, sunElevation: 0.18, cloudCover: 0.85, fogDensity: 0.3,
           precip: 'rain', precipIntensity: 0.6, wind: 3 },
  // snow, storm, fog …
}
```

### 11b — Sky, sun, fog

The sun's **direction** comes from elevation + azimuth (spherical → cartesian).
Everything else is derived from it:

```tsx
const day = clamp(sunElevation * 3, 0, 1)
const sunIntensity = day * (1 - cloudCover * 0.7) * 3   // clouds dim the sun
const ambient      = 0.15 + day * 0.35                  // darker at night
```

- `<Sky>` (from drei) — the gradient sky dome; feed it `sunPosition`, and raise
  `turbidity` with `cloudCover` for haze.
- `<fogExp2 attach="fog" args={[tint, amount]} />` — exponential fog reads better
  than linear for weather. `tint` shifts warm→dark as the sun drops.
- `<directionalLight castShadow>` at the sun's position = the key light + shadows.
- `<Stars>` (drei) only when `sunElevation < 0.1`.

### 11c — Clouds

drei's `<Clouds>` / `<Cloud>` are volumetric billboards. Drive them from cover:

```tsx
const puffs = Math.round(1 + cloudCover * 4)
const grey  = sunElevation < 0.25 ? 0.35 : 0.85 - cloudCover * 0.4
// render `puffs` <Cloud>s in a band at y ≈ 24, colour = grey, opacity ∝ cloudCover
```

### 11d — Precipitation

A **fixed pool** of particles in a box above the map. Each frame: move down by a
fall speed (rain fast, snow slow), drift sideways by `wind`; when a particle
passes the floor, teleport it back to the top. A pool of 6000 that loops forever
beats spawning/destroying.

```tsx
arr[i*3 + 1] -= fallSpeed * delta          // gravity
arr[i*3]     += wind * delta                // drift
if (arr[i*3 + 1] < FLOOR) { /* wrap to TOP, new random x/z */ }
geometry.setDrawRange(0, count)             // count = poolSize * intensity
```

Rain = small, fast, near-transparent, bluish. Snow = larger, slow, white, with a
gentle `sin` sway.

### 11e — Assemble

```tsx
export function Weather({ params }: { params: WeatherParams }) {
  return (
    <>
      <Sky params={params} />
      <Clouds params={params} />
      <Precipitation kind={params.precip} intensity={params.precipIntensity} wind={params.wind} />
    </>
  )
}
```

In the app: `const [weather, setWeather] = useState(WEATHER_PRESETS.clear)`, render
`<Weather params={weather} />` inside `<Canvas shadows>`, and give the control
panel a row of preset buttons (`setWeather(WEATHER_PRESETS[kind])`) plus a few
override sliders (sun elevation, cloud cover, fog, wind).

> This **replaces** the hand-rolled lights and fog from Step 9 — `Weather` now
> owns the sky, the sun, and the fog. Keep Step 9 only if you want a fixed look
> with no weather system.

**Check:** click `rain` — the sky darkens, clouds thicken, fog closes in, the sun
dims, and rain falls. Click `clear` — it all lifts. Drag *sun elevation* down to
0 and stars come out.

---

## Recap — the whole pipeline

| Step | File | Adds |
|------|------|------|
| 1 | `noise.ts` | `height(x,z)` — seeded fractal Perlin |
| 2 | `Terrain.tsx` | displaced grid mesh |
| 3 | `Terrain.tsx` | recomputed normals for lighting |
| 4 | `Terrain.tsx` | height → biome vertex colors |
| 5 | `Water.tsx` | sea-level plane |
| 6 | `noise.ts` | `makeRng(seed)` — seeded PRNG |
| 7 | `Props.tsx` | rule-based instanced tree scatter |
| 8 | `Map.tsx` | parameter state + all layers |
| 9 | scene | warm lighting, shadows, fog (superseded by Step 11) |
| 10 | — | resolution / worker / chunking |
| 11 | `src/weather/` | sky, sun, fog, clouds, rain/snow — one `WeatherParams` |

Build it one step at a time. After every step you have something visible on screen
to check before moving on.

---

## Further reading

- [Red Blob Games — Making maps with noise functions](https://www.redblobgames.com/maps/terrain-from-noise/) — the definitive explainer
- [three.js `ImprovedNoise` example](https://threejs.org/examples/webgl_geometry_terrain.html)
- [drei `<Instances>` docs](https://drei.docs.pmnd.rs/performances/instances)
- [The Book of Shaders — Noise](https://thebookofshaders.com/11/) (for the GPU version later)
- `STYLE-GUIDE.md` in `react-app/` — palette and mood targets
