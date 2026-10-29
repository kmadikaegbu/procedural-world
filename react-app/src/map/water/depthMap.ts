import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from 'three'
import { height, type TerrainParams } from '../noise'
import type { Rect } from '../world/sdf'

/**
 * DEPTH MAP — a picture of the terrain's height, so the water knows how deep
 * it is at every point.
 *
 * The terrain is a function, height(x, z). The water shader can't call that
 * function, but it can read a texture. So we sample height() over an area once
 * into a small grayscale image (one byte per pixel) and hand that to the
 * shader. Depth at any point is then (sea level − the height stored there).
 *
 * We store the TERRAIN height, not the depth, so moving the sea level (the
 * climate timeline does this every frame) needs no rebuild — only a new uniform.
 * The map is rebuilt only when the terrain itself changes.
 *
 * Two maps are used: a fine one over the detail square around Roosevelt Island
 * (so its shore foam is crisp) and a coarse one over the whole city.
 */

export interface DepthMap {
  texture: DataTexture
  /** Terrain height that byte 0 stands for. */
  hMin: number
  /** Height span byte 255 stands for (so height = hMin + byte/255 × hRange). */
  hRange: number
  /** The world area the image covers. */
  area: Rect
}

export function buildDepthMap(params: TerrainParams, area: Rect, resX: number, resZ: number): DepthMap {
  const heights = new Float32Array(resX * resZ)
  const w = area.x1 - area.x0
  const h = area.z1 - area.z0
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j < resZ; j++) {
    for (let i = 0; i < resX; i++) {
      // pixel centre → world position; row j is z, column i is x
      const x = area.x0 + ((i + 0.5) / resX) * w
      const z = area.z0 + ((j + 0.5) / resZ) * h
      const v = height(x, z, params)
      heights[j * resX + i] = v
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  // a bytes-per-pixel image can't hold raw heights, so squeeze the actual
  // range (with a little margin) into 0–255
  const hMin = lo - 0.05
  const hRange = Math.max(hi - lo + 0.1, 0.01)
  const bytes = new Uint8Array(resX * resZ)
  for (let n = 0; n < bytes.length; n++) {
    bytes[n] = Math.round(((heights[n] - hMin) / hRange) * 255)
  }

  const texture = new DataTexture(bytes, resX, resZ, RedFormat, UnsignedByteType)
  texture.minFilter = LinearFilter // smooth between pixels, so no blocky shorelines
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return { texture, hMin, hRange, area }
}
