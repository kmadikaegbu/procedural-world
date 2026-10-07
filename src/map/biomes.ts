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
