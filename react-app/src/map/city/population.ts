// POPULATION of New York City over the years.
//
// Up to 1771 these are the settled town on Manhattan (New Amsterdam, then New
// York). From 1790 on they are the census counts for today's five boroughs, so
// the series jumps there as the farmland around the town is counted in.
//
// Census figures (1790 onward) are the published US decennial counts for the five
// boroughs; the colonial figures are historians' estimates and are rounded.
// Every number here should be spot-checked against the Census Bureau's
// historical tables before it goes in front of anyone.
//
// After 2020 the line is STYLIZED: a gentle rise to ~9 million by 2050, then
// flat. It is not a forecast.

export const POPULATION: [year: number, people: number][] = [
  [1624, 30], // the first Dutch settlers
  [1626, 270],
  [1656, 1000],
  [1664, 1500], // handed to the English
  [1700, 5000],
  [1723, 7250],
  [1746, 11700],
  [1771, 21900],
  [1790, 49400],
  [1800, 79200],
  [1810, 119700],
  [1820, 152100],
  [1830, 242300],
  [1840, 391100],
  [1850, 696100],
  [1860, 1174800],
  [1870, 1478100],
  [1880, 1911700],
  [1890, 2507400],
  [1900, 3437200],
  [1910, 4766900],
  [1920, 5620000],
  [1930, 6930400],
  [1940, 7455000],
  [1950, 7892000],
  [1960, 7782000],
  [1970, 7894900],
  [1980, 7071600],
  [1990, 7322600],
  [2000, 8008300],
  [2010, 8175100],
  [2020, 8804200],
  [2050, 9000000], // stylized, not a forecast
]

/** Where the census data ends and the stylized line begins. */
export const POPULATION_DATA_END = 2020

/** People living in the city in `year` (0 before the Dutch). Linear between the known points. */
export function populationForYear(year: number): number {
  const p = POPULATION
  if (year < p[0][0]) return 0
  if (year >= p[p.length - 1][0]) return p[p.length - 1][1]
  for (let i = 1; i < p.length; i++) {
    if (year <= p[i][0]) {
      const [y0, v0] = p[i - 1]
      const [y1, v1] = p[i]
      return v0 + ((year - y0) / (y1 - y0)) * (v1 - v0)
    }
  }
  return p[p.length - 1][1]
}

export const POPULATION_MAX = POPULATION[POPULATION.length - 1][1]

/** "8.80 million", "696,100", "1,500": short, readable. */
export function formatPopulation(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} million`
  if (n >= 1000) return (Math.round(n / 100) * 100).toLocaleString('en-US')
  return String(Math.round(n))
}
