import { EXAGGERATION, m } from './scale'

// THE HISTORY TIMELINE. One Year slider, 1609 → 2100, drives three things:
//
//   sea level    feeds TerrainParams.seaLevel, flooding the coast exactly the
//                way the manual Sea Level slider already does
//   the city     how far the built-up, paved city has spread out from the
//                Battery, and whether the 1811 street grid exists yet
//   the names    what the city and Roosevelt Island were called, and the most
//                recent event on the island
//
// The sources and the reasoning are in Tutorials/History and Design Position.md.
// Where a curve below is an estimate rather than data, its comment says so.

export const TIMELINE_MIN = 1609 // Hudson's arrival; the year the Welikia Project reconstructs
export const TIMELINE_MAX = 2100
export const TIMELINE_DEFAULT = 2026 // "today"

// how many years pass per real second while Play is running
export const TIMELINE_YEARS_PER_SECOND = 12

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Linear interpolation through [year, value] points, held flat beyond the ends. */
function through(points: [number, number][], year: number): number {
  if (year <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i++) {
    const [y1, v1] = points[i]
    if (year <= y1) {
      const [y0, v0] = points[i - 1]
      return v0 + ((year - y0) / (y1 - y0)) * (v1 - v0)
    }
  }
  return points[points.length - 1][1]
}

// --- sea level ---------------------------------------------------------------

/** Measured sea-level rise at the Battery tide gauge, 1856–2024 (NOAA: 2.94 mm/yr). */
const BATTERY_MM_PER_YEAR = 2.94
const GAUGE_START = 1856
/** Real metres of sea level → world units at the readable scale (hills are drawn 15× taller). */
const seaUnits = (meters: number) => m(meters) * EXAGGERATION.readable.vertical
/** Where the stylized future rise ends up, in world units (see seaLevelForYear). */
const FUTURE_RISE = 2.4

/**
 * Year → sea level, in world units (0 = today).
 *
 *   1856 → today   MEASURED: the Battery gauge's linear trend, about half a
 *                  metre in all. Drawn at the same 15× as the hills, so it shows.
 *   before 1856    no gauge, so held at the 1856 level rather than invented.
 *   today → 2100   STYLIZED: an accelerating curve to dramatize flooding. It is
 *                  far steeper than published projections and isn't a forecast.
 */
export function seaLevelForYear(year: number): number {
  if (year <= TIMELINE_DEFAULT) {
    const since = TIMELINE_DEFAULT - Math.max(year, GAUGE_START)
    return -seaUnits((since * BATTERY_MM_PER_YEAR) / 1000)
  }
  const t = clamp01((year - TIMELINE_DEFAULT) / (TIMELINE_MAX - TIMELINE_DEFAULT))
  return t * t * FUTURE_RISE // ease-in: slow at first, then accelerating
}

// --- the city's growth ----------------------------------------------------------

/**
 * The Battery, the southern tip of Manhattan, in world units (from its
 * latitude/longitude, projected the same way as the shoreline data). The city
 * grew outward from here.
 */
export const BATTERY = { x: -169, z: 194 }

/** A reach that covers every point on the map — the whole city is built up. */
export const CITY_REACH_ALL = 800

/**
 * How far the built-up city reaches from the Battery, in world units (×33.5 m).
 * An ESTIMATE from the city's well-known growth, not a survey: New Amsterdam
 * below Wall Street (~0.8 km) by 1664, the city to about Chambers Street
 * (~2.5 km) by 1800, to about 42nd Street (~6.5 km) by 1850, Manhattan built
 * up into Harlem and Brooklyn's waterfront by 1900, and the whole city by 1950.
 * It grows as a circle around the Battery, a simplification: the real city
 * grew up the island's spine and out from Brooklyn's own centre as well.
 */
const REACH: [number, number][] = [
  [1624, 0], // no European town yet
  [1664, 25], // New Amsterdam, below Wall Street
  [1800, 75], // to about Chambers Street
  [1850, 195], // to about 42nd Street
  [1900, 420], // Manhattan into Harlem; Brooklyn's waterfront
  [1950, CITY_REACH_ALL], // the whole city
]

export const cityReachForYear = (year: number) => through(REACH, year)

/** The inverse: the year the built-up city first reaches `distance` from the Battery. */
export const yearForCityReach = (distance: number) =>
  through(
    REACH.map(([year, reach]) => [reach, year] as [number, number]),
    distance,
  )

/** The Commissioners' Plan, which laid the street grid over Manhattan. */
export const GRID_YEAR = 1811

/** 0 before the 1811 grid, 1 once it exists (fading in over a few years, so Play doesn't pop). */
export const streetGridForYear = (year: number) => clamp01((year - GRID_YEAR) / 10)

// --- names and events ---------------------------------------------------------

/** What the city was called. */
export function cityNameForYear(year: number): string {
  if (year < 1624) return 'Mannahatta' // the Lenape name for the island
  if (year < 1664) return 'New Amsterdam'
  return 'New York City'
}

/** What Roosevelt Island was called (some of these dates differ by a year or two between sources). */
export function islandNameForYear(year: number): string {
  if (year < 1637) return 'Minnehanonck' // Lenape
  if (year < 1686) return 'Varken Eylandt (Hog Island)' // Dutch
  if (year < 1921) return "Blackwell's Island"
  if (year < 1973) return 'Welfare Island'
  return 'Roosevelt Island'
}

/** Moments on and around the island, oldest first. */
export const EVENTS: { year: number; text: string }[] = [
  { year: 1609, text: 'Henry Hudson sails past. Lenape land: forest, marsh and meadow.' },
  { year: 1624, text: 'The Dutch found New Amsterdam at the Battery.' },
  { year: 1637, text: 'The Dutch take the island and call it Hog Island.' },
  { year: 1664, text: 'The English take New Amsterdam; it becomes New York.' },
  { year: 1686, text: "Robert Blackwell's family takes the island; it becomes Blackwell's Island." },
  { year: 1811, text: "The Commissioners' Plan lays Manhattan's street grid, tilted 29°." },
  { year: 1828, text: 'The city buys the island for its prisons and hospitals.' },
  { year: 1839, text: 'The Octagon asylum opens (A. J. Davis).' },
  { year: 1856, text: 'Renwick\'s Smallpox Hospital opens; the Battery tide gauge starts recording.' },
  { year: 1883, text: 'The Brooklyn Bridge opens, the first to span the East River.' },
  { year: 1903, text: 'The Williamsburg Bridge opens.' },
  { year: 1909, text: 'The Queensboro and Manhattan bridges open; the Queensboro crosses the island.' },
  { year: 1916, text: 'The Hell Gate Bridge carries the railway over the East River.' },
  { year: 1921, text: 'Renamed Welfare Island: hospitals take over.' },
  { year: 1936, text: 'The Triborough Bridge opens, joining Manhattan, Queens and the Bronx over Randalls Island.' },
  { year: 1939, text: 'Goldwater Hospital opens.' },
  { year: 1955, text: 'The Roosevelt Island Bridge opens: the island\'s only road to Queens.' },
  { year: 1969, text: 'The state leases the island; Johnson and Burgee plan a "new town in town".' },
  { year: 1973, text: 'Renamed Roosevelt Island. Louis Kahn designs the Four Freedoms memorial.' },
  { year: 1976, text: 'The Roosevelt Island Tramway opens.' },
  { year: 2012, text: "Four Freedoms Park opens, built to Kahn's design." },
  { year: 2017, text: 'Cornell Tech opens its first building.' },
  { year: TIMELINE_DEFAULT, text: 'Today.' },
  { year: 2050, text: 'Past here the sea-level curve is stylized, not a forecast.' },
]

/** The most recent event at or before `year`. */
export function latestEvent(year: number): { year: number; text: string } {
  let out = EVENTS[0]
  for (const e of EVENTS) if (e.year <= year) out = e
  return out
}
