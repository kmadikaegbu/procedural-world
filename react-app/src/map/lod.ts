/**
 * Level-of-detail settings and the distance → level rule (pure, no three/React).
 *
 *   level 0  closer than thresholds[0]
 *   level 1  thresholds[0] … thresholds[1]
 *   level 2  thresholds[1] … thresholds[2]
 *   level 3  beyond thresholds[2]
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

export const LOD_NAMES = ['LOD0', 'LOD1', 'LOD2', 'LOD3'] as const

/** Debug colours, nearest → farthest. Ring i (the switch into level i+1) wears level i+1's colour. */
export const LOD_COLORS = ['#4ade80', '#facc15', '#fb923c', '#f43f5e'] as const

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
 * With hysteresis a tree only moves FARTHER once it's past threshold×(1+h) and
 * only moves NEARER once it's inside threshold×(1−h), so a tree sitting right
 * on a boundary (or a camera jittering across it) can't flicker back and forth.
 * `fresh` skips the dead band — used when there is no previous level to stick to.
 *
 * Returns true if any level changed.
 */
export function updateLevels(
  levels: Uint8Array,
  positions: Float32Array, // x,y,z per tree
  n: number,
  cam: { x: number; y: number; z: number },
  thresholds: readonly [number, number, number],
  hysteresis: number,
  fresh: boolean,
): boolean {
  const exact = thresholds.map((t) => t * t)
  const farther = thresholds.map((t) => (t * (1 + hysteresis)) ** 2)
  const nearer = thresholds.map((t) => (t * (1 - hysteresis)) ** 2)
  let changed = false
  for (let i = 0; i < n; i++) {
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
