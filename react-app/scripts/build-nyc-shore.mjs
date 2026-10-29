// Builds src/map/world/nycShore.json — the real New York City shoreline, in the
// project's own coordinates.
//
//   node scripts/build-nyc-shore.mjs [nybb.json]
//
// Source: NYC Department of City Planning, "Borough Boundaries (Clipped to
// Shoreline)" (public data), via its ArcGIS feature service. With no argument
// the script downloads it; pass a saved copy of the response to work offline.
//
// What it does:
//   1. Reads every borough polygon (lon/lat degrees).
//   2. Projects to local metres around Roosevelt Island and divides by
//      METERS_PER_UNIT, so 1 unit = 33.5 m. Roosevelt Island's centre is the
//      origin; +x is east, +z is SOUTH (so north is up the screen, -z).
//   3. Clips every ring to the map's rectangle (with a margin) and simplifies it.
//   4. Splits Roosevelt Island off from everything else, because the app can
//      widen the island on its own (the "readable" scale) without closing the
//      river channels beside it.
//   5. Writes whole-number coordinates (units × 100) to keep the file small.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '../src/map/world/nycShore.json')
const URL =
  'https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/nybb/FeatureServer/5/query' +
  '?where=1%3D1&outFields=*&outSR=4326&f=json'

const METERS_PER_UNIT = 33.5
const EARTH_M_PER_DEG = 111194.93 // metres per degree of latitude (R = 6,371,008.77 m)

// Roosevelt Island's centre — the origin of the local frame
const LAT0 = 40.7619
const LON0 = -73.9499

// The map's extent in degrees: Manhattan with Roosevelt Island, the East River,
// the Hudson as far as its middle, and the neighbouring shores of Queens, the
// Bronx, Brooklyn and Staten Island. (New Jersey isn't in the city's data.)
const BOX = { west: -74.045, east: -73.8, south: 40.655, north: 40.885 }
const MARGIN = 30 // units beyond the map to keep, so edges never show a seam

const kx = (EARTH_M_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)) / METERS_PER_UNIT
const kz = EARTH_M_PER_DEG / METERS_PER_UNIT
const project = ([lon, lat]) => [(lon - LON0) * kx, -(lat - LAT0) * kz]

const bounds = {
  x0: (BOX.west - LON0) * kx,
  x1: (BOX.east - LON0) * kx,
  z0: -(BOX.north - LAT0) * kz,
  z1: -(BOX.south - LAT0) * kz,
}

// ---------------------------------------------------------------- geometry --

const ringArea = (r) => {
  let a = 0
  for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
  return a / 2
}
const ringCentroid = (r) => {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < r.length - 1; i++) {
    const c = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    a += c; cx += (r[i][0] + r[i + 1][0]) * c; cy += (r[i][1] + r[i + 1][1]) * c
  }
  return [cx / (3 * a), cy / (3 * a)]
}

// Sutherland–Hodgman: clip a ring against one edge of the rectangle, four times
function clipRing(ring, r) {
  const edges = [
    [(p) => p[0] >= r.x0, (a, b) => [r.x0, a[1] + ((b[1] - a[1]) * (r.x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= r.x1, (a, b) => [r.x1, a[1] + ((b[1] - a[1]) * (r.x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= r.z0, (a, b) => [a[0] + ((b[0] - a[0]) * (r.z0 - a[1])) / (b[1] - a[1]), r.z0]],
    [(p) => p[1] <= r.z1, (a, b) => [a[0] + ((b[0] - a[0]) * (r.z1 - a[1])) / (b[1] - a[1]), r.z1]],
  ]
  let pts = ring.slice(0, -1)
  for (const [inside, cut] of edges) {
    const next = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]
      if (inside(a)) { next.push(a); if (!inside(b)) next.push(cut(a, b)) }
      else if (inside(b)) next.push(cut(a, b))
    }
    pts = next
    if (pts.length < 3) return null
  }
  return [...pts, pts[0]]
}

// Douglas–Peucker simplification (iterative, so huge rings can't overflow the stack)
function simplify(ring, tol) {
  const pts = ring.slice(0, -1)
  if (pts.length <= 8) return ring
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  const dist2 = (p, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const l2 = dx * dx + dz * dz
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 : 0
    t = Math.max(0, Math.min(1, t))
    const ex = a[0] + t * dx - p[0], ez = a[1] + t * dz - p[1]
    return ex * ex + ez * ez
  }
  while (stack.length) {
    const [s, e] = stack.pop()
    let worst = 0, at = -1
    for (let i = s + 1; i < e; i++) {
      const d = dist2(pts[i], pts[s], pts[e])
      if (d > worst) { worst = d; at = i }
    }
    if (at >= 0 && worst > tol * tol) { keep[at] = 1; stack.push([s, at], [at, e]) }
  }
  const out = pts.filter((_, i) => keep[i])
  return out.length >= 3 ? [...out, out[0]] : ring
}

// ------------------------------------------------------------------- build --

let raw
if (process.argv[2]) raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
else {
  console.log('Downloading borough boundaries…')
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
  raw = await res.json()
}
if (!raw.features) throw new Error('Unexpected response: no features')

const rect = {
  x0: bounds.x0 - MARGIN, x1: bounds.x1 + MARGIN, z0: bounds.z0 - MARGIN, z1: bounds.z1 + MARGIN,
}

let islandRing = null
const rest = []
for (const f of raw.features) {
  for (const ring of f.geometry.rings) {
    if (ring.length < 4) continue
    const [clon, clat] = ringCentroid(ring)
    const km2 = Math.abs(ringArea(ring)) * 111.195 * 111.195 * Math.cos((LAT0 * Math.PI) / 180)
    // Roosevelt Island: a Manhattan ring of ~0.59 km² centred on the origin
    const isIsland =
      f.attributes.BoroName === 'Manhattan' &&
      Math.hypot(clon - LON0, clat - LAT0) < 0.004 &&
      km2 > 0.4 && km2 < 0.8
    const projected = ring.map(project)
    if (isIsland) { islandRing = projected; continue }
    const clipped = clipRing(projected, rect)
    if (!clipped) continue
    const simple = simplify(clipped, 0.15) // 5 m
    if (simple.length < 4) continue
    rest.push(simple)
  }
}
if (!islandRing) throw new Error('Could not find Roosevelt Island in the data')
const island = simplify(islandRing, 0.03) // 1 m

const pack = (ring) => ring.slice(0, -1).flatMap(([x, z]) => [Math.round(x * 100), Math.round(z * 100)])
const out = {
  meta: {
    source: 'NYC Department of City Planning — Borough Boundaries (Clipped to Shoreline)',
    originLat: LAT0,
    originLon: LON0,
    metersPerUnit: METERS_PER_UNIT,
    bounds,
    precision: 100, // coordinates are whole numbers of 1/100 unit
  },
  island: [pack(island)],
  rest: rest.map(pack),
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out))

const pts = out.rest.reduce((n, r) => n + r.length / 2, 0)
const xs = island.map((p) => p[0]), zs = island.map((p) => p[1])
console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`)
console.log(`  map: x ${bounds.x0.toFixed(0)}…${bounds.x1.toFixed(0)}, z ${bounds.z0.toFixed(0)}…${bounds.z1.toFixed(0)} units`)
console.log(`  island: ${island.length - 1} points, x ${Math.min(...xs).toFixed(1)}…${Math.max(...xs).toFixed(1)}, z ${Math.min(...zs).toFixed(1)}…${Math.max(...zs).toFixed(1)}`)
console.log(`  rest: ${rest.length} rings, ${pts} points`)
