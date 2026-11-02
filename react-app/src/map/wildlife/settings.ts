/**
 * WILDLIFE SETTINGS — the Wildlife tab.
 *
 * Three species live in the wild land around Roosevelt Island: birds that
 * flock, deer that graze, and foxes that hunt the deer. How many of each the
 * land can hold depends on how much of it is still wild, so as the History
 * Timeline paves the city, the animals are pushed back and thin out. See
 * sim.ts for how each one behaves.
 */

export interface WildlifeSettings {
  show: boolean
  /** Most birds the area holds when all of it is wild. */
  birds: number
  /** Most deer the area holds when all of it is wild. */
  deer: number
  /** Most foxes the area holds when all of it is wild. */
  foxes: number
  /**
   * How many times bigger than their real size the animals are drawn, on top
   * of the scale's objects factor. A real deer is ~1.9 m, about a twentieth of
   * a world unit: invisible from the camera without this.
   */
  size: number
  /** Tint every animal by its current state, and draw the foxes' cones of vision. */
  showStates: boolean
  /** Leave fading footprints on the ground. */
  tracks: boolean
}

export const WILDLIFE_DEFAULTS: WildlifeSettings = {
  show: true,
  birds: 140,
  deer: 60,
  foxes: 8,
  size: 12,
  showStates: false,
  tracks: true,
}

export const WILDLIFE_SLIDERS: {
  key: 'birds' | 'deer' | 'foxes' | 'size'
  label: string
  title: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'birds', label: 'Birds', title: 'How many birds the area holds when all of it is wild. Fewer live here as the city paves their habitat.', min: 0, max: 300, step: 10 },
  { key: 'deer', label: 'Deer', title: 'How many deer the area holds when all of it is wild.', min: 0, max: 150, step: 5 },
  { key: 'foxes', label: 'Foxes', title: 'How many foxes the area holds when all of it is wild. Foxes that catch nothing starve and leave.', min: 0, max: 30, step: 1 },
  { key: 'size', label: 'Size ×', title: 'How many times bigger than real the animals are drawn, so you can see them from the air. 1 = their real size at the chosen scale.', min: 1, max: 20, step: 1 },
]
