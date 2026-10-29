import { EXAGGERATION } from '../scale'
import { ISLAND_MEAN_HALF_WIDTH, islandDistance } from './shore'

/**
 * Roosevelt Island's outline is the real one, but at the readable scale it is
 * drawn fatter (2.5× its real width at Width = 1) so it stays easy to see. This
 * is how far each shore is pushed out, in world units.
 *
 * The widening is capped: the West Channel between the island and Manhattan is
 * about 260 m (7.8 units) at its narrowest, and must stay open.
 */
const WIDEN_MAX = 6

export function islandWiden(p: { islandWidth: number }): number {
  // p.islandWidth × 2.5 = how many times its real width the island is drawn (1 at true scale)
  const factor = p.islandWidth * EXAGGERATION.readable.islandWidth
  return Math.min(WIDEN_MAX, Math.max(0, ISLAND_MEAN_HALF_WIDTH * (factor - 1)))
}

/**
 * How much of a spot is Roosevelt Island itself, 0..1 (soft at the shore). The
 * island stays green parkland even when the rest of the city is paved.
 */
export function islandWeight(x: number, z: number, widen: number): number {
  const t = Math.min(1, Math.max(0, (islandDistance(x, z, widen) + 0.5) / 1))
  return t * t * (3 - 2 * t)
}
