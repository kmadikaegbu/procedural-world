import { height, type TerrainParams } from '../noise'
import { coastDistance } from '../world/shore'
import { EXAGGERATION, m, type ScaleMode } from '../scale'
import { at } from './layout'
import { islandXZ } from '../world/island'

/**
 * BRIDGES AND HIGHWAYS over the water, built in their real years.
 *
 * Each crossing is given as a point on the real bridge (latitude, longitude), the
 * direction it runs, and its dates. The positions come from memory and are
 * approximate, so a bridge is not placed by its coordinates alone: the program
 * walks along the line, finds where it actually crosses the water on the map's
 * real shoreline, and lays the bridge from shore to shore (plus a ramp onto each
 * bank). So even if a coordinate is a little off, the bridge still spans the river.
 *
 * Each bridge is then described as a list of PARTS (deck sections, towers,
 * piers, cables, truss posts), each with the point in the building programme at
 * which it appears. BridgeLayer.tsx turns the parts into meshes and, as the year
 * moves from `start` to `built`, builds them: piers and towers first, the deck
 * out from both banks, the cables, and the deck's last gap in the middle.
 */

export type BridgeKind = 'suspension' | 'cantilever' | 'arch' | 'lift' | 'highway'

interface Spec {
  name: string
  kind: BridgeKind
  lat: number
  lon: number
  /** Compass bearing the bridge runs along, degrees (0 = north, 90 = east). */
  bearing: number
  /** Construction starts, and the bridge opens. */
  start: number
  built: number
  /** Deck width, real metres. */
  widthM: number
  /** Height of the deck above the water in mid-span, real metres. */
  clearM: number
  /** Height of the towers (or truss crown) above the deck, real metres. */
  towerM: number
  /** Water gaps closer than this (world units) are crossed by the one bridge: the Queensboro spans both channels and the island between. */
  merge?: number
}

/** The crossings, oldest first. */
const SPECS: Spec[] = [
  { name: 'Brooklyn Bridge', kind: 'suspension', lat: 40.706, lon: -73.9969, bearing: 128, start: 1869, built: 1883, widthM: 26, clearM: 41, towerM: 43 },
  { name: 'Williamsburg Bridge', kind: 'suspension', lat: 40.713, lon: -73.9703, bearing: 100, start: 1896, built: 1903, widthM: 36, clearM: 41, towerM: 55 },
  { name: 'Manhattan Bridge', kind: 'suspension', lat: 40.7075, lon: -73.9908, bearing: 160, start: 1901, built: 1909, widthM: 37, clearM: 41, towerM: 50 },
  { name: 'Queensboro Bridge', kind: 'cantilever', lat: 40.7569, lon: -73.954, bearing: 119, start: 1901, built: 1909, widthM: 36, clearM: 40, towerM: 38, merge: 12 },
  { name: 'Hell Gate Bridge', kind: 'arch', lat: 40.779, lon: -73.923, bearing: 15, start: 1912, built: 1916, widthM: 18, clearM: 40, towerM: 60 },
  { name: 'Triborough Bridge (Manhattan)', kind: 'suspension', lat: 40.7995, lon: -73.93, bearing: 110, start: 1929, built: 1936, widthM: 28, clearM: 40, towerM: 50 },
  { name: 'Triborough Bridge (Queens)', kind: 'lift', lat: 40.787, lon: -73.9227, bearing: 165, start: 1929, built: 1936, widthM: 28, clearM: 40, towerM: 45 },
  { name: 'Roosevelt Island Bridge', kind: 'lift', lat: 40.7634, lon: -73.944, bearing: 100, start: 1952, built: 1955, widthM: 18, clearM: 30, towerM: 40 },
]

type V3 = [number, number, number]

/** One piece of a bridge. */
export interface Part {
  /** Ends of the piece: a box runs from `from` to `to`, `thick` high and `wide` across. */
  from: V3
  to: V3
  thick: number
  wide: number
  color: string
  /** The share of the construction (0..1) at which it begins to appear, and how long it takes. */
  appear: number
  span: number
  /** Grows up from `from` (towers and piers) instead of just appearing. */
  rise?: boolean
}

export interface BridgePlan {
  name: string
  kind: BridgeKind
  start: number
  built: number
  parts: Part[]
  /** Hangers (suspension): pairs of points, drawn as thin lines once the cables are up. */
  hangers: V3[]
  /** Where the span begins and ends (world), for the readout. */
  a: V3
  b: V3
  /** A cable car's route (the tramway): its cabins shuttle along these points. */
  cabins?: V3[]
}

const STEEL = '#6f7880'
const DARK_STEEL = '#4a4540'
const STONE = '#b3a589'
const DECK = '#5a5e63'
const RAIL = '#7b838a'
const CABLE = '#6b7278'
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/**
 * The water crossing nearest the point: walk along the line both ways, collect
 * the stretches that are water, merge the ones separated by less than `merge`,
 * and take the group nearest the middle. Returns the line's two ends (parameter t
 * along it, in world units from the point), or null if the line never meets water.
 */
function crossing(x: number, z: number, dx: number, dz: number, merge: number): [number, number] | null {
  const R = 16
  const step = 0.25
  const wet: [number, number][] = []
  let from: number | null = null
  for (let t = -R; t <= R; t += step) {
    const water = coastDistance(x + dx * t, z + dz * t) < 0
    if (water && from === null) from = t
    if (!water && from !== null) {
      wet.push([from, t])
      from = null
    }
  }
  if (from !== null) wet.push([from, R])
  if (wet.length === 0) return null
  // merge stretches of water with a short gap of land between them
  const groups: [number, number][] = []
  for (const w of wet) {
    const last = groups[groups.length - 1]
    if (last && w[0] - last[1] < merge) last[1] = w[1]
    else groups.push([w[0], w[1]])
  }
  let best = groups[0]
  let bd = Infinity
  for (const g of groups) {
    const d = g[0] <= 0 && g[1] >= 0 ? 0 : Math.min(Math.abs(g[0]), Math.abs(g[1]))
    if (d < bd) {
      bd = d
      best = g
    }
  }
  return best
}

/** A bridge's deck line and the parts that make it, for one terrain and scale. */
function plan(
  s: { name: string; kind: BridgeKind; start: number; built: number; widthM: number; clearM: number; towerM: number },
  a: [number, number],
  b: [number, number],
  params: TerrainParams,
  k: number,
): BridgePlan {
  // heights are enlarged like trees and buildings (m() is metres → world units); widths are real
  const H = (metres: number) => m(metres) * k
  const ground = (x: number, z: number) => height(x, z, params)
  const L = Math.hypot(b[0] - a[0], b[1] - a[1])
  const dir: [number, number] = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]
  const side: [number, number] = [-dir[1], dir[0]]
  const wide = Math.max(0.5, m(s.widthM))
  const clear = H(s.clearM)
  const thick = Math.max(0.12, H(3))
  const yA = ground(a[0], a[1]) + 0.05
  const yB = ground(b[0], b[1]) + 0.05
  const parts: Part[] = []
  const hangers: V3[] = []

  const pt = (t: number, across = 0): [number, number] => [
    a[0] + dir[0] * L * t + side[0] * across,
    a[1] + dir[1] * L * t + side[1] * across,
  ]
  // deck height: from the bank at each end, rising along a ramp to the full clearance
  const deckY = (t: number) =>
    yA + (yB - yA) * t + clear * smooth(0, s.kind === 'cantilever' ? 0.08 : 0.22, Math.min(t, 1 - t))
  const at3 = (t: number, across = 0, up = 0): V3 => {
    const [x, z] = pt(t, across)
    return [x, deckY(t) + up, z]
  }

  // deck sections, laid out from both banks toward the middle
  const nDeck = Math.max(6, Math.round(L / 1.4))
  for (let i = 0; i < nDeck; i++) {
    const t0 = i / nDeck
    const t1 = (i + 1) / nDeck
    const mid = (t0 + t1) / 2
    const fromEnd = Math.min(mid, 1 - mid) * 2 // 0 at a bank, 1 at the middle
    parts.push({
      from: at3(t0, 0, -thick / 2),
      to: at3(t1, 0, -thick / 2),
      thick,
      wide,
      color: DECK,
      appear: 0.3 + 0.62 * fromEnd,
      span: 0.06,
    })
  }

  // piers: columns to the bed or the ground
  const pier = (t: number, across: number, appear: number, w = 0.35) => {
    const [x, z] = pt(t, across)
    parts.push({
      from: [x, ground(x, z) - 0.3, z],
      to: [x, deckY(t) - thick, z],
      thick: w,
      wide: w,
      color: s.kind === 'highway' ? '#7b7b78' : STONE,
      appear,
      span: 0.25,
      rise: true,
    })
  }
  const nPiers = Math.max(2, Math.round(L / 9))
  for (let i = 1; i < nPiers; i++) {
    const t = i / nPiers
    // suspension and lift bridges stand on their towers; the others on piers along the way
    if ((s.kind === 'suspension' || s.kind === 'lift') && t > 0.2 && t < 0.8) continue
    pier(t, 0, 0.02 + 0.15 * (i % 2))
  }

  if (s.kind === 'suspension' || s.kind === 'lift') {
    const t1 = 0.24
    const t2 = 0.76
    const top = H(s.towerM)
    const leg = Math.max(0.3, wide * 0.18)
    for (const t of [t1, t2]) {
      for (const sgn of [-1, 1]) {
        const [x, z] = pt(t, sgn * wide * 0.42)
        const g = ground(x, z) - 0.3
        parts.push({
          from: [x, g, z],
          to: [x, deckY(t) + top, z],
          thick: leg,
          wide: leg,
          color: s.kind === 'lift' ? STEEL : STONE,
          appear: 0,
          span: 0.4,
          rise: true,
        })
      }
      // a cross-beam between the legs at the top, and one at the deck
      parts.push({
        from: at3(t, -wide * 0.42, top - leg),
        to: at3(t, wide * 0.42, top - leg),
        thick: leg * 0.8,
        wide: leg * 0.8,
        color: s.kind === 'lift' ? STEEL : STONE,
        appear: 0.4,
        span: 0.05,
      })
    }
    if (s.kind === 'suspension') {
      // two main cables: straight down each side span to the bank, a sag between the towers
      const topY = deckY(t1) + top
      const cableY = (t: number) => {
        if (t < t1) return yA + (topY - yA) * (t / t1) * 1
        if (t > t2) return yB + (topY - yB) * ((1 - t) / (1 - t2))
        const u = (t - t1) / (t2 - t1)
        const low = deckY(0.5) + H(5)
        return topY - (topY - low) * (1 - (2 * u - 1) ** 2)
      }
      for (const sgn of [-1, 1]) {
        const n = 30
        for (let i = 0; i < n; i++) {
          const t0 = i / n
          const t1c = (i + 1) / n
          const [x0, z0] = pt(t0, sgn * wide * 0.42)
          const [x1, z1] = pt(t1c, sgn * wide * 0.42)
          parts.push({
            from: [x0, cableY(t0), z0],
            to: [x1, cableY(t1c), z1],
            thick: 0.13,
            wide: 0.13,
            color: CABLE,
            appear: 0.5 + 0.3 * (1 - Math.min(t0, 1 - t0) * 2),
            span: 0.05,
          })
        }
        // hangers from the main span's cable to the deck
        for (let i = 0; i <= 18; i++) {
          const t = t1 + ((t2 - t1) * i) / 18
          const [x, z] = pt(t, sgn * wide * 0.42)
          hangers.push([x, cableY(t), z], [x, deckY(t), z])
        }
      }
    } else {
      // a lift bridge: a truss span between the towers
      parts.push({
        from: at3(t1, -wide * 0.42, H(s.towerM) - 0.3),
        to: at3(t2, -wide * 0.42, H(s.towerM) - 0.3),
        thick: 0.18,
        wide: 0.18,
        color: STEEL,
        appear: 0.5,
        span: 0.2,
      })
      parts.push({
        from: at3(t1, wide * 0.42, H(s.towerM) - 0.3),
        to: at3(t2, wide * 0.42, H(s.towerM) - 0.3),
        thick: 0.18,
        wide: 0.18,
        color: STEEL,
        appear: 0.5,
        span: 0.2,
      })
    }
  }

  if (s.kind === 'cantilever' || s.kind === 'arch') {
    // a steel truss along each side: a top chord rising to a crown, posts down to the deck
    const crown = H(s.towerM)
    const heavy = s.kind === 'cantilever' // the Queensboro is a deep, dark steel truss
    const profile = (t: number) =>
      s.kind === 'arch'
        ? crown * 4 * t * (1 - t)
        : crown *
          (0.18 +
            0.82 * Math.max(Math.exp(-(((t - 0.22) / 0.1) ** 2)), Math.exp(-(((t - 0.78) / 0.1) ** 2))) +
            0.12 * Math.sin(Math.PI * t))
    const n = Math.max(12, Math.round(L / 1.6))
    for (const sgn of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const t0 = i / n
        const t1 = (i + 1) / n
        const fromEnd = Math.min((t0 + t1) / 2, 1 - (t0 + t1) / 2) * 2
        const appear = 0.35 + 0.55 * fromEnd
        parts.push({
          from: at3(t0, sgn * wide * 0.5, profile(t0)),
          to: at3(t1, sgn * wide * 0.5, profile(t1)),
          thick: heavy ? 0.42 : 0.16,
          wide: heavy ? 0.42 : 0.16,
          color: heavy ? DARK_STEEL : STEEL,
          appear,
          span: 0.05,
        })
        // a post from the deck to the chord, and a diagonal to the next one
        parts.push({
          from: at3(t0, sgn * wide * 0.5, 0),
          to: at3(t0, sgn * wide * 0.5, profile(t0)),
          thick: heavy ? 0.2 : 0.09,
          wide: heavy ? 0.2 : 0.09,
          color: heavy ? DARK_STEEL : RAIL,
          appear,
          span: 0.05,
        })
        parts.push({
          from: at3(t0, sgn * wide * 0.5, 0),
          to: at3(t1, sgn * wide * 0.5, profile(t1)),
          thick: heavy ? 0.14 : 0.07,
          wide: heavy ? 0.14 : 0.07,
          color: heavy ? DARK_STEEL : RAIL,
          appear,
          span: 0.05,
        })
      }
    }
  }

  return {
    name: s.name,
    kind: s.kind,
    start: s.start,
    built: s.built,
    parts,
    hangers,
    a: [a[0], yA, a[1]],
    b: [b[0], yB, b[1]],
  }
}

/**
 * The Roosevelt Island Tramway (1976): a cable car from Manhattan's Second Avenue
 * over the West Channel to the island, on one support tower on the Manhattan bank.
 * Positions follow the reference photographs (world/island.ts).
 */
function tramway(params: TerrainParams, k: number): BridgePlan {
  const H = (metres: number) => m(metres) * k
  const ground = (x: number, z: number) => height(x, z, params)
  const [ax, az] = islandXZ(-17.3, -29.5) // the Manhattan terminal
  const [tx, tz] = islandXZ(-16.2, -15.5) // the support tower
  const [bx, bz] = islandXZ(-15.1, -2.0) // the island station
  const top = (x: number, z: number, metres: number): V3 => [x, ground(x, z) + H(metres), z]
  const A = top(ax, az, 18)
  const T = top(tx, tz, 76)
  const Bt = top(bx, bz, 14)
  const parts: Part[] = []
  // the terminal building, and the tower: four legs that lean together
  const box = (x: number, z: number, w: number, hgt: number, color: string, appear: number): Part => ({
    from: [x, ground(x, z) - 0.2, z],
    to: [x, ground(x, z) + H(hgt), z],
    thick: w,
    wide: w,
    color,
    appear,
    span: 0.3,
    rise: true,
  })
  parts.push(box(ax, az, m(32), 18, '#7d868c', 0))
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = tx + dx * 0.5
    const z = tz + dz * 0.5
    parts.push({
      from: [x, ground(x, z) - 0.2, z],
      to: [tx + dx * 0.12, T[1], tz + dz * 0.12],
      thick: 0.14,
      wide: 0.14,
      color: STEEL,
      appear: 0,
      span: 0.5,
      rise: true,
    })
  }
  // two cables, side by side, from the terminal over the tower to the island
  for (const off of [-0.25, 0.25]) {
    const line = (p: V3, q: V3, appear: number) =>
      parts.push({
        from: [p[0] + off, p[1], p[2]],
        to: [q[0] + off, q[1], q[2]],
        thick: 0.06,
        wide: 0.06,
        color: CABLE,
        appear,
        span: 0.2,
      })
    line(A, T, 0.55)
    line(T, Bt, 0.7)
  }
  return {
    name: 'Roosevelt Island Tramway',
    kind: 'highway',
    start: 1974,
    built: 1976,
    parts,
    hangers: [],
    a: A,
    b: Bt,
    cabins: [A, T, Bt],
  }
}

/** Every crossing, for the given terrain and scale. Rebuilt only when the terrain or scale changes. */
export function planBridges(params: TerrainParams, scale: ScaleMode): BridgePlan[] {
  const k = EXAGGERATION[scale].objects
  const out: BridgePlan[] = []
  for (const s of SPECS) {
    const [x, z] = at(s.lat, s.lon)
    const th = (s.bearing * Math.PI) / 180
    const dx = Math.sin(th)
    const dz = -Math.cos(th) // +z is south
    const span = crossing(x, z, dx, dz, s.merge ?? 0)
    if (!span) continue // the coordinates didn't come near water: skip rather than guess
    const ext = 3 // a ramp onto each bank
    const a: [number, number] = [x + dx * (span[0] - ext), z + dz * (span[0] - ext)]
    const b: [number, number] = [x + dx * (span[1] + ext), z + dz * (span[1] + ext)]
    out.push(plan(s, a, b, params, k))
  }
  out.push(tramway(params, k))
  // the Triborough's two arms are joined across Randalls Island by a viaduct
  const man = out.find((p) => p.name === 'Triborough Bridge (Manhattan)')
  const qns = out.find((p) => p.name === 'Triborough Bridge (Queens)')
  if (man && qns) {
    out.push(
      plan(
        {
          name: 'Triborough viaduct (Randalls Island)',
          kind: 'highway',
          start: 1929,
          built: 1936,
          widthM: 28,
          clearM: 14,
          towerM: 0,
        },
        [man.b[0], man.b[2]],
        [qns.a[0], qns.a[2]],
        params,
        k,
      ),
    )
  }
  return out.sort((p, q) => p.built - q.built)
}

/** How many of the crossings are open by `year`. */
export function bridgesOpenBy(year: number): number {
  return SPECS.filter((s) => s.built <= year).length
}
