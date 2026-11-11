// Builds public/data/nyc-streets.bin — every real street, highway, path and
// alley on the map, as the city surveys them, in the project's own coordinates.
//
//   node scripts/build-nyc-streets.mjs [cache-dir]
//
// Source: NYC Office of Technology and Innovation, "Centerline" (CSCL, NYC Open
// Data, dataset inkn-q76z): the centre line of every street segment, with its
// roadway type and the width of its roadbed. With a cache directory the raw
// pages are saved there and reused, so the script can be re-run offline.
//
// The data has no year a street was laid. To let the History Timeline grow the
// streets, each segment carries the year the oldest buildings standing near it
// went up (from public/data/nyc-buildings.bin, so build that first). The app
// combines it with its own estimate of when the city reached that far
// (city/layout.ts): a street is at least as old as its oldest building.
//
// Kept: streets, highways, boardwalks, paths, step streets, ramps, alleys and
// U-turns that are built (status 2). Left out: bridges (drawn by the bridge
// layer), tunnels, driveways, ferry routes and "non-physical" segments.
//
// The file starts with a 16-byte header: "NYCS", a version (uint32), the
// segment count (uint32) and the total vertex count (uint32). Then, per
// segment, in columns:
//   kind    uint8   0 street, 1 highway, 2 path (paths, boardwalks, step streets), 3 ramp, 4 alley
//   width   uint8   roadbed width, in half metres (0 = not recorded)
//   year    uint16  the year the oldest buildings near it went up (0 = none near)
//   count   uint16  how many vertices its line has
// then every vertex, segment after segment:
//   x, z    int16   in 1/64 world units

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '../public/data/nyc-streets.bin')
const BUILDINGS = path.join(HERE, '../public/data/nyc-buildings.bin')
const API = 'https://data.cityofnewyork.us/resource/inkn-q76z.json'
const PAGE = 50000

// the map's extent, as in build-nyc-shore.mjs
const BOX = { west: -74.045, east: -73.8, south: 40.655, north: 40.885 }

// the projection, as in src/map/world/project.ts
const LAT0 = 40.7619
const LON0 = -73.9499
const KX = (111195 * Math.cos((LAT0 * Math.PI) / 180)) / 33.5
const KZ = 111195 / 33.5
const project = ([lon, lat]) => [(lon - LON0) * KX, -(lat - LAT0) * KZ]

const FEET = 0.3048

/** CSCL roadway types kept, and what the app calls them. */
const KIND = { 1: 0, 2: 1, 5: 2, 6: 2, 7: 2, 9: 3, 10: 4, 13: 0 }

/** How far round a street to look for its oldest buildings, world units (~85 m). */
const NEAR = 2.5
/** The oldest buildings: this share of the recorded years near it are older. */
const OLDEST_SHARE = 0.1

// ---------------------------------------------------------------- download --

async function page(offset, cacheDir) {
  const file = cacheDir && path.join(cacheDir, `centerline-${offset}.json`)
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  const url = new URL(API)
  url.searchParams.set('$select', 'the_geom,rw_type,status,streetwidth')
  url.searchParams.set('$where', `within_box(the_geom,${BOX.north},${BOX.west},${BOX.south},${BOX.east})`)
  url.searchParams.set('$order', 'objectid')
  url.searchParams.set('$limit', String(PAGE))
  url.searchParams.set('$offset', String(offset))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  const rows = await res.json()
  if (file) fs.writeFileSync(file, JSON.stringify(rows))
  return rows
}

// ---------------------------------------------------------------- buildings --

/** The real buildings' centres and recorded years, in a grid for looking up what stands near a point. */
function loadBuildings() {
  const buf = fs.readFileSync(BUILDINGS)
  if (buf.toString('ascii', 0, 4) !== 'NYCB') throw new Error('nyc-buildings.bin: bad header')
  const n = buf.readUInt32LE(8)
  const col = (k) => 16 + k * n * 2
  const cells = new Map()
  const CELL = NEAR
  const key = (i, j) => i * 100003 + j
  for (let i = 0; i < n; i++) {
    const year = buf.readUInt16LE(col(5) + i * 2)
    if (year < 1650 || year > 2030) continue
    const x = buf.readInt16LE(col(0) + i * 2) / 64
    const z = buf.readInt16LE(col(1) + i * 2) / 64
    const k = key(Math.floor(x / CELL), Math.floor(z / CELL))
    let list = cells.get(k)
    if (!list) cells.set(k, (list = []))
    list.push(x, z, year)
  }
  return (x, z) => {
    const years = []
    const ci = Math.floor(x / CELL)
    const cj = Math.floor(z / CELL)
    for (let i = ci - 1; i <= ci + 1; i++)
      for (let j = cj - 1; j <= cj + 1; j++) {
        const list = cells.get(key(i, j))
        if (!list) continue
        for (let k = 0; k < list.length; k += 3)
          if (Math.hypot(list[k] - x, list[k + 1] - z) < NEAR) years.push(list[k + 2])
      }
    if (years.length < 2) return 0
    years.sort((a, b) => a - b)
    return years[Math.floor(years.length * OLDEST_SHARE)]
  }
}

// ---------------------------------------------------------------- main --

async function main() {
  const cacheDir = process.argv[2]
  if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true })
  const oldestNear = loadBuildings()

  const out = []
  const skipped = { type: 0, status: 0, short: 0 }
  for (let offset = 0; ; offset += PAGE) {
    const rows = await page(offset, cacheDir)
    process.stdout.write(`\r${offset + rows.length} segments read`)
    for (const row of rows) {
      const kind = KIND[Number(row.rw_type)]
      if (kind === undefined) { skipped.type++; continue }
      if (String(row.status) !== '2') { skipped.status++; continue }
      for (const line of row.the_geom.coordinates) {
        // drop repeated points, then lines with nothing left
        const pts = []
        for (const p of line.map(project)) {
          const last = pts[pts.length - 1]
          if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.02) pts.push(p)
        }
        if (pts.length < 2) { skipped.short++; continue }
        const mid = pts[Math.floor(pts.length / 2)]
        const midPrev = pts[Math.floor(pts.length / 2) - 1] ?? pts[0]
        const mx = (mid[0] + midPrev[0]) / 2
        const mz = (mid[1] + midPrev[1]) / 2
        out.push({
          kind,
          width: Math.max(0, Number(row.streetwidth) || 0) * FEET,
          year: oldestNear(mx, mz),
          pts,
          x: mx,
        })
      }
    }
    if (rows.length < PAGE) break
  }
  process.stdout.write('\n')

  // west to east, so neighbours sit together in the file
  out.sort((a, b) => a.x - b.x)

  const n = out.length
  const nv = out.reduce((s, o) => s + o.pts.length, 0)
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)))
  const header = Buffer.alloc(16)
  header.write('NYCS', 0, 'ascii')
  header.writeUInt32LE(1, 4)
  header.writeUInt32LE(n, 8)
  header.writeUInt32LE(nv, 12)
  const kinds = Buffer.from(out.map((o) => o.kind))
  const widths = Buffer.from(out.map((o) => clamp(o.width * 2, 0, 255)))
  const years = Buffer.alloc(n * 2)
  const counts = Buffer.alloc(n * 2)
  out.forEach((o, i) => {
    years.writeUInt16LE(o.year, i * 2)
    counts.writeUInt16LE(Math.min(65535, o.pts.length), i * 2)
  })
  const verts = Buffer.alloc(nv * 4)
  let v = 0
  for (const o of out)
    for (const [x, z] of o.pts) {
      verts.writeInt16LE(clamp(x * 64, -32768, 32767), v)
      verts.writeInt16LE(clamp(z * 64, -32768, 32767), v + 2)
      v += 4
    }
  fs.writeFileSync(OUT, Buffer.concat([header, kinds, widths, years, counts, verts]))
  const perKind = [0, 0, 0, 0, 0]
  for (const o of out) perKind[o.kind]++
  console.log(
    `${n} lines, ${nv} vertices → ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`,
  )
  console.log(`streets ${perKind[0]}, highways ${perKind[1]}, paths ${perKind[2]}, ramps ${perKind[3]}, alleys ${perKind[4]}`)
  console.log(`left out: ${skipped.type} by type, ${skipped.status} not built, ${skipped.short} too short`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
