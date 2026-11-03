import { EXAGGERATION } from '../scale'
import { ISLAND_MEAN_HALF_WIDTH, islandDistance } from './shore'
import { BATTERY } from '../timeline'
import { parkWeight } from './parks'

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
  // p.islandWidth × the readable factor = how many times its real width the island is drawn (1 = real)
  const factor = p.islandWidth * EXAGGERATION.readable.islandWidth
  return Math.min(WIDEN_MAX, Math.max(0, ISLAND_MEAN_HALF_WIDTH * (factor - 1)))
}

/**
 * How much of a spot is Roosevelt Island itself, 0..1 (soft at the shore). The
 * island stays green parkland even when the rest of the city is paved.
 */
export function islandWeight(x: number, z: number, widen: number): number {
  const t = Math.min(1, Math.max(0, (islandDistance(x, z, widen) + 0.5) / 1))
  // the city's real parks (world/parks.ts) stay green too, like the island
  return Math.max(t * t * (3 - 2 * t), parkWeight(x, z))
}

/** Width of the city's edge, in world units (~1 km): built-up fades to green across it. */
export const CITY_EDGE = 30

/**
 * How built-up a spot is, 0..1: 1 within `reach` of the Battery (where the city
 * grew from), fading to 0 across the city's edge. See timeline.ts.
 */
export function urbanWeight(x: number, z: number, reach: number): number {
  const d = Math.hypot(x - BATTERY.x, z - BATTERY.z)
  const t = Math.min(1, Math.max(0, (reach - d) / CITY_EDGE))
  return t * t * (3 - 2 * t)
}

/**
 * How green (parkland rather than paved) a spot is, 0..1: paved only where the
 * city has reached, as strongly as the Paving setting says, and never on
 * Roosevelt Island (`island` is its islandWeight).
 */
export function greenAt(
  x: number,
  z: number,
  island: number,
  g: { paving: number; cityReach: number },
): number {
  return Math.max(1 - g.paving * urbanWeight(x, z, g.cityReach), island)
}
