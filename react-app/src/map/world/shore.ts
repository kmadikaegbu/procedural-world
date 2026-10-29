import data from './nycShore.json'
import { buildSdf, type Rect, type Ring, type Sdf } from './sdf'

/**
 * THE REAL SHORELINE of New York City, as signed-distance fields.
 *
 * nycShore.json is built by scripts/build-nyc-shore.mjs from the city's own
 * borough-boundary data, already projected into this project's units:
 *   1 unit = 33.5 m, Roosevelt Island's centre = (0, 0), +x east, +z SOUTH.
 *
 * Roosevelt Island and the rest of the city are kept as two separate fields.
 * That lets the "readable" scale fatten just the island (so it's easy to see)
 * without squeezing shut the river channels between it and its neighbours.
 */

export const WORLD: Rect = data.meta.bounds

/** The square of detailed terrain around Roosevelt Island: sculpting, erosion, painting and the Voxel scene live here. */
export const DETAIL_HALF = 50

// Cell sizes (world units). Coarser for the whole city, finer around the island.
const CITY_CELL = 0.4 // ≈ 13 m
const ISLAND_CELL = 0.2 // ≈ 6.7 m

/** Real mean half-width of Roosevelt Island (0.585 km² ÷ 3.2 km ÷ 2 ≈ 91 m), in units. */
export const ISLAND_MEAN_HALF_WIDTH = 2.7

let city: Sdf | null = null
let island: Sdf | null = null

// Built on first use (a few hundred milliseconds), then kept.
function fields() {
  if (!city || !island) {
    const p = data.meta.precision
    city = buildSdf(data.rest as Ring[], p, WORLD, CITY_CELL)
    const win: Rect = { x0: -DETAIL_HALF, x1: DETAIL_HALF, z0: -DETAIL_HALF, z1: DETAIL_HALF }
    island = buildSdf(data.island as Ring[], p, win, ISLAND_CELL, -60)
  }
  return { city, island }
}

/**
 * Signed distance to the coast in world units: positive on land, negative in
 * water, 0 on the shore. `widen` fattens Roosevelt Island only, by that many
 * units on each side (0 = its real outline).
 */
export function coastDistance(x: number, z: number, widen = 0): number {
  const f = fields()
  const c = f.city.sample(x, z)
  const i = f.island.sample(x, z) + widen
  return c > i ? c : i
}

/** Signed distance to Roosevelt Island alone (positive on the island), widened by `widen`. */
export function islandDistance(x: number, z: number, widen = 0): number {
  return fields().island.sample(x, z) + widen
}
