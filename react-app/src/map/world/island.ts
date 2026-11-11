import { coastDistance, islandDistance } from './shore'

/**
 * ROOSEVELT ISLAND AS IT IS TODAY: its buildings, parks, sports fields, paths and
 * the banks either side of it, laid out from four reference photographs of the
 * island (Google Earth views from the south-west, the south and above) and the
 * island's real outline. A survey of the photos (by feature type) was merged and
 * cross-checked into the lists below; positions are good to a few tens of metres,
 * and every name and date beyond what the photos show is from the island's history.
 *
 * COORDINATES. Everything is placed in the island's own frame:
 *   s   along the island's long axis, in world units (33.5 m): 0 at its centre,
 *       positive to the north tip, negative to the south tip (about -49 … +44)
 *   u   across it: negative toward Manhattan (west), positive toward Queens (east)
 * The axis runs 29° east of north. Sizes are in real metres: `along` is the
 * extent along the axis, `across` the extent across it.
 */

const TH = (29 * Math.PI) / 180
/** Unit vectors in world (x east, z south): along the axis toward the north tip, and across toward Queens. */
export const SPINE: [number, number] = [Math.sin(TH), -Math.cos(TH)]
export const ACROSS: [number, number] = [Math.cos(TH), Math.sin(TH)]

/** Island frame → world position. */
export const islandXZ = (s: number, u: number): [number, number] => [
  SPINE[0] * s + ACROSS[0] * u,
  SPINE[1] * s + ACROSS[1] * u,
]
/** World position → island frame. */
export const islandSU = (x: number, z: number): [number, number] => [
  x * SPINE[0] + z * SPINE[1],
  x * ACROSS[0] + z * ACROSS[1],
]
/** Island frame → latitude and longitude. */
export function islandLatLon(s: number, u: number): [number, number] {
  const [x, z] = islandXZ(s, u)
  // the inverse of project.ts's `at`
  const lat = 40.7619 - z / (111195 / 33.5)
  const lon = -73.9499 + x / ((111195 * Math.cos((40.7619 * Math.PI) / 180)) / 33.5)
  return [lat, lon]
}

const M = 1 / 33.5 // metres → world units

export type Wall = 'brick' | 'stone' | 'glass' | 'timber'
export type Shape = 'block' | 'slab' | 'house' | 'round'

export interface IslandBuilding {
  name: string
  s: number
  u: number
  /** Footprint, metres: along the island's axis and across it. */
  along: number
  across: number
  /** Height, metres. */
  height: number
  built: number
  gone?: number
  shape: Shape
  wall: Wall
}

const B = (
  name: string,
  s: number,
  u: number,
  along: number,
  across: number,
  height: number,
  built: number,
  shape: Shape,
  wall: Wall,
  gone?: number,
): IslandBuilding => ({ name, s, u, along, across, height, built, gone, shape, wall })

/** The island's own buildings, south to north. */
export const ISLAND_BUILDINGS: IslandBuilding[] = [
  B('Smallpox Hospital ruin', -40.8, -4.4, 55, 18, 14, 1856, 'block', 'stone'),
  B('Strecker Memorial Laboratory', -35.8, -2.8, 20, 12, 11, 1892, 'block', 'brick'),
  // Cornell Tech, just south of the Queensboro Bridge
  B('Cornell Tech: The House', -23.2, -0.4, 55, 38, 82, 2017, 'slab', 'glass'),
  B('Cornell Tech: west tower', -23.2, -3.0, 55, 38, 75, 2017, 'slab', 'glass'),
  B('Cornell Tech: The Bridge', -26.0, -1.6, 40, 25, 32, 2017, 'block', 'glass'),
  B('Cornell Tech: Bloomberg Center', -28.0, -1.1, 95, 38, 22, 2017, 'block', 'stone'),
  B('Cornell Tech: Tata Innovation Center', -28.1, -3.3, 85, 36, 30, 2020, 'block', 'stone'),
  B('Cornell Tech: Verizon Executive Education', -31.0, -2.4, 65, 28, 16, 2018, 'block', 'glass'),
  B('Blackwell House', -15.5, 0.6, 14, 9, 10, 1796, 'house', 'timber'),
  B('Tramway island station', -15.1, -2.0, 40, 30, 14, 1976, 'block', 'stone'),
  // Main Street's apartment towers
  B('Eastwood', -4.5, 1.6, 75, 38, 70, 1976, 'slab', 'brick'),
  B('Rivercross', -2.8, -1.6, 70, 36, 75, 1975, 'slab', 'brick'),
  B('Chapel of the Good Shepherd', -1, 1, 22, 11, 22, 1889, 'house', 'stone'),
  B('Island House', 1, -1.8, 80, 38, 75, 1975, 'slab', 'brick'),
  B('Westview', 4.8, -1.6, 80, 38, 70, 1976, 'slab', 'brick'),
  B('Subway station entrance', 9.5, 0.9, 25, 12, 6, 1989, 'block', 'glass'),
  // Manhattan Park (Southtown), Motorgate and the school
  B('Manhattan Park 1', 12, -0.3, 60, 34, 65, 1989, 'slab', 'brick'),
  B('Manhattan Park 2', 16, -0.8, 55, 34, 60, 1989, 'slab', 'brick'),
  B('Manhattan Park 3', 15, 0.4, 50, 34, 55, 1989, 'slab', 'brick'),
  B('Manhattan Park 4', 17.2, 1.4, 55, 34, 68, 1989, 'slab', 'brick'),
  B('Motorgate Garage', 13.6, 3.0, 200, 65, 18, 1974, 'block', 'stone'),
  B('Roosevelt Island school', 18.6, 3.4, 90, 45, 14, 1993, 'block', 'brick'),
  // the hospital campus at the north
  B('The Octagon', 27.5, 2.4, 70, 70, 30, 1839, 'round', 'stone'),
  B('Goldwater Hospital', 29.6, -0.1, 55, 60, 30, 1939, 'block', 'stone'),
  B('Coler hospital: east wing', 32.4, 5.0, 70, 28, 20, 1952, 'block', 'brick'),
  B('Coler Memorial Hospital', 34.6, 3.3, 110, 70, 35, 1952, 'block', 'brick'),
  B('Coler hospital: north wing', 37.8, 3.4, 70, 100, 15, 1952, 'block', 'brick'),
  B('Blackwell Island Lighthouse', 43.6, 3.7, 6, 6, 15, 1872, 'round', 'stone'),
  // earlier buildings, long gone
  B('The penitentiary', 14, -0.6, 120, 40, 12, 1832, 'block', 'stone', 1970),
  B('Charity hospital', -3, -1.6, 70, 28, 14, 1860, 'block', 'brick', 1970),
]

/** Towers on the banks that the photos show, which the street generator would not place. */
export const BANK_TOWERS: IslandBuilding[] = [
  // Sutton Place: a pale tower with a loose group of 100-200 m neighbours
  B('Sutton Tower', -13.5, -20.5, 48, 40, 260, 2016, 'slab', 'stone'),
  B('Sutton Place tower 1', -11, -22, 35, 35, 150, 1972, 'slab', 'stone'),
  B('Sutton Place tower 2', -16, -23, 35, 35, 130, 1965, 'slab', 'brick'),
  B('Sutton Place tower 3', -9, -25, 40, 30, 110, 1975, 'slab', 'stone'),
  // Long Island City: Court Square, Queens Plaza and the Gantry Plaza towers by the Eleventh Street Basin
  B('One Court Square', -36, 35, 50, 50, 200, 1990, 'slab', 'glass'),
  B('Skyline Tower', -35, 37, 30, 30, 220, 2014, 'slab', 'glass'),
  B('The Orchard', -38, 33, 35, 35, 170, 2017, 'slab', 'glass'),
  B('Queens Plaza tower', -30, 38, 30, 30, 150, 2009, 'slab', 'glass'),
  B('Gantry Plaza tower 1', -53, 10.5, 30, 30, 120, 2008, 'slab', 'glass'),
  B('Gantry Plaza tower 2', -52, 12.5, 30, 30, 110, 2009, 'slab', 'glass'),
  B('Gantry Plaza tower 3', -54, 13, 30, 30, 95, 2010, 'slab', 'glass'),
  B('Gantry Plaza tower 4', -51, 10, 30, 30, 140, 2011, 'slab', 'glass'),
  // the low industrial edge of Queens: warehouses and Costco
  B('Costco', 24, 12.5, 150, 60, 14, 1998, 'block', 'stone'),
  B('Long Island City warehouse', -26, 14, 110, 70, 16, 1950, 'block', 'stone'),
  B('Con Edison building', -29, 15.5, 90, 40, 18, 1960, 'block', 'brick'),
  B('Astoria riverfront tower 1', 18.5, 15.5, 30, 30, 85, 2010, 'slab', 'glass'),
  B('Astoria riverfront tower 2', 20, 17.5, 30, 30, 85, 2011, 'slab', 'glass'),
]

// --- ground surfaces ---------------------------------------------------------------

/** What a flat ground ribbon is (see Road.kind in city/layout.ts). */
export const Surface = { Road: 0, Path: 1, Court: 2, Earth: 3, Turf: 4, Paving: 5 } as const

export interface Ribbon {
  x: number
  z: number
  rot: number
  len: number
  width: number
  built: number
  kind: number
}

/** A rectangle on the island's ground, aligned with its axis, rotated by `turn` degrees. */
interface Patch {
  name: string
  s: number
  u: number
  along: number
  across: number
  surface: number
  built: number
  turn?: number
}
const P = (
  name: string,
  s: number,
  u: number,
  along: number,
  across: number,
  surface: number,
  built: number,
  turn = 0,
): Patch => ({ name, s, u, along, across, surface, built, turn })

const PATCHES: Patch[] = [
  // Four Freedoms Park, at the south tip: a granite "room", a terrace and a long lawn
  P('Four Freedoms room', -48.3, -5.5, 20, 20, Surface.Paving, 2012),
  P('Four Freedoms terrace', -41.2, -4.5, 18, 55, Surface.Paving, 2012),
  // Cornell Tech's plaza
  P('Cornell Tech plaza', -31.5, -2.6, 40, 60, Surface.Paving, 2017),
  // Southpoint Park's big meadow, and the strip of lawn between the linden rows
  P('Southpoint lawn', -37.5, -3.1, 200, 90, Surface.Turf, 1990),
  P('Four Freedoms lawn', -43.5, -4.9, 100, 14, Surface.Turf, 2012),
  // the sports area at the north: a field, the infield of a baseball diamond, courts
  P('Capobianco Field', 19.6, 0.0, 100, 90, Surface.Turf, 1976),
  P('Baseball infield', 23.5, 3.2, 30, 30, Surface.Earth, 1976, 45),
  P('Playground', 22.3, 0.3, 35, 50, Surface.Earth, 1976),
  P('Community garden', 21.2, 2.8, 35, 40, Surface.Earth, 1990),
  P('Parking', 24.6, 2.3, 35, 30, Surface.Road, 1976),
  P('Tennis court 1', 25.9 - 0.4, 3.7 - 0.28, 24, 16, Surface.Court, 1976),
  P('Tennis court 2', 25.9 - 0.4, 3.7 + 0.28, 24, 16, Surface.Court, 1976),
  P('Tennis court 3', 25.9 + 0.4, 3.7 - 0.28, 24, 16, Surface.Court, 1976),
  P('Tennis court 4', 25.9 + 0.4, 3.7 + 0.28, 24, 16, Surface.Court, 1976),
  P('Manhattan Park pool', 17.2, -1.3, 25, 12, Surface.Court, 1989),
  // the Queens shore: big sand and parking lots, Rainey Park's field
  P('Queens West lot', -38, 12, 150, 100, Surface.Earth, 1960),
  P('Con Edison lot', -26, 17, 120, 80, Surface.Earth, 1950),
  P('Rainey Park field', 19, 13, 120, 90, Surface.Turf, 1980),
]

/** Open lawns, kept clear of trees (they stay the island's grass). */
const LAWNS: { name: string; s: number; u: number; along: number; across: number }[] = [
  { name: 'Southpoint Park lawn', s: -37.5, u: -3.1, along: 240, across: 120 },
  { name: 'Four Freedoms lawn', s: -44.5, u: -4.9, along: 150, across: 30 },
  { name: 'Blackwell Park', s: -15.2, u: 0.5, along: 60, across: 70 },
  { name: 'Manhattan Park lawn', s: 13.8, u: -1.1, along: 45, across: 40 },
  { name: 'Octagon lawn', s: 25, u: 1.5, along: 60, across: 60 },
]

/** Woods: where the island's trees grow thick. `density` 0..1. */
export const WOODS: { name: string; s: number; u: number; along: number; across: number; density: number }[] = [
  { name: 'Smallpox ruin grove', s: -41, u: -4.3, along: 90, across: 90, density: 1 },
  { name: 'Southpoint south woodland', s: -41.5, u: -4.1, along: 120, across: 120, density: 1 },
  { name: 'Cornell Tech trees', s: -33.5, u: -2.2, along: 40, across: 80, density: 0.6 },
  { name: 'Main Street courtyards', s: 1.5, u: -0.5, along: 250, across: 150, density: 0.5 },
  { name: 'Garden belt', s: 21.8, u: 1.2, along: 90, across: 180, density: 0.9 },
  { name: 'Coler grounds', s: 35, u: 1.4, along: 150, across: 90, density: 0.7 },
  { name: 'Lighthouse Park woods', s: 41.5, u: 3.8, along: 100, across: 45, density: 1 },
]

// --- what the generators ask --------------------------------------------------------

/** Cached edges of the island (west and east, in u) at each s. */
const edgeCache = new Map<number, [number, number] | null>()
export function islandEdges(s: number): [number, number] | null {
  const key = Math.round(s * 4)
  const hit = edgeCache.get(key)
  if (hit !== undefined) return hit
  let lo: number | null = null
  let hi: number | null = null
  for (let u = -14; u <= 14; u += 0.1) {
    const [x, z] = islandXZ(key / 4, u)
    if (islandDistance(x, z) > 0) {
      if (lo === null) lo = u
      hi = u
    }
  }
  const out: [number, number] | null = lo === null || hi === null ? null : [lo, hi]
  edgeCache.set(key, out)
  return out
}

function ribbon(cx: number, cz: number, dirX: number, dirZ: number, len: number, width: number, built: number, kind: number): Ribbon {
  return { x: cx, z: cz, rot: -Math.atan2(dirZ, dirX), len, width, built, kind }
}

/** A line of ribbons through waypoints given in the island frame. */
function line(points: [number, number][], widthM: number, built: number, kind: number): Ribbon[] {
  const out: Ribbon[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = islandXZ(...points[i])
    const [x1, z1] = islandXZ(...points[i + 1])
    const len = Math.hypot(x1 - x0, z1 - z0)
    // a little longer, so the joints between segments overlap
    out.push(ribbon((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, len + 0.1, widthM * M, built, kind))
  }
  return out
}

/**
 * Every flat ground surface on and beside the island: fields, courts, plazas,
 * paths and roads. `streets` adds the hand-laid Main Street and the two shore
 * drives (FDR Drive, Vernon Boulevard); leave them out when the city's real
 * street data is drawn, which has them at their true places.
 */
export function islandRibbons(streets = true): Ribbon[] {
  const out: Ribbon[] = []

  for (const p of PATCHES) {
    const [x, z] = islandXZ(p.s, p.u)
    const turn = ((p.turn ?? 0) * Math.PI) / 180
    // a patch's long side lies along the island's axis
    const dx = SPINE[0] * Math.cos(turn) + ACROSS[0] * Math.sin(turn)
    const dz = SPINE[1] * Math.cos(turn) + ACROSS[1] * Math.sin(turn)
    out.push(ribbon(x, z, dx, dz, p.along * M, p.across * M, p.built, p.surface))
  }

  // Main Street: down the middle of the island from the tram plaza to the hospital, bending west round the Octagon
  const main: [number, number][] = []
  for (let s = -16; s <= 32.5; s += 2) {
    const e = islandEdges(s)
    if (!e) continue
    const mid = (e[0] + e[1]) / 2
    main.push([s, mid - (s > 22 ? 0.8 : 0)])
  }
  if (streets) out.push(...line(main, 12, 1850, Surface.Road))

  // the promenades round the shore, just inside the water's edge
  const west: [number, number][] = []
  const east: [number, number][] = []
  for (let s = -46; s <= 42; s += 2) {
    const e = islandEdges(s)
    if (!e || e[1] - e[0] < 1.6) continue
    west.push([s, e[0] + 0.45])
    east.push([s, e[1] - 0.45])
  }
  out.push(...line(west, 6, 1990, Surface.Path), ...line(east, 6, 1990, Surface.Path))

  // the worn paths across Southpoint Park's meadow: a Y that meets near its middle
  out.push(
    ...line([[-44.5, -4.8], [-38.5, -3.2], [-34, -2.6]], 4, 1990, Surface.Earth),
    ...line([[-33, -4.6], [-35.5, -3.4], [-38.5, -3.2]], 4, 1990, Surface.Earth),
    ...line([[-34, -2.6], [-31.5, -1.6], [-30.5, -0.6]], 4, 1990, Surface.Earth),
  )

  if (!streets) return out
  // FDR Drive and Vernon Boulevard, just inland of the Manhattan and Queens shores
  out.push(...shoreRoad(-1, -50, 60, 26, 1940, 0.8))
  out.push(...shoreRoad(+1, -22, 50, 20, 1900, 0.7))
  return out
}

/**
 * A road that follows a bank of the river: for each s, walk out from the island
 * across the water to the first land, and put the road `inset` units inland.
 * `side` is -1 for the Manhattan bank, +1 for Queens.
 */
function shoreRoad(side: -1 | 1, s0: number, s1: number, widthM: number, built: number, inset: number): Ribbon[] {
  const points: [number, number][] = []
  for (let s = s0; s <= s1; s += 3) {
    // start from the island (or from the axis beyond its ends) and walk across
    const e = islandEdges(s)
    let u = e ? (side < 0 ? e[0] : e[1]) : 0
    let found: number | null = null
    // first walk out through water, then stop at the first land
    let sawWater = false
    for (let k = 0; k < 400; k++) {
      u += side * 0.1
      const [x, z] = islandXZ(s, u)
      if (Math.abs(u) > 40) break
      const wet = coastDistance(x, z) < 0
      if (wet) sawWater = true
      else if (sawWater) {
        found = u
        break
      }
    }
    if (found !== null) points.push([s, found - side * inset])
  }
  return line(points, widthM, built, Surface.Road)
}

/** Rectangles the forest must stay out of: lawns, courts, plazas and the footprints of buildings (world units, island frame). */
interface Rect {
  s: number
  u: number
  hs: number
  hu: number
}
const KEEP_CLEAR: Rect[] = [
  ...PATCHES.map((p) => ({ s: p.s, u: p.u, hs: (p.along * M) / 2 + 0.3, hu: (p.across * M) / 2 + 0.3 })),
  ...LAWNS.map((l) => ({ s: l.s, u: l.u, hs: (l.along * M) / 2, hu: (l.across * M) / 2 })),
  ...ISLAND_BUILDINGS.filter((b) => b.gone === undefined).map((b) => ({
    s: b.s,
    u: b.u,
    hs: (b.along * M) / 2 + 0.3,
    hu: (b.across * M) / 2 + 0.3,
  })),
]

/**
 * How likely a tree is to be kept at (x, z) on the island, 0..1: none on lawns,
 * fields, plazas, courts and buildings; thick in the woods; a row along the shore;
 * sparse elsewhere. Anywhere off the island it returns 1 (the rest of the map
 * decides for itself).
 */
export function islandTreeWeight(x: number, z: number): number {
  const [s, u] = islandSU(x, z)
  if (s < -52 || s > 48 || u < -12 || u > 12) return 1
  if (islandDistance(x, z) < -0.2) return 1 // water or the mainland
  for (const r of KEEP_CLEAR) if (Math.abs(s - r.s) < r.hs && Math.abs(u - r.u) < r.hu) return 0
  let w = 0.12
  for (const o of WOODS) {
    const a = Math.abs(s - o.s) / ((o.along * M) / 2)
    const b = Math.abs(u - o.u) / ((o.across * M) / 2)
    const r = Math.hypot(a, b)
    if (r < 1) w = Math.max(w, o.density * Math.min(1, (1 - r) * 3))
  }
  // a thin row of trees along the shore
  if (islandDistance(x, z) < 1.1) w = Math.max(w, 0.7)
  return w
}

/**
 * Four Freedoms Park's trees: two double rows of lindens, down each side of the
 * long lawn at the south tip. World positions.
 */
export function linden(): [number, number][] {
  const out: [number, number][] = []
  for (let s = -47.5; s <= -38; s += 0.2) {
    for (const u of [-6.0, -5.55, -4.25, -3.8]) {
      const e = islandEdges(s)
      if (!e || u < e[0] + 0.2 || u > e[1] - 0.2) continue
      out.push(islandXZ(s, u))
    }
  }
  return out
}
