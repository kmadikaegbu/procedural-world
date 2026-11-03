/**
 * Latitude/longitude → world units, the same projection scripts/build-nyc-shore.mjs
 * used for the shoreline: 1 unit = 33.5 m, Roosevelt Island's centre = (0, 0),
 * +x east, +z south.
 */
export const LAT0 = 40.7619
export const LON0 = -73.9499
export const KX = (111195 * Math.cos((LAT0 * Math.PI) / 180)) / 33.5
export const KZ = 111195 / 33.5

export const at = (lat: number, lon: number): [number, number] => [
  (lon - LON0) * KX,
  -(lat - LAT0) * KZ,
]

/** Kilometres → world units. */
export const km = (k: number) => (k * 1000) / 33.5
