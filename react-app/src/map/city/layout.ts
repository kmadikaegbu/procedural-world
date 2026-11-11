import { coastDistance, islandDistance, WORLD } from '../world/shore'
import { BATTERY, yearForCityReach } from '../timeline'
import { objectSize } from '../scale'
import { at } from '../world/project'
import { openLandAt } from '../world/parks'
import { ACROSS, BANK_TOWERS, ISLAND_BUILDINGS, islandRibbons, islandSU, islandXZ } from '../world/island'
import type { RealBuildings } from './realBuildings'
import { StreetKind, type RealStreets } from './realStreets'

/**
 * THE CITY'S BUILDINGS AND STREETS, grown over time.
 *
 * Two layers of buildings:
 *
 *   - THE REAL CITY (once the data has loaded, realBuildings.ts): every building
 *     standing today, at its real place, size and roof height, rising in the
 *     year the city records it was built. That data only knows the survivors:
 *     everything pulled down before is missing from it.
 *   - THE LOST CITY, procedural: a stand-in for the buildings that came before.
 *     Each one comes down in the year the first real building on its ground goes
 *     up, so the old town is replaced by the real one as the timeline plays.
 *
 * The lost city is not a survey. It is built from a few rules that are true of
 * New York:
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

// --- projection: see world/project.ts ----------------------------------------------

export { at }

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
  { at: at(40.75, -73.915), angle: 15, sa: 2.4, sb: 4.4, fill: 0.65, tall: 0.3 }, // western Queens, low and patchy by the river
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
  { at: at(40.754, -73.988), sigma: 21, weight: 1 }, // Midtown
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

/** Left empty: parks, cemeteries, airfields and rail yards (world/parks.ts). */
function reserved(x: number, z: number): boolean {
  return openLandAt(x, z) !== null
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
  Round: 5, // a round or octagonal tower with a low cone roof: the Octagon, the lighthouse
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
  /**
   * What it is: 0 a street, 1 a footpath, 2 a tennis court, 3 bare earth (a
   * baseball infield), 4 turf (a sports field), 5 paving (a plaza). Anything but
   * 0 is drawn flat in its own colour, with no kerb or centre line.
   */
  kind?: number
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
  return mix3([0.66, 0.65, 0.61], [0.52, 0.52, 0.5], r) // limestone to granite, a neutral grey
}
function glass(r: number): RGB {
  return mix3([0.72, 0.8, 0.86], [0.55, 0.64, 0.72], r) // pale blue-grey
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

/** Whatever replaced a lost building: the year the first real building on its ground went up. */
type Replaced = (x: number, z: number, rot: number, w: number, d: number, built: number) => number

/**
 * One building of the lost city on a lot of `lotLen` along its street and
 * `depth` across: the year it goes up (from when the city reached here), its
 * height (from its era and district), and, in a business core, the tower that
 * later replaces it. With the real buildings loaded it is only the building that
 * stood here before them.
 */
function lostLot(
  lots: Lot[],
  px: number,
  pz: number,
  rot: number,
  lotLen: number,
  depth: number,
  dist: District,
  [r1, r2, r3, r4]: [number, number, number, number],
  replaced: Replaced | null,
) {
  const away = Math.hypot(px - BATTERY.x, pz - BATTERY.z)
  // the front reaches here, then the lot fills in over a few decades
  const built = Math.min(
    1975,
    yearForCityReach(away + (r1 - 0.5) * 16) + r2 * r2 * 70,
  )
  const core = coreAt(px, pz)
  const w = lotLen * (0.72 + 0.2 * r3)
  const dpt = depth * (0.72 + 0.2 * r4)
  // an ordinary building of its day
  const storeys = Math.max(
    1,
    through(STOREYS, built) * (0.7 + r2 * 0.7) * (0.6 + 0.8 * dist.tall),
  )

  // in a core, the low building is later replaced by a tower
  const towerYear = 1890 + Math.pow(r3, 1.3) * 125
  const goesTall = core * dist.tall > 0.22 && r1 < core * 1.1 && towerYear > built + 25
  if (replaced) {
    // with the real city loaded, this lot is only the building that stood
    // here before it: it comes down when the first real one on its ground
    // goes up (no invented towers: the real ones are there)
    const gone = replaced(px, pz, rot, w, dpt, built)
    if (gone - built >= MIN_LIFE) lots.push(makeLot(px, pz, rot, w, dpt, storeys, built, gone, r4))
    return
  }
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

/**
 * THE PROCEDURAL GRID, used until the real streets have loaded (or if they
 * can't be): each district gets a regular grid at its own angle, with a lost
 * building on every lot.
 */
function proceduralGrid(lots: Lot[], roads: Road[], replaced: Replaced | null) {
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

          lostLot(lots, px, pz, rotSt, lotLen, depth, dist, [
            rnd(ia, ib, salt + 1),
            rnd(ia, ib, salt + 2),
            rnd(ia, ib, salt + 3),
            rnd(ia, ib, salt + 4),
          ], replaced)
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

}

function generate(real: RealBuildings | null, streets: RealStreets | null): CityLayout {
  const lots: Lot[] = []
  const roads: Road[] = []
  // the real city first, so each lot of the lost city can find what replaced it
  const replaced = real ? addRealBuildings(lots, real) : null

  if (streets) {
    const pieces = addRealStreets(roads, streets)
    lostCityAlong(lots, pieces, replaced)
  } else {
    proceduralGrid(lots, roads, replaced)
  }

  // the real data has the bank towers already, at their true places
  addIslandBuildings(lots, !real)
  // with the real streets, the island's Main Street and the shore drives come from them
  for (const r of islandRibbons(!streets)) roads.push(r)

  return summarise(lots, roads)
}


// --- the real city ---------------------------------------------------------------------

/** Years a lost building must stand to be worth drawing at all. */
const MIN_LIFE = 10
/**
 * When a lost building with nothing standing on its ground today comes down: the
 * mid-century clearances (parks, highways, housing projects). An estimate.
 */
const CLEARED_BY = 1950
/** Grid for finding the real buildings on a lot's ground, world units. */
const FIND_CELL = 1

/**
 * Add every real building as a lot, and return a lookup: the year the first real
 * building went up inside a given rectangle (the lost building's ground).
 */
function addRealBuildings(
  lots: Lot[],
  real: RealBuildings,
): (x: number, z: number, rot: number, w: number, d: number, built: number) => number {
  const cells = new Map<number, number[]>() // cell → [x, z, built, …]
  const key = (i: number, j: number) => (i + 2048) * 4096 + (j + 2048)

  for (let i = 0; i < real.count; i++) {
    const x = real.x[i]
    const z = real.z[i]
    if (x < WORLD.x0 || x > WORLD.x1 || z < WORLD.z0 || z > WORLD.z1) continue
    // in the river by the app's simplified shore (piers, mostly), or on Roosevelt
    // Island, which is laid out by hand from photographs (addIslandBuildings)
    if (coastDistance(x, z) < 0.15 || islandDistance(x, z) > -1.5) continue
    const rr = rnd(i, 7, 13)
    // the year the city records; where it has none, a guess from when the city
    // reached this far (the same estimate as the lost city's)
    const recorded = real.year[i] >= 1650 && real.year[i] <= 2030
    const built = recorded
      ? real.year[i]
      : Math.min(2015, yearForCityReach(Math.hypot(x - BATTERY.x, z - BATTERY.z)) + 20 + rr * 60)
    // a roof the city never measured gets the usual height for its day
    const metres = real.height[i] > 0 ? real.height[i] : through(STOREYS, built) * STOREY_M
    lots.push(makeLot(x, z, -real.angle[i], real.w[i], real.d[i], metres / STOREY_M, built, NEVER, rr))

    const k = key(Math.floor(x / FIND_CELL), Math.floor(z / FIND_CELL))
    const list = cells.get(k)
    if (list) list.push(x, z, built)
    else cells.set(k, [x, z, built])
  }

  return (x, z, rot, w, d, built) => {
    // the lot's own axes (see makeLot: local x along (cos rot, −sin rot))
    const ux = Math.cos(rot)
    const uz = -Math.sin(rot)
    const r = Math.hypot(w, d) / 2
    let first = Infinity
    for (let i = Math.floor((x - r) / FIND_CELL); i <= Math.floor((x + r) / FIND_CELL); i++) {
      for (let j = Math.floor((z - r) / FIND_CELL); j <= Math.floor((z + r) / FIND_CELL); j++) {
        const list = cells.get(key(i, j))
        if (!list) continue
        for (let n = 0; n < list.length; n += 3) {
          const dx = list[n] - x
          const dz = list[n + 1] - z
          if (Math.abs(dx * ux + dz * uz) <= w / 2 && Math.abs(-dx * uz + dz * ux) <= d / 2) {
            first = Math.min(first, list[n + 2])
          }
        }
      }
    }
    return first < Infinity ? first : Math.max(built + 40, CLEARED_BY)
  }
}

/**
 * Roosevelt Island and the banks beside it are laid out from the reference
 * photographs (world/island.ts): each building has its real position, footprint,
 * height and date. A building that is not on the island (a tower in Queens) is
 * placed too, where the street generator would not put one, unless the real
 * data is loaded (`banks` false), which has them all.
 */
const SHAPE_KIND = { block: Kind.Block, slab: Kind.Slab, house: Kind.House, round: Kind.Round } as const
const WALL_STYLE = { brick: Style.Brick, stone: Style.Stone, glass: Style.Glass, timber: Style.Timber } as const

function addIslandBuildings(lots: Lot[], banks: boolean) {
  const rot = -Math.atan2(ACROSS[1], ACROSS[0]) // a lot's local x runs across the island
  const all = banks ? [...ISLAND_BUILDINGS, ...BANK_TOWERS] : ISLAND_BUILDINGS
  all.forEach((b, i) => {
    const [x, z] = islandXZ(b.s, b.u)
    const onIsland = ISLAND_BUILDINGS.includes(b)
    // never put a building in the river
    if (onIsland ? islandDistance(x, z) < 0.15 : coastDistance(x, z) < 0.3) return
    lots.push(
      makeLot(
        x,
        z,
        rot,
        Math.max(0.2, b.across / 33.5),
        Math.max(0.2, b.along / 33.5),
        b.height / STOREY_M,
        b.built,
        b.gone ?? NEVER,
        rnd(i, 5, 11),
        SHAPE_KIND[b.shape],
        WALL_STYLE[b.wall],
      ),
    )
  })
}

// --- the real streets ------------------------------------------------------------------

/** One straight piece of a real street, between two of its line's vertices. */
interface Piece {
  x0: number
  z0: number
  x1: number
  z1: number
  /** Half the width it is drawn, world units. */
  half: number
  kind: StreetKind
  rot: number
}

const M = 1 / 33.5

/**
 * How wide each kind of line is drawn, metres, from the roadbed width the city
 * records (`bed`, 0 when it doesn't): streets get a sidewalk either side, the
 * rest don't.
 */
function drawnWidth(kind: StreetKind, bed: number): number {
  switch (kind) {
    case StreetKind.Street:
      return Math.min(45, Math.max(8, (bed || 10.4) + 7))
    case StreetKind.Highway:
      return Math.min(45, Math.max(10, (bed || 20) + 2))
    case StreetKind.Path:
      return Math.min(8, bed || 3.5)
    case StreetKind.Ramp:
      return Math.max(6, (bed || 8) + 1)
    default:
      return Math.max(5, (bed || 6) + 2)
  }
}

/** Roosevelt Island's own buildings, standing today, in the island's frame: no street runs through them. */
const ISLAND_FOOTPRINTS = ISLAND_BUILDINGS.filter((b) => b.gone === undefined).map((b) => ({
  s: b.s,
  u: b.u,
  hs: b.along / 33.5 / 2,
  hu: b.across / 33.5 / 2,
}))
function onIslandBuilding(x: number, z: number): boolean {
  if (islandDistance(x, z) < -0.5) return false
  const [s, u] = islandSU(x, z)
  return ISLAND_FOOTPRINTS.some((f) => Math.abs(s - f.s) < f.hs && Math.abs(u - f.u) < f.hu)
}

/**
 * Lay every real street as straight ribbons along its centre line, and say when
 * each was laid. The data has no such year, so it comes from two estimates: when
 * the city reached this far from the Battery (as for the lost city), and the year
 * the oldest buildings standing beside it went up. A street is at least as old as
 * its buildings, so it takes the earlier one.
 */
function addRealStreets(roads: Road[], streets: RealStreets): Piece[] {
  const pieces: Piece[] = []
  for (let i = 0; i < streets.count; i++) {
    const kind = streets.kind[i] as StreetKind
    const width = drawnWidth(kind, streets.width[i]) * M
    const near = streets.year[i]
    const a = streets.start[i]
    const b = streets.start[i + 1]
    // one year for the whole line, from its middle
    const mi = a + ((b - a) >> 1)
    const mx = streets.x[mi]
    const mz = streets.z[mi]
    const away = Math.hypot(mx - BATTERY.x, mz - BATTERY.z)
    let built = yearForCityReach(away + (rnd(i, 3, 17) - 0.5) * 16) - 4
    if (near >= 1650) built = Math.min(built, near - 5)
    built = Math.max(1624, Math.min(1972, built))
    for (let v = a; v < b - 1; v++) {
      const x0 = streets.x[v]
      const z0 = streets.z[v]
      const x1 = streets.x[v + 1]
      const z1 = streets.z[v + 1]
      const len = Math.hypot(x1 - x0, z1 - z0)
      if (len < 0.01) continue
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      if (coastDistance(cx, cz) < -0.4) continue // out over the water: piers and the like
      if (onIslandBuilding(cx, cz)) continue
      const rot = -Math.atan2(z1 - z0, x1 - x0)
      // a little longer than the piece, so the joints at a bend overlap
      roads.push({
        x: cx,
        z: cz,
        rot,
        len: len + Math.min(width, 0.25),
        width,
        built,
        kind: kind === StreetKind.Path ? 1 : 0,
      })
      pieces.push({ x0, z0, x1, z1, half: width / 2, kind, rot })
    }
  }
  return pieces
}

/** Distance from a point to a piece's centre line. */
function distToPiece(p: Piece, x: number, z: number): number {
  const dx = p.x1 - p.x0
  const dz = p.z1 - p.z0
  const l2 = dx * dx + dz * dz
  const t = Math.max(0, Math.min(1, ((x - p.x0) * dx + (z - p.z0) * dz) / l2))
  return Math.hypot(x - (p.x0 + t * dx), z - (p.z0 + t * dz))
}

/** Lot depth of the lost city (across the street), world units: about 28 m. */
const LOT_DEPTH = 0.85
/** Lot width along the street, world units: about 45 m. */
const LOT_ALONG = 1.4

/**
 * THE LOST CITY ALONG THE REAL STREETS: a building on each lot down both sides
 * of every real street, kept off every other street and off its neighbours,
 * so the old town lines the streets that are really there.
 */
function lostCityAlong(lots: Lot[], pieces: Piece[], replaced: Replaced | null) {
  // the pieces in a grid, for asking what street is near a point
  const CELL = 1
  const key = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096)
  const grid = new Map<number, number[]>()
  pieces.forEach((p, k) => {
    if (p.kind === StreetKind.Path) return // a lot may back onto a footpath
    const pad = p.half + LOT_DEPTH
    for (let i = Math.floor((Math.min(p.x0, p.x1) - pad) / CELL); i <= Math.floor((Math.max(p.x0, p.x1) + pad) / CELL); i++)
      for (let j = Math.floor((Math.min(p.z0, p.z1) - pad) / CELL); j <= Math.floor((Math.max(p.z0, p.z1) + pad) / CELL); j++) {
        const c = key(i, j)
        const list = grid.get(c)
        if (list) list.push(k)
        else grid.set(c, [k])
      }
  })
  const clearOfStreets = (x: number, z: number, self: number, room: number) => {
    const list = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)))
    if (!list) return true
    for (const k of list) if (k !== self && distToPiece(pieces[k], x, z) < pieces[k].half + room) return false
    return true
  }
  // one lot to a patch of ground, so lots on the corners don't stack up
  const TAKEN = 0.75
  const taken = new Set<number>()

  pieces.forEach((p, k) => {
    if (p.kind !== StreetKind.Street) return
    const len = Math.hypot(p.x1 - p.x0, p.z1 - p.z0)
    if (len < LOT_ALONG * 0.6) return
    const ux = (p.x1 - p.x0) / len
    const uz = (p.z1 - p.z0) / len
    const n = Math.max(1, Math.round(len / LOT_ALONG))
    const lotLen = len / n
    for (const side of [-1, 1]) {
      const off = p.half + LOT_DEPTH / 2 + 0.05
      for (let q = 0; q < n; q++) {
        const t = (q + 0.5) * lotLen
        const px = p.x0 + ux * t - uz * off * side
        const pz = p.z0 + uz * t + ux * off * side
        if (px < WORLD.x0 || px > WORLD.x1 || pz < WORLD.z0 || pz > WORLD.z1) continue
        if (coastDistance(px, pz) < 0.6 || islandDistance(px, pz) > -1.5) continue
        if (reserved(px, pz)) continue
        const salt = q * 2 + (side > 0 ? 1 : 0)
        const dist = DISTRICTS[districtAt(px, pz)]
        if (rnd(k, salt, 41) > dist.fill) continue
        if (!clearOfStreets(px, pz, k, LOT_DEPTH * 0.35)) continue
        const cell = key(Math.floor(px / TAKEN), Math.floor(pz / TAKEN))
        if (taken.has(cell)) continue
        taken.add(cell)
        lostLot(lots, px, pz, p.rot, lotLen, LOT_DEPTH, dist, [rnd(k, salt, 42), rnd(k, salt, 43), rnd(k, salt, 44), rnd(k, salt, 45)], replaced)
      }
    }
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
let realCity: RealBuildings | null = null
let realStreets: RealStreets | null = null
const listeners = new Set<() => void>()

/** The city's lots and roads, built on first use and kept. */
export function getCity(): CityLayout {
  if (!cache) cache = generate(realCity, realStreets)
  return cache
}

/** Hand over the real buildings once they've loaded: the city is laid out again with them. */
export function setRealBuildings(real: RealBuildings) {
  realCity = real
  cache = null
  listeners.forEach((f) => f())
}

/** Hand over the real streets once they've loaded: the streets, and the lost city along them, are laid out again. */
export function setRealStreets(streets: RealStreets) {
  realStreets = streets
  cache = null
  listeners.forEach((f) => f())
}

/** For useSyncExternalStore: call `f` when the layout changes; `cityVersion` says which one it is. */
export function onCityChange(f: () => void): () => void {
  listeners.add(f)
  return () => listeners.delete(f)
}
export const cityVersion = () => (realCity ? 1 : 0) + (realStreets ? 2 : 0)

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
