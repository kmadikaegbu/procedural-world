import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

const perlin = new ImprovedNoise()

export const MAP_SIZE = 100 // world units across the terrain plane

export type TerrainParams = {
  seed: number
  amplitude: number // max height in world units
  frequency: number // base noise scale (small = broad hills)
  octaves: number // how many layers of detail
  persistence: number // how much each finer octave contributes (0–1)
  ridged: boolean // sharp mountain ridges vs. rolling hills
  resolution: number // grid segments per side — calibrates topography detail vs. cost
  island: boolean // mask the noise into the Roosevelt Island outline
  islandWidth: number // width multiplier — 0.45 ≈ true scale, 1 = legible
  offsetX: number // pan through the noise field, in sampled (post-frequency) units
  offsetZ: number // — same coastline, different hills underneath; seed jumps, this slides
  seaLevel: number // world-Y height of the water surface — the land doesn't move, just what's submerged
}

export const TERRAIN_DEFAULTS: TerrainParams = {
  seed: 1,
  amplitude: 4,
  frequency: 0.035,
  octaves: 5,
  persistence: 0.5,
  ridged: false,
  resolution: 200,
  island: true,
  islandWidth: 1,
  offsetX: 0,
  offsetZ: 0,
  seaLevel: 0,
}

// --- island shape -----------------------------------------------------------

const ISLAND_LENGTH = 0.96 // fraction of the map the island spans (north→south)
const ISLAND_HALF_WIDTH = 9 // world units at the widest point, before islandWidth
const SEABED_DEPTH = 4 // how far below sea level the river bottom sits

/**
 * Roosevelt Island half-width, north tip (t=0) → south tip (t=1), as a fraction
 * of the widest point. Traced off the RIOC island map — the real thing is a
 * 3.2 km ribbon that swells at the north hospital campus, pinches below
 * Blackwell, swells again at the Tram, then tapers to a point.
 */
const PROFILE = [
  0.05, // 0.00  north tip — Lighthouse point
  0.5, //  0.05  Lighthouse Park
  0.88, // 0.10  Coler North Campus
  1.0, //  0.15  widest point
  0.92, // 0.20  Coler North Campus, lower
  0.66, // 0.25  Tennis Courts — pinch
  0.6, //  0.30  Community Garden
  0.7, //  0.35  The Octagon
  0.76, // 0.40  Motorgate
  0.84, // 0.45  Roosevelt Island Bridge landing (bulges east)
  0.7, //  0.50  Capobianco Field
  0.6, //  0.55  Rivercross Lawn
  0.66, // 0.60  Blackwell Park
  0.52, // 0.65  pinch below Blackwell
  0.56, // 0.70  Riverwalk Commons
  0.62, // 0.75  Firefighters Field
  0.7, //  0.80  Tram Station / Sportspark
  0.72, // 0.85  Coler South Campus
  0.58, // 0.90  Southpoint Openspace
  0.34, // 0.95  Four Freedoms Park
  0.04, // 1.00  south tip
]

/** Centreline drift, same sampling — keeps the island from being a sausage. */
const DRIFT = [
  -0.3, -0.18, -0.06, 0.0, -0.02, -0.1, -0.14, -0.1, -0.02, 0.1, 0.12, 0.08,
  0.1, 0.04, 0.02, 0.04, 0.08, 0.06, 0.0, -0.06, -0.1,
]

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

const smoothstep = (edge0: number, edge1: number, v: number) => {
  const t = clamp01((v - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Linearly interpolate a control-point table at t ∈ 0..1. */
function sample(table: number[], t: number): number {
  const f = clamp01(t) * (table.length - 1)
  const i = Math.floor(f)
  const j = Math.min(i + 1, table.length - 1)
  const k = f - i
  return table[i] * (1 - k) + table[j] * k
}

/**
 * 1 inland, 0 out in the East River, with a soft band at the waterline.
 * Multiplying the noise by this is what turns a square of hills into an island.
 */
export function islandMask(x: number, z: number, p: TerrainParams): number {
  const halfLen = (MAP_SIZE * ISLAND_LENGTH) / 2
  const t = (z + halfLen) / (halfLen * 2) // 0 = north tip, 1 = south tip
  if (t < 0 || t > 1) return 0

  const scale = ISLAND_HALF_WIDTH * p.islandWidth
  const halfWidth = sample(PROFILE, t) * scale
  if (halfWidth < 0.05) return 0
  const centre = sample(DRIFT, t) * scale * 2

  // nibble the coastline with noise so the shore isn't a clean spline;
  // sampling each bank separately keeps east and west shores different
  const bank = x >= centre ? 4.7 : -4.7
  const wobble = perlin.noise(z * 0.09 + p.seed, bank, p.seed * 0.7) * 0.1

  const d = Math.abs(x - centre) / halfWidth + wobble
  return smoothstep(1.0, 0.72, d) // 1 inland → 0 at the waterline
}

// --- height field -----------------------------------------------------------

// fractal Brownian motion: sum several octaves of Perlin noise
function fbm(x: number, z: number, p: TerrainParams): number {
  const s = p.seed * 100
  let value = 0
  let amp = 1
  let freq = p.frequency
  let norm = 0

  for (let o = 0; o < p.octaves; o++) {
    let n = perlin.noise(
      x * freq + s + p.offsetX,
      z * freq + s + p.offsetZ,
      s * 0.1,
    ) // -1..1
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

export function height(x: number, z: number, p: TerrainParams): number {
  const n = fbm(x, z, p)
  if (!p.island) return n * p.amplitude

  // fbm with normalised octaves rarely reaches ±1, so stretch the usable range
  // before mapping to elevation — otherwise everything bunches into one biome
  const n01 = clamp01(0.5 + n * 1.15)

  // lift the land clear of the waterline so the coast comes from the mask,
  // not from the noise happening to dip below zero
  const land = (0.12 + 0.88 * n01) * p.amplitude
  const m = islandMask(x, z, p)
  return land * m - SEABED_DEPTH * (1 - m)
}

/** Half-extent the island can reach in x — lets prop scattering skip the river. */
export function islandXReach(p: TerrainParams): number {
  return p.island ? ISLAND_HALF_WIDTH * p.islandWidth * 1.8 : MAP_SIZE * 0.48
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
