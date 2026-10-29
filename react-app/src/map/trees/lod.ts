import { Color, type Camera, type InstancedMesh, type OrthographicCamera } from 'three'
import { LOD_COUNT } from './geometry'
import type { PlacedTree } from './scatter'
import type { TreeSet } from './treeSet'

/**
 * LOD MANAGER — decides how much detail each tree gets, every frame.
 *
 * Every tree shape exists at four levels of detail (geometry.ts). Close trees
 * should use the full mesh; far ones can use a cheap stand-in nobody can tell
 * apart at that size. The camera distance picks the level:
 *
 *   level 0  closer than thresholds[0]          full tree
 *   level 1  thresholds[0] … thresholds[1]      one generation fewer
 *   level 2  thresholds[1] … thresholds[2]      main limbs + leaf clumps
 *   level 3  beyond thresholds[2]               one blob
 *
 * Drawing: each (shape, level) pair is ONE InstancedMesh, a mesh the GPU can
 * draw many copies of in a single call. Each frame the manager "files" every
 * tree under the mesh for its current level. So the forest costs one draw call
 * per (shape, level) that has any trees in it, whether that's 10 trees or 5,000.
 */

export interface LodSettings {
  /** Off = every tree is drawn at LOD0 (the "before" in a before/after comparison). */
  enabled: boolean
  /** Camera distances (world units) where a tree drops to LOD1, LOD2, LOD3. */
  thresholds: [number, number, number]
  /** Fraction of each threshold used as a dead band (0.08 = ±8%). */
  hysteresis: number
  /** Draw a ring at each threshold and tint every tree by its current level. */
  debug: boolean
}

export const LOD_DEFAULTS: LodSettings = {
  enabled: false,
  thresholds: [45, 85, 125],
  hysteresis: 0.08,
  debug: false,
}

/** Used where LOD doesn't apply (the minimap). */
export const LOD_OFF: LodSettings = { ...LOD_DEFAULTS, enabled: false }

/** Debug colours, nearest → farthest. Ring i (the switch into level i+1) wears level i+1's colour. */
export const LOD_COLORS = ['#4ade80', '#facc15', '#fb923c', '#f43f5e'] as const

// Debug tint per level. It multiplies the tree's own colours, so it's pushed
// past 1 to stay readable on dark bark.
const DEBUG_TINT = LOD_COLORS.map((c) => new Color(c).multiplyScalar(1.6))

/** What <Props> reports back about the frame it just drew. */
export interface LodReadout {
  /** Was LOD on when this was measured. */
  enabled: boolean
  /** Triangles in the trees only (what LOD changes). */
  treeTris: number
  /** Everything the GPU drew last frame (terrain, water, trees, shadow pass…). */
  frameTris: number
  fps: number
  /** Trees at each level. */
  byLevel: number[]
  /** Instanced meshes drawn for the trees — i.e. tree draw calls (shadow pass not counted). */
  meshes: number
}

/**
 * Re-pick every tree's level from its camera distance.
 *
 * Hysteresis: a tree only moves FARTHER once it's past threshold×(1+h), and
 * only moves NEARER once it's inside threshold×(1−h). The gap in between is a
 * "dead band" where it keeps whatever level it had, so a tree sitting right on
 * a boundary (or a camera jittering across it) can't flicker back and forth.
 * `fresh` skips the dead band — used when there is no previous level to keep.
 *
 * Returns true if any level changed.
 */
export function updateLevels(
  levels: Uint8Array,
  positions: Float32Array, // x,y,z per tree
  chosen: Uint32Array, // which trees to update (indices into positions/levels)
  cam: { x: number; y: number; z: number },
  thresholds: readonly [number, number, number],
  hysteresis: number,
  fresh: boolean,
): boolean {
  // compare squared distances — same answer, no square roots
  const exact = thresholds.map((t) => t * t)
  const farther = thresholds.map((t) => (t * (1 + hysteresis)) ** 2)
  const nearer = thresholds.map((t) => (t * (1 - hysteresis)) ** 2)
  let changed = false
  for (let c = 0; c < chosen.length; c++) {
    const i = chosen[c]
    if (i >= levels.length) continue // a selection from before the pool changed
    const dx = positions[i * 3] - cam.x
    const dy = positions[i * 3 + 1] - cam.y
    const dz = positions[i * 3 + 2] - cam.z
    const d2 = dx * dx + dy * dy + dz * dz
    let level = fresh ? 0 : levels[i]
    if (fresh) {
      while (level < 3 && d2 > exact[level]) level++
    } else {
      while (level < 3 && d2 > farther[level]) level++
      while (level > 0 && d2 < nearer[level - 1]) level--
    }
    if (level !== levels[i]) {
      levels[i] = level
      changed = true
    }
  }
  return changed
}

// ---------------------------------------------------------------------------

/** Everything about each tree that doesn't change with the camera, packed into flat arrays. */
export interface ForestPool {
  n: number
  /** Which shape (index into TreeSet.shapes) each tree uses. */
  shapeOf: Uint16Array
  positions: Float32Array // x,y,z per tree
  matrices: Float32Array // 16 per tree: position × spin × lean × scale
  tints: Float32Array
  /** Trees per shape — how many copies each shape's meshes must be able to hold. */
  capacity: Int32Array
}

/** Pack the scattered trees for fast per-frame work, and assign each one a shape. */
export function packForest(
  trees: PlacedTree[],
  set: TreeSet,
  compose: (t: PlacedTree, out: Float32Array, at: number) => void,
): ForestPool {
  const n = trees.length
  const V = set.variantsPerSpecies
  const shapeFor = (t: PlacedTree) =>
    (set.mixed ? t.species * V : 0) + Math.floor(t.variantRoll * V)
  const pool: ForestPool = {
    n,
    shapeOf: new Uint16Array(n),
    positions: new Float32Array(n * 3),
    matrices: new Float32Array(n * 16),
    tints: new Float32Array(n),
    capacity: new Int32Array(set.shapes.length),
  }
  trees.forEach((t, i) => {
    // a mixed forest keeps each species in its own block of shapes;
    // a single-species one picks from all of them
    const shape = shapeFor(t)
    pool.shapeOf[i] = shape
    pool.capacity[shape]++
    pool.positions.set(t.pos, i * 3)
    pool.tints[i] = t.tint
    compose(t, pool.matrices, i * 16)
  })
  return pool
}

export class LodManager {
  /** One InstancedMesh per (shape, level): meshes[shape * LOD_COUNT + level]. */
  meshes: (InstancedMesh | null)[] = []

  /** As of the last refill. */
  byLevel = [0, 0, 0, 0]
  treeTris = 0
  drawCalls = 0

  private pool: ForestPool | null = null
  private set: TreeSet | null = null
  private settings: LodSettings = LOD_OFF
  private chosen: Uint32Array = new Uint32Array(0)
  private levels = new Uint8Array(0)
  private refresh = true
  private refill = true

  /** New trees, shapes or settings: forget every level and refill from scratch next frame. */
  configure(pool: ForestPool, set: TreeSet, settings: LodSettings) {
    this.pool = pool
    this.set = set
    this.settings = settings
    this.levels = new Uint8Array(pool.n)
    this.refresh = true
    for (const m of this.meshes) {
      // the per-copy colour buffer only exists once something has been written to it
      if (m && !m.instanceColor) m.setColorAt(0, new Color(1, 1, 1))
    }
  }

  /**
   * Which trees of the pool to draw (indices into it). Cheap: the pool and the
   * meshes stay as they are, the meshes are just refilled next frame. This is
   * how sea level and the Count slider change the forest without repacking it.
   */
  select(chosen: Uint32Array) {
    this.chosen = chosen
    this.refill = true
  }

  /** Call once per frame. Returns true if the meshes were refilled. */
  update(camera: Camera): boolean {
    const p = this.pool
    const set = this.set
    if (!p || !set) return false
    const chosen = this.chosen
    const cfg = this.settings
    // an orthographic view (the 2D minimap) has no meaningful "distance" — draw it at full detail
    const active = cfg.enabled && !(camera as OrthographicCamera).isOrthographicCamera
    const fresh = this.refresh
    this.refresh = false

    let changed = fresh || this.refill
    this.refill = false
    if (active) {
      const moved = updateLevels(
        this.levels,
        p.positions,
        chosen,
        camera.position,
        cfg.thresholds,
        cfg.hysteresis,
        fresh,
      )
      changed = moved || changed
    } else if (fresh) {
      this.levels.fill(0)
    }
    if (!changed) return false // nobody switched level → the GPU buffers are still right

    // refill: copy each tree's matrix + tint into the mesh for its (shape, level)
    const S = set.shapes.length
    const filled = new Int32Array(S * LOD_COUNT)
    const byLevel = [0, 0, 0, 0]
    let treeTris = 0
    const debug = active && cfg.debug
    for (let c = 0; c < chosen.length; c++) {
      const i = chosen[c]
      if (i >= p.n) continue // a selection from before the pool changed
      const shape = p.shapeOf[i]
      const level = this.levels[i]
      const slot = shape * LOD_COUNT + level
      const mesh = this.meshes[slot]
      if (!mesh) continue
      const k = filled[slot]++
      mesh.instanceMatrix.array.set(p.matrices.subarray(i * 16, i * 16 + 16), k * 16)
      const col = mesh.instanceColor!.array
      const tint = p.tints[i]
      const d = debug ? DEBUG_TINT[level] : null
      col[k * 3] = d ? d.r * tint : tint
      col[k * 3 + 1] = d ? d.g * tint : tint
      col[k * 3 + 2] = d ? d.b * tint : tint
      byLevel[level]++
      treeTris += set.shapes[shape].tris[level]
    }
    let drawCalls = 0
    for (let slot = 0; slot < S * LOD_COUNT; slot++) {
      const mesh = this.meshes[slot]
      if (!mesh) continue
      mesh.count = filled[slot]
      mesh.visible = filled[slot] > 0 // a hidden mesh costs no draw call
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
      if (filled[slot] > 0) drawCalls++
    }
    this.byLevel = byLevel
    this.treeTris = treeTris
    this.drawCalls = drawCalls
    return true
  }
}
