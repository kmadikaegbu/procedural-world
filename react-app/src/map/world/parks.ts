import { at, km } from './project'
import { islandLatLon } from './island'

/**
 * OPEN LAND: the parks, cemeteries, airfields and rail yards of the real city,
 * as ovals and rectangles (positions from memory, approximate; sizes are
 * the parks' real extents).
 *
 *   park / cemetery  green, with trees, and no buildings or streets
 *   open             bare paved ground with no buildings or streets: an airport
 *                    or a rail yard
 *
 * The city's generator (city/layout.ts) leaves them empty, the ground colouring
 * and the forest treat the green ones like Roosevelt Island's parkland, and the
 * animals can live in them.
 */

export type OpenKind = 'park' | 'cemetery' | 'open'

interface Spec {
  name: string
  kind: OpenKind
  lat: number
  lon: number
  /** Half-length and half-width, km. */
  a: number
  b: number
  /** Compass bearing of the long axis, degrees. */
  bearing: number
  shape?: 'oval' | 'rect'
}

const SPECS: Spec[] = [
  { name: 'Central Park', kind: 'park', lat: 40.7824, lon: -73.9656, a: 2.05, b: 0.42, bearing: 29, shape: 'rect' },
  { name: 'Prospect Park', kind: 'park', lat: 40.6602, lon: -73.969, a: 1.0, b: 0.55, bearing: 20 },
  { name: 'Randalls Island', kind: 'park', lat: 40.793, lon: -73.9215, a: 1.1, b: 0.45, bearing: 30 },
  { name: 'Wards Island', kind: 'park', lat: 40.7855, lon: -73.9275, a: 0.8, b: 0.4, bearing: 20 },
  { name: 'Governors Island', kind: 'park', lat: 40.6895, lon: -74.0168, a: 0.55, b: 0.35, bearing: 60 },
  { name: 'Battery Park', kind: 'park', lat: 40.7033, lon: -74.017, a: 0.3, b: 0.25, bearing: 0 },
  { name: 'Flushing Meadows–Corona Park', kind: 'park', lat: 40.7466, lon: -73.8448, a: 1.6, b: 0.8, bearing: 0 },
  { name: 'Forest Park', kind: 'park', lat: 40.7, lon: -73.85, a: 1.2, b: 0.6, bearing: 90 },
  { name: 'Bronx Park and Zoo', kind: 'park', lat: 40.856, lon: -73.877, a: 1.4, b: 0.55, bearing: 10 },
  { name: 'Pelham Bay Park', kind: 'park', lat: 40.865, lon: -73.81, a: 2.0, b: 1.4, bearing: 30 },
  { name: 'Inwood Hill and Fort Tryon', kind: 'park', lat: 40.873, lon: -73.926, a: 0.9, b: 0.45, bearing: 20 },
  { name: 'Green-Wood Cemetery', kind: 'cemetery', lat: 40.658, lon: -73.991, a: 0.8, b: 0.55, bearing: 20 },
  { name: 'Calvary Cemetery', kind: 'cemetery', lat: 40.732, lon: -73.923, a: 0.9, b: 0.45, bearing: 90 },
  { name: 'LaGuardia Airport', kind: 'open', lat: 40.7769, lon: -73.874, a: 1.4, b: 0.8, bearing: 90 },
  { name: 'Sunnyside Yard', kind: 'open', lat: 40.744, lon: -73.92, a: 1.2, b: 0.25, bearing: 80 },
]

// parks on the banks beside Roosevelt Island, placed from the reference photographs
// (positions in the island's own frame, see world/island.ts)
const bank = (name: string, s: number, u: number, longM: number, shortM: number): Spec => {
  const [lat, lon] = islandLatLon(s, u)
  return { name, kind: 'park', lat, lon, a: longM / 2000, b: shortM / 2000, bearing: 29 }
}
SPECS.push(
  bank('Rainey Park', 23, 15, 220, 200),
  bank('Queensbridge Park', -3.5, 13.2, 400, 150),
  bank('Socrates Sculpture Park', 37.5, 14, 150, 80),
  bank('Carl Schurz Park', 50, -9, 300, 150),
)

interface Shape {
  name: string
  kind: OpenKind
  x: number
  z: number
  /** The long axis, as a unit vector, and the half-extents along and across it (world units). */
  ax: number
  az: number
  a: number
  b: number
  rect: boolean
}

const SHAPES: Shape[] = SPECS.map((s) => {
  const [x, z] = at(s.lat, s.lon)
  const th = (s.bearing * Math.PI) / 180
  return {
    name: s.name,
    kind: s.kind,
    x,
    z,
    ax: Math.sin(th),
    az: -Math.cos(th), // +z is south
    a: km(s.a),
    b: km(s.b),
    rect: s.shape === 'rect',
  }
})

/** How far inside a shape a point is: below 1 inside, 1 at the edge. */
function reach(s: Shape, x: number, z: number): number {
  const dx = x - s.x
  const dz = z - s.z
  const u = (dx * s.ax + dz * s.az) / s.a
  const v = (-dx * s.az + dz * s.ax) / s.b
  return s.rect ? Math.max(Math.abs(u), Math.abs(v)) : Math.hypot(u, v)
}

/** Is the point inside any open land? */
export function openLandAt(x: number, z: number): OpenKind | null {
  for (const s of SHAPES) if (reach(s, x, z) < 1) return s.kind
  return null
}

/** Parkland weight 0..1 (soft at the edge): the greens only, not airports or yards. */
export function parkWeight(x: number, z: number): number {
  let best = 0
  for (const s of SHAPES) {
    if (s.kind === 'open') continue
    const r = reach(s, x, z)
    if (r >= 1.04) continue
    const w = 1 - Math.min(1, Math.max(0, (r - 0.94) / 0.1))
    if (w > best) best = w
  }
  return best
}

/** A random point inside a random green shape, for planting its trees: `r1..r3` are uniform numbers in 0..1. */
export function randomParkPoint(r1: number, r2: number, r3: number): [number, number] | null {
  const greens = SHAPES.filter((s) => s.kind !== 'open')
  // shapes are chosen in proportion to their area
  const area = (s: Shape) => (s.rect ? 4 : Math.PI) * s.a * s.b
  const total = greens.reduce((t, s) => t + area(s), 0)
  let pick = r1 * total
  let chosen = greens[greens.length - 1]
  for (const s of greens) {
    pick -= area(s)
    if (pick <= 0) {
      chosen = s
      break
    }
  }
  let u: number
  let v: number
  if (chosen.rect) {
    u = r2 * 2 - 1
    v = r3 * 2 - 1
  } else {
    const rad = Math.sqrt(r2)
    const ang = r3 * Math.PI * 2
    u = rad * Math.cos(ang)
    v = rad * Math.sin(ang)
  }
  return [
    chosen.x + u * chosen.a * chosen.ax - v * chosen.b * chosen.az,
    chosen.z + u * chosen.a * chosen.az + v * chosen.b * chosen.ax,
  ]
}

/** The shapes, for the notes and the readouts. */
export const OPEN_LAND = SPECS.map((s) => ({ name: s.name, kind: s.kind }))
