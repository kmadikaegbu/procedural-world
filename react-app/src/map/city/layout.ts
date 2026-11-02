import { coastDistance, islandDistance, WORLD } from '../world/shore'
import { BATTERY, yearForCityReach } from '../timeline'
import { objectSize } from '../scale'

/**
 * THE CITY'S BUILDINGS AND STREETS, grown over time.
 *
 * Nothing here is a survey. It is a procedural stand-in for the real thing,
 * built from a few rules that are true of New York:
 *
 *   - the town grew outward from the Battery (the same estimate the paving
 *     uses, timeline.ts), so a lot's BUILT YEAR comes from how far it is from
 *     there, plus some delay so the edge fills in slowly instead of all at once
 *   - the streets come first, then the buildings on them
 *   - the street grid is tilted differently in different parts of the city
 *     (Manhattan's is the 29° one), so each district has its own angle
 *   - low buildings early on; a few cores (Wall Street, Midtown) later pull
 *     their low buildings down and put up towers, as the real ones did
 *   - each building here stands for a few real ones (lots are ~45 m wide)
 *
 * The result is plain arrays, made once (a few hundred ms) and kept. The
 * Year slider never regenerates anything: every lot and road carries the year
 * it appears, and the GPU decides what is built (city/City.tsx).
 */

// --- projection (same as scripts/build-nyc-shore.mjs) ---------------------------

const LAT0 = 40.7619
const LON0 = -73.9499
const KX = (111195 * Math.cos((LAT0 * Math.PI) / 180)) / 33.5
const KZ = 111195 / 33.5
const at = (lat: number, lon: number): [number, number] => [(lon - LON0) * KX, -(lat - LAT0) * KZ]

// --- deterministic noise ---------------------------------------------------------

function rnd(a: number, b: number, salt: number): number {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(salt, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// --- districts: where the street grid points which way -------------------------

interface District {
  at: [number, number]
  /** Grid angle in degrees: how far the avenues are tilted from north. */
  angle: number
  /** Distance between cross streets, along the avenues (world units). */
  sa: number
  /** Distance between avenues, along the cross streets. */
  sb: number
  /** Share of lots that are built on (the rest are yards, parks, rail). */
  fill: number
  /** How tall buildings run here compared with Manhattan, 0..1. */
  tall: number
}

const DISTRICTS: District[] = [
  { at: at(40.711, -74.0075), angle: 14, sa: 1.4, sb: 2.6, fill: 0.95, tall: 0.8 }, // the old town, before the 1811 grid
  { at: at(40.76, -73.979), angle: 29, sa: 2.4, sb: 5.8, fill: 1, tall: 1 }, // Midtown, the Commissioners' grid
  { at: at(40.82, -73.945), angle: 29, sa: 2.4, sb: 5.8, fill: 0.95, tall: 0.75 }, // Harlem and up
  { at: at(40.85, -73.88), angle: 8, sa: 2.6, sb: 4.6, fill: 0.8, tall: 0.35 }, // the Bronx
  { at: at(40.75, -73.915), angle: 15, sa: 2.4, sb: 4.4, fill: 0.8, tall: 0.45 }, // western Queens
  { at: at(40.73, -73.83), angle: -8, sa: 2.6, sb: 4.6, fill: 0.6, tall: 0.25 }, // eastern Queens
  { at: at(40.715, -73.95), angle: 35, sa: 2.2, sb: 4.4, fill: 0.9, tall: 0.5 }, // north Brooklyn
  { at: at(40.64, -73.95), angle: 0, sa: 2.6, sb: 4.6, fill: 0.8, tall: 0.35 }, // south Brooklyn
  { at: at(40.67, -73.9), angle: 22, sa: 2.6, sb: 4.6, fill: 0.75, tall: 0.3 }, // east Brooklyn
  { at: at(40.635, -74.09), angle: 20, sa: 2.8, sb: 5, fill: 0.5, tall: 0.2 }, // Staten Island
]

function districtAt(x: number, z: number): number {
  let best = 0
  let bd = Infinity
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = (x - DISTRICTS[i].at[0]) ** 2 + (z - DISTRICTS[i].at[1]) ** 2
    if (d < bd) {
      bd = d
      best = i
    }
  }
  return best
}

// --- places that shape the city -------------------------------------------------

/** Business cores: buildings here go tall once the city is old enough. */
const CORES: { at: [number, number]; sigma: number; weight: number }[] = [
  { at: at(40.7074, -74.0113), sigma: 12, weight: 1 }, // Wall Street
  { at: at(40.754, -73.984), sigma: 28, weight: 1 }, // Midtown
  { at: at(40.6928, -73.9903), sigma: 9, weight: 0.55 }, // Downtown Brooklyn
  { at: at(40.7447, -73.9485), sigma: 9, weight: 0.5 }, // Long Island City
  { at: at(40.81, -73.95), sigma: 20, weight: 0.25 }, // Harlem
]

function coreAt(x: number, z: number): number {
  let best = 0
  for (const c of CORES) {
    const d = Math.hypot(x - c.at[0], z - c.at[1]) / c.sigma
    best = Math.max(best, c.weight * Math.exp(-d * d))
  }
  return best
}

/** Central Park, as a quadrilateral (59th & Fifth, 59th & CPW, 110th & CPW, 110th & Fifth). */
const CENTRAL_PARK = [
  at(40.7644, -73.9731),
  at(40.7681, -73.9817),
  at(40.8005, -73.9581),
  at(40.7968, -73.9494),
]

function inPolygon(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

const GOVERNORS_ISLAND = at(40.6895, -74.0168)

/** Left empty: parks, and Governors Island (a fort, not a neighbourhood, for most of its life). */
function reserved(x: number, z: number): boolean {
  return (
    inPolygon(x, z, CENTRAL_PARK) || Math.hypot(x - GOVERNORS_ISLAND[0], z - GOVERNORS_ISLAND[1]) < 7
  )
}

// --- eras ------------------------------------------------------------------------

/** Linear interpolation through [year, value] points, held flat beyond the ends. */
function through(points: [number, number][], year: number): number {
  if (year <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    if (year <= points[i][0]) {
      const [y0, v0] = points[i - 1]
      const [y1, v1] = points[i]
      return v0 + ((year - y0) / (y1 - y0)) * (v1 - v0)
    }
  }
  return points[points.length - 1][1]
}

/** Typical storeys of an ordinary building, by the year it went up. */
const STOREYS: [number, number][] = [
  [1624, 1.3],
  [1750, 2],
  [1850, 3.2],
  [1900, 4.8],
  [1930, 6],
  [1960, 6.5],
  [2020, 7],
]

/** How tall the tallest towers of the day were, in storeys. */
const TOWER_CAP: [number, number][] = [
  [1890, 12],
  [1915, 40], // the first skyscrapers
  [1932, 75], // the Empire State Building era
  [1960, 60],
  [1975, 75], // the glass towers
  [2015, 85],
]

const STOREY_M = 3.6
/**
 * Buildings are enlarged by the same factor as trees (the scale's objects factor,
 * ×2.9 at the readable scale), so a five-storey building stands beside a street
 * tree in the same proportion as in life. Their footprints are not enlarged: they
 * tile the real street grid. (This was once 0.6, which left trees taller than
 * buildings.)
 */
export const BUILDING_EXAGGERATION = 1
export const storeyHeight = objectSize(STOREY_M) * BUILDING_EXAGGERATION

// --- the output --------------------------------------------------------------------

/** The shapes a building can take (city/shapes.ts draws each one). */
export const Kind = {
  House: 0, // gabled, low: the early town and old neighbourhoods
  Block: 1, // a plain box: tenements and ordinary mid-rises
  Setback: 2, // stepped, with a spire: Art Deco towers
  Slab: 3, // a box with a rooftop plant: post-war and glass towers
  Crown: 4, // tall with a pyramid top
} as const
export type Kind = (typeof Kind)[keyof typeof Kind]

/** How the walls look. */
export const Style = {
  Brick: 0,
  Stone: 1,
  Glass: 2,
  Timber: 3,
} as const
export type Style = (typeof Style)[keyof typeof Style]

export interface Lot {
  x: number
  z: number
  /** Rotation about the vertical axis, radians. */
  rot: number
  /** Footprint: width along the street, depth across it (world units). */
  w: number
  d: number
  /** Height in world units at the readable scale. */
  h: number
  kind: Kind
  style: Style
  /** The year construction starts. It takes a few years to finish. */
  built: number
  /** The year it is pulled down (Infinity if it never is). */
  gone: number
  /** Colour, sRGB 0..1. */
  r: number
  g: number
  b: number
}

export interface Road {
  x: number
  z: number
  rot: number
  len: number
  width: number
  built: number
}

export interface CityLayout {
  lots: Lot[]
  roads: Road[]
  /** Sorted years, for the readouts. */
  lotYears: Float32Array
  goneYears: Float32Array
  roadYears: Float32Array
  /** Running total of road length (km) matching roadYears. */
  roadKm: Float32Array
}

const STREET_W = 0.3 // ~10 m
const AVENUE_W = 0.46 // ~15 m
const NEVER = 9999

// sRGB palettes
type RGB = [number, number, number]
const mix3 = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
function brick(r: number): RGB {
  // red brick, ochre and a grey-brown, so a street isn't one colour
  return r < 0.5 ? mix3([0.5, 0.3, 0.25], [0.62, 0.5, 0.38], r * 2) : mix3([0.62, 0.5, 0.38], [0.5, 0.47, 0.44], (r - 0.5) * 2)
}
function stone(r: number): RGB {
  return mix3([0.72, 0.68, 0.6], [0.58, 0.57, 0.55], r) // limestone to granite
}
function glass(r: number): RGB {
  return mix3([0.6, 0.72, 0.8], [0.42, 0.52, 0.6], r) // pale blue-grey
}
function timber(r: number): RGB {
  return mix3([0.42, 0.34, 0.26], [0.5, 0.42, 0.32], r) // weathered wood
}

function paint(style: Style, r: number): [number, number, number] {
  return style === Style.Glass
    ? glass(r)
    : style === Style.Stone
      ? stone(r)
      : style === Style.Timber
        ? timber(r)
        : brick(r)
}

function chooseKind(storeys: number, built: number, r: number): Kind {
  if (storeys <= 2.6 && built < 1930) return Kind.House
  if (storeys <= 9) return Kind.Block
  if (built < 1945) return storeys >= 40 && r < 0.5 ? Kind.Crown : Kind.Setback
  return r < 0.15 ? Kind.Block : Kind.Slab
}

function chooseStyle(storeys: number, built: number, r: number): Style {
  if (built < 1750) return Style.Timber
  if (built >= 1950 && storeys >= 8) return Style.Glass
  if (built >= 1900 && storeys >= 10) return Style.Stone
  return r < 0.9 ? Style.Brick : Style.Stone
}

function makeLot(
  x: number,
  z: number,
  rot: number,
  w: number,
  d: number,
  storeys: number,
  built: number,
  gone: number,
  rr: number,
  forceKind?: Kind,
  forceStyle?: Style,
): Lot {
  const kind = forceKind ?? chooseKind(storeys, built, rr)
  const style = forceStyle ?? chooseStyle(storeys, built, rr)
  const [r, g, b] = paint(style, (rr * 7.31) % 1)
  return { x, z, rot, w, d, h: storeys * storeyHeight, kind, style, built, gone, r, g, b }
}

// --- generation ----------------------------------------------------------------------

function generate(): CityLayout {
  const lots: Lot[] = []
  const roads: Road[] = []

  const corners = [
    [WORLD.x0, WORLD.z0],
    [WORLD.x1, WORLD.z0],
    [WORLD.x0, WORLD.z1],
    [WORLD.x1, WORLD.z1],
  ]

  DISTRICTS.forEach((dist, di) => {
    const th = (dist.angle * Math.PI) / 180
    const ave: [number, number] = [Math.sin(th), -Math.cos(th)] // along the avenues
    const st: [number, number] = [Math.cos(th), Math.sin(th)] // along the cross streets
    // the range of block numbers that can touch the map
    let aLo = Infinity
    let aHi = -Infinity
    let bLo = Infinity
    let bHi = -Infinity
    for (const [cx, cz] of corners) {
      const a = (cx * ave[0] + cz * ave[1]) / dist.sa
      const b = (cx * st[0] + cz * st[1]) / dist.sb
      aLo = Math.min(aLo, a)
      aHi = Math.max(aHi, a)
      bLo = Math.min(bLo, b)
      bHi = Math.max(bHi, b)
    }
    const at2 = (a: number, b: number): [number, number] => [
      ave[0] * a * dist.sa + st[0] * b * dist.sb,
      ave[1] * a * dist.sa + st[1] * b * dist.sb,
    ]
    // rotation that lays a box's local x along the cross streets, and along the avenues
    const rotSt = -Math.atan2(st[1], st[0])
    const rotAve = -Math.atan2(ave[1], ave[0])

    const depth = dist.sa - STREET_W // across a block, between two streets
    const length = dist.sb - AVENUE_W // along a block, between two avenues
    const nLots = Math.max(1, Math.round(length / 1.5))
    const lotLen = length / nLots

    for (let ia = Math.floor(aLo); ia <= Math.ceil(aHi); ia++) {
      for (let ib = Math.floor(bLo); ib <= Math.ceil(bHi); ib++) {
        // --- the block's buildings ---
        for (let k = 0; k < nLots; k++) {
          const [px, pz] = at2(
            ia + 0.5,
            ib + (AVENUE_W / 2 + (k + 0.5) * lotLen) / dist.sb,
          )
          if (px < WORLD.x0 || px > WORLD.x1 || pz < WORLD.z0 || pz > WORLD.z1) continue
          if (districtAt(px, pz) !== di) continue
          if (coastDistance(px, pz) < 1.1 || islandDistance(px, pz) > -1.5) continue
          if (reserved(px, pz)) continue
          const salt = di * 97 + k
          if (rnd(ia, ib, salt) > dist.fill) continue

          const r1 = rnd(ia, ib, salt + 1)
          const r2 = rnd(ia, ib, salt + 2)
          const r3 = rnd(ia, ib, salt + 3)
          const r4 = rnd(ia, ib, salt + 4)
          const away = Math.hypot(px - BATTERY.x, pz - BATTERY.z)
          // the front reaches here, then the lot fills in over a few decades
          const built = Math.min(
            1975,
            yearForCityReach(away + (r1 - 0.5) * 16) + r2 * r2 * 70,
          )
          const core = coreAt(px, pz)
          const w = lotLen * (0.72 + 0.2 * r3)
          const dpt = depth * (0.72 + 0.2 * r4)
          const rot = rotSt
          // an ordinary building of its day
          const storeys = Math.max(
            1,
            through(STOREYS, built) * (0.7 + r2 * 0.7) * (0.6 + 0.8 * dist.tall),
          )

          // in a core, the low building is later replaced by a tower
          const towerYear = 1890 + Math.pow(r3, 1.3) * 125
          const goesTall = core * dist.tall > 0.22 && r1 < core * 1.1 && towerYear > built + 25
          lots.push(
            makeLot(px, pz, rot, w, dpt, storeys, built, goesTall ? towerYear : NEVER, r4),
          )
          if (goesTall) {
            const cap = through(TOWER_CAP, towerYear)
            // most towers are mid-height; only a few reach the cap (as in the real skyline)
            const towerStoreys = Math.max(12, cap * (0.2 + 0.8 * r2 * r2) * (0.5 + 0.5 * core))
            lots.push(
              makeLot(px, pz, rot, w * 0.9, dpt * 0.9, towerStoreys, towerYear, NEVER, r4 + 0.1),
            )
          }
        }

        // --- the streets round the block: a cross street and an avenue ---
        const streets: { a: number; b: number; len: number; width: number; dir: [number, number]; rot: number; salt: number }[] = [
          // a cross street: constant a, runs along the cross-street direction
          { a: ia, b: ib + 0.5, len: dist.sb, width: STREET_W, dir: st, rot: rotSt, salt: 1 },
          // an avenue: constant b, runs along the avenues
          { a: ia + 0.5, b: ib, len: dist.sa, width: AVENUE_W, dir: ave, rot: rotAve, salt: 2 },
        ]
        for (const { a, b, len, width, dir, rot, salt } of streets) {
          const [cx, cz] = at2(a, b)
          if (cx < WORLD.x0 || cx > WORLD.x1 || cz < WORLD.z0 || cz > WORLD.z1) continue
          if (districtAt(cx, cz) !== di) continue
          if (coastDistance(cx, cz) < 0.5 || islandDistance(cx, cz) > -1.2) continue
          if (reserved(cx, cz)) continue
          // both ends must be on land too, so a street stops at the shore
          const [dx, dz] = dir
          const e1 = coastDistance(cx + (dx * len) / 2, cz + (dz * len) / 2)
          const e2 = coastDistance(cx - (dx * len) / 2, cz - (dz * len) / 2)
          if (e1 < 0.2 || e2 < 0.2) continue
          if (rnd(ia, ib, di * 31 + salt + 7) > Math.sqrt(dist.fill)) continue
          const away = Math.hypot(cx - BATTERY.x, cz - BATTERY.z)
          // roads are laid a few years before the buildings that line them
          const built = Math.min(
            1972,
            yearForCityReach(away + (rnd(ia, ib, di * 31 + salt) - 0.5) * 16) - 4,
          )
          roads.push({ x: cx, z: cz, rot, len, width, built })
        }
      }
    }
  })

  addRooseveltIsland(lots)

  return summarise(lots, roads)
}

/**
 * Roosevelt Island is left parkland by the rest of the city, so its buildings
 * are placed by hand-written rules instead of the grid. They follow its real
 * story (timeline.ts has the dates): an island of institutions from the 1830s,
 * hospitals in the 20th century, the apartment towers of the 1970s, Cornell
 * Tech at the southern tip from 2017. Positions are along the island's spine
 * (`s` in world units from its centre, + toward the north tip).
 */
function addRooseveltIsland(lots: Lot[]) {
  const th = (29 * Math.PI) / 180
  const spine: [number, number] = [Math.sin(th), -Math.cos(th)]
  const across: [number, number] = [Math.cos(th), Math.sin(th)]
  const rot = -Math.atan2(across[1], across[0])

  // [built year, s, offset across the island, storeys, kind, style, gone]
  const plan: [number, number, number, number, Kind, Style, number][] = [
    [1832, 6, 0.5, 3, Kind.Block, Style.Stone, 1970], // penitentiary
    [1839, 16, 0, 3, Kind.Block, Style.Stone, NEVER], // the Octagon asylum
    [1856, -22, 0.4, 3, Kind.House, Style.Stone, NEVER], // the smallpox hospital
    [1860, -9, -0.4, 4, Kind.Block, Style.Brick, 1960], // charity hospital
    [1872, 44, 0, 2, Kind.House, Style.Stone, NEVER], // lighthouse keeper's house
    [1906, 24, 0.5, 4, Kind.Block, Style.Brick, 1990],
    [1939, 28, -0.3, 8, Kind.Block, Style.Stone, NEVER], // Goldwater hospital
    [1952, 36, 0.2, 9, Kind.Block, Style.Brick, NEVER], // Coler
    [1976, -4, 1.0, 14, Kind.Slab, Style.Brick, NEVER], // Main Street apartments
    [1976, 2, -1.0, 14, Kind.Slab, Style.Brick, NEVER],
    [1976, 8, 1.0, 16, Kind.Slab, Style.Brick, NEVER],
    [1977, 14, -1.0, 15, Kind.Slab, Style.Brick, NEVER],
    [1980, 20, 1.0, 14, Kind.Slab, Style.Brick, NEVER],
    [1989, -12, -1.0, 16, Kind.Slab, Style.Glass, NEVER],
    [1989, 12, 1.0, 14, Kind.Slab, Style.Glass, NEVER],
    [2017, -32, 0.4, 7, Kind.Slab, Style.Glass, NEVER], // Cornell Tech
    [2019, -36, -0.6, 8, Kind.Slab, Style.Glass, NEVER],
    [2020, -29, -0.8, 6, Kind.Slab, Style.Glass, NEVER],
    [2021, -39, 0.6, 12, Kind.Slab, Style.Glass, NEVER],
  ]
  plan.forEach(([built, s, off, storeys, kind, style, gone], i) => {
    const x = spine[0] * s + across[0] * off * 2
    const z = spine[1] * s + across[1] * off * 2
    if (islandDistance(x, z) < 1.2) return // off the island: skip rather than put it in the river
    lots.push(makeLot(x, z, rot, 1.3, 1.9, storeys, built, gone, rnd(i, 5, 11), kind, style))
  })
}

// --- readouts --------------------------------------------------------------------

function summarise(lots: Lot[], roads: Road[]): CityLayout {
  const lotYears = Float32Array.from(lots.map((l) => l.built)).sort()
  const goneYears = Float32Array.from(lots.filter((l) => l.gone < NEVER).map((l) => l.gone)).sort()
  const byYear = [...roads].sort((a, b) => a.built - b.built)
  const roadYears = new Float32Array(byYear.length)
  const roadKm = new Float32Array(byYear.length)
  let km = 0
  byYear.forEach((r, i) => {
    km += (r.len * 33.5) / 1000
    roadYears[i] = r.built
    roadKm[i] = km
  })
  return { lots, roads, lotYears, goneYears, roadYears, roadKm }
}

/** Number of entries in a sorted array that are ≤ value. */
function countUpTo(sorted: Float32Array, value: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] <= value) lo = mid + 1
    else hi = mid
  }
  return lo
}

let cache: CityLayout | null = null

/** The city's lots and roads, built on first use and kept. */
export function getCity(): CityLayout {
  if (!cache) cache = generate()
  return cache
}

/** Buildings standing in `year` (counting ones still going up). */
export function buildingsAt(year: number): number {
  const c = getCity()
  return countUpTo(c.lotYears, year) - countUpTo(c.goneYears, year)
}

/** Kilometres of street laid by `year`. */
export function roadKmAt(year: number): number {
  const c = getCity()
  const n = countUpTo(c.roadYears, year)
  return n === 0 ? 0 : c.roadKm[n - 1]
}
