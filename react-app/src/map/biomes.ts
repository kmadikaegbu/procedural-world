import * as THREE from 'three'
import { BANDS } from './noise'

// Shared with both the smooth (Terrain.tsx) and blocky (VoxelTerrain.tsx)
// renderers, so a hill reads as the same biome regardless of which one draws it.
export const BIOME_COLORS = {
  water: new THREE.Color('#4a6d7c'),
  sand: new THREE.Color('#d9c8a0'),
  grass: new THREE.Color('#81b29a'),
  rock: new THREE.Color('#8a7f76'),
  snow: new THREE.Color('#f4efe6'),
  // the rest of the city: paved, built-up ground rather than parkland
  urban: new THREE.Color('#9299a1'), // cool concrete grey
}

export type BiomeRamp = { max: number; color: THREE.Color }[]

/**
 * Height → biome colour. Cut points scale with amplitude (see BANDS) and shift
 * with sea level, so raising/lowering the water floods or drains the coast
 * instead of just sliding a plane through unrelated-looking ground colours.
 */
export function makeRamp(amplitude: number, seaLevel: number): BiomeRamp {
  return [
    { max: seaLevel, color: BIOME_COLORS.water },
    { max: seaLevel + BANDS.sand * amplitude, color: BIOME_COLORS.sand },
    { max: seaLevel + BANDS.grass * amplitude, color: BIOME_COLORS.grass },
    { max: seaLevel + BANDS.rock * amplitude, color: BIOME_COLORS.rock },
    { max: Infinity, color: BIOME_COLORS.snow },
  ]
}

export function biomeColor(
  y: number,
  ramp: BiomeRamp,
  out: THREE.Color,
): THREE.Color {
  for (let b = 1; b < ramp.length; b++) {
    if (y <= ramp[b].max) {
      const lo = ramp[b - 1]
      const hi = ramp[b]
      const t = THREE.MathUtils.clamp((y - lo.max) / (hi.max - lo.max), 0, 1)
      return out.copy(lo.color).lerp(hi.color, t)
    }
  }
  return out.copy(ramp[ramp.length - 1].color)
}

/**
 * Ground colour with the city mixed in. `green` is 1 where there's parkland
 * (Roosevelt Island, or everywhere in the plain noise world) and 0 on the
 * built-up rest of the city, which gets a paved grey above the waterline.
 */
export function landColor(
  y: number,
  ramp: BiomeRamp,
  green: number,
  out: THREE.Color,
): THREE.Color {
  biomeColor(y, ramp, out)
  if (green >= 1) return out
  const sea = ramp[0].max
  // sand's height (0.08 × the terrain amplitude): the yardstick for "just above the
  // waterline", so this works the same at the readable and the true scale
  const sandTop = Math.max(ramp[1].max - sea, 1e-4)
  // paving fades in just above the waterline, so the river bed keeps its water colour
  const above = THREE.MathUtils.clamp((y - sea) / (0.8 * sandTop), 0, 1)
  const urban = BIOME_COLORS.urban
  // a touch lighter on higher ground
  const shade = 0.92 + THREE.MathUtils.clamp(((y - sea) / sandTop) * 0.2, 0, 0.16)
  return out.lerp(
    _urban.setRGB(urban.r * shade, urban.g * shade, urban.b * shade),
    (1 - green) * above,
  )
}
const _urban = new THREE.Color()
