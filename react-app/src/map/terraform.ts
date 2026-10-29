// Hand-sculpted terrain edits: a coarse grid of height OFFSETS laid over the
// whole map and added on top of the procedural height field. Because it lives
// in TerrainParams, everything that reads height() — smooth mesh, voxels,
// biomes, tree placement, minimap — picks up an edit with no extra wiring.

import { WORLD } from './world/shore'
import { makeSpec } from './world/spec'

// One grid over the WHOLE city. ~1.2 world units (40 m) per cell is finer than
// the voxels (2.5) and plenty for brush strokes several units across.
export const EDIT_GRID = makeSpec(WORLD, 1.2)

// how far a stroke can push the land up or down, in world units
const MAX_OFFSET = 24

export type TerrainEdits = {
  data: Float32Array // EDIT_GRID.w × EDIT_GRID.h height offsets, row-major by z then x
}

export type BrushTool = 'raise' | 'lower' | 'flatten'

export function emptyEdits(): TerrainEdits {
  return { data: new Float32Array(EDIT_GRID.w * EDIT_GRID.h) }
}

const toGridX = (x: number) => (x - EDIT_GRID.x0) / EDIT_GRID.cell
const toGridZ = (z: number) => (z - EDIT_GRID.z0) / EDIT_GRID.cell
const fromGridX = (g: number) => EDIT_GRID.x0 + g * EDIT_GRID.cell
const fromGridZ = (g: number) => EDIT_GRID.z0 + g * EDIT_GRID.cell

// Edits fade to nothing over the last few units of the map, so a stroke near
// the edge never leaves a step against the sea beyond it.
const EDGE_FADE = 4
const edgeFade = (x: number, z: number) => {
  const d = Math.min(x - WORLD.x0, WORLD.x1 - x, z - WORLD.z0, WORLD.z1 - z)
  const t = Math.min(1, Math.max(0, d / EDGE_FADE))
  return t * t * (3 - 2 * t)
}

/** Bilinear height offset at world (x, z); 0 outside the map or with no edits. */
export function sampleEdits(
  edits: TerrainEdits | null,
  x: number,
  z: number,
): number {
  if (!edits) return 0
  const { w, h } = EDIT_GRID
  const gx = toGridX(x)
  const gz = toGridZ(z)
  if (gx < 0 || gz < 0 || gx > w - 1 || gz > h - 1) return 0

  const i = Math.min(Math.floor(gx), w - 2)
  const j = Math.min(Math.floor(gz), h - 2)
  const fx = gx - i
  const fz = gz - j
  const data = edits.data
  const a = data[j * w + i]
  const b = data[j * w + i + 1]
  const c = data[(j + 1) * w + i]
  const d = data[(j + 1) * w + i + 1]
  return ((a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz) * edgeFade(x, z)
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
  tool: BrushTool,
  cx: number,
  cz: number,
  radius: number,
  rate: number,
  dt: number,
  target: number,
  baseHeight: (x: number, z: number) => number,
): void {
  const { w, h } = EDIT_GRID
  const r = radius / EDIT_GRID.cell // radius in cells
  const gi0 = Math.max(0, Math.floor(toGridX(cx) - r))
  const gi1 = Math.min(w - 1, Math.ceil(toGridX(cx) + r))
  const gj0 = Math.max(0, Math.floor(toGridZ(cz) - r))
  const gj1 = Math.min(h - 1, Math.ceil(toGridZ(cz) + r))

  for (let j = gj0; j <= gj1; j++) {
    const z = fromGridZ(j)
    for (let i = gi0; i <= gi1; i++) {
      const x = fromGridX(i)
      const d2 = ((x - cx) ** 2 + (z - cz) ** 2) / (radius * radius)
      if (d2 >= 1) continue
      const falloff = (1 - d2) * (1 - d2) // smooth dome, 1 at centre → 0 at rim

      const k = j * w + i
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
