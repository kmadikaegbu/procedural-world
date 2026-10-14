import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { hash01, hash32 } from './grammar'
import { grassRange, height, islandXReach, MAP_SIZE, type TerrainParams } from '../noise'

/**
 * Where the trees go — pure data in, pure data out, no meshes.
 *
 * Every candidate spot gets its own seed (`hash32(base, candidateIndex)`), and
 * everything about the tree that would grow there — position, yaw, tilt, size,
 * girth, tint, which shape — is a hash of THAT seed. So:
 *   - the same settings always plant the same forest,
 *   - no two trees share a seed, and
 *   - a candidate's numbers never depend on how many others were accepted, so
 *     editing the terrain or a slider doesn't reshuffle the whole forest.
 */

/** Size of the scatter pool. The Count control draws a prefix of it. */
export const MAX_TREES = 5000

export interface ScatterSettings {
  /** 0 = trees anywhere on the grass; 1 = grouped into stands by a slow noise field. */
  clustering: number
  /** Random spin range in degrees (360 = any direction, 0 = every tree faces the same way). */
  yaw: number
  /** Random lean range in degrees (± this much off vertical). */
  tilt: number
  /** Each tree's size is a random pick in this range (1 = the species' natural height). */
  scaleMin: number
  scaleMax: number
  /** Minimum distance between any two trees, in world units. 0 = no rule. */
  minSpacing: number
  /** Steepest ground a tree may stand on, in degrees. 90 = no limit. */
  slopeLimit: number
  /** Plant only inside the painted mask. */
  maskEnabled: boolean
  /** Distinct shapes grown per species — more variants, more unique trees, more draw calls. */
  variants: number
}

export const SCATTER_DEFAULTS: ScatterSettings = {
  clustering: 1,
  yaw: 360,
  tilt: 4,
  scaleMin: 0.6,
  scaleMax: 1.4,
  minSpacing: 0.5,
  slopeLimit: 55,
  maskEnabled: false,
  variants: 6,
}

export const SCATTER_SLIDERS: {
  key: Exclude<keyof ScatterSettings, 'maskEnabled'>
  label: string
  title: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'clustering', label: 'Clustering', title: 'How strongly trees group into stands. 0 = spread evenly over the grass, 1 = dense groves with clearings.', min: 0, max: 1, step: 0.05 },
  { key: 'yaw', label: 'Rotation', title: 'Random spin range in degrees. 360 = any direction, 0 = every tree faces the same way.', min: 0, max: 360, step: 15 },
  { key: 'tilt', label: 'Tilt', title: 'Random lean off vertical, ± this many degrees.', min: 0, max: 15, step: 0.5 },
  { key: 'scaleMin', label: 'Scale min', title: 'Smallest tree, as a multiple of its natural size.', min: 0.2, max: 2.5, step: 0.05 },
  { key: 'scaleMax', label: 'Scale max', title: 'Largest tree, as a multiple of its natural size.', min: 0.2, max: 2.5, step: 0.05 },
  { key: 'minSpacing', label: 'Spacing', title: 'Minimum distance between any two trees, in world units. Higher = a sparser, more orderly forest — it can cap how many trees fit.', min: 0, max: 6, step: 0.1 },
  { key: 'slopeLimit', label: 'Slope limit', title: 'Steepest ground a tree will grow on, in degrees. 90 = no limit; lower keeps trees off cliffs and banks.', min: 5, max: 90, step: 1 },
  { key: 'variants', label: 'Shapes', title: 'Distinct shapes grown per species (a single-species forest grows twice as many). More shapes = fewer lookalikes, but more instanced draw calls.', min: 1, max: 16, step: 1 },
]

// ---------------------------------------------------------------------------
// The painted mask: a coarse grid over the whole map, 1 = plant here
// ---------------------------------------------------------------------------

export const MASK_RES = 64

export interface ScatterMask {
  res: number
  data: Uint8Array
}

export const emptyMask = (): ScatterMask => ({
  res: MASK_RES,
  data: new Uint8Array(MASK_RES * MASK_RES),
})

/** World size of one mask cell. */
export const MASK_CELL = MAP_SIZE / MASK_RES

const cellOf = (v: number, res: number) =>
  Math.min(res - 1, Math.max(0, Math.floor(((v + MAP_SIZE / 2) / MAP_SIZE) * res)))

export function maskAt(m: ScatterMask, x: number, z: number): boolean {
  return m.data[cellOf(z, m.res) * m.res + cellOf(x, m.res)] > 0
}

/** Paint (value 1) or erase (0) every cell whose centre is within `radius` of (x, z). */
export function paintMask(
  data: Uint8Array,
  res: number,
  x: number,
  z: number,
  radius: number,
  value: 0 | 1,
) {
  const cell = MAP_SIZE / res
  const i0 = cellOf(x - radius, res)
  const i1 = cellOf(x + radius, res)
  const j0 = cellOf(z - radius, res)
  const j1 = cellOf(z + radius, res)
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cx = -MAP_SIZE / 2 + (i + 0.5) * cell
      const cz = -MAP_SIZE / 2 + (j + 0.5) * cell
      if ((cx - x) ** 2 + (cz - z) ** 2 <= radius * radius) data[j * res + i] = value
    }
  }
}

// ---------------------------------------------------------------------------
// The scatter
// ---------------------------------------------------------------------------

export interface PlacedTree {
  /** Position in the pool — the Count slider keeps the ones below it. */
  i: number
  /** This tree's own seed; every other field below is a hash of it. */
  seed: number
  pos: [number, number, number]
  yaw: number // radians
  tiltX: number // radians
  tiltZ: number // radians
  scale: number
  girth: number // sideways stretch, so two copies of a shape differ in build
  tint: number // brightness multiplier on the vertex colours
  species: 0 | 1 | 2 // which stand it grows in (only used by the mixed forest)
  variantRoll: number // 0..1 — picks one of the species' shapes
}

const forestNoise = new ImprovedNoise()
const DEG = Math.PI / 180

/**
 * For a VoxelMap: snap each candidate to the exact grid VoxelTerrain samples,
 * so a tree can never land where no block was actually rendered underneath it.
 */
export interface VoxelSnap {
  xz: (v: number) => number
  y: (h: number) => number
}

export function scatterTrees(
  params: TerrainParams,
  s: ScatterSettings,
  mask: ScatterMask | null,
  scatterSeed: number,
  voxel?: VoxelSnap,
): PlacedTree[] {
  const base = hash32(params.seed + 777, scatterSeed * 131 + 1)
  // only sample where land can actually be — in island mode most of the map is
  // river, so scattering across the full square wastes nearly every try
  const xReach = islandXReach(params)
  const zReach = MAP_SIZE * 0.48
  const [minY, maxY] = grassRange(params)
  const out: PlacedTree[] = []

  // spacing: a grid with cells the size of the spacing, so only the 3×3 cells
  // around a candidate can hold a neighbour that's too close
  const spacing = s.minSpacing
  const grid = new Map<number, number[]>()
  const key = (cx: number, cz: number) => cx * 100003 + cz
  const tooClose = (x: number, z: number) => {
    const cx = Math.floor(x / spacing)
    const cz = Math.floor(z / spacing)
    for (let a = cx - 1; a <= cx + 1; a++) {
      for (let b = cz - 1; b <= cz + 1; b++) {
        for (const j of grid.get(key(a, b)) ?? []) {
          const dx = out[j].pos[0] - x
          const dz = out[j].pos[2] - z
          if (dx * dx + dz * dz < spacing * spacing) return true
        }
      }
    }
    return false
  }

  const limitSlope = s.slopeLimit < 89.5
  const maxGrad = Math.tan(s.slopeLimit * DEG)
  const STEP = 0.6 // finite-difference step for the slope, in world units
  const scaleLo = Math.min(s.scaleMin, s.scaleMax)
  const scaleHi = Math.max(s.scaleMin, s.scaleMax)
  const maskOn = s.maskEnabled && mask !== null

  for (let cand = 0; out.length < MAX_TREES && cand < MAX_TREES * 40; cand++) {
    const seed = hash32(base, cand)
    let x = (hash01(seed, 1) - 0.5) * 2 * xReach
    let z = (hash01(seed, 2) - 0.5) * 2 * zReach
    const keepRoll = hash01(seed, 3)
    if (voxel) {
      x = voxel.xz(x)
      z = voxel.xz(z)
    }

    if (maskOn && !maskAt(mask, x, z)) continue // cheapest test first
    const h = height(x, z, params)
    if (h < minY || h > maxY) continue // grass band only

    // stands: a slow noise field decides how likely each spot is to keep a tree
    const density = forestNoise.noise(x * 0.05, z * 0.05, params.seed) // -1..1
    const keep = 1 - s.clustering + (s.clustering * (density + 1)) / 2
    if (keepRoll > keep) continue

    if (limitSlope) {
      const gx = (height(x + STEP, z, params) - h) / STEP
      const gz = (height(x, z + STEP, params) - h) / STEP
      if (Math.hypot(gx, gz) > maxGrad) continue
    }
    if (spacing > 0 && tooClose(x, z)) continue

    const sNoise = forestNoise.noise(x * 0.03 + 100, z * 0.03 + 100, params.seed)
    const r = (salt: number) => hash01(seed, salt)
    out.push({
      i: out.length,
      seed,
      // sit on the block's actual top face, not the smooth in-between height
      pos: [x, voxel ? voxel.y(h) : h, z],
      yaw: (r(10) - 0.5) * s.yaw * DEG,
      tiltX: (r(14) - 0.5) * 2 * s.tilt * DEG,
      tiltZ: (r(15) - 0.5) * 2 * s.tilt * DEG,
      scale: scaleLo + r(11) * (scaleHi - scaleLo),
      girth: 0.85 + r(12) * 0.3,
      tint: 0.85 + r(13) * 0.25,
      species: sNoise < -0.12 ? 0 : sNoise < 0.12 ? 1 : 2,
      variantRoll: r(16),
    })
    if (spacing > 0) {
      const k = key(Math.floor(x / spacing), Math.floor(z / spacing))
      const cell = grid.get(k)
      if (cell) cell.push(out.length - 1)
      else grid.set(k, [out.length - 1])
    }
  }
  return out
}

const _m = new Matrix4()
const _q = new Quaternion()
const _e = new Euler(0, 0, 0, 'YXZ') // spin about the trunk first, then lean
const _p = new Vector3()
const _s = new Vector3()

/** Write a placed tree's transform (position × spin × lean × size) into `out` at `at`. */
export function treeMatrix(t: PlacedTree, out: Float32Array, at: number) {
  _e.set(t.tiltX, t.yaw, t.tiltZ)
  _q.setFromEuler(_e)
  _p.set(...t.pos)
  _s.set(t.scale * t.girth, t.scale, t.scale * t.girth)
  _m.compose(_p, _q, _s)
  out.set(_m.elements, at)
}
