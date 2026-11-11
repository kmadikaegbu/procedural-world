import { ISLAND_BUILDINGS, islandEdges } from '../world/island'

/**
 * THE PLACES OF ISLAND LIFE: the units of Roosevelt Island's simulation, in
 * Stone Librande's terms (his SimCity design diagrams, Class 09). Units are
 * where people and resources start and end: homes, workplaces, the school,
 * shops, parks, the three ways off the island, and the plant that takes the
 * island's trash. Paths connect them. Here there is one main path, Main
 * Street, which runs down the middle of the island, so every trip goes from a
 * door to Main Street, along it, and in at another door.
 *
 * Positions are in the island's own frame (world/island.ts): `s` along its
 * axis, `u` across it, both in world units. Most places are buildings from
 * ISLAND_BUILDINGS, which already know their footprint and the year they went
 * up. The rest are given here directly.
 */

export type PlaceKind = 'home' | 'work' | 'school' | 'campus' | 'hospital' | 'shop' | 'park' | 'portal' | 'avac'

export interface Place {
  name: string
  kind: PlaceKind
  /** Centre, island frame. */
  s: number
  u: number
  /** Half the footprint along and across the island, world units (parks: their size). */
  hs: number
  hu: number
  /** Where people go in and out: the side of the building facing Main Street. */
  door: [number, number]
  /** Years it is open: [from, until). */
  open: [number, number]
  /** People who live here (homes) or work here (workplaces). */
  people: number
  /** Connected to the pneumatic trash tubes (AVAC). */
  avac: boolean
}

const M = 1 / 33.5
const NEVER = 9999

/** Main Street's line: the middle of the island at `s`, bending west round the Octagon (as islandRibbons draws it). */
export function mainStreetU(s: number): number {
  const c = Math.max(-47, Math.min(42, s))
  const e = islandEdges(c) ?? islandEdges(Math.round(c)) ?? [-1, 1]
  return (e[0] + e[1]) / 2 - (c > 22 ? 0.8 : 0)
}

/** The door of a footprint: the point of its edge nearest Main Street. */
function doorOf(s: number, u: number, hs: number, hu: number): [number, number] {
  const main = mainStreetU(s)
  if (main > u + hu) return [s, u + hu]
  if (main < u - hu) return [s, u - hu]
  // Main Street runs through it: the door is on its south face
  return [s - hs, main]
}

function building(
  name: string,
  kind: PlaceKind,
  people: number,
  avac: boolean,
  open?: [number, number],
): Place {
  const b = ISLAND_BUILDINGS.find((x) => x.name === name)
  if (!b) throw new Error(`islandlife: no building called ${name}`)
  const hs = (b.along * M) / 2
  const hu = (b.across * M) / 2
  return {
    name,
    kind,
    s: b.s,
    u: b.u,
    hs,
    hu,
    door: doorOf(b.s, b.u, hs, hu),
    open: open ?? [b.built, b.gone ?? NEVER],
    people,
    avac,
  }
}

function spot(
  name: string,
  kind: PlaceKind,
  s: number,
  u: number,
  sizeM: number,
  open: [number, number],
  people = 0,
  avac = false,
): Place {
  const h = (sizeM * M) / 2
  return { name, kind, s, u, hs: h, hu: h, door: kind === 'park' ? [s, u] : doorOf(s, u, h, h), open, people, avac }
}

/**
 * Residents of an apartment building, from its volume: one person to every 123
 * m³. That rate makes the nine residential buildings below add up to the
 * island's 2020 census count (11,722).
 */
function residents(name: string): number {
  const b = ISLAND_BUILDINGS.find((x) => x.name === name)
  return b ? Math.round((b.along * b.across * b.height) / 123) : 0
}

const HOME = (name: string, open?: [number, number]) => building(name, 'home', residents(name), true, open)

export const PLACES: Place[] = [
  // the "new town in town": Main Street's four towers (1975–76), then Manhattan Park (1989)
  HOME('Eastwood'),
  HOME('Rivercross'),
  HOME('Island House'),
  HOME('Westview'),
  HOME('Manhattan Park 1'),
  HOME('Manhattan Park 2'),
  HOME('Manhattan Park 3'),
  HOME('Manhattan Park 4'),
  // the old asylum's rotunda, apartments since 2006
  HOME('The Octagon', [2006, NEVER]),
  // Cornell Tech's residential tower: its own students (about 530 live there)
  building('Cornell Tech: The House', 'home', 530, false),

  // workplaces: the hospitals run around the clock, in three shifts
  building('Coler Memorial Hospital', 'hospital', 900, true),
  building('Goldwater Hospital', 'hospital', 900, true, [1939, 2013]), // closed in 2013
  building('Roosevelt Island school', 'school', 450, false),
  building('Cornell Tech: Bloomberg Center', 'campus', 1000, false),
  // the shops on the ground floors along Main Street
  spot('Main Street shops', 'shop', 2.6, mainStreetU(2.6) + 0.9, 40, [1976, NEVER], 60),

  // parks (people stay outside in these, and walk about)
  spot('Blackwell Park', 'park', -15.2, 0.5, 50, [1976, NEVER]),
  spot('Capobianco Field', 'park', 19.6, 0.0, 80, [1976, NEVER]),
  spot('Southpoint Park', 'park', -37.5, -3.1, 150, [2011, NEVER]),
  spot('Four Freedoms Park', 'park', -44.5, -4.9, 70, [2012, NEVER]),
  spot('Lighthouse Park', 'park', 41.5, 3.8, 60, [1976, NEVER]),

  // the ways on and off the island
  building('Tramway island station', 'portal', 0, false),
  building('Subway station entrance', 'portal', 0, false),
  building('Motorgate Garage', 'portal', 0, false), // the bus stop for the bridge to Queens

  // the AVAC plant at the north end, where the tubes deliver the trash (position approximate)
  spot('AVAC plant', 'avac', 31.6, mainStreetU(31.6) - 1.4, 40, [1975, NEVER]),
]

export const placeIndex = (name: string) => PLACES.findIndex((p) => p.name === name)

export const isOpen = (p: Place, year: number) => year >= p.open[0] && year < p.open[1]

/** The year island life starts: the new town's first towers and the Tramway. */
export const TOWN_OPENS = 1976

/**
 * The ways off the island. Each one leaves on a timetable and carries up to
 * `cap` people a trip (the Tram's cabins hold 110).
 */
export interface Line {
  name: string
  short: string
  place: number
  open: number
  cap: number
  /** Minutes between trips at the rush hours (7–10, 16–20) and the rest of the day. */
  peak: number
  offPeak: number
  /** Running hours, minutes from midnight; `to` may pass midnight (26*60 = 2 am). */
  from: number
  to: number
  /** How likely a traveller is to take it, when it is open. */
  weight: number
}

export const LINES: Line[] = [
  { name: 'Roosevelt Island Tramway', short: 'Tram', place: placeIndex('Tramway island station'), open: 1976, cap: 110, peak: 7.5, offPeak: 15, from: 6 * 60, to: 26 * 60, weight: 0.35 },
  { name: 'F train', short: 'Subway', place: placeIndex('Subway station entrance'), open: 1989, cap: 600, peak: 6, offPeak: 12, from: 0, to: 24 * 60, weight: 0.5 },
  { name: 'Bus over the Roosevelt Island Bridge', short: 'Bus', place: placeIndex('Motorgate Garage'), open: 1976, cap: 60, peak: 10, offPeak: 20, from: 5 * 60, to: 25 * 60, weight: 0.15 },
]
