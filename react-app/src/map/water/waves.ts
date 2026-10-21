import { makeRng } from '../noise'

/**
 * WAVES — a small set of Gerstner waves, chosen from a seed.
 *
 * A plain sine wave just moves points up and down. A Gerstner wave also drags
 * each point sideways, towards the crest, which bunches the surface up into
 * sharp crests and flat troughs — it looks like real water. Adding four of them
 * together, each with its own direction and size, avoids any visible pattern.
 *
 * Each wave is described by:
 *   direction  which way it travels
 *   k          "wave number" = 2π ÷ wavelength (bigger k = shorter wave)
 *   weight     its share of the total height (the biggest swell dominates)
 *   speed      how fast the crests travel
 *
 * The directions are scattered around the main direction by the seed, so the
 * same terrain seed always gets the same sea.
 */

export const WAVE_COUNT = 4

// Each wave is shorter and lower than the one before it.
const WAVELENGTHS = [9, 5, 2.8, 1.6] // world units, before the Wave size slider
const WEIGHTS = [0.5, 0.3, 0.15, 0.05] // add up to 1
const SPREAD = [0.15, 0.5, 0.9, 1.3] // radians of scatter: small waves wander more

export interface Wave {
  dirX: number
  dirZ: number
  k: number
  weight: number
  /** Crest speed in world units per second (before the Speed slider). */
  speed: number
}

/** The four waves for a seed, travelling around `directionDeg`, scaled by `waveScale`. */
export function makeWaves(seed: number, directionDeg: number, waveScale: number): Wave[] {
  const rng = makeRng(seed * 31 + 7)
  const base = (directionDeg * Math.PI) / 180
  return WAVELENGTHS.map((len, i) => {
    const angle = base + (rng() * 2 - 1) * SPREAD[i]
    const wavelength = len * waveScale * (0.9 + rng() * 0.2)
    return {
      dirX: Math.cos(angle),
      dirZ: Math.sin(angle),
      k: (2 * Math.PI) / wavelength,
      weight: WEIGHTS[i],
      // longer waves travel faster (as in deep water, speed grows with √wavelength)
      speed: 0.35 * Math.sqrt(wavelength),
    }
  })
}
