import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from 'three'
import { height, MAP_SIZE, type TerrainParams } from '../noise'

/**
 * DEPTH MAP — a picture of the terrain's height, so the water knows how deep
 * it is at every point.
 *
 * The terrain is a function, height(x, z). The water shader can't call that
 * function, but it can read a texture. So we sample height() over the whole map
 * once into a small grayscale image (one byte per pixel) and hand that to the
 * shader. Depth at any point is then (sea level − the height stored there).
 *
 * We store the TERRAIN height, not the depth, so moving the sea level (the
 * climate timeline does this every frame) needs no rebuild — only a new uniform.
 * The map is rebuilt only when the terrain itself changes (seed, sculpting…).
 */

export const DEPTH_RES = 256

export interface DepthMap {
  texture: DataTexture
  /** Terrain height that byte 0 stands for. */
  hMin: number
  /** Height span byte 255 stands for (so height = hMin + byte/255 × hRange). */
  hRange: number
}

export function buildDepthMap(params: TerrainParams): DepthMap {
  const res = DEPTH_RES
  const heights = new Float32Array(res * res)
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      // pixel centre → world position; row j is z, column i is x
      const x = ((i + 0.5) / res - 0.5) * MAP_SIZE
      const z = ((j + 0.5) / res - 0.5) * MAP_SIZE
      const h = height(x, z, params)
      heights[j * res + i] = h
      if (h < lo) lo = h
      if (h > hi) hi = h
    }
  }
  // a bytes-per-pixel image can't hold raw heights, so squeeze the actual
  // range (with a little margin) into 0–255
  const hMin = lo - 0.05
  const hRange = Math.max(hi - lo + 0.1, 0.01)
  const bytes = new Uint8Array(res * res)
  for (let n = 0; n < bytes.length; n++) {
    bytes[n] = Math.round(((heights[n] - hMin) / hRange) * 255)
  }

  const texture = new DataTexture(bytes, res, res, RedFormat, UnsignedByteType)
  texture.minFilter = LinearFilter // smooth between pixels, so no blocky shorelines
  texture.magFilter = LinearFilter
  texture.needsUpdate = true
  return { texture, hMin, hRange }
}
