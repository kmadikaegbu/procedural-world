/**
 * SIGNED DISTANCE FIELDS — "how far is this point from the coast?"
 *
 * The shoreline is a set of polygons (the outline of the land). Asking a polygon
 * "am I inside, and how far from the edge?" for every vertex of a big terrain
 * would be slow, so we do it once up front and keep the answers in a grid:
 *
 *   1. RASTERISE   paint the polygons into a grid: 1 = land, 0 = water.
 *   2. DISTANCE    for every cell, find the distance to the nearest cell of the
 *                  OTHER kind. (An exact method, Felzenszwalb–Huttenlocher, does
 *                  this in two quick passes over the grid.)
 *   3. SIGN        positive on land, negative in water. The coast is where it
 *                  crosses zero.
 *
 * Lookups then blend the four nearest cells (bilinear), so the answer is smooth
 * even though the grid is coarse — a coastline traced at ~13 m cells still
 * comes out as a clean curve.
 *
 * Everything here is plain arrays (no three.js), so it runs the same in the
 * browser and in Node tests.
 */

export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

/** A ring is a flat list [x0, z0, x1, z1, …] of whole numbers; divide by `precision` for world units. */
export type Ring = number[]

/** Paint polygon rings into a land/water grid (even–odd rule, so holes work). */
export function rasterise(rings: Ring[], precision: number, area: Rect, cell: number): { mask: Uint8Array; w: number; h: number } {
  const w = Math.ceil((area.x1 - area.x0) / cell)
  const h = Math.ceil((area.z1 - area.z0) / cell)
  const mask = new Uint8Array(w * h)

  // for each grid row, collect the x positions where polygon edges cross the row's centre line
  const crossings: number[][] = Array.from({ length: h }, () => [])
  for (const ring of rings) {
    const n = ring.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      let ax = ring[i * 2] / precision, az = ring[i * 2 + 1] / precision
      let bx = ring[j * 2] / precision, bz = ring[j * 2 + 1] / precision
      if (az === bz) continue // horizontal edges never cross a row centre
      if (az > bz) { [ax, bx] = [bx, ax]; [az, bz] = [bz, az] }
      // rows whose centre lies in [az, bz)
      const r0 = Math.max(0, Math.ceil((az - area.z0) / cell - 0.5))
      const r1 = Math.min(h - 1, Math.ceil((bz - area.z0) / cell - 0.5) - 1)
      for (let r = r0; r <= r1; r++) {
        const zc = area.z0 + (r + 0.5) * cell
        const t = (zc - az) / (bz - az)
        crossings[r].push(ax + t * (bx - ax))
      }
    }
  }
  for (let r = 0; r < h; r++) {
    const xs = crossings[r].sort((p, q) => p - q)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - area.x0) / cell - 0.5))
      const c1 = Math.min(w - 1, Math.ceil((xs[k + 1] - area.x0) / cell - 0.5) - 1)
      for (let c = c0; c <= c1; c++) mask[r * w + c] = 1
    }
  }
  return { mask, w, h }
}

const INF = 1e20

/** Exact squared distance to the nearest `feature` cell, for every cell (Felzenszwalb–Huttenlocher). */
function squaredDistance(mask: Uint8Array, w: number, h: number, featureValue: number): Float32Array {
  const d = new Float32Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = mask[i] === featureValue ? 0 : INF

  const n = Math.max(w, h)
  const f = new Float32Array(n)
  const out = new Float32Array(n)
  const v = new Int32Array(n)
  const z = new Float32Array(n + 1)

  // one-dimensional pass: lower envelope of parabolas
  const pass = (len: number) => {
    let k = 0
    v[0] = 0
    z[0] = -INF
    z[1] = INF
    for (let q = 1; q < len; q++) {
      let s: number
      for (;;) {
        const p = v[k]
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p)
        if (s <= z[k] && k > 0) k--
        else break
      }
      k++
      v[k] = q
      z[k] = s
      z[k + 1] = INF
    }
    k = 0
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++
      const p = v[k]
      out[q] = (q - p) * (q - p) + f[p]
    }
  }

  for (let x = 0; x < w; x++) { // columns
    for (let y = 0; y < h; y++) f[y] = d[y * w + x]
    pass(h)
    for (let y = 0; y < h; y++) d[y * w + x] = out[y]
  }
  for (let y = 0; y < h; y++) { // rows
    for (let x = 0; x < w; x++) f[x] = d[y * w + x]
    pass(w)
    for (let x = 0; x < w; x++) d[y * w + x] = out[x]
  }
  return d
}

/** A grid of signed distances (world units, positive on land) that can be sampled anywhere. */
export class Sdf {
  readonly data: Float32Array
  readonly area: Rect
  readonly cell: number
  readonly w: number
  readonly h: number
  /** What to answer outside the grid: far out in the water. */
  readonly outside: number
  constructor(area: Rect, cell: number, mask: Uint8Array, w: number, h: number, outside = -1000) {
    this.area = area
    this.cell = cell
    this.w = w
    this.h = h
    this.outside = outside
    const toWater = squaredDistance(mask, w, h, 0) // for land cells: distance to the nearest water cell
    const toLand = squaredDistance(mask, w, h, 1) // for water cells: distance to the nearest land cell
    this.data = new Float32Array(w * h)
    for (let i = 0; i < this.data.length; i++) {
      // a cell's centre is half a cell from the boundary between two cells
      this.data[i] = mask[i]
        ? (Math.sqrt(toWater[i]) - 0.5) * cell
        : -(Math.sqrt(toLand[i]) - 0.5) * cell
    }
  }

  /** Signed distance at world (x, z): bilinear blend of the four nearest cells. */
  sample(x: number, z: number): number {
    const gx = (x - this.area.x0) / this.cell - 0.5
    const gz = (z - this.area.z0) / this.cell - 0.5
    if (gx < -0.5 || gz < -0.5 || gx > this.w - 0.5 || gz > this.h - 0.5) return this.outside
    const i = Math.max(0, Math.min(this.w - 2, Math.floor(gx)))
    const j = Math.max(0, Math.min(this.h - 2, Math.floor(gz)))
    const fx = Math.max(0, Math.min(1, gx - i))
    const fz = Math.max(0, Math.min(1, gz - j))
    const k = j * this.w + i
    const a = this.data[k], b = this.data[k + 1]
    const c = this.data[k + this.w], d = this.data[k + this.w + 1]
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz
  }
}

export function buildSdf(rings: Ring[], precision: number, area: Rect, cell: number, outside?: number): Sdf {
  const { mask, w, h } = rasterise(rings, precision, area, cell)
  return new Sdf(area, cell, mask, w, h, outside)
}
