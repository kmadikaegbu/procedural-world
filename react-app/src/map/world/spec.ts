import type { Rect } from './sdf'

/**
 * A regular grid laid over a rectangle of the world: `w` × `h` nodes, `cell`
 * world units apart, the first node at (x0, z0). Sculpt edits, erosion and the
 * tree-painting mask all use one of these, covering the whole city.
 */
export interface GridSpec {
  x0: number
  z0: number
  cell: number
  w: number
  h: number
}

export function makeSpec(area: Rect, cell: number): GridSpec {
  return {
    x0: area.x0,
    z0: area.z0,
    cell,
    w: Math.floor((area.x1 - area.x0) / cell) + 1,
    h: Math.floor((area.z1 - area.z0) / cell) + 1,
  }
}
