import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { cellular2 } from '../noise/cellularNoise'
import { MAP_SIZE } from './mapSize'
import { coastDistance, islandDistance, WORLD } from './world/shore'
import { islandWiden } from './world/region'
import { sampleEdits, type TerrainEdits } from './terraform'
import { erode } from './erosion'

const perlin = new ImprovedNoise()

export { MAP_SIZE }

export type TerrainParams = {
  seed: number
  amplitude: number // max height in world units
  frequency: number // base noise scale (small = broad hills)
  octaves: number // how many layers of detail
  persistence: number // how much each finer octave contributes (0–1)
  ridged: boolean // sharp mountain ridges vs. rolling hills
  noiseBlend: number // 0 = pure Perlin, 1 = pure cellular (Worley) — mixed per octave
  redistribution: number // shaping exponent: <1 lifts lowlands into plateaus, >1 flattens valleys + sharpens peaks
  terraces: number // shaping: quantize height into this many steps (0 = off)
  resolution: number // grid segments per side — calibrates topography detail vs. cost
  islandWidth: number // Roosevelt Island's width multiplier — 0.4 = its real width at true scale, 1 = legible
  offsetX: number // pan through the noise field, in sampled (post-frequency) units
  offsetZ: number // — same coastline, different hills underneath; seed jumps, this slides
  seaLevel: number // world-Y height of the water surface — the land doesn't move, just what's submerged
  erosion: number // hydraulic erosion strength, in thousands of raindrops (0 = off)
  erosionGrid: TerrainEdits | null // the simulated erosion offsets, derived from erosion + the params above (see erodeTerrain)
  edits: TerrainEdits | null // hand-sculpted height offsets from the terraform brush (null = none)
  // Vertical scale applied to everything that isn't already scaled through
  // amplitude/seaLevel: the river bed, erosion and sculpt offsets. 1 = as
  // authored (the Readable scale); the True-to-scale switch sets it to 1/15.
  // Set by applyScale() in scale.ts, not by a slider.
  vScale: number
}

export const TERRAIN_DEFAULTS: TerrainParams = {
  seed: 1,
  amplitude: 4,
  frequency: 0.035,
  octaves: 5,
  persistence: 0.5,
  ridged: false,
  noiseBlend: 0,
  redistribution: 1,
  terraces: 0,
  resolution: 200,
  islandWidth: 1,
  offsetX: 0,
  offsetZ: 0,
  seaLevel: 0,
  erosion: 0,
  erosionGrid: null,
  edits: null,
  vScale: 1,
}

// --- city shape -------------------------------------------------------------
//
// The coastline is the real one (world/shore.ts gives the signed distance to
// it: positive on land, negative in water). Height is built from that distance:
//
//   on land    noise relief × a bank that rises from the shore over BANK_UP
//   in water   a river bed that deepens from the shore over SHELF, to SEABED_DEPTH
//   at the map's edges  everything sinks to the river bed, so the map ends in sea

const SEABED_DEPTH = 4 // how far below sea level the river bottom sits
const BANK_UP = 3.5 // units from the shore over which the land climbs to full height (~120 m)
const SHELF = 6 // units from the shore over which the bed drops to full depth (~200 m)
// Relief: Roosevelt Island is a low park (its highest ground is ~7 m). Manhattan
// beside it is a little higher and hillier. In the real city the island sits
// below the Manhattan shore; keep that relationship.
const ISLAND_RELIEF = 0.7
const URBAN_RELIEF = 0.55
const URBAN_LIFT = 0.45 // units (~15 m) the rest of the city is raised above the island's base
const EDGE_FADE = 40 // units: how far in from the map's edge the land sinks into the sea

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

const smoothstep = (edge0: number, edge1: number, v: number) => {
  const t = clamp01((v - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

// --- height field -----------------------------------------------------------

// fractal Brownian motion: sum several octaves of noise — Perlin, cellular
// (Worley), or a blend of the two, chosen per octave by p.noiseBlend
function fbm(x: number, z: number, p: TerrainParams): number {
  const s = p.seed * 100
  const blend = clamp01(p.noiseBlend)
  let value = 0
  let amp = 1
  let freq = p.frequency
  let norm = 0

  for (let o = 0; o < p.octaves; o++) {
    const nx = x * freq + s + p.offsetX
    const nz = z * freq + s + p.offsetZ

    // each type is only sampled when it contributes — cellular is 9 cell
    // lookups per sample, so pure-Perlin terrain shouldn't pay for it
    const perlinN = blend < 1 ? perlin.noise(nx, nz, s * 0.1) : 0 // -1..1
    let cellN = 0
    if (blend > 0) {
      // distance to the nearest feature point, inverted so each cell
      // becomes a rounded hill peaking at its point; mapped into -1..1
      const { f1 } = cellular2(nx, nz, 1, p.seed + o * 7.3)
      cellN = 1 - 2 * clamp01(f1 * 1.1)
    }

    let n = perlinN * (1 - blend) + cellN * blend
    if (p.ridged) n = 1 - Math.abs(n) // fold negatives up → ridges
    value += n * amp
    norm += amp
    amp *= p.persistence
    freq *= 2 // each octave doubles frequency (adds finer detail)
  }

  return value / (norm || 1) // back into a predictable -1..1
}

/**
 * Biome thresholds as a FRACTION of amplitude, so the land/rock/snow mix stays
 * believable at any relief setting instead of drifting as you raise amplitude.
 */
export const BANDS = { sand: 0.08, grass: 0.68, rock: 0.9 } as const

/** Height window where trees belong — the grass band, relative to sea level. */
export function grassRange(p: TerrainParams): [number, number] {
  return [
    p.seaLevel + BANDS.sand * p.amplitude,
    p.seaLevel + BANDS.grass * p.amplitude,
  ]
}

/**
 * Shaping ops, applied to noise already normalised into 0..1:
 *  - redistribution: a power curve. 1 = untouched; <1 pushes heights up
 *    (broad uplands); >1 pushes them down (flat lowlands, isolated peaks).
 *  - terraces: snaps height into N flat steps joined by short slopes, like
 *    rice paddies or eroded mesas. 0 = off.
 * Both are identities at their defaults, so the base terrain is unchanged.
 */
function shape(n01: number, p: TerrainParams): number {
  let h = n01
  if (p.redistribution !== 1) h = Math.pow(h, p.redistribution)
  if (p.terraces > 0) {
    const k = h * p.terraces
    const step = Math.floor(k)
    // flat for the first 70% of each step, then a smooth riser to the next
    h = (step + smoothstep(0.7, 1, k - step)) / p.terraces
  }
  return h
}

/**
 * The shaped noise field as 0..1, BEFORE the coastline is applied — what the noise
 * equation itself produces. Drives the grayscale "Noise" inset view, and is
 * the same value height() builds the terrain from.
 */
export function noise01(x: number, z: number, p: TerrainParams): number {
  const n = fbm(x, z, p)
  // fbm's normalised octaves rarely reach ±1, so stretch the usable range —
  // otherwise everything bunches into one biome.
  const n01 = clamp01(0.5 + n * 1.15)
  return shape(n01, p)
}

/** The procedural height alone — noise, shaping and the real coastline, no edits. */
function proceduralHeight(x: number, z: number, p: TerrainParams): number {
  const n01 = noise01(x, z, p)
  const widen = islandWiden(p)
  const d = coastDistance(x, z, widen) // + on land, − in water
  const bed = SEABED_DEPTH * p.vScale

  let h: number
  if (d >= 0) {
    // lift the land clear of the waterline so the coast comes from the shoreline
    // data, not from the noise happening to dip below zero
    const onIsland = smoothstep(-0.5, 0.5, islandDistance(x, z, widen))
    const relief = URBAN_RELIEF + (ISLAND_RELIEF - URBAN_RELIEF) * onIsland
    const lift = URBAN_LIFT * (1 - onIsland) * (p.amplitude / 4)
    h = ((0.12 + 0.88 * n01) * p.amplitude * relief + lift) * smoothstep(0, BANK_UP, d)
  } else {
    h = -bed * smoothstep(0, SHELF, -d)
  }

  // sink into the sea at the map's edges, so land never ends in a cliff
  const edge = Math.min(x - WORLD.x0, WORLD.x1 - x, z - WORLD.z0, WORLD.z1 - z)
  const keep = smoothstep(0, EDGE_FADE, edge)
  return h * keep - bed * (1 - keep)
}

/** Procedural height plus the erosion offsets — everything but hand edits. */
export function baseHeight(x: number, z: number, p: TerrainParams): number {
  return proceduralHeight(x, z, p) + sampleEdits(p.erosionGrid, x, z) * p.vScale
}

/**
 * Runs the erosion simulation over the procedural terrain described by `p`
 * and returns the offset grid to store in `erosionGrid` (null when off).
 * Expensive — call it from a memo, not per frame.
 */
export function erodeTerrain(p: TerrainParams): TerrainEdits | null {
  if (p.erosion <= 0) return null
  return erode(
    (x, z) => proceduralHeight(x, z, p),
    // only land erodes — the river bed stays put
    (x, z) => smoothstep(0.5, 3, coastDistance(x, z, islandWiden(p))),
    p.amplitude,
    p.erosion * 1000,
    p.seed,
  )
}

/** Final terrain height: the procedural surface plus any terraform edits. */
export function height(x: number, z: number, p: TerrainParams): number {
  return baseHeight(x, z, p) + sampleEdits(p.edits, x, z) * p.vScale
}

// seeded PRNG (mulberry32) — Math.random() can't be seeded
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 // 0..1
  }
}

/**
 * Every setting that changes the SHAPE of the ground, i.e. what height()
 * returns. Not sea level, which only changes where the water is drawn and what
 * colour things are; not Resolution, which only changes how finely the smooth
 * mesh samples it; not the erosion strength, which reaches height() through
 * erosionGrid. Use as a React dependency list for anything expensive that
 * shouldn't rebuild when the climate timeline moves the sea every frame.
 */
export const shapeKey = (p: TerrainParams): unknown[] => [
  p.seed, p.amplitude, p.frequency, p.octaves, p.persistence, p.ridged,
  p.noiseBlend, p.redistribution, p.terraces, p.islandWidth,
  p.offsetX, p.offsetZ, p.vScale, p.edits, p.erosionGrid,
]
