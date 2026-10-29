import type { TerrainParams } from './noise'

/**
 * SCALE — the one place the world's ruler is defined.
 *
 * Rule 1, define a working scale: the coastline is New York City's real one
 * (world/shore.ts), so horizontal distances are true; Roosevelt Island is
 * ~3,150 m long and measures ~94 units. So:
 *
 *   1 world unit = 33.5 m
 *
 * Rule 2, keep objects proportional: every size is written as REAL METRES,
 * converted with m(), times ONE exaggeration factor for its category. Using
 * one shared factor per category keeps things in proportion with each other
 * even when they're enlarged (a tree is always ~14 people tall).
 *
 * Two scales are offered:
 *   readable  hills, objects and the island's width are enlarged so they stay
 *             visible from the camera's 670 m – 8.7 km range (see
 *             Tutorials/Real-World Scale.md, Step 5)
 *   true      every factor is 1: the island as it really is
 *
 * The scene's assets (tree shapes, slider defaults) are authored at the
 * READABLE scale. True scale is applied on top as a ratio — see ratios().
 */

/** Roosevelt Island's real length, north tip to south tip (the city's data gives ~3,150 m). */
export const REAL_ISLAND_LENGTH_M = 3200

/** How many real metres one world unit stands for. Matches scripts/build-nyc-shore.mjs. */
export const METERS_PER_UNIT = 33.5

/** Roosevelt Island's length in world units (≈ 96). */
export const ISLAND_LENGTH_UNITS = REAL_ISLAND_LENGTH_M / METERS_PER_UNIT

/** Real metres → world units. */
export const m = (meters: number) => meters / METERS_PER_UNIT
/** World units → real metres. */
export const toMeters = (units: number) => units * METERS_PER_UNIT

export type ScaleMode = 'readable' | 'true'

export interface Exaggeration {
  /** Terrain heights, the river bed, sea-level change and wave height. */
  vertical: number
  /** Trees, ivy, fallen leaves — and the spacing between trees. */
  objects: number
  /** The island's width (its length is always real). */
  islandWidth: number
}

/**
 * Category factors. Readable values were measured from the scene as it was
 * tuned by eye (Real-World Scale, Step 4): hills ~15× the real 7 m, trees ~2.9×
 * a 25 m street tree, the island ~2.5× its real 240 m width.
 */
export const EXAGGERATION: Record<ScaleMode, Exaggeration> = {
  readable: { vertical: 15, objects: 2.9, islandWidth: 2.5 },
  true: { vertical: 1, objects: 1, islandWidth: 1 },
}

/** Size of an object in world units at the readable scale: real metres × the objects factor. */
export const objectSize = (meters: number) => m(meters) * EXAGGERATION.readable.objects

/** How much the chosen scale shrinks things relative to the readable assets (1 = unchanged). */
export function ratios(mode: ScaleMode): Exaggeration {
  const r = EXAGGERATION.readable
  const c = EXAGGERATION[mode]
  return {
    vertical: c.vertical / r.vertical,
    objects: c.objects / r.objects,
    islandWidth: c.islandWidth / r.islandWidth,
  }
}

/**
 * The terrain settings the scene should draw. The sliders always hold the
 * readable values; this returns them unchanged at the readable scale, and
 * scaled down to real proportions at the true scale.
 */
export function applyScale(p: TerrainParams, mode: ScaleMode): TerrainParams {
  if (mode === 'readable') return p
  const r = ratios(mode)
  return {
    ...p,
    amplitude: p.amplitude * r.vertical, // hills (and the biome bands, which are fractions of it)
    seaLevel: p.seaLevel * r.vertical, // sea level and the climate timeline's rise
    islandWidth: p.islandWidth * r.islandWidth,
    vScale: r.vertical, // river bed, erosion and sculpt offsets
  }
}

/**
 * Rule 4, place the camera for the scale: how far back a camera with this
 * field of view must be for something `size` units tall/long to just fit.
 *   distance = size ÷ (2 × tan(fov ÷ 2))
 */
export function framingDistance(size: number, fovDeg: number): number {
  return size / (2 * Math.tan((fovDeg * Math.PI) / 360))
}

/** A camera position `distance` away along `direction` (which needn't be unit length). */
export function cameraAt(
  direction: [number, number, number],
  distance: number,
): [number, number, number] {
  const len = Math.hypot(...direction)
  return direction.map((v) => (v / len) * distance) as [number, number, number]
}
