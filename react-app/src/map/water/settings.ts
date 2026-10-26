/**
 * WATER SETTINGS — everything the Water section of the Weather tab edits.
 *
 * Two of the numbers are also nudged by the weather on top of what you set:
 * wind makes the waves taller and choppier, and rain adds ripple rings and
 * speckle. So a storm preset looks rough without you touching a slider.
 */

export interface WaterSettings {
  /** Height of the waves in REAL METRES (scaled like the terrain's height — see scale.ts). */
  waveHeight: number
  /** 0 = rounded swells, 1 = sharp-crested, peaked waves. */
  choppiness: number
  /** Multiplier on how far apart wave crests are. */
  waveScale: number
  /** Multiplier on how fast the waves travel. */
  speed: number
  /** Direction the waves travel, in degrees (0 = east, 90 = south along the island). */
  direction: number
  /** Strength of the fine ripples that break up the reflections. */
  ripples: number
  /** How deep (world units) you can see before the water turns to its deep colour. */
  clarity: number
  /** Whitecaps on wave crests, and foam where water meets land. */
  foam: number
  /** How much the surface mirrors the sky at a shallow viewing angle. */
  reflection: number
  shallowColor: string
  deepColor: string
}

export const WATER_DEFAULTS: WaterSettings = {
  // 0.27 m of chop × the readable vertical factor (15) ≈ 0.12 world units
  waveHeight: 0.27,
  choppiness: 0.55,
  waveScale: 1,
  speed: 1,
  // the East River runs north–south past the island, so waves travel along it
  direction: 90,
  ripples: 0.5,
  clarity: 2,
  foam: 0.6,
  reflection: 0.5,
  shallowColor: '#5cc6c9',
  deepColor: '#124a72',
}

export const WATER_SLIDERS: {
  key: Exclude<keyof WaterSettings, 'shallowColor' | 'deepColor'>
  label: string
  title: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'waveHeight', label: 'Wave height', title: 'How tall the waves are, in real metres. Enlarged like the hills are (×15 at the readable scale), so waves stay in proportion to the land. Wind from the weather adds to this.', min: 0, max: 1.2, step: 0.01 },
  { key: 'choppiness', label: 'Choppiness', title: 'Rounded swells (0) versus sharp-crested, peaked waves (1).', min: 0, max: 1, step: 0.05 },
  { key: 'waveScale', label: 'Wave size', title: 'How far apart the wave crests are. Higher = long, lazy swells; lower = tight chop.', min: 0.4, max: 3, step: 0.05 },
  { key: 'speed', label: 'Wave speed', title: 'How fast the waves travel. 0 freezes them.', min: 0, max: 3, step: 0.1 },
  { key: 'direction', label: 'Direction', title: 'The way the waves travel, in degrees. 0 = east, 90 = south (along the island).', min: 0, max: 360, step: 5 },
  { key: 'ripples', label: 'Ripples', title: 'Fine surface ripples. They break up the sun glints and the sky reflection.', min: 0, max: 1, step: 0.05 },
  { key: 'clarity', label: 'Clarity', title: 'How deep you can see. Low = murky, turns dark blue quickly; high = clear shallows.', min: 0.3, max: 6, step: 0.1 },
  { key: 'foam', label: 'Foam', title: 'Whitecaps on the tallest waves, and foam lapping at the shoreline.', min: 0, max: 1, step: 0.05 },
  { key: 'reflection', label: 'Reflection', title: 'How much the water mirrors the sky when seen at a shallow angle.', min: 0, max: 1, step: 0.05 },
]
