import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { hash01, hash32 } from './grammar'
import { BANDS, height, type TerrainParams } from '../noise'
import { WORLD } from '../world/shore'
import { makeSpec } from '../world/spec'
import { EXAGGERATION, m, ratios, type ScaleMode } from '../scale'

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

/**
 * Size of the scatter pool — the most trees that can exist. The Count control
 * draws that many of the ones currently on suitable ground. (The map is ~470,000
 * square units, so the pool is big; far trees are drawn as cheap blobs by the LOD.)
 */
export const MAX_TREES = 30000

export interface ScatterSettings {
  /** 0 = trees anywhere on the grass; 1 = grouped into stands by a slow noise field. */
  clustering: number
  /** Random spin range in degrees (360 = any direction, 0 = every tree faces the same way). */
  yaw: number
  /** Random lean range in degrees (± this much off vertical). */
  tilt: number
  /**
   * Smallest and largest tree, as a multiple of the species' mature height
   * (1 = a fully grown tree). The size each tree actually gets inside this
   * range comes from its stand's age and its site — see treeSize().
   */
  scaleMin: number
  scaleMax: number
  /**
   * How much trees differ in size. 0 = every tree the same middling size;
   * 1 = natural woodland (young and old stands, stunted trees on exposed or
   * steep ground, tall ones in sheltered hollows); above 1 exaggerates it.
   */
  sizeVariety: number
  /** Minimum distance between any two trees, in REAL METRES (scaled like the trees). 0 = no rule. */
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
  scaleMin: 0.3, // a young tree, ~⅓ of mature height
  scaleMax: 1.15, // a veteran, a little taller than the species' mature height
  sizeVariety: 1,
  minSpacing: 6, // metres — ≈ 0.5 units at the readable scale
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
  { key: 'scaleMin', label: 'Scale min', title: 'Smallest tree (a sapling), as a multiple of its species\' mature height.', min: 0.1, max: 2, step: 0.05 },
  { key: 'scaleMax', label: 'Scale max', title: 'Largest tree (a veteran), as a multiple of its species\' mature height. 1 = fully grown.', min: 0.1, max: 2, step: 0.05 },
  { key: 'sizeVariety', label: 'Size variety', title: 'How much trees differ in size. 0 = all the same. 1 = natural: young and old stands, stunted trees on exposed or steep ground, tall ones in sheltered hollows. Higher exaggerates it.', min: 0, max: 1.5, step: 0.05 },
  { key: 'minSpacing', label: 'Spacing (m)', title: 'Minimum distance between any two trees, in real metres. It is enlarged exactly like the trees are, so spacing stays in proportion at either scale. Higher = a sparser, more orderly forest — it can cap how many trees fit.', min: 0, max: 70, step: 1 },
  { key: 'slopeLimit', label: 'Slope limit', title: 'Steepest ground a tree will grow on, in degrees. 90 = no limit; lower keeps trees off cliffs and banks.', min: 5, max: 90, step: 1 },
  { key: 'variants', label: 'Shapes', title: 'Distinct shapes grown per species (a single-species forest grows twice as many). More shapes = fewer lookalikes, but more instanced draw calls.', min: 1, max: 16, step: 1 },
]

// ---------------------------------------------------------------------------
// The painted mask: a coarse grid over the whole map, 1 = plant here
// ---------------------------------------------------------------------------

// One grid over the whole city, ~2.4 world units (80 m) per cell.
export const MASK_GRID = makeSpec(WORLD, 2.4)

export interface ScatterMask {
  data: Uint8Array // MASK_GRID.w × MASK_GRID.h
}

export const emptyMask = (): ScatterMask => ({
  data: new Uint8Array(MASK_GRID.w * MASK_GRID.h),
})

/** World size of one mask cell. */
export const MASK_CELL = MASK_GRID.cell

// the mask node nearest to a world position
const nodeX = (x: number) => Math.min(MASK_GRID.w - 1, Math.max(0, Math.round((x - MASK_GRID.x0) / MASK_GRID.cell)))
const nodeZ = (z: number) => Math.min(MASK_GRID.h - 1, Math.max(0, Math.round((z - MASK_GRID.z0) / MASK_GRID.cell)))

export function maskAt(m: ScatterMask, x: number, z: number): boolean {
  return m.data[nodeZ(z) * MASK_GRID.w + nodeX(x)] > 0
}

/** Paint (value 1) or erase (0) every cell whose centre is within `radius` of (x, z). */
export function paintMask(
  data: Uint8Array,
  x: number,
  z: number,
  radius: number,
  value: 0 | 1,
) {
  const i0 = nodeX(x - radius)
  const i1 = nodeX(x + radius)
  const j0 = nodeZ(z - radius)
  const j1 = nodeZ(z + radius)
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cx = MASK_GRID.x0 + i * MASK_GRID.cell
      const cz = MASK_GRID.z0 + j * MASK_GRID.cell
      if ((cx - x) ** 2 + (cz - z) ** 2 <= radius * radius) data[j * MASK_GRID.w + i] = value
    }
  }
}

// ---------------------------------------------------------------------------
// The scatter
// ---------------------------------------------------------------------------

export interface PlacedTree {
  /** Position in the pool — the Count slider keeps the first ones that are on suitable ground. */
  i: number
  /** Height of the ground here — checked against the CURRENT sea level to decide if the tree is on grass. */
  h: number
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
// the range of sea levels the climate timeline reaches (−1 … 2.4), with a margin
// share of candidate spots clustered around the island, and how far they spread
// (world units; about 63% fall within this distance of the island's centre)
const FOCUS_SHARE = 0.55
const FOCUS_SPREAD = 38
const SEA_MIN = -1.2
const SEA_MAX = 2.6
const DEG = Math.PI / 180

/**
 * TREE SIZE — how big a tree grows, as a fraction (0 = smallest allowed, 1 = largest).
 *
 * Real trees aren't random sizes between two limits. Three things set it:
 *
 *   STAND AGE   trees in one grove sprang up together, so they're about the
 *               same age; neighbouring groves can be young or old. A slow noise
 *               field gives each place an age, and each tree varies a little
 *               around it.
 *   SITE        sheltered, low, fertile ground grows taller trees. Trees with
 *               open water around them are exposed to wind and stay stunted,
 *               and trees on steep ground are poorer too.
 *   CHANCE      every tree gets its own random nudge from its own seed.
 *
 * `variety` blends from "all identical" (0) to the full effect (1) and beyond.
 */
export interface SiteInfo {
  /** 0 at the bottom of the grass band (low, near the river) → 1 at the top. */
  height01: number
  /** 0 = flat ground, 1 = at the slope limit. */
  steep01: number
  /** 0 = sheltered, 1 = open water on every side. */
  exposed01: number
  /** 0..1 — the stand's age from the slow noise field. */
  stand01: number
  /** 0..1 — this tree's own chance. */
  chance01: number
}

export function treeSize01(site: SiteInfo, variety: number): number {
  // age: mostly the stand's, partly the tree's own
  const age = 0.75 * site.stand01 + 0.25 * site.chance01
  // site quality: 1 = ideal, lower = stunted by height up the bank, wind and slope
  const quality =
    1 - 0.3 * site.height01 - 0.4 * site.exposed01 - 0.3 * site.steep01
  const raw = 0.65 * age + 0.35 * quality
  // variety 0 → everything collapses to the middle; 1 → the full spread
  return Math.min(1, Math.max(0, 0.5 + (raw - 0.5) * 2 * variety))
}

/**
 * For a VoxelMap: snap each candidate to the exact grid VoxelTerrain samples,
 * so a tree can never land where no block was actually rendered underneath it.
 */
export interface VoxelSnap {
  x: (v: number) => number
  z: (v: number) => number
  y: (h: number) => number
}

export function scatterTrees(
  params: TerrainParams,
  s: ScatterSettings,
  mask: ScatterMask | null,
  scatterSeed: number,
  voxel?: VoxelSnap,
  scaleMode: ScaleMode = 'readable',
): PlacedTree[] {
  const base = hash32(params.seed + 777, scatterSeed * 131 + 1)
  // The pool must not depend on sea level (the climate timeline changes it every
  // frame, and re-scattering 30,000 trees each time would stall it). So accept
  // ground on grass at ANY sea level the timeline reaches; Props then hides the
  // trees that are off the grass band at the current one.
  const loY = SEA_MIN + BANDS.sand * params.amplitude
  const hiY = SEA_MAX + BANDS.grass * params.amplitude
  // for tree sizes, judge "how high up the bank" against the band at sea level 0
  const [minY, maxY] = [BANDS.sand * params.amplitude, BANDS.grass * params.amplitude]
  const out: PlacedTree[] = []

  // spacing: a grid with cells the size of the spacing, so only the 3×3 cells
  // around a candidate can hold a neighbour that's too close
  // spacing is real metres × the same factor the trees are enlarged by, so a
  // forest keeps its density whichever scale it's drawn at
  const spacing = m(s.minSpacing) * EXAGGERATION[scaleMode].objects
  const sizeRatio = ratios(scaleMode).objects // 1 readable, ~0.34 true to scale
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
  const EXPOSURE_RADIUS = 5 // world units: how far a tree "looks" for open water

  for (let cand = 0; out.length < MAX_TREES && cand < MAX_TREES * 40; cand++) {
    const seed = hash32(base, cand)
    // Most candidate spots cluster around Roosevelt Island, thinning smoothly
    // with distance (a bell curve, so there's no visible edge); the rest are
    // anywhere on the map. Spread evenly over a ~470,000-unit map, 30,000 trees
    // would leave the island nearly bare; this keeps it lush while trees still
    // grow, more sparsely, on suitable land everywhere.
    const focused = hash01(seed, 4) < FOCUS_SHARE
    let x: number
    let z: number
    if (focused) {
      // Box–Muller: two uniform numbers → a point from a 2-D bell curve
      const rad = FOCUS_SPREAD * Math.sqrt(-2 * Math.log(Math.max(hash01(seed, 5), 1e-9)))
      const ang = hash01(seed, 6) * Math.PI * 2
      x = rad * Math.cos(ang)
      z = rad * Math.sin(ang)
      if (x < WORLD.x0 || x > WORLD.x1 || z < WORLD.z0 || z > WORLD.z1) continue
    } else {
      x = WORLD.x0 + hash01(seed, 1) * (WORLD.x1 - WORLD.x0)
      z = WORLD.z0 + hash01(seed, 2) * (WORLD.z1 - WORLD.z0)
    }
    const keepRoll = hash01(seed, 3)
    if (voxel) {
      x = voxel.x(x)
      z = voxel.z(z)
    }

    if (maskOn && !maskAt(mask, x, z)) continue
    const h = height(x, z, params)
    if (h < loY || h > hiY) continue // grass band only

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

    // --- how big does this tree grow? (see treeSize01) ---
    // exposure: what share of the ground 5 units away, in 8 directions, is open water?
    let wet = 0
    for (let a = 0; a < 8; a++) {
      const ang = a * (Math.PI / 4)
      if (height(x + Math.cos(ang) * EXPOSURE_RADIUS, z + Math.sin(ang) * EXPOSURE_RADIUS, params) < 0) wet++
    }
    const gx2 = (height(x + STEP, z, params) - h) / STEP
    const gz2 = (height(x, z + STEP, params) - h) / STEP
    const site: SiteInfo = {
      height01: (h - minY) / Math.max(maxY - minY, 1e-6),
      steep01: Math.min(1, Math.hypot(gx2, gz2) / Math.max(maxGrad, 0.05)),
      exposed01: wet / 8,
      // Perlin noise rarely strays far from 0, so stretch it to use the full
      // 0..1 range — otherwise every stand would come out the same middling age
      stand01: Math.min(1, Math.max(0, 0.5 + 0.9 * forestNoise.noise(x * 0.06 + 300, z * 0.06 + 300, params.seed))),
      chance01: r(11),
    }
    const size01 = treeSize01(site, s.sizeVariety)
    const size = scaleLo + size01 * (scaleHi - scaleLo)
    out.push({
      i: out.length,
      h,
      seed,
      // sit on the block's actual top face, not the smooth in-between height
      pos: [x, voxel ? voxel.y(h) : h, z],
      yaw: (r(10) - 0.5) * s.yaw * DEG,
      tiltX: (r(14) - 0.5) * 2 * s.tilt * DEG,
      tiltZ: (r(15) - 0.5) * 2 * s.tilt * DEG,
      scale: size * sizeRatio,
      // young trees are slimmer for their height, old ones sturdier (trunk
      // thickness grows faster than height does)
      girth: (0.85 + r(12) * 0.3) * Math.min(1.1, Math.max(0.7, Math.pow(Math.max(size, 0.05), 0.3))),
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
