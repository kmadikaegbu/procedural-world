import { StreetKind, type RealStreets } from '../city/realStreets'
import { drawnWidth, onIslandBuilding, type Road } from '../city/layout'
import { islandEdges, islandSU } from '../world/island'

/**
 * THE ISLAND'S REAL STREETS, AS PATHS: the streets the map draws on Roosevelt
 * Island (city/layout.ts lays them from the city's Centerline data), joined
 * into a network the simulation can find its way along. Cars and buses drive
 * the streets on the right; people walk their pavements and the footpaths.
 * Where a building stands over a street the map leaves it out, and so does
 * this: nobody drives through a building.
 *
 * Everything is in the island's frame (s along it, u across it, world units).
 */

type P = [number, number]

interface Edge {
  to: number
  len: number
  /** Drawn width, world units. */
  width: number
  /** Cars may use it (a street or a ramp; footpaths are for walking). */
  car: boolean
}

interface Net {
  nodes: P[]
  edges: Edge[][]
  /** Segments, for finding the nearest point on the network. */
  segs: { a: number; b: number; width: number; car: boolean }[]
  /**
   * The nodes of the biggest connected network, for driving and for walking.
   * A few streets the map draws don't join it (a campus drive cut off where a
   * building stands over it): trips keep to the network that does join.
   */
  main: { car: Uint8Array; walk: Uint8Array }
}

let net: Net | null = null

/** How far from the island's edges a street may lie and still count as the island's. */
const MARGIN = 0.2

function onIsland([s, u]: P): boolean {
  if (s < -48 || s > 44) return false
  const e = islandEdges(Math.round(s))
  return !!e && u > e[0] - MARGIN && u < e[1] + MARGIN
}

/** Build the network from the city's streets (once they've loaded). */
export function setIslandStreets(streets: RealStreets) {
  const nodes: P[] = []
  const edges: Edge[][] = []
  const segs: Net['segs'] = []
  const ids = new Map<string, number>()
  const node = (x: number, z: number) => {
    const key = `${x},${z}`
    let id = ids.get(key)
    if (id === undefined) {
      id = nodes.length
      ids.set(key, id)
      nodes.push(islandSU(x, z))
      edges.push([])
    }
    return id
  }
  for (let i = 0; i < streets.count; i++) {
    const kind = streets.kind[i] as StreetKind
    if (kind === StreetKind.Highway) continue
    const width = drawnWidth(kind, streets.width[i]) / 33.5
    const car = kind !== StreetKind.Path
    for (let v = streets.start[i]; v < streets.start[i + 1] - 1; v++) {
      const x0 = streets.x[v]
      const z0 = streets.z[v]
      const x1 = streets.x[v + 1]
      const z1 = streets.z[v + 1]
      if (!onIsland(islandSU(x0, z0)) || !onIsland(islandSU(x1, z1))) continue
      // the map leaves out a piece under a building (layout.ts): so does this
      if (onIslandBuilding((x0 + x1) / 2, (z0 + z1) / 2)) continue
      const a = node(x0, z0)
      const b = node(x1, z1)
      if (a === b) continue
      const len = Math.hypot(nodes[b][0] - nodes[a][0], nodes[b][1] - nodes[a][1])
      edges[a].push({ to: b, len, width, car })
      edges[b].push({ to: a, len, width, car })
      segs.push({ a, b, width, car })
    }
  }
  net = segs.length ? { nodes, edges, segs, main: { car: biggest(nodes, edges, true), walk: biggest(nodes, edges, false) } } : null
  paths.clear()
}

export const islandStreetsReady = () => net !== null

/** The nodes of the connected network with the most street in it. */
function biggest(nodes: P[], edges: Edge[][], car: boolean): Uint8Array {
  const label = new Int32Array(nodes.length).fill(-1)
  const length: number[] = []
  for (let start = 0; start < nodes.length; start++) {
    if (label[start] >= 0) continue
    const id = length.length
    length.push(0)
    label[start] = id
    const stack = [start]
    while (stack.length) {
      const a = stack.pop()!
      for (const e of edges[a]) {
        if (car && !e.car) continue
        length[id] += e.len / 2 // each edge is met from both ends
        if (label[e.to] < 0) {
          label[e.to] = id
          stack.push(e.to)
        }
      }
    }
  }
  const best = length.indexOf(Math.max(...length))
  return Uint8Array.from(label, (l) => (l === best ? 1 : 0))
}

/** The nearest point on the network to `p`: on which segment, and how far along it. */
function nearest(n: Net, [s, u]: P, car: boolean) {
  let best = { seg: -1, t: 0, d: Infinity, at: [s, u] as P }
  const main = car ? n.main.car : n.main.walk
  n.segs.forEach((g, k) => {
    if ((car && !g.car) || !main[g.a]) return
    const [as, au] = n.nodes[g.a]
    const [bs, bu] = n.nodes[g.b]
    const ds = bs - as
    const du = bu - au
    const t = Math.max(0, Math.min(1, ((s - as) * ds + (u - au) * du) / (ds * ds + du * du)))
    const ps = as + ds * t
    const pu = au + du * t
    const d = Math.hypot(s - ps, u - pu)
    if (d < best.d) best = { seg: k, t, d, at: [ps, pu] }
  })
  return best
}

/** Shortest paths from one node, kept: a walk or drive from the same corner reuses them. */
const paths = new Map<string, { dist: Float64Array; prev: Int32Array }>()

function from(n: Net, src: number, car: boolean) {
  const key = `${src}:${car ? 'c' : 'w'}`
  const hit = paths.get(key)
  if (hit) return hit
  const N = n.nodes.length
  const dist = new Float64Array(N).fill(Infinity)
  const prev = new Int32Array(N).fill(-1)
  const done = new Uint8Array(N)
  dist[src] = 0
  // a binary heap of [distance, node]
  const heap: [number, number][] = [[0, src]]
  const push = (x: [number, number]) => {
    heap.push(x)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [d, a] = pop()
    if (done[a]) continue
    done[a] = 1
    for (const e of n.edges[a]) {
      if (car && !e.car) continue
      const nd = d + e.len
      if (nd < dist[e.to]) {
        dist[e.to] = nd
        prev[e.to] = a
        push([nd, e.to])
      }
    }
  }
  const out = { dist, prev }
  paths.set(key, out)
  return out
}

/** Widths along a centre line: each point's is the widest street meeting there. */
interface Line {
  pts: P[]
  width: number[]
}

/** The centre line from `a` to `b` along the network, or null if they don't connect. */
function centreLine(n: Net, a: P, b: P, car: boolean): Line | null {
  const A = nearest(n, a, car)
  const B = nearest(n, b, car)
  if (A.seg < 0 || B.seg < 0) return null
  const ga = n.segs[A.seg]
  const gb = n.segs[B.seg]
  if (A.seg === B.seg) return { pts: [A.at, B.at], width: [ga.width, ga.width] }
  // from either end of A's segment to either end of B's
  let best: { d: number; ea: number; eb: number } | null = null
  for (const ea of [ga.a, ga.b]) {
    const sp = from(n, ea, car)
    const da = Math.hypot(n.nodes[ea][0] - A.at[0], n.nodes[ea][1] - A.at[1])
    for (const eb of [gb.a, gb.b]) {
      const db = Math.hypot(n.nodes[eb][0] - B.at[0], n.nodes[eb][1] - B.at[1])
      const d = da + sp.dist[eb] + db
      if (Number.isFinite(d) && (!best || d < best.d)) best = { d, ea, eb }
    }
  }
  if (!best) return null
  const sp = from(n, best.ea, car)
  const chain: number[] = []
  for (let k = best.eb; k >= 0; k = sp.prev[k]) {
    chain.push(k)
    if (k === best.ea) break
  }
  chain.reverse()
  const widthAt = (k: number) => Math.max(...n.edges[k].filter((e) => !car || e.car).map((e) => e.width))
  return {
    pts: [A.at, ...chain.map((k) => n.nodes[k]), B.at],
    width: [ga.width, ...chain.map(widthAt), gb.width],
  }
}

/**
 * Move a centre line sideways by `side` of each street's width (positive is to
 * the right of the way of travel). At a bend the two offset lines meet halfway.
 */
function offset(line: Line, side: number): P[] {
  const { pts, width } = line
  const out: P[] = []
  const right = (k: number): P => {
    const ds = pts[k + 1][0] - pts[k][0]
    const du = pts[k + 1][1] - pts[k][1]
    const l = Math.hypot(ds, du) || 1
    // right of travel along +s is +u (as the simulation drives)
    return [-du / l, ds / l]
  }
  for (let k = 0; k < pts.length; k++) {
    const r0 = k > 0 ? right(k - 1) : null
    const r1 = k < pts.length - 1 ? right(k) : null
    let rs = (r0?.[0] ?? 0) + (r1?.[0] ?? 0)
    let ru = (r0?.[1] ?? 0) + (r1?.[1] ?? 0)
    const l = Math.hypot(rs, ru)
    if (l < 1e-6) continue // a U-turn on the spot
    rs /= l
    ru /= l
    const o = width[k] * side
    out.push([pts[k][0] + rs * o, pts[k][1] + ru * o])
  }
  // drop steps too short to matter
  return out.filter((p, k) => k === 0 || Math.hypot(p[0] - out[k - 1][0], p[1] - out[k - 1][1]) > 1e-3)
}

/** The middle of a lane, as a share of the drawn width (city/City.tsx: the roadway is the middle 72%, pavements either side). */
const LANE = 0.18
/** The middle of a pavement, likewise. */
const PAVEMENT = 0.43

/**
 * A drive on the island's streets, on the right, from `a` to `b`. Both ends are
 * on the street (the kerb nearest each point). Null until the streets load, or
 * if the two don't connect.
 */
export function streetDrive(a: P, b: P): P[] | null {
  if (!net) return null
  const line = centreLine(net, a, b, true)
  return line ? offset(line, LANE) : null
}

/**
 * A walk from `a` to `b`: across to the nearest pavement or footpath, along the
 * network, and over to `b`. `side` (±1) keeps each person to one pavement, as
 * they face. Null until the streets load, or if the two don't connect.
 */
export function streetWalk(a: P, b: P, side: number): P[] | null {
  if (!net) return null
  const line = centreLine(net, a, b, false)
  if (!line) return null
  return [a, ...offset(line, Math.sign(side || 1) * PAVEMENT), b]
}

// --- what's underfoot ------------------------------------------------------------------

/** The map's flat ribbons on and around the island (streets, paths, courts), on a grid. */
let under: { cells: Map<number, Road[]>; roads: Road[] } | null = null
const CELL = 0.5
const cellKey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096)

/** Hand over the map's ribbons (city/layout.ts getCity().roads); those near the island are kept. */
export function setIslandGround(roads: Road[], near: (x: number, z: number) => boolean) {
  if (under && under.roads === roads) return
  const cells = new Map<number, Road[]>()
  for (const r of roads) {
    if (!near(r.x, r.z)) continue
    const reach = Math.hypot(r.len, r.width) / 2
    for (let i = Math.floor((r.x - reach) / CELL); i <= Math.floor((r.x + reach) / CELL); i++)
      for (let j = Math.floor((r.z - reach) / CELL); j <= Math.floor((r.z + reach) / CELL); j++) {
        const k = cellKey(i, j)
        const list = cells.get(k)
        if (list) list.push(r)
        else cells.set(k, [r])
      }
  }
  under = { cells, roads }
}

/**
 * Whether the map draws a ribbon (street, path, court) under the world point
 * (x, z), which stands 0.1 above the ground there (city/City.tsx).
 */
export function onRibbon(x: number, z: number): boolean {
  const list = under?.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)))
  if (!list) return false
  for (const r of list) {
    // a ribbon's own frame: along (cos rot, -sin rot)
    const c = Math.cos(r.rot)
    const s = -Math.sin(r.rot)
    const dx = x - r.x
    const dz = z - r.z
    if (Math.abs(dx * c + dz * s) <= r.len / 2 && Math.abs(-dx * s + dz * c) <= r.width / 2) return true
  }
  return false
}
