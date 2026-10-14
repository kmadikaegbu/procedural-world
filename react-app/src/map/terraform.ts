// Hand-sculpted terrain edits: a coarse grid of height OFFSETS laid over the
// whole map and added on top of the procedural height field. Because it lives
// in TerrainParams, everything that reads height() — smooth mesh, voxels,
// biomes, tree placement, minimap — picks up an edit with no extra wiring.

import { MAP_SIZE } from './mapSize'

// cells per side; ~0.8 world units per cell is finer than the voxels (1.5)
// and plenty for brush strokes several units across
export const EDIT_RES = 128

// how far a stroke can push the land up or down, in world units
const MAX_OFFSET = 24

export type TerrainEdits = {
  res: number
  data: Float32Array // res × res height offsets, row-major by z then x
}

export type BrushTool = 'raise' | 'lower' | 'flatten'

export function emptyEdits(): TerrainEdits {
  return { res: EDIT_RES, data: new Float32Array(EDIT_RES * EDIT_RES) }
}

const half = MAP_SIZE / 2
const toGrid = (v: number, res: number) => ((v + half) / MAP_SIZE) * (res - 1)
const fromGrid = (g: number, res: number) => (g / (res - 1)) * MAP_SIZE - half

/** Bilinear height offset at world (x, z); 0 outside the map or with no edits. */
export function sampleEdits(
  edits: TerrainEdits | null,
  x: number,
  z: number,
): number {
  if (!edits) return 0
  const { res, data } = edits
  const gx = toGrid(x, res)
  const gz = toGrid(z, res)
  if (gx < 0 || gz < 0 || gx > res - 1 || gz > res - 1) return 0

  const i = Math.min(Math.floor(gx), res - 2)
  const j = Math.min(Math.floor(gz), res - 2)
  const fx = gx - i
  const fz = gz - j
  const a = data[j * res + i]
  const b = data[j * res + i + 1]
  const c = data[(j + 1) * res + i]
  const d = data[(j + 1) * res + i + 1]
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz
}

/**
 * Applies one frame of brushing to `data` IN PLACE (the caller owns a working
 * copy for the duration of a stroke).
 *
 * - raise / lower: push the offset up or down by `rate` world units/second at
 *   the brush centre, fading smoothly to 0 at the rim.
 * - flatten: ease the FINAL height (procedural + offset) toward `target`, so
 *   a stroke levels hills and fills hollows to one plateau. `baseHeight`
 *   is the procedural height with no edits, so the offset needed is exact.
 */
export function applyBrush(
  data: Float32Array,
  res: number,
  tool: BrushTool,
  cx: number,
  cz: number,
  radius: number,
  rate: number,
  dt: number,
  target: number,
  baseHeight: (x: number, z: number) => number,
): void {
  const r = (radius / MAP_SIZE) * (res - 1) // radius in cells
  const gi0 = Math.max(0, Math.floor(toGrid(cx, res) - r))
  const gi1 = Math.min(res - 1, Math.ceil(toGrid(cx, res) + r))
  const gj0 = Math.max(0, Math.floor(toGrid(cz, res) - r))
  const gj1 = Math.min(res - 1, Math.ceil(toGrid(cz, res) + r))

  for (let j = gj0; j <= gj1; j++) {
    const z = fromGrid(j, res)
    for (let i = gi0; i <= gi1; i++) {
      const x = fromGrid(i, res)
      const d2 = ((x - cx) ** 2 + (z - cz) ** 2) / (radius * radius)
      if (d2 >= 1) continue
      const falloff = (1 - d2) * (1 - d2) // smooth dome, 1 at centre → 0 at rim

      const k = j * res + i
      let v = data[k]
      if (tool === 'flatten') {
        const want = target - baseHeight(x, z)
        // exponential ease, so the result doesn't depend on frame rate
        v += (want - v) * (1 - Math.exp(-rate * 0.6 * falloff * dt))
      } else {
        v += (tool === 'raise' ? 1 : -1) * rate * falloff * dt
      }
      data[k] = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, v))
    }
  }
}
