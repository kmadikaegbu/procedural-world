/**
 * VARIABLE-DENSITY GRIDS — fine mesh around Roosevelt Island, coarse far away.
 *
 * A terrain or water mesh is a grid. A uniform grid fine enough to show the
 * island's detail would have millions of vertices over the whole city. Instead
 * the grid lines are spaced FINELY inside the detail square and grow wider the
 * farther they get, up to a coarse spacing:
 *
 *   |  |  |  |  |   |    |      |        |
 *   fine (±50)     grading →   coarse
 *
 * Because every row and column is shared by the whole mesh (a "tensor grid"),
 * there are no seams or T-junctions between the detailed and the coarse parts —
 * the mesh is one continuous surface.
 */

/**
 * Sorted positions of the grid lines along one axis, from `lo` to `hi`.
 * Lines are `fine` apart out to ±`innerHalf` from 0, then the spacing grows by
 * `growth` each step until it reaches `coarse`.
 */
export function axisLines(lo: number, hi: number, fine: number, coarse: number, innerHalf: number, growth = 1.25): number[] {
  const side = (limit: number): number[] => {
    // positions going away from 0, up to `limit` (> 0)
    const out: number[] = []
    let p = 0
    let step = fine
    while (p < limit - 1e-6) {
      const inner = p + 1e-6 < innerHalf
      if (!inner) step = Math.min(coarse, step * growth)
      let next = p + Math.max(step, fine)
      if (inner) next = Math.min(next, innerHalf) // land exactly on the detail square's edge
      p = next
      out.push(p)
    }
    // end exactly on the limit; absorb a sliver of a last cell
    out[out.length - 1] = limit
    if (out.length >= 2 && out[out.length - 1] - out[out.length - 2] < 0.3 * step) out.splice(out.length - 2, 1)
    return out
  }
  const pos = hi > 0 ? side(hi) : []
  const neg = lo < 0 ? side(-lo).map((v) => -v) : []
  return [...neg.reverse(), 0, ...pos]
}
