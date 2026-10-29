import type { Season } from '../trees/seasons'

/**
 * GRASS SETTINGS — the Grass section of the Terrain tab.
 *
 * Scale note: one world unit is ~33.5 m and the camera never comes closer than
 * ~670 m, so a single blade of grass would be far smaller than a pixel (see
 * Tutorials/Real-World Scale.md). Realistic grass at this scale is what a meadow
 * looks like from a drone or a plane: patchy colour, drier and lusher ground,
 * bare slopes, wind rolling across it. That's what these settings shape.
 */

export interface GrassSettings {
  /** Overall: 0 = parched straw, 1 = deep, well-watered green. */
  lushness: number
  /** How strongly the colour varies in patches across the island. */
  patchiness: number
  /** Fine surface grain that catches the light when you zoom in. */
  detail: number
  /** Light and dark bands that roll across the grass in the wind. */
  windSheen: number
  /** How readily steep slopes thin out to bare soil. */
  bareSlopes: number
  /** How much of the land is paved city instead of green. 0 = all parkland (the procedural world); 1 = a paved city with a street grid. Roosevelt Island stays green. */
  paving: number
  lushColor: string
  dryColor: string
  soilColor: string
}

export const GRASS_DEFAULTS: GrassSettings = {
  lushness: 0.6,
  patchiness: 0.6,
  detail: 0.5,
  windSheen: 0.5,
  bareSlopes: 0.5,
  paving: 0,
  lushColor: '#4f8a3a',
  dryColor: '#b3a45e',
  soilColor: '#7a6248',
}

export const GRASS_SLIDERS: {
  key: Exclude<keyof GrassSettings, 'lushColor' | 'dryColor' | 'soilColor'>
  label: string
  title: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'lushness', label: 'Lushness', title: 'Overall: 0 = parched straw, 1 = deep, well-watered green. Low ground near the water is always a little lusher than high ground.', min: 0, max: 1, step: 0.05 },
  { key: 'patchiness', label: 'Patchiness', title: 'How much the colour varies in patches across the island — dry spots, lush hollows.', min: 0, max: 1, step: 0.05 },
  { key: 'detail', label: 'Grain', title: 'Fine surface texture that catches the light when you zoom in close.', min: 0, max: 1, step: 0.05 },
  { key: 'windSheen', label: 'Wind sheen', title: 'Light and dark bands rolling across the grass as the wind blows. Stronger in stormy weather; none when calm.', min: 0, max: 1, step: 0.05 },
  { key: 'paving', label: 'Paving', title: 'How much of the land is paved city instead of green. 0 = everything parkland, like the procedural world. 1 = a paved grey city with a faint street grid (Roosevelt Island stays green).', min: 0, max: 1, step: 0.05 },
  { key: 'bareSlopes', label: 'Bare slopes', title: 'How readily steep slopes thin out to bare soil. 0 = grass clings everywhere.', min: 0, max: 1, step: 0.05 },
]

/**
 * How the season (the same control the trees use, on the Props tab) changes
 * the grass. `tint` is the colour it shifts toward, `mix` how far, and `dry`
 * pushes the whole meadow toward straw.
 */
export const GRASS_SEASONS: Record<Season, { tint: string; mix: number; dry: number }> = {
  spring: { tint: '#7cc44a', mix: 0.35, dry: -0.15 }, // fresh, bright new growth
  summer: { tint: '#4f8a3a', mix: 0, dry: 0 }, // as set by the sliders
  autumn: { tint: '#b59a52', mix: 0.4, dry: 0.25 }, // yellowing
  winter: { tint: '#8c8463', mix: 0.6, dry: 0.45 }, // dormant, dull straw-olive
}
