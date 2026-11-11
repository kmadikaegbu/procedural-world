// Builds public/data/nyc-buildings.bin — every real building on the map, with the
// year it was built and its roof height, in the project's own coordinates.
//
//   node scripts/build-nyc-buildings.mjs [cache-dir]
//
// Source: NYC Office of Technology and Innovation, "Building Footprints" (NYC
// Open Data, dataset 5zhs-2jue): an outline, a roof height above the ground and
// a construction year for every building in the city. With a cache directory the
// raw pages are saved there and reused, so the script can be re-run offline.
//
// What it does:
//   1. Downloads every footprint inside the map's box (the same box as the
//      shoreline, scripts/build-nyc-shore.mjs), about half a million.
//   2. Leaves out what isn't a building you'd see from the air: garages,
//      skybridges, canopies, tanks, placeholders, and sheds under ~20 m².
//   3. Projects each outline to world units (1 unit = 33.5 m, Roosevelt Island's
//      centre at the origin, +x east, +z south: see src/map/world/project.ts)
//      and reduces it to the smallest rectangle that holds it. The app draws
//      every building as a box, so a rectangle is all it needs.
//   4. Writes the rectangles as a small binary file, one column per field, so
//      the browser can read half a million buildings without parsing JSON.
//
// The file starts with a 16-byte header: "NYCB", a version (uint32), the count
// (uint32), and 4 spare bytes. Then the columns, each `count` long:
//   x, z    int16   centre, in 1/64 world units
//   w, d    uint16  the rectangle's two sides, in 1/256 world units
//   h       uint16  roof height above the ground, in decimetres (0 = unknown)
//   year    uint16  construction year (0 = unknown)
//   rot     uint8   the w side's angle from east, 0..π in 256 steps

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '../public/data/nyc-buildings.bin')
const API = 'https://data.cityofnewyork.us/resource/5zhs-2jue.json'
const PAGE = 50000

// the map's extent, as in build-nyc-shore.mjs
const BOX = { west: -74.045, east: -73.8, south: 40.655, north: 40.885 }

// the projection, as in src/map/world/project.ts
const LAT0 = 40.7619
const LON0 = -73.9499
const KX = (111195 * Math.cos((LAT0 * Math.PI) / 180)) / 33.5
const KZ = 111195 / 33.5
const project = ([lon, lat]) => [(lon - LON0) * KX, -(lat - LAT0) * KZ]

/**
 * Feature codes kept: 2100 building, 5100 under construction, 1004 auxiliary
 * structure, 1006 cantilevered building. Left out: 5110 garage, 2110 skybridge
 * (it floats above the street), 1001 canopy, 1002 storage tank, 1003 placeholder,
 * 1005 temporary structure, 1000 shed.
 */
const KEEP = new Set(['2100', '5100', '1004', '1006'])
/** Smallest footprint kept, m²: sheds and kiosks go. (Measured from the outline: the data's own shape_area is in other units.) */
const MIN_AREA_M2 = 20
const FEET = 0.3048
const M_PER_UNIT = 33.5

/** Area of a ring of [x, z] points (shoelace), in the points' units squared. */
function ringArea(r) {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]
  return Math.abs(a) / 2
}

// ---------------------------------------------------------------- download --

async function page(offset, cacheDir) {
  const file = cacheDir && path.join(cacheDir, `footprints-${offset}.json`)
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  const url = new URL(API)
  url.searchParams.set('$select', 'the_geom,construction_year,height_roof,feature_code')
  url.searchParams.set(
    '$where',
    `within_box(the_geom,${BOX.north},${BOX.west},${BOX.south},${BOX.east})`,
  )
  url.searchParams.set('$order', 'objectid')
  url.searchParams.set('$limit', String(PAGE))
  url.searchParams.set('$offset', String(offset))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const rows = await res.json()
  if (file) fs.writeFileSync(file, JSON.stringify(rows))
  return rows
}

// ---------------------------------------------------------------- geometry --

/** Convex hull (Andrew's monotone chain), counter-clockwise, no repeated point. */
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/**
 * The smallest-area rectangle around a set of points. One of its sides always
 * lies along an edge of the convex hull, so it's enough to try each edge.
 */
function minRect(points) {
  const h = hull(points)
  if (h.length < 3) return null
  let best = null
  for (let i = 0; i < h.length; i++) {
    const a = h[i]
    const b = h[(i + 1) % h.length]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len === 0) continue
    const ux = (b[0] - a[0]) / len
    const uz = (b[1] - a[1]) / len
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
    for (const [x, z] of h) {
      const u = x * ux + z * uz
      const v = -x * uz + z * ux
      u0 = Math.min(u0, u); u1 = Math.max(u1, u)
      v0 = Math.min(v0, v); v1 = Math.max(v1, v)
    }
    const area = (u1 - u0) * (v1 - v0)
    if (!best || area < best.area) {
      const uc = (u0 + u1) / 2
      const vc = (v0 + v1) / 2
      best = { area, x: uc * ux - vc * uz, z: uc * uz + vc * ux, w: u1 - u0, d: v1 - v0, ang: Math.atan2(uz, ux) }
    }
  }
  return best
}

// ---------------------------------------------------------------- main --

async function main() {
  const cacheDir = process.argv[2]
  if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true })

  const out = []
  const skipped = { feature: 0, small: 0, shape: 0 }
  for (let offset = 0; ; offset += PAGE) {
    const rows = await page(offset, cacheDir)
    process.stdout.write(`\r${offset + rows.length} footprints read`)
    for (const row of rows) {
      if (!KEEP.has(String(row.feature_code))) { skipped.feature++; continue }
      // every corner of every part (a few buildings come in more than one piece)
      const rings = row.the_geom.coordinates.map((poly) => poly[0].map(project))
      const area = rings.reduce((sum, r) => sum + ringArea(r), 0) * M_PER_UNIT * M_PER_UNIT
      if (area < MIN_AREA_M2) { skipped.small++; continue }
      const pts = rings.flat()
      const r = minRect(pts)
      if (!r) { skipped.shape++; continue }
      // the angle only matters modulo π: a rectangle turned half round is the same
      let ang = r.ang % Math.PI
      if (ang < 0) ang += Math.PI
      out.push({
        x: r.x,
        z: r.z,
        w: r.w,
        d: r.d,
        h: Math.max(0, Number(row.height_roof) || 0) * FEET,
        year: Number(row.construction_year) || 0,
        ang,
      })
    }
    if (rows.length < PAGE) break
  }
  process.stdout.write('\n')

  // sort west to east: neighbours sit together, which helps the file compress
  out.sort((a, b) => a.x - b.x)

  const n = out.length
  const header = Buffer.alloc(16)
  header.write('NYCB', 0, 'ascii')
  header.writeUInt32LE(1, 4)
  header.writeUInt32LE(n, 8)
  const col16 = (f, signed) => {
    const b = Buffer.alloc(n * 2)
    out.forEach((o, i) => (signed ? b.writeInt16LE(f(o), i * 2) : b.writeUInt16LE(f(o), i * 2)))
    return b
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)))
  const body = [
    col16((o) => clamp(o.x * 64, -32768, 32767), true),
    col16((o) => clamp(o.z * 64, -32768, 32767), true),
    col16((o) => clamp(o.w * 256, 1, 65535)),
    col16((o) => clamp(o.d * 256, 1, 65535)),
    col16((o) => clamp(o.h * 10, 0, 65535)),
    col16((o) => clamp(o.year, 0, 65535)),
    Buffer.from(out.map((o) => clamp((o.ang / Math.PI) * 256, 0, 255) % 256)),
  ]
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, Buffer.concat([header, ...body]))

  const years = out.filter((o) => o.year > 0)
  const noHeight = out.filter((o) => o.h === 0).length
  console.log(
    `Wrote ${path.relative(process.cwd(), OUT)}: ${n.toLocaleString('en-US')} buildings ` +
      `(${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB); ` +
      `${(n - years.length).toLocaleString('en-US')} without a year, ${noHeight.toLocaleString('en-US')} without a height; ` +
      `left out ${skipped.feature.toLocaleString('en-US')} non-buildings, ${skipped.small.toLocaleString('en-US')} sheds, ${skipped.shape} bad shapes`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
