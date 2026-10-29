// Hydraulic erosion: simulate raindrops running downhill over the procedural
// height field, picking up sediment where the slope is steep and dropping it
// where the flow slows. The result is a grid of height OFFSETS (same shape as
// the terraform edits), so it layers on top of the noise without touching it:
// valleys deepen, sediment fans out below them, and ridges sharpen.

import { EDIT_GRID, type TerrainEdits } from './terraform'

// The simulation runs on the same grid as the sculpt edits (the whole city,
// ~1.2 units per cell), so its result is simply stored as a TerrainEdits.

// droplet tuning, in grid-cell units on heights normalised by amplitude
const INERTIA = 0.05 // how much a droplet keeps its heading vs. following the slope
const CAPACITY = 1.2 // sediment a droplet can carry per unit slope × speed × water
const MIN_CAPACITY_SLOPE = 0.01
const ERODE_RATE = 0.08
const DEPOSIT_RATE = 0.2
const EVAPORATE = 0.02
const GRAVITY = 4
const MAX_STEPS = 48
const RADIUS = 2 // erosion brush radius, in cells — smooths out pitting
const MAX_DEPTH = 0.3 // cap on |offset| as a fraction of amplitude
const FOCUS_SHARE = 0.5 // share of drops clustered around Roosevelt Island
const FOCUS_SPREAD = 32 // …and how far they spread, in cells (~38 world units)

/** mulberry32, local copy so this module doesn't import noise.ts (cycle). */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @param heightAt  procedural height in world units at (x, z) — no edits
 * @param landAt    0..1 weight of how much each spot may change (the island
 *                  mask), so the river bed and open water stay put
 * @param drops     number of droplets to simulate
 */
export function erode(
  heightAt: (x: number, z: number) => number,
  landAt: (x: number, z: number) => number,
  amplitude: number,
  drops: number,
  seed: number,
): TerrainEdits {
  const { w, h } = EDIT_GRID
  const amp = Math.max(amplitude, 0.001)

  const base = new Float32Array(w * h)
  const land = new Float32Array(w * h)
  for (let j = 0; j < h; j++) {
    const z = EDIT_GRID.z0 + j * EDIT_GRID.cell
    for (let i = 0; i < w; i++) {
      const x = EDIT_GRID.x0 + i * EDIT_GRID.cell
      // the river bed is flattened for the sim so droplets stop at the shore
      // instead of carving the cliff down to the seabed
      base[j * w + i] = Math.max(heightAt(x, z), 0) / amp
      land[j * w + i] = landAt(x, z)
    }
  }
  const map = Float32Array.from(base)

  // brush weights for spreading each erosion step over nearby cells
  const offsets: number[] = []
  const weights: number[] = []
  let wsum = 0
  for (let dj = -RADIUS; dj <= RADIUS; dj++) {
    for (let di = -RADIUS; di <= RADIUS; di++) {
      const d = Math.hypot(di, dj)
      if (d > RADIUS) continue
      const wt = 1 - d / (RADIUS + 1) // not `w`: that's the grid width, the row stride below
      offsets.push(dj * w + di)
      weights.push(wt)
      wsum += wt
    }
  }
  for (let k = 0; k < weights.length; k++) weights[k] /= wsum

  const rand = rng(seed * 9973 + 17)
  const lastX = w - 1
  const lastY = h - 1
  // where the map's origin (Roosevelt Island's centre) sits on the grid, in cells
  const originX = -EDIT_GRID.x0 / EDIT_GRID.cell
  const originZ = -EDIT_GRID.z0 / EDIT_GRID.cell

  // height + gradient at a fractional grid position (bilinear)
  const sampleAt = (px: number, py: number) => {
    const i = Math.floor(px)
    const j = Math.floor(py)
    const fx = px - i
    const fy = py - j
    const k = j * w + i
    const a = map[k]
    const b = map[k + 1]
    const c = map[k + w]
    const d = map[k + w + 1]
    return {
      h: (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy,
      gx: (b - a) * (1 - fy) + (d - c) * fy,
      gy: (c - a) * (1 - fx) + (d - b) * fx,
    }
  }

  // add `amount` (normalised height) around cell (ci, cj), weighted by the brush
  const spread = (ci: number, cj: number, amount: number) => {
    const centre = cj * w + ci
    for (let k = 0; k < offsets.length; k++) {
      const idx = centre + offsets[k]
      if (idx < 0 || idx >= w * h) continue
      const ii = idx % w
      if (Math.abs(ii - ci) > RADIUS) continue // wrapped across a row edge
      map[idx] += amount * weights[k] * land[idx]
    }
  }

  for (let drop = 0; drop < drops; drop++) {
    // Half the rain falls in a bell-shaped cluster around Roosevelt Island (the
    // map's origin), thinning smoothly outward; the rest anywhere. Spread evenly
    // over the whole city, a given drop count would barely mark the island.
    let px: number
    let py: number
    if (rand() < FOCUS_SHARE) {
      const rad = FOCUS_SPREAD * Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9)))
      const ang = rand() * Math.PI * 2
      px = originX + rad * Math.cos(ang)
      py = originZ + rad * Math.sin(ang)
      if (px < RADIUS || py < RADIUS || px > lastX - RADIUS - 1 || py > lastY - RADIUS - 1) continue
    } else {
      px = RADIUS + rand() * (lastX - 2 * RADIUS - 1)
      py = RADIUS + rand() * (lastY - 2 * RADIUS - 1)
    }
    // only rain on land: a droplet in the river has nothing to carve
    if (land[Math.floor(py) * w + Math.floor(px)] < 0.5) continue

    let dx = 0
    let dy = 0
    let speed = 1
    let water = 1
    let sediment = 0

    for (let step = 0; step < MAX_STEPS; step++) {
      const ci = Math.floor(px)
      const cj = Math.floor(py)
      const { h, gx, gy } = sampleAt(px, py)

      // steer along the downhill gradient, keeping a little momentum
      dx = dx * INERTIA - gx * (1 - INERTIA)
      dy = dy * INERTIA - gy * (1 - INERTIA)
      const len = Math.hypot(dx, dy)
      if (len < 1e-6) break
      dx /= len
      dy /= len

      const nx = px + dx
      const ny = py + dy
      if (nx < RADIUS || ny < RADIUS || nx >= lastX - RADIUS || ny >= lastY - RADIUS) break

      const dh = sampleAt(nx, ny).h - h // negative = downhill
      const capacity =
        Math.max(-dh, MIN_CAPACITY_SLOPE) * speed * water * CAPACITY

      if (sediment > capacity || dh > 0) {
        // uphill: fill the pit up to the step height; otherwise drop a share
        const amount =
          dh > 0
            ? Math.min(dh, sediment)
            : (sediment - capacity) * DEPOSIT_RATE
        sediment -= amount
        spread(ci, cj, amount)
      } else {
        // never carve deeper than the slope we just walked down
        const amount = Math.min((capacity - sediment) * ERODE_RATE, -dh)
        sediment += amount
        spread(ci, cj, -amount)
      }

      speed = Math.sqrt(Math.max(speed * speed + -dh * GRAVITY, 0))
      water *= 1 - EVAPORATE
      px = nx
      py = ny
    }
  }

  const data = new Float32Array(w * h)
  const cap = MAX_DEPTH * amp
  for (let k = 0; k < data.length; k++) {
    const d = (map[k] - base[k]) * amp
    data[k] = d > cap ? cap : d < -cap ? -cap : d
  }
  return { data }
}
